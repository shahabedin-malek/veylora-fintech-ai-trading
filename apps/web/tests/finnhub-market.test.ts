import { afterEach, describe, expect, it, vi } from "vitest";

import { FinnhubProvider, finnhubConfigured, finnhubSymbol } from "@/lib/market/finnhub";
import { getQuotesSafe, getProvider } from "@/lib/market";

/**
 * Finnhub is the equity leg of the market data, so the properties that matter are:
 * only instruments it can actually price are asked for (forex is premium → not claimed),
 * a real quote is labelled `finnhub` and not offline, a symbol Finnhub does not know
 * degrades to the labelled offline generator, and the composite routes crypto to
 * CoinGecko and equities to Finnhub.
 */

const QUOTE = { c: 336.64, d: -3.78, dp: -1.1104, h: 338.61, l: 330.7, o: 331.695, pc: 340.42, t: 1791576000 };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("finnhubSymbol", () => {
  it("maps equities to their ticker and crypto to the exchange-prefixed symbol", () => {
    expect(finnhubSymbol("AAPL")).toBe("AAPL");
    expect(finnhubSymbol("btc")).toBe("BINANCE:BTCUSDT");
  });

  it("does not claim forex or unknown instruments (forex is premium on this plan)", () => {
    expect(finnhubSymbol("EURUSD")).toBeNull();
    expect(finnhubSymbol("NOPE")).toBeNull();
  });
});

describe("finnhubConfigured", () => {
  it("is false without a key and true with one", () => {
    vi.stubEnv("FINNHUB_API_KEY", "");
    expect(finnhubConfigured()).toBe(false);
    vi.stubEnv("FINNHUB_API_KEY", "test-key");
    expect(finnhubConfigured()).toBe(true);
  });
});

describe("FinnhubProvider.getQuotes", () => {
  it("returns labelled offline quotes when unconfigured (never a silent stand-in)", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const quotes = await new FinnhubProvider().getQuotes(["AAPL"]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({ symbol: "AAPL", source: "offline", offline: true });
  });

  it("normalises a real equity quote", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(QUOTE), { status: 200 })));

    const [quote] = await new FinnhubProvider().getQuotes(["AAPL"]);
    expect(quote).toMatchObject({
      symbol: "AAPL",
      name: "Apple Inc.",
      assetClass: "equity",
      priceUsd: 336.64,
      change24hPct: -1.11,
      high24hUsd: 338.61,
      low24hUsd: 330.7,
      source: "finnhub",
      offline: false,
      asOf: new Date(1791576000 * 1000).toISOString(),
    });
  });

  it("sends the key in a header, not the URL", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-key");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify(QUOTE), { status: 200 });
      })
    );

    await new FinnhubProvider().getQuotes(["AAPL"]);
    expect(calls[0].url).not.toContain("test-key");
    expect((calls[0].init.headers as Record<string, string>)["X-Finnhub-Token"]).toBe("test-key");
  });

  it("degrades to offline for a symbol Finnhub cannot price (c = 0 or a failure)", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ c: 0 }), { status: 200 })));

    const [quote] = await new FinnhubProvider().getQuotes(["AAPL"]);
    expect(quote.source).toBe("offline");
    expect(quote.offline).toBe(true);
  });

  it("degrades to offline when the request fails", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 403 })));

    const [quote] = await new FinnhubProvider().getQuotes(["AAPL"]);
    expect(quote.offline).toBe(true);
  });

  it("returns offline candles (the candle endpoints are premium on this plan)", async () => {
    const candles = await new FinnhubProvider().getCandles("AAPL", 12);
    expect(candles).toHaveLength(12);
    expect(candles.every((c) => c.offline === true)).toBe(true);
  });
});

describe("composite market provider", () => {
  const coingeckoQuote = [
    { symbol: "btc", name: "Bitcoin", current_price: 83000, price_change_percentage_24h: 1.2, high_24h: 0, low_24h: 0, total_volume: 0 },
  ];

  function stubBoth() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const href = String(url);
        if (href.includes("coingecko")) return new Response(JSON.stringify(coingeckoQuote), { status: 200 });
        if (href.includes("finnhub")) return new Response(JSON.stringify(QUOTE), { status: 200 });
        return new Response("unexpected", { status: 404 });
      })
    );
  }

  it("routes crypto to CoinGecko and equities to Finnhub", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-key");
    stubBoth();

    const { quotes } = await getQuotesSafe(["BTC", "AAPL"]);
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
    expect(bySymbol.get("BTC")).toMatchObject({ source: "coingecko", offline: false });
    expect(bySymbol.get("AAPL")).toMatchObject({ source: "finnhub", offline: false });
  });

  it("falls back to offline for equities when Finnhub is not configured", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "");
    stubBoth();

    const { quotes, degraded } = await getQuotesSafe(["AAPL"]);
    expect(quotes[0]).toMatchObject({ symbol: "AAPL", source: "offline", offline: true });
    expect(degraded).toBe(true);
  });

  it("never invents a quote for an instrument outside the catalog", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "test-key");
    stubBoth();

    const { quotes } = await getQuotesSafe(["BTC", "NOPE"]);
    expect(quotes.map((q) => q.symbol)).toEqual(["BTC"]);
  });

  it("is the provider selected by default", () => {
    expect(getProvider().id).toBe("auto");
  });
});
