import { config } from "@/lib/config";
import { CATALOG, instrument } from "@/lib/market/catalog";
import { CoinGeckoProvider } from "@/lib/market/coingecko";
import { FinnhubProvider, finnhubConfigured } from "@/lib/market/finnhub";
import { OfflineProvider } from "@/lib/market/offline";
import type { AssetClass, Candle, MarketDataProvider, NewsItem, Quote } from "@/lib/market/types";

const offline = new OfflineProvider();
const coingecko = new CoinGeckoProvider();
const finnhub = new FinnhubProvider();

/**
 * Routes each instrument to the provider that can actually price it: crypto to
 * CoinGecko and equities to Finnhub (when it is configured), with everything else —
 * and anything a provider cannot answer — coming from the labelled offline generator.
 *
 * The provider list is computed per call so an env change (and a test stubbing the
 * key) takes effect without a module reload. A provider that throws contributes
 * nothing; the remaining symbols are filled in, never dropped.
 */
class CompositeProvider implements MarketDataProvider {
  id = "auto";
  supports: AssetClass[] = ["crypto", "forex", "equity"];

  private order(): MarketDataProvider[] {
    return finnhubConfigured() ? [coingecko, finnhub] : [coingecko];
  }

  private handles(provider: MarketDataProvider, symbol: string): boolean {
    const inst = instrument(symbol);
    return inst !== undefined && provider.supports.includes(inst.assetClass);
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const quotes: Quote[] = [];
    const covered = new Set<string>();

    for (const provider of this.order()) {
      const wanted = symbols.filter((s) => !covered.has(s.toUpperCase()) && this.handles(provider, s));
      if (!wanted.length) continue;
      try {
        for (const quote of await provider.getQuotes(wanted)) {
          quotes.push(quote);
          covered.add(quote.symbol.toUpperCase());
        }
      } catch {
        /* try the next provider; an uncovered symbol falls through to offline */
      }
    }

    const missing = symbols.filter((s) => !covered.has(s.toUpperCase()));
    if (missing.length) quotes.push(...(await offline.getQuotes(missing)));
    return quotes;
  }

  async getCandles(symbol: string, points: number): Promise<Candle[]> {
    const provider = this.order().find((p) => this.handles(p, symbol));
    if (provider) {
      try {
        const candles = await provider.getCandles(symbol, points);
        if (candles.length) return candles;
      } catch {
        /* fall through to the labelled offline generator */
      }
    }
    return offline.getCandles(symbol, points);
  }
}

const composite = new CompositeProvider();

/** Select a provider; unknown/unset falls back to the composite in "auto". */
export function getProvider(): MarketDataProvider {
  switch (config.marketProvider) {
    case "offline":
      return offline;
    case "coingecko":
      return coingecko;
    case "finnhub":
      return finnhub;
    default:
      return composite;
  }
}

/** Fetch quotes with graceful degradation. Never throws; falls back to the
 * offline provider (clearly marked `offline: true`) when a live source fails. */
export async function getQuotesSafe(symbols: string[]): Promise<{ quotes: Quote[]; degraded: boolean; source: string }> {
  const provider = getProvider();
  try {
    const quotes = await provider.getQuotes(symbols);
    if (quotes.length) {
      const degraded = quotes.some((q) => q.offline);
      // Report `offline` whenever no live value came back, even through a routing
      // provider — the point of `source` is whether the desk is showing real prices.
      return { quotes, degraded, source: quotes.every((q) => q.offline) ? "offline" : provider.id };
    }
  } catch {
    /* fall through to the offline fallback */
  }
  const quotes = await offline.getQuotes(symbols);
  return { quotes, degraded: true, source: "offline" };
}

export async function getCandlesSafe(symbol: string, points = 60) {
  try {
    const candles = await getProvider().getCandles(symbol, points);
    // Trust the per-candle flag: a live provider may still fall back internally
    // to offline data (e.g. forex/equities on CoinGecko), which must be labelled.
    if (candles.length) return { candles, offline: candles.some((c) => c.offline !== false) };
  } catch {
    /* fall through */
  }
  return { candles: await offline.getCandles(symbol, points), offline: true };
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
 * How many configured feeds are fetched per call. Feeds are fetched in parallel and
 * the merged list is capped afterwards, so this bounds request fan-out, not content.
 */
const MAX_FEEDS = 10;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#0?38;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Only absolute http(s) URLs are accepted — never `data:`, `file:` or a relative path. */
function absoluteHttpUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const url = decodeEntities(raw).trim().replace(/^<!\[CDATA\[|\]\]>$/g, "");
  if (!/^https?:\/\//i.test(url)) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Pull the published image out of an item, in the order feeds usually carry it:
 * an RSS `enclosure` (only when it is an image), then `media:content` /
 * `media:thumbnail`, then the first `<img>` inside the description or content body.
 * Returns undefined when the feed publishes no image, so the caller can omit it.
 */
function extractImageUrl(block: string): string | undefined {
  const enclosure = block.match(/<enclosure\b([^>]*)>/i)?.[1];
  if (enclosure && /\btype=["']image\//i.test(enclosure)) {
    const url = absoluteHttpUrl(/\burl=["']([^"']+)["']/i.exec(enclosure)?.[1]);
    if (url) return url;
  }
  for (const pattern of [
    /<media:content\b[^>]*\burl=["']([^"']+)["']/i,
    /<media:thumbnail\b[^>]*\burl=["']([^"']+)["']/i,
    /<img\b[^>]*\bsrc=["']([^"']+)["']/i,
  ]) {
    const url = absoluteHttpUrl(block.match(pattern)?.[1]);
    if (url) return url;
  }
  return undefined;
}

/**
 * News is read only from real configured RSS feeds (public defaults when
 * NEWS_FEEDS is unset). Headlines are never fabricated — if no feed responds,
 * this returns an empty list and the UI shows an explanatory empty state.
 * Pass `symbols` to sort instrument-relevant stories first, and `limit` to raise the
 * cap for a browsing surface (the markets page asks for more than the rail needs).
 */
export async function getNews(symbols?: string[], limit = 24): Promise<NewsItem[]> {
  const feeds = config.newsFeeds;
  if (!feeds.length) return [];
  const items: NewsItem[] = [];

  await Promise.all(
    feeds.slice(0, MAX_FEEDS).map(async (feed) => {
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
          const content = b.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1];
          if (!title || !link) continue;
          const headline = stripCdata(title).trim();
          const body = stripCdata(desc ?? content ?? "").trim().slice(0, 400);
          const text = `${headline} ${body}`;
          items.push({
            headline,
            source: host,
            url: stripCdata(link).trim(),
            publishedAt: parseDate(pub ? stripCdata(pub) : undefined),
            offline: false,
            category: classifyHeadline(text),
            relatedSymbols: tagSymbols(text),
            imageUrl: extractImageUrl(b),
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
  return deduped.slice(0, limit);
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
