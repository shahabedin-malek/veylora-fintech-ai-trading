import { describe, expect, it } from "vitest";

import {
  NEWS_ASSET_FILTERS,
  countNewsByAssetClass,
  filterNewsByAssetClass,
  isNewsAssetFilter,
  newsAssetClasses,
} from "@/lib/market/news-filter";
import type { NewsItem } from "@/lib/market/types";

function item(headline: string, relatedSymbols?: string[]): NewsItem {
  return {
    headline,
    source: "example.com",
    url: `https://example.com/${encodeURIComponent(headline)}`,
    publishedAt: "2026-10-10T00:00:00.000Z",
    offline: false,
    relatedSymbols,
  };
}

const BTC = item("Bitcoin ETF inflows", ["BTC"]);
const ETH_AAPL = item("Apple and Ethereum in one story", ["ETH", "AAPL"]);
const EUR = item("Euro slips against the dollar", ["EURUSD"]);
const MACRO = item("Fed holds rates steady"); // no tagged instrument

const ALL = [BTC, ETH_AAPL, EUR, MACRO];

describe("news asset-class filter", () => {
  it("derives classes from tagged catalog symbols only", () => {
    expect(newsAssetClasses(BTC)).toEqual(["crypto"]);
    expect(newsAssetClasses(EUR)).toEqual(["forex"]);
    expect(newsAssetClasses(ETH_AAPL).sort()).toEqual(["crypto", "equity"]);
    expect(newsAssetClasses(MACRO)).toEqual([]);
  });

  it("ignores symbols that are not in the catalog", () => {
    expect(newsAssetClasses(item("Unknown ticker", ["NOPE", "BTC"]))).toEqual(["crypto"]);
  });

  it("keeps only the class asked for, and everything for all", () => {
    expect(filterNewsByAssetClass(ALL, "crypto")).toEqual([BTC, ETH_AAPL]);
    expect(filterNewsByAssetClass(ALL, "equity")).toEqual([ETH_AAPL]);
    expect(filterNewsByAssetClass(ALL, "forex")).toEqual([EUR]);
    expect(filterNewsByAssetClass(ALL, "all")).toEqual(ALL);
  });

  it("never shows an untagged story under a specific class", () => {
    expect(filterNewsByAssetClass([MACRO], "crypto")).toEqual([]);
    expect(filterNewsByAssetClass([MACRO], "all")).toEqual([MACRO]);
  });

  it("counts items per class, counting a multi-class item in each", () => {
    expect(countNewsByAssetClass(ALL)).toEqual({ all: 4, crypto: 2, forex: 1, equity: 1 });
  });

  it("validates query-string values", () => {
    expect(isNewsAssetFilter("crypto")).toBe(true);
    expect(isNewsAssetFilter("all")).toBe(true);
    expect(isNewsAssetFilter("bonds")).toBe(false);
    expect(isNewsAssetFilter(undefined)).toBe(false);
  });

  it("offers a filter for every asset class in the catalog", () => {
    const values = NEWS_ASSET_FILTERS.map((f) => f.value);
    expect(values).toEqual(["all", "crypto", "forex", "equity"]);
  });
});
