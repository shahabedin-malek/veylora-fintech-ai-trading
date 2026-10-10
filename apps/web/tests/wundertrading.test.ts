import { afterEach, describe, expect, it, vi } from "vitest";

import {
  WUNDERTRADING_BASE_URL,
  buildSignaturePayload,
  postPosition,
  signPayload,
  wundertradingConfigured,
} from "@/lib/wundertrading/client";
import {
  WundertradingRefusedError,
  executeWundertradingOrder,
  validateWundertradingOrder,
  type WundertradingOrderInput,
} from "@/lib/wundertrading/orders";

/**
 * WunderTrading can open a **real position on a live exchange account**, so the
 * properties that matter are: the signed payload is exactly what goes on the wire, the
 * signature is Base64 HMAC-SHA256, an order without a stop loss never leaves the
 * process, and a cap breach is refused rather than trimmed.
 *
 * (The default `config.venue.spendLimits` are $1,000/order and $5,000/day — the
 * module-level config is read at import, so the cap tests use those defaults.)
 */

const KEY = "test-api-key";
const SECRET = "test-secret";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function configure() {
  vi.stubEnv("WUNDERTRADING_API_KEY", KEY);
  vi.stubEnv("WUNDERTRADING_SECRET_KEY", SECRET);
}

function order(over: Partial<WundertradingOrderInput> = {}): WundertradingOrderInput {
  return {
    exchangeCode: "BINANCE",
    pairCode: "BTCUSDT",
    profilesCodes: ["profile-1"],
    side: "buy",
    orderType: "MARKET",
    amountPerTrade: "10",
    amountPerTradeType: "PERCENT",
    stopLoss: "100.55",
    notionalCents: 25_000,
    spentTodayCents: 0,
    ...over,
  };
}

describe("buildSignaturePayload", () => {
  it("joins method, path, timestamp, recv window and body with newlines", () => {
    expect(
      buildSignaturePayload({
        method: "post",
        path: "/open_api/position",
        timestamp: 1_700_000_000_000,
        recvWindow: 60_000,
        body: '{"a":1}',
      })
    ).toBe('POST\n/open_api/position\n1700000000000\n60000\n{"a":1}');
  });

  it("uses an empty trailing segment for a bodyless request", () => {
    expect(
      buildSignaturePayload({ method: "GET", path: "/markets", timestamp: 1, recvWindow: 2, body: "" })
    ).toBe("GET\n/markets\n1\n2\n");
  });
});

describe("signPayload", () => {
  it("is Base64 HMAC-SHA256 over the payload", () => {
    const payload = buildSignaturePayload({
      method: "POST",
      path: "/open_api/position",
      timestamp: 1_700_000_000_000,
      recvWindow: 60_000,
      body: '{"a":1}',
    });
    expect(signPayload(SECRET, payload)).toBe("irgDYyiozk7PCQsfKSMq8vzR0lyTWikFIDDXyqMP4NY=");
  });

  it("changes when any signed segment changes", () => {
    const base = buildSignaturePayload({ method: "GET", path: "/markets", timestamp: 1, recvWindow: 2, body: "" });
    const other = buildSignaturePayload({ method: "GET", path: "/markets", timestamp: 3, recvWindow: 2, body: "" });
    expect(signPayload(SECRET, base)).not.toBe(signPayload(SECRET, other));
  });
});

describe("wundertradingConfigured", () => {
  it("is false unless both halves of the key pair are present", () => {
    vi.stubEnv("WUNDERTRADING_API_KEY", "");
    vi.stubEnv("WUNDERTRADING_SECRET_KEY", "");
    expect(wundertradingConfigured()).toBe(false);

    vi.stubEnv("WUNDERTRADING_API_KEY", KEY);
    expect(wundertradingConfigured()).toBe(false);

    vi.stubEnv("WUNDERTRADING_SECRET_KEY", SECRET);
    expect(wundertradingConfigured()).toBe(true);
  });
});

describe("validateWundertradingOrder", () => {
  it("accepts a well-formed order", () => {
    expect(validateWundertradingOrder(order())).toBeNull();
  });

  it("requires a stop loss with a price greater than zero", () => {
    expect(validateWundertradingOrder(order({ stopLoss: "" }))).toMatch(/stop loss/i);
    expect(validateWundertradingOrder(order({ stopLoss: "0" }))).toMatch(/stop loss/i);
    expect(validateWundertradingOrder(order({ stopLoss: "-5" }))).toMatch(/stop loss/i);
  });

  it("requires the core venue fields", () => {
    expect(validateWundertradingOrder(order({ exchangeCode: "  " }))).toMatch(/exchange/i);
    expect(validateWundertradingOrder(order({ pairCode: "" }))).toMatch(/pair/i);
    expect(validateWundertradingOrder(order({ profilesCodes: [] }))).toMatch(/profile/i);
    expect(validateWundertradingOrder(order({ orderType: "" }))).toMatch(/order type/i);
    expect(validateWundertradingOrder(order({ amountPerTrade: "0" }))).toMatch(/amount/i);
    expect(validateWundertradingOrder(order({ amountPerTradeType: "" }))).toMatch(/amount type/i);
  });

  it("rejects a non buy/sell side", () => {
    expect(validateWundertradingOrder(order({ side: "hold" as unknown as "buy" }))).toMatch(/buy or a sell/i);
  });

  it("accepts an absent take profit but rejects a non-positive one", () => {
    expect(validateWundertradingOrder(order({ takeProfit: undefined }))).toBeNull();
    expect(validateWundertradingOrder(order({ takeProfit: "" }))).toBeNull();
    expect(validateWundertradingOrder(order({ takeProfit: "0" }))).toMatch(/take profit/i);
  });

  it("requires a positive integer-cent notional", () => {
    expect(validateWundertradingOrder(order({ notionalCents: 0 }))).toMatch(/notional/i);
    expect(validateWundertradingOrder(order({ notionalCents: 12.5 }))).toMatch(/notional/i);
  });
});

describe("executeWundertradingOrder", () => {
  it("refuses an order with no stop loss without touching the venue", async () => {
    configure();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(executeWundertradingOrder(order({ stopLoss: "" }))).rejects.toBeInstanceOf(
      WundertradingRefusedError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an order over the per-transaction cap without touching the venue", async () => {
    configure();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // Default cap is $1,000 = 100,000 cents.
    await expect(executeWundertradingOrder(order({ notionalCents: 100_001 }))).rejects.toThrow(
      /exceeds the desk's real-money limit/i
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an order that would breach the rolling daily cap", async () => {
    configure();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      executeWundertradingOrder(order({ notionalCents: 25_000, spentTodayCents: 500_000 }))
    ).rejects.toBeInstanceOf(WundertradingRefusedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs and sends a valid order, covering the bytes on the wire", async () => {
    configure();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "pos_1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = await executeWundertradingOrder(order());

    expect(result).toEqual({ id: "pos_1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${WUNDERTRADING_BASE_URL}/position`);
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers["X-API-Key"]).toBe(KEY);
    expect(headers["X-Recv-Window"]).toBe("60000");
    expect(Number(headers["X-Timestamp"])).toBeGreaterThan(0);

    // The exact body is re-created and the signature must cover it.
    const body = init.body as string;
    const expected = buildSignaturePayload({
      method: "POST",
      path: "/position",
      timestamp: Number(headers["X-Timestamp"]),
      recvWindow: 60_000,
      body,
    });
    expect(headers["X-Signature"]).toBe(signPayload(SECRET, expected));
    expect(JSON.parse(body)).toMatchObject({ side: "buy", stopLoss: "100.55" });
  });
});

describe("postPosition", () => {
  it("fails closed when the venue is unconfigured (no request is made)", async () => {
    vi.stubEnv("WUNDERTRADING_API_KEY", "");
    vi.stubEnv("WUNDERTRADING_SECRET_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(postPosition({ pairCode: "BTCUSDT" })).rejects.toThrow(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
