import { CATALOG, instrument } from "@/lib/market/catalog";
import type { AssetClass, Candle, MarketDataProvider, Quote } from "@/lib/market/types";

/** Deterministic pseudo-noise so the same minute always yields the same value. */
function noise(seed: string, bucket: number): number {
  let h = 2166136261;
  const s = `${seed}:${bucket}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000 - 0.5; // -0.5 .. 0.5
}

/**
 * Offline fallback provider. Values are deterministic per 60s bucket and are
 * ALWAYS labelled `offline: true` so the UI can show a clear source badge.
 * This exists so the product works offline and never invents "live" data.
 */
export class OfflineProvider implements MarketDataProvider {
  id = "offline";
  supports: AssetClass[] = ["crypto", "forex", "equity"];

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const bucket = Math.floor(Date.now() / 60_000);
    const asOf = new Date().toISOString();
    return symbols
      .map((s) => instrument(s))
      .filter((i): i is NonNullable<typeof i> => Boolean(i))
      .map((i) => {
        const drift = noise(i.symbol, bucket) * 0.04;
        const price = i.seedUsd * (1 + drift);
        const high = price * (1 + Math.abs(noise(i.symbol + "h", bucket)) * 0.03);
        const low = price * (1 - Math.abs(noise(i.symbol + "l", bucket)) * 0.03);
        return {
          symbol: i.symbol,
          name: i.name,
          assetClass: i.assetClass,
          priceUsd: price,
          change24hPct: Number((drift * 100).toFixed(2)),
          high24hUsd: high,
          low24hUsd: low,
          volume24hUsd: i.seedUsd * 1_000_000 * (1 + Math.abs(drift)),
          source: "offline",
          offline: true,
          asOf,
        };
      });
  }

  async getCandles(symbol: string, points = 60): Promise<Candle[]> {
    const inst = instrument(symbol);
    const base = inst?.seedUsd ?? 100;
    const now = Date.now();
    const out: Candle[] = [];
    for (let i = points - 1; i >= 0; i--) {
      const t = now - i * 3600_000;
      const bucket = Math.floor(t / 3600_000);
      const c = base * (1 + noise(symbol, bucket) * 0.08);
      const o = base * (1 + noise(symbol, bucket - 1) * 0.08);
      out.push({
        t,
        o,
        c,
        h: Math.max(o, c) * (1 + Math.abs(noise(symbol + "h", bucket)) * 0.01),
        l: Math.min(o, c) * (1 - Math.abs(noise(symbol + "l", bucket)) * 0.01),
        v: 1000 * (1 + Math.abs(noise(symbol + "v", bucket))),
        offline: true,
      });
    }
    return out;
  }
}

export const OFFLINE_SYMBOLS = CATALOG.map((c) => c.symbol);
