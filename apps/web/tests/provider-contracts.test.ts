import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AltFinsProvider,
  parseAltfinsNumber,
  parseAltfinsPercent,
  normalizeDirection,
  normalizeSymbol,
  toSignalEvent,
  toSignalKey,
} from "@/lib/signals/altfins";
import { CoinMarketCapProvider } from "@/lib/signals/coinmarketcap";
import {
  toBreakoutEvents,
  toFearGreedEvent,
  toTechnicalEvent,
} from "@/lib/signals/freecryptoapi";
import { toMacdEvent, toRsiEvent } from "@/lib/signals/taapi";
import { FinnhubProvider } from "@/lib/market/finnhub";

/**
 * Provider **contract** tests — the offline guard the desk was missing.
 *
 * Each block feeds a fixture that mirrors the vendor's *documented* response shape
 * (captured live on 2026-10-10 and recorded in `docs/signals/*`) into the adapter's
 * parser and asserts it still normalises. If a vendor changes its wire format, this
 * fails in CI, offline, instead of surfacing as a silent "no signals" in production.
 *
 * These are intentionally separate from the behavioural tests in
 * `tests/signals-providers.test.ts`: the point here is only "the documented shape still
 * parses", not the surrounding logic.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/* ---------------------------------------------------------------------- AltFins */

/**
 * AltFins: a Spring page (`{content:[…]}`) whose numeric fields are **strings**,
 * `marketCap` is comma-formatted, `priceChange` is a percent string, and `direction`
 * is an upper-case word. Verified live (see `docs/signals/altfins.md`).
 */
const ALTFINS_ITEM = {
  timestamp: "2026-10-10 09:00:00",
  direction: "BULLISH",
  signalKey: "PRICE_CROSSES_ABOVE_SMA200",
  signalName: "Price crossed above SMA200",
  symbol: "BTC",
  symbolName: "Bitcoin",
  lastPrice: "109.83",
  marketCap: "64,822,436,701",
  priceChange: "0.69%",
};

describe("AltFins contract", () => {
  it("parses the documented field decorations", () => {
    expect(parseAltfinsNumber("64,822,436,701")).toBe(64822436701);
    expect(parseAltfinsNumber("109.83")).toBe(109.83);
    expect(parseAltfinsPercent("0.69%")).toBe(0.69);
    expect(parseAltfinsPercent(0.69)).toBe(0.69);
    expect(normalizeSymbol("EUR/USD")).toBe("EURUSD");
    expect(normalizeSymbol("BTC")).toBe("BTC");
    expect(normalizeSymbol("PEPE")).toBeNull();
    expect(normalizeDirection("BEARISH")).toBe("bearish");
    expect(normalizeDirection("sideways")).toBe("neutral");
  });

  it("normalises one documented search item", () => {
    const event = toSignalEvent(ALTFINS_ITEM);
    expect(event).toMatchObject({
      provider: "altfins",
      providerKey: "PRICE_CROSSES_ABOVE_SMA200",
      symbol: "BTC",
      direction: "bullish",
      priceUsd: 109.83,
      marketCapUsd: 64822436701,
      changePct: 0.69,
    });
    // The timestamp is normalised to ISO-8601 (the exact instant depends on the host
    // timezone, which the vendor's space-separated form does not pin).
    expect(new Date(event!.ts).getTime()).not.toBeNaN();
    expect(event!.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("drops an item with no catalog symbol or no signal key (never invents one)", () => {
    expect(toSignalEvent({ ...ALTFINS_ITEM, symbol: "PEPE" })).toBeNull();
    expect(toSignalEvent({ ...ALTFINS_ITEM, signalKey: "" })).toBeNull();
  });

  it("normalises a documented /signal-keys entry", () => {
    expect(
      toSignalKey({
        signalKey: "PRICE_CROSSES_ABOVE_SMA200",
        nameBullish: "Price crossed above SMA200",
        nameBearish: "Price crossed below SMA200",
        signalType: "TECHNICAL",
        trendSensitive: true,
      })
    ).toMatchObject({ signalKey: "PRICE_CROSSES_ABOVE_SMA200", trendSensitive: true });
    expect(toSignalKey({ symbol: "BTC" })).toBeNull();
  });

  it("consumes the Spring page envelope end to end", async () => {
    vi.stubEnv("ALTFINS_API_KEY", "altfins-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({ content: [ALTFINS_ITEM, { ...ALTFINS_ITEM, symbol: "PEPE" }], totalElements: 2 })
      )
    );

    const batch = await new AltFinsProvider().getSignals({ symbols: ["BTC"] });
    expect(batch.events).toHaveLength(1);
    expect(batch.events[0]).toMatchObject({ symbol: "BTC", providerKey: "PRICE_CROSSES_ABOVE_SMA200" });
    // The out-of-catalog row is counted, not silently dropped.
    expect(batch.unmapped).toBe(1);
  });
});

/* ----------------------------------------------------------------------- Finnhub */

/** Finnhub `/quote`: `{c,d,dp,h,l,o,pc,t}` with `t` in epoch seconds. */
const FINNHUB_QUOTE = {
  c: 336.64,
  d: -3.78,
  dp: -1.1104,
  h: 338.61,
  l: 330.7,
  o: 331.695,
  pc: 340.42,
  t: 1791576000,
};

describe("Finnhub contract", () => {
  it("normalises a documented /quote payload", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "finnhub-key");
    vi.stubGlobal("fetch", vi.fn(async () => json(FINNHUB_QUOTE)));

    const [quote] = await new FinnhubProvider().getQuotes(["AAPL"]);
    expect(quote).toMatchObject({
      symbol: "AAPL",
      source: "finnhub",
      offline: false,
      priceUsd: 336.64,
      change24hPct: -1.11,
    });
    // `t` is epoch seconds and must become a real timestamp.
    expect(quote.asOf).toBe(new Date(1791576000 * 1000).toISOString());
  });

  it("treats the documented 'unknown symbol' zero-price answer as no data", async () => {
    vi.stubEnv("FINNHUB_API_KEY", "finnhub-key");
    vi.stubGlobal("fetch", vi.fn(async () => json({ c: 0, d: null, dp: null, h: 0, l: 0, o: 0, pc: 0, t: 0 })));

    const [quote] = await new FinnhubProvider().getQuotes(["AAPL"]);
    // Falls back to the labelled offline generator rather than showing a $0 row as live.
    expect(quote).toMatchObject({ symbol: "AAPL", offline: true });
  });
});

/* ----------------------------------------------------------------- CoinMarketCap */

/** CoinMarketCap listings: `{data:[…]}`; `quote` is an **array** keyless, an object keyed. */
const CMC_KEYLESS_ROW = {
  symbol: "BTC",
  quote: [{ symbol: "USD", price: 70000, percent_change_24h: -8.5, last_updated: "2026-10-10T09:00:00.000Z" }],
};
const CMC_KEYED_ROW = {
  symbol: "ETH",
  quote: { USD: { price: 2500, percent_change_24h: 7.1, last_updated: "2026-10-10T09:00:00.000Z" } },
};

describe("CoinMarketCap contract", () => {
  it("parses the keyless array-quote shape", async () => {
    vi.stubEnv("COINMARKETCAP_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn(async () => json({ data: [CMC_KEYLESS_ROW] })));

    const batch = await new CoinMarketCapProvider().getSignals({ symbols: ["BTC"] });
    expect(batch.events).toHaveLength(1);
    expect(batch.events[0]).toMatchObject({ symbol: "BTC", direction: "neutral", providerKey: "MARKET_MOVE_24H" });
  });

  it("parses the keyed object-quote shape", async () => {
    vi.stubEnv("COINMARKETCAP_API_KEY", "cmc-key");
    vi.stubGlobal("fetch", vi.fn(async () => json({ data: [CMC_KEYED_ROW] })));

    const batch = await new CoinMarketCapProvider().getSignals({ symbols: ["ETH"] });
    expect(batch.events).toHaveLength(1);
    expect(batch.events[0]).toMatchObject({ symbol: "ETH", changePct: 7.1 });
  });
});

/* --------------------------------------------------------------- FreeCryptoAPI */

describe("FreeCryptoAPI contract", () => {
  it("parses the documented /getBreakouts rows", () => {
    const events = toBreakoutEvents({
      status: "success",
      breakouts: [
        { symbol: "BTC", direction: "bullish", period: 50, price: "70000", date: "2026-10-10 09:00:00" },
        { symbol: "PEPE", direction: "bearish", period: 200 },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      providerKey: "FCA_BREAKOUT_SMA50",
      symbol: "BTC",
      direction: "bullish",
      ts: "2026-10-10T09:00:00.000Z",
    });
  });

  it("yields nothing for the no-entitlement envelope", () => {
    expect(toBreakoutEvents({ status: false, error: "No access. Please upgrade your subscription" })).toEqual([]);
    expect(toFearGreedEvent({ status: false, error: "No access" })).toBeNull();
    expect(toTechnicalEvent({ status: false }, "BTC")).toBeNull();
  });

  it("parses the documented /getFearGreed shape as neutral MARKET context", () => {
    const event = toFearGreedEvent({
      status: "success",
      fear_and_greed: { value: 18, value_classification: "Extreme Fear", timestamp: "2026-10-10 09:00:00" },
    });
    expect(event).toMatchObject({ providerKey: "FCA_FEAR_GREED", symbol: "MARKET", direction: "neutral" });
  });

  it("parses the documented /getTechnicalAnalysis shape as neutral context", () => {
    const event = toTechnicalEvent(
      { status: "success", technical_analysis: { rsi: 72.3, macd: 1.2, macd_signal: 0.8, price: "70000" } },
      "BTC"
    );
    expect(event).toMatchObject({ providerKey: "FCA_TECHNICAL", symbol: "BTC", direction: "neutral", priceUsd: 70000 });
  });
});

/* ----------------------------------------------------------------------- TAAPI */

describe("TAAPI contract", () => {
  it("parses an /indicator/rsi reading as neutral context", () => {
    expect(toRsiEvent({ value: 72.3 }, "BTC")).toMatchObject({
      provider: "taapi",
      providerKey: "TAAPI_RSI",
      symbol: "BTC",
      direction: "neutral",
    });
  });

  it("parses an /indicator/macd reading as neutral context", () => {
    expect(toMacdEvent({ valueMACD: 1.2, valueMACDSignal: 0.8, valueMACDHist: 0.4 }, "BTC")).toMatchObject({
      providerKey: "TAAPI_MACD",
      symbol: "BTC",
      direction: "neutral",
    });
  });

  it("returns null for an unrecognised reading rather than guessing", () => {
    expect(toRsiEvent({ result: 72.3 }, "BTC")).toBeNull();
    expect(toMacdEvent({ nope: 1 }, "BTC")).toBeNull();
    expect(toRsiEvent("72.3", "BTC")).toBeNull();
  });
});
