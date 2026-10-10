/**
 * Finnhub market data.
 *
 * Finnhub is the **equity leg** of the market data: the catalog's `AAPL`, `MSFT`, `NVDA`
 * and `TSLA` cannot come from CoinGecko, so they fall back to the offline generator
 * today. With `FINNHUB_API_KEY` set this provider prices them for real.
 *
 * Verified live (2026-10-10) with the supplied key:
 *   - `GET /quote?symbol=AAPL` → `{c,d,dp,h,l,o,pc,t}` ✅
 *   - `GET /quote?symbol=BINANCE:BTCUSDT` (crypto) ✅
 *   - forex (`OANDA:EUR_USD`) and `/forex/rates` → **403** (premium), so forex stays on
 *     the offline fallback rather than showing a premium feed as live.
 *
 * The key is sent as the `X-Finnhub-Token` header (Finnhub accepts it in place of the
 * `token=` query parameter), which keeps the secret out of URLs and request logs.
 * Candles are a premium resource on this plan, so `getCandles` delegates to the
 * labelled offline generator rather than calling an endpoint that would fail.
 */

import { ProviderRequestError, withCredential } from "@/lib/credentials/pool";
import { providerHasPoolKeySync } from "@/lib/credentials/presence";
import { instrument } from "@/lib/market/catalog";
import { OfflineProvider } from "@/lib/market/offline";
import type { AssetClass, Candle, MarketDataProvider, Quote } from "@/lib/market/types";

export const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
export const FINNHUB_TIMEOUT_MS = 6000;

/**
 * Finnhub crypto quotes are exchange-prefixed. Only listed here if the mapping is
 * certain; an unmapped crypto symbol falls back rather than being guessed.
 */
const CRYPTO_SYMBOL: Record<string, string> = {
  BTC: "BINANCE:BTCUSDT",
  ETH: "BINANCE:ETHUSDT",
  SOL: "BINANCE:SOLUSDT",
  XRP: "BINANCE:XRPUSDT",
  ADA: "BINANCE:ADAUSDT",
  DOGE: "BINANCE:DOGEUSDT",
};

/**
 * Whether the provider can run. A key may come from the env var or the admin key pool;
 * absent both, it is skipped entirely.
 */
export function finnhubConfigured(): boolean {
  return (process.env.FINNHUB_API_KEY ?? "").trim().length > 0 || providerHasPoolKeySync("finnhub");
}

/**
 * The Finnhub symbol for an instrument in the app's catalog, or `null` when Finnhub
 * cannot price it on this plan (forex is premium).
 */
export function finnhubSymbol(symbol: string): string | null {
  const inst = instrument(symbol);
  if (!inst) return null;
  if (inst.assetClass === "equity") return inst.symbol;
  if (inst.assetClass === "crypto") return CRYPTO_SYMBOL[inst.symbol] ?? null;
  return null;
}

/** The subset of a Finnhub `/quote` response the app uses. */
export interface FinnhubQuote {
  c?: number; // current price
  d?: number | null; // change
  dp?: number | null; // percent change
  h?: number; // high
  l?: number; // low
  o?: number; // open
  pc?: number; // previous close
  t?: number; // epoch seconds
}

export class FinnhubProvider implements MarketDataProvider {
  id = "finnhub";
  /** Forex is a premium resource on the supplied plan, so only these are claimed. */
  supports: AssetClass[] = ["equity", "crypto"];
  private fallback = new OfflineProvider();

  private async fetchQuote(symbol: string): Promise<FinnhubQuote> {
    // Rotate across the key pool when a key is rejected (401/429). The key stays in the
    // header, never a URL.
    return withCredential("finnhub", async (values) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FINNHUB_TIMEOUT_MS);
      try {
        const res = await fetch(`${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}`, {
          signal: controller.signal,
          headers: { accept: "application/json", "X-Finnhub-Token": values.apiKey },
          next: { revalidate: 30 },
        });
        if (!res.ok) throw new ProviderRequestError(`finnhub ${res.status}`, res.status);
        return (await res.json()) as FinnhubQuote;
      } finally {
        clearTimeout(timer);
      }
    });
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    // Unconfigured ⇒ no live prices; the caller sees labelled offline values, never a
    // silent stand-in for a real venue.
    if (!finnhubConfigured()) return this.fallback.getQuotes(symbols);

    const quotes: Quote[] = [];
    const unpriceable: string[] = [];

    for (const raw of symbols) {
      const inst = instrument(raw);
      const symbol = finnhubSymbol(raw);
      if (!inst || !symbol) {
        unpriceable.push(raw);
        continue;
      }
      try {
        const data = await this.fetchQuote(symbol);
        // Finnhub answers `{c: 0, …}` for a symbol it does not know; treat that as no data.
        if (typeof data.c !== "number" || !Number.isFinite(data.c) || data.c <= 0) {
          unpriceable.push(raw);
          continue;
        }
        quotes.push({
          symbol: inst.symbol,
          name: inst.name,
          assetClass: inst.assetClass,
          priceUsd: data.c,
          change24hPct: Number((data.dp ?? 0).toFixed(2)),
          high24hUsd: typeof data.h === "number" && data.h > 0 ? data.h : undefined,
          low24hUsd: typeof data.l === "number" && data.l > 0 ? data.l : undefined,
          source: "finnhub",
          offline: false,
          asOf: data.t ? new Date(data.t * 1000).toISOString() : new Date().toISOString(),
        });
      } catch {
        unpriceable.push(raw);
      }
    }

    // Anything Finnhub cannot price degrades to the labelled offline generator rather
    // than being dropped, so the UI still has a row — clearly marked as not live.
    if (unpriceable.length) quotes.push(...(await this.fallback.getQuotes(unpriceable)));
    return quotes;
  }

  /**
   * Finnhub candles are premium on the supplied plan, so charts use the labelled
   * offline generator. No premium endpoint is called, so a chart never implies it is
   * showing real Finnhub history when it is not.
   */
  async getCandles(symbol: string, points: number): Promise<Candle[]> {
    return this.fallback.getCandles(symbol, points);
  }
}
