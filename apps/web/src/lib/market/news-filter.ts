import { CATALOG } from "@/lib/market/catalog";
import type { AssetClass, NewsItem } from "@/lib/market/types";

/**
 * Asset-class browsing for the news feed.
 *
 * `getNews` tags each item with catalog symbols it mentions (word-boundary matched, see
 * `tagSymbols`), and the catalog is the one place that maps a symbol to an asset class.
 * So an item's class is derived from those tags rather than guessed from the headline:
 * a story that mentions BTC and ETH is crypto, one that mentions AAPL is equity, and a
 * story with no recognisable instrument (a Fed statement, say) belongs to no class and
 * therefore appears under "All" only.
 */

export type NewsAssetFilter = "all" | AssetClass;

export const NEWS_ASSET_FILTERS: { value: NewsAssetFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "crypto", label: "Crypto" },
  { value: "forex", label: "Forex" },
  { value: "equity", label: "Equities" },
];

const SYMBOL_CLASS = new Map(CATALOG.map((i) => [i.symbol, i.assetClass]));

/** Narrows an untrusted query-string value (e.g. `?news=crypto`) to a filter. */
export function isNewsAssetFilter(value: string | undefined): value is NewsAssetFilter {
  return NEWS_ASSET_FILTERS.some((f) => f.value === value);
}

/** The asset classes an item touches, from the catalog symbols it was tagged with. */
export function newsAssetClasses(item: NewsItem): AssetClass[] {
  const classes = new Set<AssetClass>();
  for (const symbol of item.relatedSymbols ?? []) {
    const assetClass = SYMBOL_CLASS.get(symbol.toUpperCase());
    if (assetClass) classes.add(assetClass);
  }
  return [...classes];
}

/** Keep items touching at least one symbol of the class; `all` keeps everything. */
export function filterNewsByAssetClass(items: NewsItem[], filter: NewsAssetFilter): NewsItem[] {
  if (filter === "all") return items;
  return items.filter((item) => newsAssetClasses(item).includes(filter));
}

/** How many items each filter would show, so the chips can label themselves. */
export function countNewsByAssetClass(items: NewsItem[]): Record<NewsAssetFilter, number> {
  const counts: Record<NewsAssetFilter, number> = { all: items.length, crypto: 0, forex: 0, equity: 0 };
  for (const item of items) {
    for (const assetClass of newsAssetClasses(item)) counts[assetClass] += 1;
  }
  return counts;
}
