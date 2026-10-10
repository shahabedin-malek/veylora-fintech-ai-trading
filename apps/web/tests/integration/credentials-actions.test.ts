import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * End-to-end coverage of the admin key pool: the server actions encrypt and store a key,
 * refuse without the encryption key, require every field, toggle and delete, and refuse a
 * non-admin — and, crucially, a key added **through the admin action** participates in the
 * resolver's rotation, so an exhausted key falls over to the backup.
 *
 * Only the Next framework boundary is mocked (cookies / redirect / revalidate); the
 * database, encryption and resolver are real.
 */

const h = vi.hoisted(() => ({ store: new Map<string, string>(), redirects: [] as string[] }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (h.store.has(name) ? { name, value: h.store.get(name)! } : undefined),
    set: (name: string, value: string) => void h.store.set(name, value),
    delete: (name: string) => void h.store.delete(name),
  }),
  headers: async () => new Headers({ host: "localhost:3210" }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    h.redirects.push(url);
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import {
  addProviderCredentialAction,
  deleteProviderCredentialAction,
  toggleProviderCredentialAction,
} from "@/lib/credentials/actions";
import { decryptSecret } from "@/lib/credentials/crypto";
import { ProviderRequestError, credentialCandidates, withCredential } from "@/lib/credentials/pool";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, createToken } from "@/lib/session";

const HEX_KEY = "d".repeat(64);
const CHAIN = 8453;
const ADMIN_WALLET = `0x${"44".repeat(20)}`;
const USER_WALLET = `0x${"55".repeat(20)}`;

let adminId: string;
let userId: string;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { walletAddress: { in: [ADMIN_WALLET, USER_WALLET] } } });
  const admin = await prisma.user.create({
    data: {
      walletAddress: ADMIN_WALLET,
      chainId: CHAIN,
      name: "Key Admin IT",
      role: "ADMIN",
      wallet: { create: { address: ADMIN_WALLET, kind: "MAINNET", network: "mainnet" } },
    },
  });
  adminId = admin.id;
  const user = await prisma.user.create({
    data: {
      walletAddress: USER_WALLET,
      chainId: CHAIN,
      name: "Key User IT",
      role: "USER",
      wallet: { create: { address: USER_WALLET, kind: "MAINNET", network: "mainnet" } },
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { walletAddress: { in: [ADMIN_WALLET, USER_WALLET] } } });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  h.redirects.length = 0;
  h.store.clear();
  await prisma.providerCredential.deleteMany({});
  await prisma.auditLog.deleteMany({ where: { actorId: { in: [adminId, userId] } } });
});

function signIn(id: string): void {
  h.store.set(SESSION_COOKIE, createToken(id, CHAIN));
}

function addForm(fields: Record<string, string>, extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("provider", "altfins");
  fd.set("label", "primary");
  for (const [key, value] of Object.entries(fields)) fd.set(`field:${key}`, value);
  for (const [key, value] of Object.entries(extra)) fd.set(key, value);
  return fd;
}

/** Redirects throw in the mock; the URL is read from `h.redirects`. */
async function run(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") return;
    throw error;
  }
}

describe("addProviderCredentialAction", () => {
  it("encrypts and stores a key, redirects, and audits it", async () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", HEX_KEY);
    signIn(adminId);

    await run(() => addProviderCredentialAction(addForm({ apiKey: "super-secret" })));

    expect(h.redirects.at(-1)).toBe("/admin/credentials?keys=added");
    const rows = await prisma.providerCredential.findMany({ where: { provider: "altfins" } });
    expect(rows).toHaveLength(1);
    // The stored value is ciphertext; only decrypting it in-process yields the key.
    expect(rows[0].secret).not.toContain("super-secret");
    expect(decryptSecret(rows[0].secret)).toEqual({ apiKey: "super-secret" });
    expect(rows[0].fingerprint).toHaveLength(12);
    expect(await prisma.auditLog.count({ where: { actorId: adminId, action: "provider-credential.added" } })).toBe(1);
  });

  it("refuses to store anything when the encryption key is unset (fail closed)", async () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "");
    signIn(adminId);

    await run(() => addProviderCredentialAction(addForm({ apiKey: "super-secret" })));

    expect(h.redirects.at(-1)).toBe("/admin/credentials?keys=no-key");
    expect(await prisma.providerCredential.count()).toBe(0);
  });

  it("requires every non-optional field", async () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", HEX_KEY);
    signIn(adminId);

    await run(() => addProviderCredentialAction(addForm({})));

    expect(h.redirects.at(-1)).toMatch(/keys=missing/);
    expect(await prisma.providerCredential.count()).toBe(0);
  });

  it("refuses a non-admin and stores nothing", async () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", HEX_KEY);
    signIn(userId);

    await expect(addProviderCredentialAction(addForm({ apiKey: "x" }))).rejects.toThrow(/FORBIDDEN/i);
    expect(await prisma.providerCredential.count()).toBe(0);
  });
});

describe("toggle / delete", () => {
  async function seed(): Promise<string> {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", HEX_KEY);
    signIn(adminId);
    await run(() => addProviderCredentialAction(addForm({ apiKey: "seed-key" })));
    const row = await prisma.providerCredential.findFirstOrThrow({ where: { provider: "altfins" } });
    return row.id;
  }

  it("disables and re-enables a key", async () => {
    const id = await seed();
    const toggle = new FormData();
    toggle.set("id", id);

    await run(() => toggleProviderCredentialAction(toggle));
    expect((await prisma.providerCredential.findUnique({ where: { id } }))?.enabled).toBe(false);
    expect((await prisma.providerCredential.findUnique({ where: { id } }))?.status).toBe("DISABLED");

    await run(() => toggleProviderCredentialAction(toggle));
    expect((await prisma.providerCredential.findUnique({ where: { id } }))?.enabled).toBe(true);
    expect((await prisma.providerCredential.findUnique({ where: { id } }))?.status).toBe("ACTIVE");
  });

  it("deletes a key and audits it", async () => {
    const id = await seed();
    const del = new FormData();
    del.set("id", id);

    await run(() => deleteProviderCredentialAction(del));

    expect(await prisma.providerCredential.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.auditLog.count({ where: { actorId: adminId, action: "provider-credential.deleted" } })).toBe(1);
  });
});

describe("keys added through the admin flow feed the resolver", () => {
  it("rotates to the backup added second when the first is rejected", async () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", HEX_KEY);
    vi.stubEnv("ALTFINS_API_KEY", ""); // no env candidate — the pool is the only source
    signIn(adminId);

    await run(() => addProviderCredentialAction(addForm({ apiKey: "primary-key" }, { label: "primary", priority: "10" })));
    h.redirects.length = 0;
    await run(() => addProviderCredentialAction(addForm({ apiKey: "backup-key" }, { label: "backup", priority: "20" })));

    const ordered = await credentialCandidates("altfins");
    expect(ordered.map((c) => c.label)).toEqual(["primary", "backup"]);

    const used: string[] = [];
    const result = await withCredential("altfins", async (values) => {
      used.push(values.apiKey);
      if (values.apiKey === "primary-key") throw new ProviderRequestError("429", 429);
      return values.apiKey;
    });

    expect(result).toBe("backup-key");
    expect(used).toEqual(["primary-key", "backup-key"]);

    // The exhausted key is cooled down and skipped on the next resolve.
    const primary = await prisma.providerCredential.findFirstOrThrow({ where: { label: "primary" } });
    expect(primary.status).toBe("COOLDOWN");
    const after = await credentialCandidates("altfins");
    expect(after.map((c) => c.label)).toEqual(["backup"]);
  });
});
