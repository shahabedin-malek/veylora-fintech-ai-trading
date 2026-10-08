import { CATALOG, instrument } from "@/lib/market/catalog";
import type { AssetClass, Candle, MarketDataProvider, Quote } from "@/lib/market/types";
import { SimulatedProvider } from "@/lib/market/simulated";

const IDS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple", ADA: "cardano", DOGE: "dogecoin",
};

/**
 * Live crypto prices from the public CoinGecko API (no API key required).
 * Only crypto is supported; forex/equity requests fall back to the simulated
 * provider. Network failures throw and the caller falls back gracefully.
 */
export class CoinGeckoProvider implements MarketDataProvider {
  id = "coingecko";
  supports: AssetClass[] = ["crypto"];
  private fallback = new SimulatedProvider();

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const wanted = symbols.map((s) => s.toUpperCase());
    const crypto = wanted.filter((s) => instrument(s)?.assetClass === "crypto");
    const other = wanted.filter((s) => instrument(s)?.assetClass !== "crypto");

    const quotes: Quote[] = [];
    if (crypto.length) {
      const ids = crypto.map((s) => IDS[s]).filter(Boolean).join(",");
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" }, next: { revalidate: 30 } });
        if (!res.ok) throw new Error(`coingecko ${res.status}`);
        const data = (await res.json()) as Array<{
          symbol: string; name: string; current_price: number; price_change_percentage_24h: number | null;
          high_24h: number | null; low_24h: number | null; total_volume: number | null;
        }>;
        for (const d of data) {
          const sym = d.symbol.toUpperCase();
          quotes.push({
            symbol: sym,
            name: d.name,
            assetClass: "crypto",
            priceUsd: d.current_price,
            change24hPct: Number((d.price_change_percentage_24h ?? 0).toFixed(2)),
            high24hUsd: d.high_24h ?? undefined,
            low24hUsd: d.low_24h ?? undefined,
            volume24hUsd: d.total_volume ?? undefined,
            source: "coingecko",
            simulated: false,
            asOf: new Date().toISOString(),
          });
        }
      } finally {
        clearTimeout(timer);
      }
    }
    if (other.length) quotes.push(...(await this.fallback.getQuotes(other)));
    return quotes;
  }

  /** Real OHLC candles from CoinGecko's ohlc endpoint, with volume matched from
   * market_chart. No high/low values are synthesized. Falls back to simulated. */
  async getCandles(symbol: string, points: number): Promise<Candle[]> {
    if (instrument(symbol)?.assetClass !== "crypto") return this.fallback.getCandles(symbol, points);
    const id = IDS[symbol.toUpperCase()];
    if (!id) return this.fallback.getCandles(symbol, points);
    const days = points <= 24 ? 1 : points <= 60 ? 7 : 14;
    try {
      const opts = { headers: { accept: "application/json" }, next: { revalidate: 300 } } as const;
      const [ohlcRes, volRes] = await Promise.all([
        fetch(`https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${days}`, opts),
        fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`, opts),
      ]);
      if (!ohlcRes.ok) throw new Error(`coingecko ohlc ${ohlcRes.status}`);
      const ohlc = (await ohlcRes.json()) as [number, number, number, number, number][];
      if (!Array.isArray(ohlc) || !ohlc.length) throw new Error("coingecko ohlc empty");
      const vols = volRes.ok
        ? ((await volRes.json()) as { total_volumes: [number, number][] }).total_volumes
        : [];
      return ohlc.slice(-points).map(([t, o, h, l, c]) => ({
        t,
        o,
        h,
        l,
        c,
        v: nearestVolume(vols, t),
        simulated: false,
      }));
    } catch {
      return this.fallback.getCandles(symbol, points);
    }
  }
}

/** Volume for an OHLC bucket is approximated by the nearest market_chart sample. */
function nearestVolume(vols: [number, number][], ts: number): number {
  if (!vols.length) return 0;
  let best = vols[0];
  let bestDelta = Math.abs(vols[0][0] - ts);
  for (const v of vols) {
    const d = Math.abs(v[0] - ts);
    if (d < bestDelta) {
      bestDelta = d;
      best = v;
    }
  }
  return best[1];
}

export const CRYPTO_CATALOG = CATALOG.filter((c) => c.assetClass === "crypto");
