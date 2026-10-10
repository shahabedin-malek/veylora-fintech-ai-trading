import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TaapiProvider,
  taapiConfigured,
  taapiSymbol,
  toMacdEvent,
  toRsiEvent,
} from "@/lib/signals/taapi";

/**
 * TAAPI supplies indicator *readings*, so the properties that matter are: the vendor's
 * symbol/param conventions are respected, a reading becomes a **neutral** context event
 * (never a directional call), an unrecognised shape yields nothing rather than a guessed
 * value, and an unconfigured provider makes no request.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("TAAPI helpers", () => {
  it("maps a crypto instrument to TAAPI's no-slash symbol", () => {
    expect(taapiSymbol("BTC")).toBe("BTCUSDT");
    expect(taapiSymbol("btc")).toBe("BTCUSDT");
    expect(taapiSymbol("AAPL")).toBeNull(); // equities are not claimed
  });

  it("is inert without a key and available with one", () => {
    vi.stubEnv("TAAPI_API_KEY", "");
    expect(taapiConfigured()).toBe(false);
    vi.stubEnv("TAAPI_API_KEY", "k");
    expect(taapiConfigured()).toBe(true);
  });
});

describe("TAAPI parsing", () => {
  it("parses an RSI reading into a neutral event", () => {
    const event = toRsiEvent({ value: 62.3 }, "BTC");
    expect(event).toMatchObject({ provider: "taapi", providerKey: "TAAPI_RSI", symbol: "BTC", direction: "neutral" });
    expect(event?.name).toBe("RSI 62.3");
  });

  it("parses a MACD reading into a neutral event", () => {
    const event = toMacdEvent({ valueMACD: 1.2, valueMACDSignal: 0.8, valueMACDHist: 0.4 }, "ETH");
    expect(event).toMatchObject({ providerKey: "TAAPI_MACD", symbol: "ETH", direction: "neutral" });
    expect(event?.name).toContain("MACD 1.2");
    expect(event?.name).toContain("signal 0.8");
  });

  it("yields nothing for an unrecognised shape", () => {
    expect(toRsiEvent({ nope: true }, "BTC")).toBeNull();
    expect(toMacdEvent({ nope: true }, "BTC")).toBeNull();
    expect(toRsiEvent("nope", "BTC")).toBeNull();
  });
});

describe("TaapiProvider.getSignals", () => {
  it("makes no request when unconfigured", async () => {
    vi.stubEnv("TAAPI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await new TaapiProvider().getSignals({ symbols: ["BTC"] })).toEqual({ events: [], unmapped: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks for RSI and MACD with the documented params and bearer key", async () => {
    vi.stubEnv("TAAPI_API_KEY", "taapi-key");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return url.includes("/rsi") ? json({ value: 55.5 }) : json({ valueMACD: 0.1, valueMACDSignal: 0.2 });
      })
    );

    const batch = await new TaapiProvider().getSignals({ symbols: ["BTC", "AAPL"] });
    expect(batch.events.map((e) => e.providerKey)).toEqual(["TAAPI_RSI", "TAAPI_MACD"]);
    // Non-crypto filtered; the endpoint, timeframe and no-slash symbol are correct.
    expect(calls).toHaveLength(2);
    const rsi = calls.find((c) => c.url.includes("/indicator/rsi"));
    expect(rsi?.url).toContain("symbol=BTCUSDT");
    expect(rsi?.url).toContain("timeframe=1h");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer taapi-key");
    expect(calls.every((c) => !c.url.includes("AAPL"))).toBe(true);
  });

  it("throws on a rejected key so the caller can degrade or rotate", async () => {
    vi.stubEnv("TAAPI_API_KEY", "taapi-key");
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Invalid or inactive token" }, 401)));
    await expect(new TaapiProvider().getSignals({ symbols: ["BTC"] })).rejects.toThrow(/taapi/);
  });
});
