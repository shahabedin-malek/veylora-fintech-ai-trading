/** Central configuration. All values come from the environment with safe defaults
 * so the app runs with only DATABASE_URL and SESSION_SECRET set. */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Real, public RSS feeds used when NEWS_FEEDS is unset. All are live public
 * news sources; headlines are never fabricated. Set NEWS_FEEDS to override. */
export const DEFAULT_NEWS_FEEDS = [
  "https://cointelegraph.com/rss",
  "https://www.investing.com/rss/news_25.rss",
  "https://feeds.bbci.co.uk/news/business/rss.xml",
] as const;

export const config = {
  minTradeUsd: intEnv("MIN_TRADE_USD", 20),
  withdrawFeeBps: intEnv("WITHDRAW_FEE_BPS", 100),
  marketProvider: (process.env.MARKET_PROVIDER || "auto") as "auto" | "coingecko" | "simulated",
  /** Configured feeds win; otherwise fall back to the real public defaults. */
  newsFeeds: (() => {
    const configured = (process.env.NEWS_FEEDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return configured.length ? configured : [...DEFAULT_NEWS_FEEDS];
  })(),
  newsTimeoutMs: 6000,
  newsPerFeed: 8,
  /** Simulated trading: deterministic balance wobble bounds (ms). */
  terminalTickMs: { min: 3000, max: 30000 },
  stopWarningMs: 5 * 60 * 1000,
} as const;

export const MIN_TRADE_CENTS = config.minTradeUsd * 100;
