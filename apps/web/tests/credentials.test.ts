import { afterEach, describe, expect, it, vi } from "vitest";

import {
  credentialEncryptionAvailable,
  decryptSecret,
  encryptSecret,
  fingerprintOf,
} from "@/lib/credentials/crypto";
import { PROVIDER_DEFS, providerDef, isReadOnly } from "@/lib/credentials/providers";
import { toBreakoutEvents } from "@/lib/signals/freecryptoapi";

/**
 * The key pool stores secrets, so the properties that matter are: a value round-trips
 * through AES-256-GCM, a tampered or wrong-key payload is rejected rather than guessed,
 * the store fails closed without `CREDENTIAL_ENCRYPTION_KEY`, and the fingerprint is
 * stable and non-reversible. The provider catalog must agree with the adopters.
 */

const HEX_KEY = "a".repeat(64);

afterEach(() => vi.unstubAllEnvs());

describe("credential crypto", () => {
  it("round-trips a field map", () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", HEX_KEY);
    const fields = { apiKey: "secret-value", secretKey: "another" };
    const payload = encryptSecret(fields);
    expect(payload).not.toContain("secret-value");
    expect(decryptSecret(payload)).toEqual(fields);
  });

  it("rejects a tampered payload", () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", HEX_KEY);
    const payload = encryptSecret({ apiKey: "x" });
    const bytes = Buffer.from(payload, "base64");
    bytes[bytes.length - 1] ^= 0xff; // flip a ciphertext bit
    expect(() => decryptSecret(bytes.toString("base64"))).toThrow();
  });

  it("rejects a payload encrypted under a different key", () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", HEX_KEY);
    const payload = encryptSecret({ apiKey: "x" });
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "b".repeat(64));
    expect(() => decryptSecret(payload)).toThrow();
  });

  it("fails closed when the encryption key is unset", () => {
    vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "");
    expect(credentialEncryptionAvailable()).toBe(false);
    expect(() => encryptSecret({ apiKey: "x" })).toThrow(/CREDENTIAL_ENCRYPTION_KEY/);
  });

  it("produces a stable, value-independent fingerprint", () => {
    const a = fingerprintOf({ apiKey: "one" });
    expect(a).toBe(fingerprintOf({ apiKey: "one" }));
    expect(a).not.toBe(fingerprintOf({ apiKey: "two" }));
    expect(a).not.toContain("one");
  });
});

describe("provider catalog", () => {
  it("covers the keyed providers and marks money movers", () => {
    const ids = PROVIDER_DEFS.map((d) => d.id);
    expect(ids).toContain("altfins");
    expect(ids).toContain("freecryptoapi");
    expect(ids).toContain("coinmarketcap");
    expect(ids).toContain("finnhub");
    expect(ids).toContain("wundertrading");
    expect(ids).toContain("coinbase-cdp");

    expect(providerDef("wundertrading")?.moneyMoving).toBe(true);
    expect(providerDef("coinbase-cdp")?.moneyMoving).toBe(true);
    expect(providerDef("altfins")?.moneyMoving).toBe(false);
    expect(isReadOnly("altfins")).toBe(true);
    expect(isReadOnly("wundertrading")).toBe(false);
  });

  it("declares the env var for every field", () => {
    for (const def of PROVIDER_DEFS) {
      expect(def.fields.length).toBeGreaterThan(0);
      for (const field of def.fields) expect(field.env).toMatch(/^[A-Z0-9_]+$/);
    }
  });
});

describe("FreeCryptoAPI breakout parsing", () => {
  it("turns directional breakout items on catalog instruments into events", () => {
    const events = toBreakoutEvents({
      status: "success",
      breakouts: [
        { symbol: "BTC", period: 50, direction: "bullish", price: "70000", date: "2026-10-10 09:00:00" },
        { symbol: "ETH", period: 200, direction: "bearish" },
        { symbol: "PEPE", period: 20, direction: "bullish" }, // outside the catalog
        { symbol: "SOL", period: 20 }, // no direction
      ],
    });
    expect(events.map((e) => [e.symbol, e.providerKey, e.direction])).toEqual([
      ["BTC", "FCA_BREAKOUT_SMA50", "bullish"],
      ["ETH", "FCA_BREAKOUT_SMA200", "bearish"],
    ]);
    expect(events[0].ts).toBe("2026-10-10T09:00:00.000Z");
  });

  it("yields nothing for the no-entitlement response", () => {
    expect(toBreakoutEvents({ status: false, error: "No access. Please upgrade your subscription" })).toEqual([]);
  });
});
