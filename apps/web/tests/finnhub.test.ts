import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deriveFinnhubEventId,
  finnhubEventType,
  finnhubWebhookConfigured,
  parseFinnhubEvent,
  verifyFinnhubSecret,
} from "@/lib/finnhub/webhook";

/**
 * Finnhub authenticates deliveries with a **static shared secret** in a header, not a
 * per-request HMAC. The properties that matter: an empty configured secret can never
 * authenticate anything, comparison is exact, and an unset secret disables the
 * receiver (fail closed).
 */

const SECRET = "db4umb1r01qm8empsqi0";
const BODY = JSON.stringify({ type: "trade", data: [{ s: "AAPL", p: 336.64, t: 1791576000, v: 100 }] });

afterEach(() => vi.unstubAllEnvs());

describe("verifyFinnhubSecret", () => {
  it("accepts an exact match", () => {
    expect(verifyFinnhubSecret({ provided: SECRET, secret: SECRET })).toBe(true);
  });

  it("rejects a mismatch, a missing header, or an empty configured secret", () => {
    expect(verifyFinnhubSecret({ provided: "wrong", secret: SECRET })).toBe(false);
    expect(verifyFinnhubSecret({ provided: undefined, secret: SECRET })).toBe(false);
    expect(verifyFinnhubSecret({ provided: "", secret: SECRET })).toBe(false);
    expect(verifyFinnhubSecret({ provided: SECRET, secret: "" })).toBe(false);
  });

  it("rejects a value of a different length without throwing", () => {
    expect(verifyFinnhubSecret({ provided: `${SECRET}x`, secret: SECRET })).toBe(false);
  });
});

describe("parseFinnhubEvent", () => {
  it("parses a JSON object", () => {
    expect(parseFinnhubEvent(BODY)).toMatchObject({ type: "trade" });
  });

  it("rejects non-object JSON and invalid JSON", () => {
    expect(parseFinnhubEvent("not json")).toBeNull();
    expect(parseFinnhubEvent("[1,2,3]")).toBeNull();
    expect(parseFinnhubEvent("null")).toBeNull();
    expect(parseFinnhubEvent('"a string"')).toBeNull();
  });
});

describe("finnhubEventType", () => {
  it("returns the type, or unknown when absent", () => {
    expect(finnhubEventType({ type: "news" })).toBe("news");
    expect(finnhubEventType({})).toBe("unknown");
    expect(finnhubEventType({ type: "  " })).toBe("unknown");
  });
});

describe("deriveFinnhubEventId", () => {
  it("is stable for an identical body (so a retry de-duplicates)", () => {
    expect(deriveFinnhubEventId(BODY)).toBe(deriveFinnhubEventId(BODY));
  });

  it("differs for a different body", () => {
    expect(deriveFinnhubEventId(BODY)).not.toBe(deriveFinnhubEventId(`${BODY} `));
  });

  it("is namespaced so it cannot collide with another provider's id", () => {
    expect(deriveFinnhubEventId(BODY).startsWith("finnhub:")).toBe(true);
  });
});

describe("finnhubWebhookConfigured", () => {
  it("is false without a secret, so the endpoint accepts nothing", () => {
    vi.stubEnv("FINNHUB_WEBHOOK_SECRET", "");
    expect(finnhubWebhookConfigured()).toBe(false);
  });

  it("is true once a secret is set", () => {
    vi.stubEnv("FINNHUB_WEBHOOK_SECRET", SECRET);
    expect(finnhubWebhookConfigured()).toBe(true);
  });
});
