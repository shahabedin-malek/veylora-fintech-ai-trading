import { config } from "@/lib/config";
import { CATALOG } from "@/lib/market/catalog";
import { CoinGeckoProvider } from "@/lib/market/coingecko";
import { SimulatedProvider } from "@/lib/market/simulated";
import type { NewsItem, Quote } from "@/lib/market/types";

const simulated = new SimulatedProvider();
const coingecko = new CoinGeckoProvider();

/** Select a provider; unknown/unset falls back to CoinGecko in "auto". */
export function getProvider() {
  if (config.marketProvider === "simulated") return simulated;
  return coingecko;
}

/** Fetch quotes with graceful degradation. Never throws; falls back to the
 * simulated provider (clearly marked `simulated: true`) when a live source fails. */
export async function getQuotesSafe(symbols: string[]): Promise<{ quotes: Quote[]; degraded: boolean; source: string }> {
  try {
    const quotes = await getProvider().getQuotes(symbols);
    if (quotes.length) return { quotes, degraded: quotes.some((q) => q.simulated), source: getProvider().id };
  } catch {
    /* fall through to simulated */
  }
  const quotes = await simulated.getQuotes(symbols);
  return { quotes, degraded: true, source: "simulated" };
}

export async function getCandlesSafe(symbol: string, points = 60) {
  try {
    const candles = await getProvider().getCandles(symbol, points);
    // Trust the per-candle flag: a live provider may still fall back internally
    // to simulated data (e.g. forex/equities on CoinGecko), which must be labelled.
    if (candles.length) return { candles, simulated: candles.some((c) => c.simulated !== false) };
  } catch {
    /* fall through */
  }
  return { candles: await simulated.getCandles(symbol, points), simulated: true };
}

/**
 * News comes only from real configured RSS feeds. If none are configured we
 * return an empty list and the UI shows an explanatory empty state — we never
 * fabricate headlines.
 */
function classifyHeadline(text: string): NewsItem["category"] {
  const t = text.toLowerCase();
  if (/(bitcoin|ethereum|crypto|token|blockchain|stablecoin|defi|nft|binance|coinbase|solana)/.test(t)) return "crypto";
  if (/(stock|equity|nasdaq|s&p|dow|earnings|shares|bonds?|yields?|fed|inflation|forex|dollar|index)/.test(t)) return "markets";
  if (/(business|economy|company|revenue|ceo|lawsuit|acquisition|profit)/.test(t)) return "business";
  return "general";
}

/** Tag a headline with catalog symbols, using word boundaries so short tickers
 * (SOL, ADA) do not match inside ordinary words. */
function tagSymbols(text: string): string[] {
  const lower = text.toLowerCase();
  const out: string[] = [];
  for (const inst of CATALOG) {
    if (out.length >= 5) break;
    const ticker = new RegExp(`\\b${inst.symbol}\\b`, "i");
    if (ticker.test(text) || lower.includes(inst.name.toLowerCase())) out.push(inst.symbol);
  }
  return out;
}

function parseDate(raw: string | undefined): string {
  if (!raw) return new Date().toISOString();
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * News is read only from real configured RSS feeds (public defaults when
 * NEWS_FEEDS is unset). Headlines are never fabricated — if no feed responds,
 * this returns an empty list and the UI shows an explanatory empty state.
 * Pass `symbols` to sort instrument-relevant stories first.
 */
export async function getNews(symbols?: string[]): Promise<NewsItem[]> {
  const feeds = config.newsFeeds;
  if (!feeds.length) return [];
  const items: NewsItem[] = [];

  await Promise.all(
    feeds.slice(0, 6).map(async (feed) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.newsTimeoutMs);
      try {
        const res = await fetch(feed, {
          headers: { accept: "application/rss+xml, application/xml, text/xml", "user-agent": "VeyloraFeed/0.1 (+rss reader)" },
          signal: controller.signal,
          next: { revalidate: 300 },
        });
        if (!res.ok) return;
        const xml = await res.text();
        const host = safeHost(feed);
        const blocks = xml.split(/<item[\s>]/i).slice(1, config.newsPerFeed + 1);
        for (const b of blocks) {
          const title = b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
          const link = b.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1];
          const pub = b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1];
          const desc = b.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1];
          if (!title || !link) continue;
          const headline = stripCdata(title).trim();
          const body = desc ? stripCdata(desc).trim().slice(0, 400) : "";
          const text = `${headline} ${body}`;
          items.push({
            headline,
            source: host,
            url: stripCdata(link).trim(),
            publishedAt: parseDate(pub ? stripCdata(pub) : undefined),
            simulated: false,
            category: classifyHeadline(text),
            relatedSymbols: tagSymbols(text),
          });
        }
      } catch {
        /* ignore individual feed errors (timeout, network, parse) */
      } finally {
        clearTimeout(timer);
      }
    })
  );

  const seen = new Set<string>();
  const deduped = items.filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)));
  deduped.sort((a, b) => {
    const ra = symbols?.some((s) => a.relatedSymbols?.includes(s)) ? 1 : 0;
    const rb = symbols?.some((s) => b.relatedSymbols?.includes(s)) ? 1 : 0;
    if (ra !== rb) return rb - ra;
    return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  });
  return deduped.slice(0, 24);
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "");
}
