import { describe, expect, it } from "vitest";
import { OfflineProvider } from "@/lib/market/offline";
import { CATALOG, instrument } from "@/lib/market/catalog";
import { isChartView } from "@/components/PriceChart";

describe("offline market provider", () => {
  const provider = new OfflineProvider();

  it("quotes are always labelled offline", async () => {
    const quotes = await provider.getQuotes(["BTC", "EURUSD", "AAPL"]);
    expect(quotes).toHaveLength(3);
    expect(quotes.every((q) => q.offline === true)).toBe(true);
    expect(quotes.every((q) => q.source === "offline")).toBe(true);
  });

  it("quotes are deterministic within the same minute bucket", async () => {
    const a = await provider.getQuotes(["BTC"]);
    const b = await provider.getQuotes(["BTC"]);
    expect(a[0].priceUsd).toBe(b[0].priceUsd);
  });

  it("ignores unknown symbols", async () => {
    const quotes = await provider.getQuotes(["NOPE"]);
    expect(quotes).toHaveLength(0);
  });

  it("candles honour OHLC invariants and are flagged as generated", async () => {
    const candles = await provider.getCandles("ETH", 24);
    expect(candles).toHaveLength(24);
    for (const c of candles) {
      expect(c.offline).toBe(true);
      expect(c.h).toBeGreaterThanOrEqual(Math.max(c.o, c.c));
      expect(c.l).toBeLessThanOrEqual(Math.min(c.o, c.c));
      expect(c.v).toBeGreaterThan(0);
      expect(c.t).toBeGreaterThan(0);
    }
  });

  it("candles are ordered oldest to newest", async () => {
    const candles = await provider.getCandles("SOL", 12);
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i].t).toBeGreaterThan(candles[i - 1].t);
    }
  });
});

describe("instrument catalog", () => {
  it("has unique symbols and a seed price for each", () => {
    const symbols = CATALOG.map((c) => c.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(CATALOG.every((c) => c.seedUsd > 0)).toBe(true);
  });

  it("resolves symbols case-insensitively", () => {
    expect(instrument("btc")?.name).toBe("Bitcoin");
    expect(instrument("nope")).toBeUndefined();
  });
});

describe("chart view", () => {
  it("accepts the supported views", () => {
    expect(isChartView("line")).toBe(true);
    expect(isChartView("area")).toBe(true);
    expect(isChartView("candles")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isChartView("pie")).toBe(false);
    expect(isChartView(undefined)).toBe(false);
    expect(isChartView("")).toBe(false);
  });
});
