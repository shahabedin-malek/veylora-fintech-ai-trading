import { afterEach, describe, expect, it, vi } from "vitest";

import { assessRisk } from "@/lib/risk/assess";
import { CoinGeckoDerivedProvider } from "@/lib/signals/coingecko-signals";
import { CoinMarketCapProvider } from "@/lib/signals/coinmarketcap";
import { catalogSymbol, isoOrNull, parseDecimal, toMoveEvent } from "@/lib/signals/derive";
import {
  FreeCryptoApiProvider,
  freecryptoapiConfigured,
  toFearGreedEvent,
  toTechnicalEvent,
} from "@/lib/signals/freecryptoapi";

/**
 * The desk must keep receiving honest market context when a keyed signal API is
 * unavailable, so the properties that matter are: a reading only becomes an event past
 * the threshold, the event is **neutral** (so it can never drive the risk gate's bearish
 * breadth), an unconfigured keyed provider makes no request, and every provider degrades
 * by throwing to the safe wrapper instead of fabricating.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/* ---------------------------------------------------------------- derive helpers */

describe("derive helpers", () => {
  it("parses numeric strings with currency/percent decorations", () => {
    expect(parseDecimal("109.83")).toBe(109.83);
    expect(parseDecimal("$70,000")).toBe(70000);
    expect(parseDecimal("-8.5%")).toBe(-8.5);
    expect(parseDecimal("n/a")).toBeUndefined();
    expect(parseDecimal(null)).toBeUndefined();
  });

  it("normalises vendor timestamps, including the space-separated form", () => {
    expect(isoOrNull("2026-10-10 09:00:00")).toBe("2026-10-10T09:00:00.000Z");
    expect(isoOrNull("2026-10-10T09:00:00Z")).toBe("2026-10-10T09:00:00.000Z");
    expect(isoOrNull("nope")).toBeNull();
  });

  it("maps a ticker onto the catalog and rejects anything outside it", () => {
    expect(catalogSymbol("btc")).toBe("BTC");
    expect(catalogSymbol("PEPE")).toBeNull();
  });
});

describe("toMoveEvent", () => {
  it("emits nothing below the threshold", () => {
    expect(toMoveEvent({ provider: "x", reading: { symbol: "BTC", change24hPct: 3 }, thresholdPct: 5 })).toBeNull();
  });

  it("emits a neutral event at or past the threshold", () => {
    const event = toMoveEvent({
      provider: "coingecko-derived",
      reading: { symbol: "BTC", change24hPct: -8.5, priceUsd: 70000, asOf: "2026-10-10T09:00:00.000Z" },
      thresholdPct: 5,
      raw: { derived: true },
    });
    expect(event).toMatchObject({
      provider: "coingecko-derived",
      providerKey: "MARKET_MOVE_24H",
      symbol: "BTC",
      direction: "neutral",
      changePct: -8.5,
      ts: "2026-10-10T09:00:00.000Z",
    });
    expect(event?.name).toMatch(/24h move -8.50%/);
  });

  it("drops a reading for an instrument outside the catalog", () => {
    expect(toMoveEvent({ provider: "x", reading: { symbol: "PEPE", change24hPct: 40 }, thresholdPct: 5 })).toBeNull();
  });
});

/* ------------------------------------------------------- keyless alternates */

describe("CoinGeckoDerivedProvider", () => {
  it("emits a neutral move from a real CoinGecko markets payload", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return json([
          { symbol: "btc", current_price: 70000, price_change_percentage_24h: -8.5, last_updated: "2026-10-10T09:00:00.000Z" },
          { symbol: "eth", current_price: 2500, price_change_percentage_24h: 0.4, last_updated: "2026-10-10T09:00:00.000Z" },
        ]);
      })
    );

    const batch = await new CoinGeckoDerivedProvider().getSignals({ symbols: ["BTC", "ETH", "AAPL"] });
    // Only crypto is requested, and only the >5% move becomes an event.
    expect(batch.events).toHaveLength(1);
    expect(batch.events[0]).toMatchObject({ symbol: "BTC", direction: "neutral", providerKey: "MARKET_MOVE_24H" });
    expect(calls[0]).toContain("ids=bitcoin");
    expect(calls[0]).not.toContain("apple");
  });

  it("throws on a non-2xx response so the caller can degrade", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 429 })));
    await expect(new CoinGeckoDerivedProvider().getSignals({ symbols: ["BTC"] })).rejects.toThrow(/coingecko/);
  });

  it("asks nothing when only non-crypto instruments are requested", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await new CoinGeckoDerivedProvider().getSignals({ symbols: ["AAPL", "EURUSD"] })).toEqual({
      events: [],
      unmapped: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/* --------------------------------------------------------- keyed alternates */

describe("FreeCryptoApiProvider", () => {
  it("is inert (and makes no request) without a key", async () => {
    vi.stubEnv("FREECRYPTOAPI_API_KEY", "");
    expect(freecryptoapiConfigured()).toBe(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await new FreeCryptoApiProvider().getSignals({ symbols: ["BTC"] })).toEqual({ events: [], unmapped: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses the verified /getData shape and sends the bearer key", async () => {
    vi.stubEnv("FREECRYPTOAPI_API_KEY", "fca-key");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return json({
          status: "success",
          symbols: [{ symbol: "BTC", last: "70000", daily_change_percentage: "-8.5", date: "2026-10-10 09:00:00" }],
        });
      })
    );

    const batch = await new FreeCryptoApiProvider().getSignals({ symbols: ["BTC", "AAPL"] });
    expect(batch.events).toHaveLength(1);
    expect(batch.events[0]).toMatchObject({ provider: "freecryptoapi", symbol: "BTC", direction: "neutral" });
    // The adapter also probes /getBreakouts; non-crypto is filtered before any request and
    // the key rides in the header, not the URL.
    expect(calls.some((c) => c.url.includes("/getBreakouts"))).toBe(true);
    const dataCall = calls.find((c) => c.url.includes("/getData"));
    expect(dataCall?.url).toContain("/getData?symbol=BTC");
    expect((dataCall?.init.headers as Record<string, string>).Authorization).toBe("Bearer fca-key");
    expect(calls.every((c) => !c.url.includes("AAPL"))).toBe(true);
  });
});

describe("CoinMarketCapProvider", () => {
  it("reads the keyless public API with no key header", async () => {
    vi.stubEnv("COINMARKETCAP_API_KEY", "");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return json({
          data: [
            // The keyless public API returns `quote` as an array (observed live).
            { symbol: "BTC", quote: [{ symbol: "USD", price: 70000, percent_change_24h: -8.5, last_updated: "2026-10-10T09:00:00.000Z" }] },
            { symbol: "PEPE", quote: [{ symbol: "USD", price: 0.00001, percent_change_24h: 90 }] },
          ],
        });
      })
    );

    const batch = await new CoinMarketCapProvider().getSignals({ symbols: ["BTC"] });
    expect(batch.events).toHaveLength(1);
    expect(batch.events[0]).toMatchObject({ provider: "coinmarketcap", symbol: "BTC", direction: "neutral" });
    expect(calls[0].url).toContain("/public-api/v3/cryptocurrency/listings/latest");
    expect((calls[0].init.headers as Record<string, string>)["X-CMC_PRO_API_KEY"]).toBeUndefined();
  });

  it("uses the keyed root and header when a key is set, handling the object quote shape", async () => {
    vi.stubEnv("COINMARKETCAP_API_KEY", "cmc-key");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return json({ data: [{ symbol: "ETH", quote: { USD: { price: 2500, percent_change_24h: 7.1, last_updated: "2026-10-10T09:00:00.000Z" } } }] });
      })
    );

    const batch = await new CoinMarketCapProvider().getSignals({ symbols: ["ETH"] });
    expect(batch.events).toHaveLength(1);
    expect(batch.events[0].symbol).toBe("ETH");
    expect(calls[0].url).not.toContain("/public-api");
    expect((calls[0].init.headers as Record<string, string>)["X-CMC_PRO_API_KEY"]).toBe("cmc-key");
  });
});

describe("FreeCryptoAPI TA parsing", () => {
  it("parses a fear & greed index as neutral MARKET context", () => {
    const event = toFearGreedEvent({
      status: "success",
      value: 18,
      value_classification: "Extreme Fear",
      timestamp: "2026-10-10 09:00:00",
    });
    expect(event).toMatchObject({ providerKey: "FCA_FEAR_GREED", symbol: "MARKET", direction: "neutral" });
    expect(event?.name).toContain("18");
    expect(event?.name).toContain("Extreme Fear");
    expect(event?.ts).toBe("2026-10-10T09:00:00.000Z");
  });

  it("yields nothing for the no-access or an unrecognised fear & greed shape", () => {
    expect(toFearGreedEvent({ status: false, error: "No access. Please upgrade your subscription" })).toBeNull();
    expect(toFearGreedEvent({ status: "success", foo: "bar" })).toBeNull();
  });

  it("parses technical analysis into a neutral context event", () => {
    const event = toTechnicalEvent({ status: "success", rsi: 72.3, macd: 1.2, macd_signal: 0.8 }, "BTC");
    expect(event).toMatchObject({ providerKey: "FCA_TECHNICAL", symbol: "BTC", direction: "neutral" });
    expect(event?.name).toContain("RSI 72.3");
    expect(event?.name).toContain("MACD 1.2");
  });

  it("drops technical analysis for a non-catalog symbol, no indicator, or no access", () => {
    expect(toTechnicalEvent({ status: "success", rsi: 50 }, "PEPE")).toBeNull();
    expect(toTechnicalEvent({ status: "success", foo: 1 }, "BTC")).toBeNull();
    expect(toTechnicalEvent({ status: false }, "BTC")).toBeNull();
  });
});

/* ----------------------------------------------------------- the real point */

describe("trading does not stop when signal APIs are unavailable", () => {
  it("stays normal when only derived (neutral) market-move events are stored", () => {
    const now = Date.parse("2026-10-10T12:00:00Z");
    const ts = new Date(now - 60 * 60 * 1000).toISOString();
    // Several large moves in one direction, from the keyless alternates.
    const result = assessRisk({
      now,
      news: [],
      signals: ["BTC", "ETH", "SOL", "XRP"].map((symbol) => ({
        providerKey: "MARKET_MOVE_24H",
        name: "24h move -8.50%",
        symbol,
        direction: "neutral",
        ts,
      })),
    });
    // Neutral events inform `elevated`, but they can never refuse — breadth ignores them.
    expect(result.riskOff).toBe(false);
    expect(result.reasons.some((r) => r.startsWith("Breadth:"))).toBe(false);
  });

  it("still refuses on a genuine vendor risk signal", () => {
    const now = Date.parse("2026-10-10T12:00:00Z");
    const result = assessRisk({
      now,
      news: [],
      signals: [
        {
          providerKey: "SIGNALS_SUMMARY_STRONG_UP_DOWN_TREND",
          name: "Strong Downtrend",
          symbol: "BTC",
          direction: "bearish",
          ts: new Date(now - 60 * 60 * 1000).toISOString(),
        },
      ],
    });
    expect(result.riskOff).toBe(true);
  });
});
