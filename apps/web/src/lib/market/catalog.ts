import type { AssetClass } from "@/lib/market/types";

export interface Instrument {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  /** Seed price used only by the simulated provider. */
  seedUsd: number;
}

/** Static universe of instruments the app can display. This is not market data. */
export const CATALOG: Instrument[] = [
  { symbol: "BTC", name: "Bitcoin", assetClass: "crypto", seedUsd: 64000 },
  { symbol: "ETH", name: "Ethereum", assetClass: "crypto", seedUsd: 3100 },
  { symbol: "SOL", name: "Solana", assetClass: "crypto", seedUsd: 155 },
  { symbol: "XRP", name: "XRP", assetClass: "crypto", seedUsd: 0.62 },
  { symbol: "ADA", name: "Cardano", assetClass: "crypto", seedUsd: 0.45 },
  { symbol: "DOGE", name: "Dogecoin", assetClass: "crypto", seedUsd: 0.14 },
  { symbol: "EURUSD", name: "Euro / US Dollar", assetClass: "forex", seedUsd: 1.08 },
  { symbol: "GBPUSD", name: "British Pound / US Dollar", assetClass: "forex", seedUsd: 1.27 },
  { symbol: "USDJPY", name: "US Dollar / Japanese Yen", assetClass: "forex", seedUsd: 0.0064 },
  { symbol: "AAPL", name: "Apple Inc.", assetClass: "equity", seedUsd: 225 },
  { symbol: "MSFT", name: "Microsoft Corp.", assetClass: "equity", seedUsd: 430 },
  { symbol: "NVDA", name: "NVIDIA Corp.", assetClass: "equity", seedUsd: 118 },
  { symbol: "TSLA", name: "Tesla Inc.", assetClass: "equity", seedUsd: 245 },
];

export function instrument(symbol: string): Instrument | undefined {
  return CATALOG.find((i) => i.symbol === symbol.toUpperCase());
}
