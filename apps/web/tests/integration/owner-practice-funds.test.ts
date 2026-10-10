import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Integration tests for the two owner-only capabilities:
 *
 *   1. **Owner sign-in gating** — signing in on a practice network is accepted for a
 *      configured owner and refused (with the generic "unsupported network" message)
 *      for everyone else, while mainnet sign-in stays open to all. Signatures are
 *      real (viem recovers the address); SIWE nonces and the session run for real
 *      against the throwaway DB.
 *   2. **Owner practice-funds credit** — an owner credits their own account (balance,
 *      ledger, transaction, notification and audit all written), a replay is a no-op,
 *      an unconfirmed call writes nothing, and a non-owner is refused outright.
 *
 * Only the Next framework boundary is mocked (cookies / redirect / revalidate).
 */

const h = vi.hoisted(() => ({
  store: new Map<string, string>(),
  redirects: [] as string[],
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (h.store.has(name) ? { name, value: h.store.get(name)! } : undefined),
    set: (name: string, value: string) => {
      h.store.set(name, value);
    },
    delete: (name: string) => {
      h.store.delete(name);
    },
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

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { SESSION_COOKIE, createToken } from "@/lib/session";
import { issueNonce } from "@/lib/siwe";
import { buildSiweMessage } from "@/lib/eip4361";
import { ownerCreditPracticeFundsAction, verifySiweAction } from "@/lib/actions";

const BASE_MAINNET = 8453;
const SEPOLIA = 11155111; // a practice network ⇒ SANDBOX

/** The signing account we configure as the owner (its address is the owner). */
const ownerAccount = privateKeyToAccount(`0x${"11".repeat(32)}`);
/** A second signing account that is deliberately never an owner. */
const otherAccount = privateKeyToAccount(`0x${"22".repeat(32)}`);

const OWNER = ownerAccount.address.toLowerCase();
const OTHER = otherAccount.address.toLowerCase();
/** A plain (non-signing) account for the practice-funds non-owner case. */
const NON_OWNER_ACCOUNT = `0x${"33".repeat(20)}`;

let ownerUserId: string;
let nonOwnerUserId: string;

beforeAll(async () => {
  // A clean slate for the accounts these tests own.
  await prisma.user.deleteMany({ where: { walletAddress: { in: [OWNER, OTHER, NON_OWNER_ACCOUNT] } } });

  const owner = await prisma.user.create({
    data: {
      walletAddress: OWNER,
      chainId: BASE_MAINNET,
      name: "Owner IT",
      role: "ADMIN",
      wallet: { create: { address: OWNER, kind: "MAINNET", network: "mainnet" } },
    },
  });
  ownerUserId = owner.id;

  const nonOwner = await prisma.user.create({
    data: {
      walletAddress: NON_OWNER_ACCOUNT,
      chainId: BASE_MAINNET,
      name: "Non Owner IT",
      role: "USER",
      wallet: { create: { address: NON_OWNER_ACCOUNT, kind: "MAINNET", network: "mainnet" } },
    },
  });
  nonOwnerUserId = nonOwner.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { walletAddress: { in: [OWNER, OTHER, NON_OWNER_ACCOUNT] } } });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  h.redirects.length = 0;
  h.store.clear();
  for (const userId of [ownerUserId, nonOwnerUserId]) {
    if (!userId) continue;
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({ where: { actorId: userId } });
    await prisma.ledgerEntry.deleteMany({ where: { userId } });
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.idempotencyKey.deleteMany({ where: { userId } });
    await prisma.wallet.update({ where: { userId }, data: { balanceCents: 0 } });
  }
  await prisma.authNonce.deleteMany({});
});

/* ------------------------------------------------------ owner sign-in gating */

/** Sign a fresh SIWE message for `account` on `chainId`. */
async function signedMessage(account: typeof ownerAccount, chainId: number) {
  const nonce = await issueNonce();
  const message = buildSiweMessage({
    domain: "localhost:3210",
    address: account.address,
    uri: "http://localhost:3210",
    chainId,
    nonce,
  });
  const signature = await account.signMessage({ message });
  return { message, signature };
}

async function attemptSignIn(account: typeof ownerAccount, chainId: number) {
  const { message, signature } = await signedMessage(account, chainId);
  try {
    return await verifySiweAction({ message, signature });
  } catch (error) {
    // A successful action redirects, which the mock surfaces as a thrown error.
    if (error instanceof Error && error.message === "NEXT_REDIRECT") return undefined;
    throw error;
  }
}

describe("owner sign-in gating", () => {
  it("refuses a practice network for a wallet that is not the owner", async () => {
    vi.stubEnv("OWNER_WALLET_ADDRESSES", OWNER);
    const result = await attemptSignIn(otherAccount, SEPOLIA);

    expect(result).toEqual({
      error: "That network is not supported. Switch to Ethereum, Base or Arbitrum.",
    });
    expect(h.redirects).toEqual([]);
    expect(h.store.has(SESSION_COOKIE)).toBe(false);
    expect(await prisma.user.findUnique({ where: { walletAddress: OTHER } })).toBeNull();
  });

  it("accepts a practice network for the owner and routes them to /admin", async () => {
    vi.stubEnv("OWNER_WALLET_ADDRESSES", OWNER);
    const result = await attemptSignIn(ownerAccount, SEPOLIA);

    expect(result).toBeUndefined();
    expect(h.redirects.at(-1)).toBe("/admin");
    expect(h.store.has(SESSION_COOKIE)).toBe(true);
    const user = await prisma.user.findUnique({ where: { walletAddress: OWNER } });
    expect(user?.role).toBe("ADMIN");
    expect(user?.chainId).toBe(SEPOLIA);
  });

  it("refuses a practice network when no owner is configured", async () => {
    vi.stubEnv("OWNER_WALLET_ADDRESSES", "");
    const result = await attemptSignIn(otherAccount, SEPOLIA);

    expect(result).toMatchObject({ error: expect.stringMatching(/not supported/i) });
    expect(h.store.has(SESSION_COOKIE)).toBe(false);
  });

  it("still accepts a mainnet wallet that is not the owner", async () => {
    vi.stubEnv("OWNER_WALLET_ADDRESSES", OWNER);
    const result = await attemptSignIn(otherAccount, BASE_MAINNET);

    expect(result).toBeUndefined();
    expect(h.redirects.at(-1)).toBe("/dashboard");
    const user = await prisma.user.findUnique({ where: { walletAddress: OTHER } });
    expect(user?.role).toBe("USER");
  });
});

/* ------------------------------------------- practice session is owner-only */

describe("getCurrentUser on a practice session", () => {
  /** Put a real signed session cookie in the mocked cookie jar. */
  function signInAs(userId: string, chainId: number) {
    h.store.set(SESSION_COOKIE, createToken(userId, chainId));
  }

  it("fails closed when the session's practice chain belongs to a non-owner", async () => {
    vi.stubEnv("OWNER_WALLET_ADDRESSES", OWNER);
    signInAs(nonOwnerUserId, SEPOLIA);

    // The account exists and the session is validly signed — only the owner rule
    // rejects it, so the caller sees a signed-out user rather than a practice session.
    expect(await prisma.user.findUnique({ where: { id: nonOwnerUserId } })).not.toBeNull();
    expect(await getCurrentUser()).toBeNull();
  });

  it("fails closed for a practice session when no owner is configured", async () => {
    vi.stubEnv("OWNER_WALLET_ADDRESSES", "");
    signInAs(ownerUserId, SEPOLIA);

    expect(await getCurrentUser()).toBeNull();
  });

  it("returns the session to the owner signed in on a practice chain", async () => {
    vi.stubEnv("OWNER_WALLET_ADDRESSES", OWNER);
    signInAs(ownerUserId, SEPOLIA);

    const user = await getCurrentUser();
    expect(user?.id).toBe(ownerUserId);
    expect(user?.isOwner).toBe(true);
    expect(user?.network).toBe("SANDBOX");
  });

  it("returns the session to a non-owner signed in on mainnet", async () => {
    vi.stubEnv("OWNER_WALLET_ADDRESSES", OWNER);
    signInAs(nonOwnerUserId, BASE_MAINNET);

    const user = await getCurrentUser();
    expect(user?.id).toBe(nonOwnerUserId);
    expect(user?.isOwner).toBe(false);
    expect(user?.network).toBe("MAINNET");
  });
});

/* ---------------------------------------------------- owner practice funds */

function practiceForm(fields: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("confirm", "on");
  fd.set("idempotencyKey", crypto.randomUUID());
  fd.set("amount", "500");
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function runCredit(form: FormData): Promise<void> {
  try {
    await ownerCreditPracticeFundsAction(form);
  } catch {
    /* the mocked redirect throws; the URL is asserted from h.redirects */
  }
}

describe("ownerCreditPracticeFundsAction", () => {
  it("credits the owner and writes balance, ledger, transaction, notification and audit", async () => {
    vi.stubEnv("OWNER_WALLET_ADDRESSES", OWNER);
    h.store.set(SESSION_COOKIE, createToken(ownerUserId, BASE_MAINNET));

    await runCredit(practiceForm({ amount: "500" }));

    expect(h.redirects.at(-1)).toBe("/admin?owner=credited");
    const wallet = await prisma.wallet.findUnique({ where: { userId: ownerUserId } });
    expect(wallet?.balanceCents).toBe(50_000);
    expect(await prisma.ledgerEntry.count({ where: { userId: ownerUserId, note: "Owner practice funds" } })).toBe(1);
    expect(await prisma.transaction.count({ where: { userId: ownerUserId, detail: "Owner practice funds (no real value)" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: ownerUserId } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { actorId: ownerUserId, action: "owner.practice_funds" } })).toBe(1);
  });

  it("refuses a non-owner and writes nothing", async () => {
    vi.stubEnv("OWNER_WALLET_ADDRESSES", OWNER); // the non-owner account is not in the list
    h.store.set(SESSION_COOKIE, createToken(nonOwnerUserId, BASE_MAINNET));

    await expect(ownerCreditPracticeFundsAction(practiceForm())).rejects.toThrow("FORBIDDEN");

    const wallet = await prisma.wallet.findUnique({ where: { userId: nonOwnerUserId } });
    expect(wallet?.balanceCents ?? 0).toBe(0);
    expect(await prisma.ledgerEntry.count({ where: { userId: nonOwnerUserId } })).toBe(0);
  });

  it("applies a replayed idempotency key at most once", async () => {
    vi.stubEnv("OWNER_WALLET_ADDRESSES", OWNER);
    h.store.set(SESSION_COOKIE, createToken(ownerUserId, BASE_MAINNET));

    const form = practiceForm({ amount: "100" });
    const key = form.get("idempotencyKey") as string;
    await runCredit(form);
    h.redirects.length = 0;
    // A replay re-uses the key (as a refresh would).
    const replay = practiceForm({ amount: "100" });
    replay.set("idempotencyKey", key);

    await runCredit(replay);

    expect(h.redirects.at(-1)).toBe("/admin?owner=duplicate");
    const wallet = await prisma.wallet.findUnique({ where: { userId: ownerUserId } });
    expect(wallet?.balanceCents).toBe(10_000); // once, not twice
  });

  it("writes nothing without the explicit confirmation", async () => {
    vi.stubEnv("OWNER_WALLET_ADDRESSES", OWNER);
    h.store.set(SESSION_COOKIE, createToken(ownerUserId, BASE_MAINNET));

    await runCredit(practiceForm({ confirm: "" }));

    expect(h.redirects).toEqual([]);
    const wallet = await prisma.wallet.findUnique({ where: { userId: ownerUserId } });
    expect(wallet?.balanceCents).toBe(0);
  });

  it("refuses an amount above the per-credit cap", async () => {
    vi.stubEnv("OWNER_WALLET_ADDRESSES", OWNER);
    h.store.set(SESSION_COOKIE, createToken(ownerUserId, BASE_MAINNET));

    await runCredit(practiceForm({ amount: "999999" }));

    expect(h.redirects.at(-1)).toBe("/admin?owner=cap");
    const wallet = await prisma.wallet.findUnique({ where: { userId: ownerUserId } });
    expect(wallet?.balanceCents).toBe(0);
  });
});
