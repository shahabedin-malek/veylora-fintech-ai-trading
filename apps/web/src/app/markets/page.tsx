import Link from "next/link";
import { CATALOG } from "@/lib/market/catalog";
import { getCandlesSafe, getNews, getQuotesSafe } from "@/lib/market";
import {
  NEWS_ASSET_FILTERS,
  countNewsByAssetClass,
  filterNewsByAssetClass,
  isNewsAssetFilter,
  type NewsAssetFilter,
} from "@/lib/market/news-filter";
import { PriceChart, isChartView, type ChartView } from "@/components/PriceChart";
import { config } from "@/lib/config";
import { timeAgo } from "@/lib/domain/time";
import { MarketsControls } from "@/components/MarketsControls";
import { assessDeskRisk } from "@/lib/risk/assess";
import { RiskBanner } from "@/components/RiskBanner";

/** How much of the feed the browsing surface pulls (the rail shows far fewer). */
const NEWS_BROWSE_LIMIT = 60;

const UNIVERSE = CATALOG.map((c) => c.symbol);
const RANGES: { value: number; label: string }[] = [
  { value: 24, label: "24h" },
  { value: 60, label: "7d" },
  { value: 168, label: "14d" },
];
const VIEWS: { value: ChartView; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "candles", label: "Candles" },
];

function fmtCompact(n: number | undefined): string {
  if (!n) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n);
}

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; range?: string; view?: string; news?: string }>;
}) {
  const sp = await searchParams;
  const symbol = (sp.symbol || "BTC").toUpperCase();
  const range = Number(sp.range || 60);
  const points = RANGES.some((r) => r.value === range) ? range : 60;
  const view: ChartView = isChartView(sp.view) ? sp.view : "area";
  const newsFilter: NewsAssetFilter = isNewsAssetFilter(sp.news) ? sp.news : "all";

  const [{ quotes, degraded, source }, { candles, offline }, news, risk] = await Promise.all([
    getQuotesSafe(UNIVERSE),
    getCandlesSafe(symbol, points),
    getNews([symbol], NEWS_BROWSE_LIMIT),
    assessDeskRisk(),
  ]);

  const selected = quotes.find((q) => q.symbol === symbol);
  const priceUp = (selected?.change24hPct ?? 0) >= 0;
  const totalVolume = candles.reduce((s, c) => s + (c.v ?? 0), 0);

  const newsCounts = countNewsByAssetClass(news);
  const visibleNews = filterNewsByAssetClass(news, newsFilter);

  /** The same view with a different news filter, so the URL stays the source of truth. */
  const newsHref = (filter: NewsAssetFilter): string => {
    const params = new URLSearchParams({ symbol, range: String(points), view });
    if (filter !== "all") params.set("news", filter);
    return `/markets?${params.toString()}`;
  };

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Markets</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            Crypto, forex and equities · source: {source}
            {degraded ? " (offline fallback)" : ""}
          </p>
        </div>
        <MarketsControls
          symbol={symbol}
          range={points}
          view={view}
          ranges={RANGES.map((r) => ({ value: String(r.value), label: r.label }))}
          views={VIEWS}
          news={newsFilter === "all" ? "" : newsFilter}
        />
      </div>

      <RiskBanner assessment={risk} />

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0 }}>
              {selected?.name ?? symbol} <span className="muted" style={{ fontSize: 16 }}>{symbol}</span>
            </h2>
            <div className="mono" style={{ fontSize: 28 }}>
              ${(selected?.priceUsd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
              {selected && (
                <span className={`${priceUp ? "pos" : "neg"}`} style={{ fontSize: 15, marginLeft: 10 }}>
                  {priceUp ? "+" : ""}
                  {selected.change24hPct.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="muted" style={{ fontSize: 13, margin: "10px 0 12px", display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span>24h high {selected?.high24hUsd !== undefined ? `$${selected.high24hUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : "—"}</span>
          <span>24h low {selected?.low24hUsd !== undefined ? `$${selected.low24hUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : "—"}</span>
          <span>24h volume {fmtCompact(selected?.volume24hUsd)}</span>
          <span>range volume {fmtCompact(totalVolume)}</span>
          <span>as of {selected ? new Date(selected.asOf).toLocaleTimeString() : "—"}</span>
          {offline && <span className="badge warn">offline series</span>}
        </div>

        <PriceChart candles={candles} label={symbol} view={view} showVolume />
      </section>

      <section className="card table-wrap">
        <h2 style={{ marginTop: 0 }}>All instruments</h2>
        <table className="data">
          <thead>
            <tr>
              <th>Symbol</th><th>Class</th>
              <th style={{ textAlign: "right" }}>Price</th>
              <th style={{ textAlign: "right" }}>24h</th>
              <th>Source</th><th />
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.symbol} style={q.symbol === symbol ? { background: "rgba(76,141,255,.07)" } : undefined}>
                <td><strong>{q.symbol}</strong><div className="muted" style={{ fontSize: 12 }}>{q.name}</div></td>
                <td className="muted">{q.assetClass}</td>
                <td className="mono" style={{ textAlign: "right" }}>${q.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                <td className={q.change24hPct >= 0 ? "pos" : "neg"} style={{ textAlign: "right" }}>{q.change24hPct >= 0 ? "+" : ""}{q.change24hPct.toFixed(2)}%</td>
                <td><span className={`badge ${q.offline ? "warn" : "live"}`}>{q.offline ? "offline" : q.source}</span></td>
                <td><Link className="link" href={`/markets?symbol=${q.symbol}&range=${points}&view=${view}`}>Chart</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" aria-labelledby="news-heading">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <h2 id="news-heading" style={{ marginTop: 0 }}>News</h2>
          <span className="muted" style={{ fontSize: 12 }}>
            {config.newsFeeds.length} feeds · showing {visibleNews.length} of {news.length}
          </span>
        </div>

        {/* The URL carries the filter, so the page still renders correctly without JS
         * and a filtered view is shareable. */}
        <div className="news-filters" role="group" aria-label="Filter news by asset class">
          {NEWS_ASSET_FILTERS.map((filter) => {
            const active = filter.value === newsFilter;
            return (
              <Link
                key={filter.value}
                href={newsHref(filter.value)}
                className={`news-filter${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {filter.label}
                <span className="muted">{newsCounts[filter.value]}</span>
              </Link>
            );
          })}
        </div>

        {news.length === 0 ? (
          <div>
            <p className="muted" style={{ marginTop: 0 }}>
              No headlines are available right now. News is only ever shown from real
              configured RSS feeds — nothing here is fabricated.
            </p>
            <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
              Set <span className="mono">NEWS_FEEDS</span> to a comma-separated list of feed URLs
              (defaults: {config.newsFeeds.map((f) => new URL(f).hostname).join(", ")}).
            </p>
          </div>
        ) : visibleNews.length === 0 ? (
          <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
            No current headline is tagged to {NEWS_ASSET_FILTERS.find((f) => f.value === newsFilter)?.label ?? newsFilter}.
            Choose another asset class or <Link className="link" href={newsHref("all")}>see all news</Link>.
          </p>
        ) : (
          <ul className="news-browse">
            {visibleNews.map((n) => (
              <li key={n.url} className="news-browse-item">
                <a className="news-browse-headline" href={n.url} target="_blank" rel="noopener noreferrer">
                  {n.headline}
                </a>
                <span className="muted news-browse-meta">
                  <span>{n.source}</span>
                  <span aria-hidden>·</span>
                  <span title={new Date(n.publishedAt).toLocaleString()}>{timeAgo(n.publishedAt)}</span>
                  {n.category && <span className="badge">{n.category}</span>}
                  {n.relatedSymbols?.slice(0, 3).map((s) => (
                    <span key={s} className={`badge${s === symbol ? " live" : ""}`}>{s}</span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}

        {news.length > 0 && (
          <p className="muted" style={{ fontSize: 12, margin: "12px 0 0" }}>
            Headlines from public RSS feeds, {symbol} stories first. Tags are instrument symbols
            found in the headline or summary — an untagged story appears under All only.
          </p>
        )}
      </section>
    </div>
  );
}
