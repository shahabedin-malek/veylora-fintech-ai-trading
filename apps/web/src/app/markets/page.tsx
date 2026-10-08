import Link from "next/link";
import { CATALOG } from "@/lib/market/catalog";
import { getCandlesSafe, getNews, getQuotesSafe } from "@/lib/market";
import { PriceChart, isChartView, type ChartView } from "@/components/PriceChart";
import { config } from "@/lib/config";

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

function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff)) return "recent";
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; range?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const symbol = (sp.symbol || "BTC").toUpperCase();
  const range = Number(sp.range || 60);
  const points = RANGES.some((r) => r.value === range) ? range : 60;
  const view: ChartView = isChartView(sp.view) ? sp.view : "area";

  const [{ quotes, degraded, source }, { candles, simulated }, news] = await Promise.all([
    getQuotesSafe(UNIVERSE),
    getCandlesSafe(symbol, points),
    getNews([symbol]),
  ]);

  const selected = quotes.find((q) => q.symbol === symbol);
  const priceUp = (selected?.change24hPct ?? 0) >= 0;
  const totalVolume = candles.reduce((s, c) => s + (c.v ?? 0), 0);

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Markets</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            Crypto, forex and equities · source: {source}
            {degraded ? " (simulated fallback)" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {RANGES.map((r) => (
            <Link key={r.value} className={`btn ${r.value === points ? "primary" : "ghost"}`} href={`/markets?symbol=${symbol}&range=${r.value}&view=${view}`}>
              {r.label}
            </Link>
          ))}
        </div>
      </div>

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
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {VIEWS.map((v) => (
              <Link key={v.value} className={`btn ${v.value === view ? "primary" : "ghost"}`} href={`/markets?symbol=${symbol}&range=${points}&view=${v.value}`}>
                {v.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="muted" style={{ fontSize: 13, margin: "10px 0 12px", display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span>24h high {selected?.high24hUsd !== undefined ? `$${selected.high24hUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : "—"}</span>
          <span>24h low {selected?.low24hUsd !== undefined ? `$${selected.low24hUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : "—"}</span>
          <span>24h volume {fmtCompact(selected?.volume24hUsd)}</span>
          <span>range volume {fmtCompact(totalVolume)}</span>
          <span>as of {selected ? new Date(selected.asOf).toLocaleTimeString() : "—"}</span>
          {simulated && <span className="badge sim">simulated series</span>}
        </div>

        <PriceChart candles={candles} label={symbol} view={view} showVolume />
      </section>

      <div className="grid cols-2" style={{ alignItems: "start" }}>
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
                  <td><span className={`badge ${q.simulated ? "sim" : "live"}`}>{q.simulated ? "sim" : q.source}</span></td>
                  <td><Link className="link" href={`/markets?symbol=${q.symbol}&range=${points}&view=${view}`}>Chart</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <h2 style={{ marginTop: 0 }}>Latest news</h2>
            <span className="muted" style={{ fontSize: 12 }}>{config.newsFeeds.length} feeds</span>
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
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12, maxHeight: 520, overflowY: "auto" }}>
              {news.map((n) => {
                const relevant = n.relatedSymbols?.includes(symbol);
                return (
                  <li key={n.url} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                    <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
                      {n.headline}
                    </a>
                    <div className="muted" style={{ fontSize: 12, marginTop: 5, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span>{n.source}</span>
                      <span aria-hidden>·</span>
                      <span title={new Date(n.publishedAt).toLocaleString()}>{timeAgo(n.publishedAt)}</span>
                      {n.category && <span className="badge">{n.category}</span>}
                      {relevant && <span className="badge live">{symbol}</span>}
                      {n.relatedSymbols?.filter((s) => s !== symbol).slice(0, 2).map((s) => (
                        <span key={s} className="badge">{s}</span>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {news.length > 0 && (
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
              Headlines from public RSS feeds, sorted with {symbol} stories first. Source and time shown on every item.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
