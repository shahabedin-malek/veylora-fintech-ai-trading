import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AltFinsProvider,
  altfinsConfigured,
  normalizeDirection,
  normalizeSymbol,
  parseAltfinsNumber,
  parseAltfinsPercent,
  toSignalEvent,
  toSignalKey,
} from "@/lib/signals/altfins";
import { getSignalsSafe, signalProviders, signalsConfigured } from "@/lib/signals";

/**
 * The adapter is an input to risk decisions, so the properties that matter are:
 * the vendor's messy wire format is parsed honestly, an instrument outside our
 * catalog is dropped (and counted), and a missing key or a provider failure yields
 * an empty, labelled result rather than a fabricated one.
 */

const VALID_ITEM = {
  timestamp: "2026-10-08T16:48:25Z",
  direction: "BULLISH",
  signalKey: "SIGNALS_SUMMARY_BULL_POWER",
  signalName: "Bull Power",
  symbol: "SOL",
  symbolName: "Solana",
  lastPrice: "109.83",
  marketCap: "64,822,436,701",
  priceChange: "0.69%",
};

function searchResponse(content: unknown[]): Response {
  return new Response(
    JSON.stringify({ size: 24, number: 0, totalElements: content.length, numberOfElements: content.length, content }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/* ------------------------------------------------------------ parsing helpers */

describe("AltFins field parsing", () => {
  it("parses numeric strings and comma-formatted numbers", () => {
    expect(parseAltfinsNumber("109.83")).toBe(109.83);
    expect(parseAltfinsNumber("64,822,436,701")).toBe(64822436701);
    expect(parseAltfinsNumber(42)).toBe(42);
    expect(parseAltfinsNumber("")).toBeUndefined();
    expect(parseAltfinsNumber("n/a")).toBeUndefined();
    expect(parseAltfinsNumber(null)).toBeUndefined();
  });

  it("parses percent strings", () => {
    expect(parseAltfinsPercent("0.69%")).toBe(0.69);
    expect(parseAltfinsPercent("-3.1%")).toBe(-3.1);
    expect(parseAltfinsPercent("abc")).toBeUndefined();
  });

  it("maps a ticker onto the catalog, including vended separators", () => {
    expect(normalizeSymbol("BTC")).toBe("BTC");
    expect(normalizeSymbol("eur/usd")).toBe("EURUSD");
    expect(normalizeSymbol("EUR-USD")).toBe("EURUSD");
    expect(normalizeSymbol("PEPE")).toBeNull(); // outside our universe
    expect(normalizeSymbol("")).toBeNull();
    expect(normalizeSymbol(undefined)).toBeNull();
  });

  it("maps direction, treating anything unrecognised as neutral (never guessed)", () => {
    expect(normalizeDirection("BULLISH")).toBe("bullish");
    expect(normalizeDirection("bearish")).toBe("bearish");
    expect(normalizeDirection("SIDEWAYS")).toBe("neutral");
    expect(normalizeDirection(undefined)).toBe("neutral");
  });
});

describe("toSignalEvent", () => {
  it("normalises a real search-requests item", () => {
    const event = toSignalEvent(VALID_ITEM);
    expect(event).toMatchObject({
      provider: "altfins",
      providerKey: "SIGNALS_SUMMARY_BULL_POWER",
      name: "Bull Power",
      symbol: "SOL",
      assetClass: "crypto",
      direction: "bullish",
      ts: "2026-10-08T16:48:25.000Z",
      priceUsd: 109.83,
      marketCapUsd: 64822436701,
      changePct: 0.69,
    });
  });

  it("drops an item whose instrument is not in the catalog", () => {
    expect(toSignalEvent({ ...VALID_ITEM, symbol: "PEPE" })).toBeNull();
  });

  it("drops an item with no signal key", () => {
    expect(toSignalEvent({ ...VALID_ITEM, signalKey: "" })).toBeNull();
  });

  it("falls back to the key as the label when no name is supplied", () => {
    expect(toSignalEvent({ ...VALID_ITEM, signalName: undefined })?.name).toBe("SIGNALS_SUMMARY_BULL_POWER");
  });
});

describe("toSignalKey", () => {
  it("normalises a catalogue entry", () => {
    expect(
      toSignalKey({
        signalKey: "SIGNALS_SUMMARY_SMA_50_200",
        nameBullish: "Bullish (Golden) Cross",
        nameBearish: "Bearish (Death) Cross",
        signalType: "SignalsSummaryDataTrend",
        trendSensitive: true,
      })
    ).toEqual({
      signalKey: "SIGNALS_SUMMARY_SMA_50_200",
      nameBullish: "Bullish (Golden) Cross",
      nameBearish: "Bearish (Death) Cross",
      signalType: "SignalsSummaryDataTrend",
      trendSensitive: true,
    });
  });

  it("rejects an entry with no key", () => {
    expect(toSignalKey({ signalKey: "" })).toBeNull();
    expect(toSignalKey("nope")).toBeNull();
  });
});

/* ------------------------------------------------------------------ provider */

describe("AltFinsProvider.getSignals", () => {
  it("returns nothing and makes no request when unconfigured", async () => {
    vi.stubEnv("ALTFINS_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const batch = await new AltFinsProvider().getSignals({ symbols: ["BTC"] });
    expect(batch).toEqual({ events: [], unmapped: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks only about catalog instruments and counts unmapped results", async () => {
    vi.stubEnv("ALTFINS_API_KEY", "test-key");
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return searchResponse([VALID_ITEM, { ...VALID_ITEM, symbol: "PEPE" }]);
      })
    );

    // "PEPE" is not in the catalog, so it is never requested; the vendor could still
    // return it, and that item is dropped and counted.
    const batch = await new AltFinsProvider().getSignals({ symbols: ["sol", "PEPE"] });
    expect(batch.events).toHaveLength(1);
    expect(batch.events[0].symbol).toBe("SOL");
    expect(batch.unmapped).toBe(1);

    expect(calls).toHaveLength(1);
    const body = JSON.parse(String(calls[0].init.body)) as { symbols: string[] };
    expect(body.symbols).toEqual(["SOL"]);
    expect(calls[0].init.method).toBe("POST");
  });

  it("throws on a non-2xx response so the caller can degrade", async () => {
    vi.stubEnv("ALTFINS_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    await expect(new AltFinsProvider().getSignals({ symbols: ["BTC"] })).rejects.toThrow(/altfins/);
  });

  it("applies a limit after normalisation", async () => {
    vi.stubEnv("ALTFINS_API_KEY", "test-key");
    const items = [
      { ...VALID_ITEM, symbol: "BTC" },
      { ...VALID_ITEM, symbol: "ETH" },
      { ...VALID_ITEM, symbol: "SOL" },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => searchResponse(items)));
    const batch = await new AltFinsProvider().getSignals({ symbols: ["BTC", "ETH", "SOL"], limit: 2 });
    expect(batch.events).toHaveLength(2);
  });
});

/* -------------------------------------------------------------- safe wrapper */

describe("signal layer", () => {
  it("keeps the keyless alternates when no key is configured", () => {
    vi.stubEnv("ALTFINS_API_KEY", "");
    vi.stubEnv("FREECRYPTOAPI_API_KEY", "");
    expect(altfinsConfigured()).toBe(false);
    // Trading never stops waiting on a signal source: a keyless alternate is always here.
    expect(signalsConfigured()).toBe(true);
    expect(signalProviders().map((p) => p.id)).toEqual(["coinmarketcap", "coingecko-derived"]);
  });

  it("adds the keyed sources once their keys are present", () => {
    vi.stubEnv("ALTFINS_API_KEY", "test-key");
    vi.stubEnv("FREECRYPTOAPI_API_KEY", "fca-key");
    expect(signalsConfigured()).toBe(true);
    expect(signalProviders().map((p) => p.id)).toEqual([
      "altfins",
      "freecryptoapi",
      "coinmarketcap",
      "coingecko-derived",
    ]);
  });

  it("still returns real market context from a keyless alternate when no key is set", async () => {
    vi.stubEnv("ALTFINS_API_KEY", "");
    vi.stubEnv("FREECRYPTOAPI_API_KEY", "");
    // A real CoinGecko markets payload with a move past the 5% threshold.
    const markets = [
      { symbol: "btc", current_price: 70000, price_change_percentage_24h: -8.5, last_updated: "2026-10-10T09:00:00.000Z" },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(markets), { status: 200 })));

    const result = await getSignalsSafe({ symbols: ["BTC"] });
    expect(result.degraded).toBe(false);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]).toMatchObject({ provider: "coingecko-derived", symbol: "BTC", direction: "neutral" });
  });

  it("getSignalsSafe never throws — a provider failure degrades", async () => {
    vi.stubEnv("ALTFINS_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    const result = await getSignalsSafe({ symbols: ["BTC"] });
    expect(result.signals).toEqual([]);
    expect(result.degraded).toBe(true);
    expect(result.source).toBe("altfins,coinmarketcap,coingecko-derived");
  });

  it("getSignalsSafe de-duplicates and sorts newest first", async () => {
    vi.stubEnv("ALTFINS_API_KEY", "test-key");
    const older = { ...VALID_ITEM, timestamp: "2026-10-01T00:00:00Z", symbol: "BTC" };
    const newer = { ...VALID_ITEM, timestamp: "2026-10-09T00:00:00Z", symbol: "ETH" };
    vi.stubGlobal("fetch", vi.fn(async () => searchResponse([older, newer, { ...newer }])));
    const result = await getSignalsSafe({ symbols: ["BTC", "ETH"] });
    expect(result.signals.map((s) => s.symbol)).toEqual(["ETH", "BTC"]);
    expect(result.degraded).toBe(false);
  });
});
