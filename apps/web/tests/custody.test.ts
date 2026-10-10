import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  COINBASE_CDP_PROVIDER,
  CustodyUnavailableError,
  REAL_CUSTODY_IMPLEMENTED,
  SpendLimitExceededError,
  authorizeCustodySpend,
  custodyAvailable,
  custodyConfigured,
  custodyKeyReference,
  custodySpendLimits,
  evaluateSpend,
  getCustodySigner,
  requireCustody,
} from "@/lib/custody";

/**
 * Custody is a real-money boundary, so the properties are structural and tested
 * directly: no backend configured ⇒ no way to sign; an unknown backend ⇒ no way to
 * sign; a value over a spend cap ⇒ refused rather than trimmed. The provider SDK is
 * mocked so the *wiring* is exercised offline — there is no live Coinbase account in
 * CI, and the wallet key never reaches this app in any case.
 */

const cdp = vi.hoisted(() => {
  const account = {
    address: "0x000000000000000000000000000000000000dEaD" as const,
    sign: vi.fn(async () => "0xsignature" as const),
    signMessage: vi.fn(async () => "0xmessage-signature" as const),
    signTransaction: vi.fn(async () => "0xsigned-transaction" as const),
  };
  return {
    account,
    getOrCreateAccount: vi.fn(async () => account),
    constructed: vi.fn(),
  };
});

vi.mock("@coinbase/cdp-sdk", () => ({
  CdpClient: class {
    evm: { getOrCreateAccount: typeof cdp.getOrCreateAccount };
    constructor(options: unknown) {
      cdp.constructed(options);
      this.evm = { getOrCreateAccount: cdp.getOrCreateAccount };
    }
  },
}));

const LIMITS = { maxPerTransactionCents: 100_000, maxDailyCents: 500_000 };

function configureCdp(credentials = true) {
  vi.stubEnv("CUSTODY_PROVIDER", COINBASE_CDP_PROVIDER);
  vi.stubEnv("CUSTODY_KEY_ID", "veylora-hot-wallet");
  vi.stubEnv("CDP_API_KEY_ID", credentials ? "key-id" : "");
  vi.stubEnv("CDP_API_KEY_SECRET", credentials ? "key-secret" : "");
  vi.stubEnv("CDP_WALLET_SECRET", credentials ? "wallet-secret" : "");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

beforeEach(() => {
  vi.stubEnv("CUSTODY_PROVIDER", "");
  vi.stubEnv("CUSTODY_KEY_ID", "");
  vi.stubEnv("CDP_API_KEY_ID", "");
  vi.stubEnv("CDP_API_KEY_SECRET", "");
  vi.stubEnv("CDP_WALLET_SECRET", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("custody spend policy", () => {
  it("allows a movement within both caps", () => {
    expect(evaluateSpend({ amountCents: 1_000, spentTodayCents: 0, limits: LIMITS })).toEqual({
      allowed: true,
    });
  });

  it("allows a movement exactly at each cap (boundary is inclusive)", () => {
    expect(evaluateSpend({ amountCents: 100_000, spentTodayCents: 0, limits: LIMITS }).allowed).toBe(true);
    expect(evaluateSpend({ amountCents: 100_000, spentTodayCents: 400_000, limits: LIMITS }).allowed).toBe(true);
  });

  it("refuses a movement above the per-transaction cap instead of trimming it", () => {
    const decision = evaluateSpend({ amountCents: 100_001, spentTodayCents: 0, limits: LIMITS });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toMatch(/per-transaction/);
  });

  it("refuses a movement that would breach the daily cap", () => {
    const decision = evaluateSpend({ amountCents: 100_000, spentTodayCents: 450_000, limits: LIMITS });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toMatch(/daily/);
  });

  it("refuses a non-positive or non-integer amount", () => {
    for (const amountCents of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(evaluateSpend({ amountCents, spentTodayCents: 0, limits: LIMITS }).allowed).toBe(false);
    }
  });
});

describe("custody fails closed", () => {
  it("ships a real custody implementation", () => {
    expect(REAL_CUSTODY_IMPLEMENTED).toBe(true);
  });

  it("cannot sign with nothing configured", () => {
    expect(custodyKeyReference()).toBeNull();
    expect(custodyConfigured()).toBe(false);
    expect(custodyAvailable()).toBe(false);
    expect(() => requireCustody()).toThrow(CustodyUnavailableError);
    expect(() => authorizeCustodySpend(1_000, 0)).toThrow(CustodyUnavailableError);
  });

  it("cannot sign through an unknown provider", () => {
    vi.stubEnv("CUSTODY_PROVIDER", "aws-kms");
    vi.stubEnv("CUSTODY_KEY_ID", "some-opaque-key-id");
    expect(custodyKeyReference()).toEqual({ provider: "aws-kms", keyId: "some-opaque-key-id" });
    expect(custodyConfigured()).toBe(false);
    expect(custodyAvailable()).toBe(false);
    expect(() => requireCustody()).toThrow(/not a supported backend/);
  });

  it("cannot sign with the provider selected but credentials missing", () => {
    configureCdp(false);
    expect(custodyConfigured()).toBe(false);
    expect(custodyAvailable()).toBe(false);
    expect(() => requireCustody()).toThrow(/missing its credentials/);
  });

  it("checks the spend caps before demanding a signer", () => {
    // Well above the default per-transaction limit, so the spend policy refuses it
    // even though custody is fully configured.
    configureCdp(true);
    const tooLarge = custodySpendLimits().maxPerTransactionCents + 1;
    expect(() => authorizeCustodySpend(tooLarge, 0)).toThrow(SpendLimitExceededError);
  });
});

describe("the coinbase-cdp backend signs through the provider", () => {
  it("is available once selected and configured", () => {
    configureCdp(true);
    expect(custodyKeyReference()).toEqual({ provider: COINBASE_CDP_PROVIDER, keyId: "veylora-hot-wallet" });
    expect(custodyConfigured()).toBe(true);
    expect(custodyAvailable()).toBe(true);
    expect(requireCustody().provider).toBe(COINBASE_CDP_PROVIDER);
    expect(() => authorizeCustodySpend(1_000, 0)).not.toThrow();
  });

  it("resolves a signer that delegates signing to the provider-held key", async () => {
    configureCdp(true);
    const signer = await getCustodySigner();

    expect(signer.address).toBe("0x000000000000000000000000000000000000dEaD");
    // The account is looked up by the key reference, not a stored address.
    expect(cdp.getOrCreateAccount).toHaveBeenCalledWith({ name: "veylora-hot-wallet" });

    await expect(signer.sign({ hash: `0x${"11".repeat(32)}` })).resolves.toBe("0xsignature");
    await expect(signer.signMessage({ message: "hello" })).resolves.toBe("0xmessage-signature");
    await expect(signer.signTransaction({ to: "0x0000000000000000000000000000000000000001" })).resolves.toBe(
      "0xsigned-transaction"
    );
  });

  it("passes the API credentials to the SDK, never a wallet key", async () => {
    configureCdp(true);
    await getCustodySigner();
    expect(cdp.constructed).toHaveBeenCalledWith({
      apiKeyId: "key-id",
      apiKeySecret: "key-secret",
      walletSecret: "wallet-secret",
    });
  });
});

describe("the custody source never handles key material", () => {
  it("exposes only a key reference and a provider signer", () => {
    const dir = join(process.cwd(), "src", "lib", "custody");
    const source = walk(dir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    for (const forbidden of ["privateKey", "private_key", "seedPhrase", "mnemonic", "secretKey", "signingKey"]) {
      expect(source, `custody source must not carry ${forbidden}`).not.toContain(forbidden);
    }
  });
});
