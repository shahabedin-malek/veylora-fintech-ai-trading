import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COINBASE_LOGIN_COPY,
  COINBASE_PROVIDER,
  coinbaseLoginEnabled,
  isCoinbaseConnector,
} from "@/lib/coinbase/login";
import {
  DEFAULT_MAX_AGE_MINUTES,
  coinbaseWebhookConfigured,
  parseCoinbaseEvent,
  verifyCoinbaseSignature,
} from "@/lib/coinbase/webhook";

/* ------------------------------------------------------------- coinbase login */

describe("Coinbase sign-in provider matching", () => {
  it("recognises the Coinbase connector by id or name, case-insensitively", () => {
    expect(isCoinbaseConnector({ id: "coinbaseWalletSDK", name: "Coinbase Wallet" })).toBe(true);
    expect(isCoinbaseConnector({ id: "xyz", name: "Coinbase" })).toBe(true);
    expect(isCoinbaseConnector({ id: "COINBASEWALLET", name: "Whatever" })).toBe(true);
  });

  it("does not claim other wallets", () => {
    expect(isCoinbaseConnector({ id: "metaMaskSDK", name: "MetaMask" })).toBe(false);
    expect(isCoinbaseConnector({ id: "walletConnect", name: "WalletConnect" })).toBe(false);
    expect(isCoinbaseConnector({ id: "injected", name: "Injected" })).toBe(false);
  });

  it("offers the entry point and exposes its label", () => {
    expect(COINBASE_PROVIDER).toBe("coinbase");
    expect(coinbaseLoginEnabled()).toBe(true);
    expect(COINBASE_LOGIN_COPY.button).toMatch(/coinbase/i);
  });
});

/* ---------------------------------------------------------- webhook signature */

const SECRET = "whsec_test_secret";
const NOW = 1_700_000_000_000;
const TIMESTAMP = Math.floor(NOW / 1000);
const HEADER_NAMES = "host content-type";
const HEADERS: Record<string, string> = {
  host: "veylora.example",
  "content-type": "application/json",
};
const BODY = JSON.stringify({
  eventID: "evt_0001",
  eventType: "payments.transfers.completed",
  timestamp: "2026-01-01T00:00:00Z",
  data: { transferId: "transfer_1", targetAsset: "usdc", targetAmount: "100.00" },
});

/** Build the `t=,h=,v1=` header the way Coinbase documents it. */
function sign(
  overrides: { body?: string; secret?: string; timestamp?: number; headerNames?: string; headers?: Record<string, string> } = {}
): string {
  const body = overrides.body ?? BODY;
  const secret = overrides.secret ?? SECRET;
  const timestamp = overrides.timestamp ?? TIMESTAMP;
  const headerNames = overrides.headerNames ?? HEADER_NAMES;
  const headers = overrides.headers ?? HEADERS;
  const headerValues = headerNames
    .split(" ")
    .map((name) => headers[name] ?? "")
    .join(".");
  const payload = `${timestamp}.${headerNames}.${headerValues}.${body}`;
  const v1 = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `t=${timestamp},h=${headerNames},v1=${v1}`;
}

function verify(header: string, overrides: Partial<Parameters<typeof verifyCoinbaseSignature>[0]> = {}) {
  return verifyCoinbaseSignature({
    rawBody: BODY,
    signatureHeader: header,
    secret: SECRET,
    headers: HEADERS,
    nowMs: NOW,
    ...overrides,
  });
}

describe("verifyCoinbaseSignature", () => {
  it("accepts a correctly signed, fresh delivery", () => {
    expect(verify(sign())).toBe(true);
  });

  it("rejects a tampered body", () => {
    const header = sign();
    expect(verify(header, { rawBody: BODY.replace("100.00", "9999.00") })).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    expect(verify(sign({ secret: "whsec_other" }))).toBe(false);
  });

  it("rejects a stale delivery (replay protection)", () => {
    const stale = NOW + (DEFAULT_MAX_AGE_MINUTES + 1) * 60 * 1000;
    expect(verify(sign(), { nowMs: stale })).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifyCoinbaseSignature({ rawBody: BODY, signatureHeader: null, secret: SECRET, headers: HEADERS })).toBe(false);
    expect(verifyCoinbaseSignature({ rawBody: BODY, signatureHeader: "", secret: SECRET, headers: HEADERS })).toBe(false);
    expect(verify("t=123,h=host")).toBe(false); // no v1
    expect(verify("garbage")).toBe(false);
  });

  it("rejects an empty secret rather than signing with nothing", () => {
    expect(verify(sign(), { secret: "" })).toBe(false);
  });

  it("signs a missing named header as the empty string", () => {
    // The reference implementation folds a named-but-absent header to "". A
    // signature computed the same way must still verify.
    const header = sign({ headerNames: "host x-absent", headers: { host: "veylora.example" } });
    expect(verify(header, { headers: { host: "veylora.example" } })).toBe(true);
  });

  it("rejects a value for a named header that does not match what was signed", () => {
    const header = sign();
    expect(verify(header, { headers: { ...HEADERS, host: "evil.example" } })).toBe(false);
  });
});

describe("parseCoinbaseEvent", () => {
  it("parses a JSON object", () => {
    expect(parseCoinbaseEvent(BODY)).toMatchObject({ eventID: "evt_0001" });
  });

  it("rejects non-object JSON and invalid JSON", () => {
    expect(parseCoinbaseEvent("not json")).toBeNull();
    expect(parseCoinbaseEvent("[1,2,3]")).toBeNull();
    expect(parseCoinbaseEvent("null")).toBeNull();
    expect(parseCoinbaseEvent('"a string"')).toBeNull();
  });
});

describe("coinbaseWebhookConfigured", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is false without a secret, so the endpoint accepts nothing", () => {
    vi.stubEnv("COINBASE_WEBHOOK_SECRET", "");
    expect(coinbaseWebhookConfigured()).toBe(false);
  });

  it("is true once a secret is set", () => {
    vi.stubEnv("COINBASE_WEBHOOK_SECRET", "whsec_live");
    expect(coinbaseWebhookConfigured()).toBe(true);
  });
});
