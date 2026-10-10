/** Central configuration. All values come from the environment with safe defaults
 * so the app runs with only DATABASE_URL and SESSION_SECRET set. */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Real, public RSS feeds used when NEWS_FEEDS is unset. Every entry here was checked
 * live and publishes a per-item image (`enclosure`, `media:content`, `media:thumbnail`
 * or `<img>`), so the home page can show picture cards and the sidebar can list the
 * same items without one. Headlines are never fabricated; set NEWS_FEEDS to override.
 * See `docs/NEWS_SOURCES.md` for the full verified list (and the entries deliberately
 * left out).
 */
export const DEFAULT_NEWS_FEEDS = [
  "https://cointelegraph.com/rss",
  "https://www.coindesk.com/arc/outboundfeeds/rss",
  "https://decrypt.co/feed",
  "https://cryptoslate.com/feed/",
  "https://bitcoinist.com/feed/",
  "https://cryptopotato.com/feed/",
  "https://www.investing.com/rss/news_25.rss",
  "https://feeds.bbci.co.uk/news/business/rss.xml",
] as const;

export const config = {
  minTradeUsd: intEnv("MIN_TRADE_USD", 20),
  withdrawFeeBps: intEnv("WITHDRAW_FEE_BPS", 100),
  /** Hard per-deposit spend cap (USD). A larger deposit is refused, never trimmed. */
  depositCapUsd: intEnv("DEPOSIT_CAP_USD", 10000),
  /**
   * How long a user has to dispute a declined withdrawal request, in **business days**
   * (Mon–Fri, UTC; no public-holiday calendar — see `src/lib/withdrawals.ts`).
   */
  disputeWindowBusinessDays: intEnv("DISPUTE_WINDOW_BUSINESS_DAYS", 3),
  /**
   * Custody spend limits (PHASE18-004). Enforced at the custody boundary before any
   * real key is used; a larger amount is refused, never trimmed.
   */
  custody: {
    spendLimits: {
      maxPerTransactionCents: intEnv("CUSTODY_MAX_PER_TX_USD", 1000) * 100,
      maxDailyCents: intEnv("CUSTODY_DAILY_LIMIT_USD", 5000) * 100,
    },
  },
  /**
   * Venue-order spend limits. A venue order (WunderTrading) is signed by the venue's
   * API, not by custody, so it has its own caps rather than borrowing the custody
   * ledger's. A larger order is refused, never trimmed.
   */
  venue: {
    spendLimits: {
      maxPerTransactionCents: intEnv("VENUE_MAX_PER_TX_USD", 1000) * 100,
      maxDailyCents: intEnv("VENUE_DAILY_LIMIT_USD", 5000) * 100,
    },
  },
  /**
   * Signal-layer tuning. A 24h move of at least `moveThresholdPct` on a catalog
   * instrument is recorded as a neutral market-move event by the derived (keyless)
   * providers, so the desk keeps market context when a keyed signal API is unavailable.
   */
  signals: {
    moveThresholdPct: intEnv("SIGNAL_MOVE_THRESHOLD_PCT", 5),
  },
  /** `auto` routes by asset class: crypto → CoinGecko, equities → Finnhub (if configured),
   *  everything else → the labelled offline generator. A single provider can be pinned. */
  marketProvider: (process.env.MARKET_PROVIDER || "auto") as "auto" | "coingecko" | "finnhub" | "offline",
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
  /** Terminal tick cadence: deterministic bounds (ms). */
  terminalTickMs: { min: 3000, max: 30000 },
  stopWarningMs: 5 * 60 * 1000,
} as const;

export const MIN_TRADE_CENTS = config.minTradeUsd * 100;

/** Per-deposit cap in integer cents (see `docs/NETWORK_BOUNDARY.md`). */
export const DEPOSIT_CAP_CENTS = config.depositCapUsd * 100;
