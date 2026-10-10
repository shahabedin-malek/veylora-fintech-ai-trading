import { afterEach, describe, expect, it, vi } from "vitest";

import { fingerprintOf } from "@/lib/credentials/crypto";
import { encryptSecret } from "@/lib/credentials/crypto";
import {
  ProviderRequestError,
  credentialCandidates,
  providerHasPoolKeySync,
  warmCredentialCache,
  withCredential,
} from "@/lib/credentials/pool";
import { prisma } from "@/lib/db";

/**
 * The pool exists so a rate-limited or revoked key does not take a feed down, so the
 * properties that matter are: candidates are ordered (env first, then priority), a
 * cooled-down key is skipped, a rejected key is cooled and the next candidate is used,
 * and a transport error does not burn through the pool.
 */

const KEY = "c".repeat(64);

async function add(provider: string, label: string, values: Record<string, string>, priority = 100) {
  return prisma.providerCredential.create({
    data: {
      provider,
      label,
      secret: encryptSecret(values),
      fingerprint: fingerprintOf(values),
      priority,
      enabled: true,
      status: "ACTIVE",
    },
  });
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await prisma.providerCredential.deleteMany({});
});

describe("credentialCandidates", () => {
  it("orders env first, then pool keys by priority", async () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", KEY);
    vi.stubEnv("ALTFINS_API_KEY", "env-key");
    await add("altfins", "low", { apiKey: "low" }, 200);
    await add("altfins", "high", { apiKey: "high" }, 10);

    const candidates = await credentialCandidates("altfins");
    expect(candidates.map((c) => (c.source === "env" ? "env" : c.label))).toEqual(["env", "high", "low"]);
    expect(candidates[0].values.apiKey).toBe("env-key");
  });

  it("skips a key that is inside its cooldown window", async () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", KEY);
    vi.stubEnv("ALTFINS_API_KEY", "");
    const row = await add("altfins", "cooling", { apiKey: "x" });
    await prisma.providerCredential.update({
      where: { id: row.id },
      data: { cooldownUntil: new Date(Date.now() + 60_000) },
    });
    expect(await credentialCandidates("altfins")).toHaveLength(0);
  });

  it("ignores a stored key when encryption is unavailable (fail closed)", async () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", KEY);
    await add("altfins", "pool", { apiKey: "x" });
    // The store is disabled once the key is gone; only the env candidate remains.
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "");
    vi.stubEnv("ALTFINS_API_KEY", "env-key");
    const candidates = await credentialCandidates("altfins");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].source).toBe("env");
  });
});

describe("withCredential", () => {
  it("rotates to a backup when a key is rejected, and cools the bad one", async () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", KEY);
    vi.stubEnv("ALTFINS_API_KEY", "");
    const bad = await add("altfins", "bad", { apiKey: "bad" }, 10);
    await add("altfins", "good", { apiKey: "good" }, 20);

    const seen: string[] = [];
    const result = await withCredential("altfins", async (values) => {
      seen.push(values.apiKey);
      if (values.apiKey === "bad") throw new ProviderRequestError("429", 429);
      return values.apiKey;
    });

    expect(result).toBe("good");
    expect(seen).toEqual(["bad", "good"]);

    const badRow = await prisma.providerCredential.findUnique({ where: { id: bad.id } });
    expect(badRow?.status).toBe("COOLDOWN");
    expect(badRow?.failureCount).toBe(1);
    expect(badRow?.cooldownUntil).toBeTruthy();
  });

  it("does not rotate on a transport error (not a credential problem)", async () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", KEY);
    vi.stubEnv("ALTFINS_API_KEY", "");
    await add("altfins", "a", { apiKey: "a" }, 10);
    await add("altfins", "b", { apiKey: "b" }, 20);

    let calls = 0;
    await expect(
      withCredential("altfins", async () => {
        calls += 1;
        throw new Error("network down");
      })
    ).rejects.toThrow("network down");
    expect(calls).toBe(1);
  });

  it("throws when no key is configured", async () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", KEY);
    vi.stubEnv("ALTFINS_API_KEY", "");
    await expect(withCredential("altfins", async () => "x")).rejects.toThrow(/not configured/i);
  });
});

describe("presence cache", () => {
  it("reflects a pool key after warming", async () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", KEY);
    await warmCredentialCache(["finnhub"]);
    expect(providerHasPoolKeySync("finnhub")).toBe(false);

    await add("finnhub", "k", { apiKey: "k" });
    await warmCredentialCache(["finnhub"]);
    expect(providerHasPoolKeySync("finnhub")).toBe(true);
  });
});
