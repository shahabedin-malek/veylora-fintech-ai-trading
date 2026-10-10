export type AssetClass = "crypto" | "forex" | "equity";

export interface Quote {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  priceUsd: number;
  change24hPct: number;
  high24hUsd?: number;
  low24hUsd?: number;
  volume24hUsd?: number;
  source: string;
  /** true when the value came from the offline fallback provider, not a live feed. */
  offline: boolean;
  asOf: string;
}

export interface Candle {
  t: number; // epoch ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  /** true when this candle came from the offline fallback provider, not a live feed. */
  offline?: boolean;
}

export interface NewsItem {
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  /** Always false: news is only ever read from a real configured RSS feed. */
  offline: boolean;
  category?: "crypto" | "markets" | "business" | "general";
  relatedSymbols?: string[];
  /**
   * Absolute http(s) image URL published with the item (`enclosure`, `media:content`,
   * `media:thumbnail`, or the first `<img>` in the description). Absent when the feed
   * carries no usable image — the UI falls back rather than inventing one.
   */
  imageUrl?: string;
}

export interface MarketDataProvider {
  id: string;
  supports: AssetClass[];
  getQuotes(symbols: string[]): Promise<Quote[]>;
  getCandles(symbol: string, points: number): Promise<Candle[]>;
}
