/**
 * Desk risk gate — news and signals combined into a single "may we take new risk?"
 * decision.
 *
 * This is deliberately a **rule set, not a model**: every rule is explicit, explained in
 * the returned `reasons`, and reproducible. It is conservative on purpose — a signal or
 * headline that argues for caution should be able to refuse a trade — and it can only
 * ever *refuse*. Nothing here can open a position, and the money paths remain gated by
 * `src/lib/execution.ts` and the custody boundary.
 *
 * Inputs:
 * Both inputs are read from **stored state**, never fetched live, so the decision is
 * fast, deterministic and never depends on a provider or a feed being reachable at
 * trade time:
 *   - **Signals** come from the store (`signalEvent`).
 *   - **News** comes from a synced snapshot (`src/lib/risk/news.ts`, `MarketCache` key
 *     `risk:news`) of the real RSS feeds the app already uses (`docs/NEWS_SOURCES.md`).
 *
 * That makes an explicit sync a prerequisite for the gate — see `/admin/signals`. With
 * no stored input the gate is `normal`: absence of evidence is not evidence of
 * danger, and it is certainly not a reason to invent a refusal.
 */

import { storedRiskNews } from "@/lib/risk/news";
import { MARKET_MOVE_KEY } from "@/lib/signals/derive";
import { recentSignals } from "@/lib/signals/store";

export type RiskLevel = "normal" | "elevated" | "off";

/** How far back an input counts. Stale fear is not a reason to refuse a trade today. */
export const RECENCY_HOURS = 48;
export const RECENCY_MS = RECENCY_HOURS * 60 * 60 * 1000;

const RECENT_SIGNAL_LIMIT = 200;

/**
 * Extreme-volatility signals. They carry no direction (`nameBullish == nameBearish`),
 * so they are evidence of *dangerous conditions*, not of a bearish view. `MARKET_MOVE_KEY`
 * is the neutral market-move event the derived (keyless) providers emit: a big move makes
 * the desk `elevated` (a heads-up, never a refusal), so an alternate feed can inform the
 * state without ever stopping trading. Because it is `neutral` it also cannot count toward
 * the bearish-breadth rule below.
 */
export const VOLATILITY_KEYS = new Set([
  "SIGNALS_SUMMARY_TR_ATR_4x",
  "SIGNALS_SUMMARY_TR_ATR_5x",
  MARKET_MOVE_KEY,
]);

/**
 * Regime signals that, when bearish, argue against taking new risk across every
 * timeframe — not a short entry, just a reason to stand aside.
 */
export const BEARISH_REGIME_KEYS = new Set([
  "SIGNALS_SUMMARY_STRONG_UP_DOWN_TREND",
  "UP_DOWN_TREND",
  "SIGNALS_SUMMARY_VERY_OVERSOLD_OVERBOUGHT",
]);

/** Desk-wide bearish breadth: at least this many, and this many times the bullish count. */
export const BREADTH_MIN_BEARISH = 3;
export const BREADTH_RATIO = 2;

/**
 * Severe-event vocabulary for a headline. Deliberately explicit and conservative — a
 * hack, exploit, insolvency, delisting or seizure argues for standing aside. Ordinary
 * price moves ("crash", "plunge") are **not** included: they describe volatility, not
 * a reason to distrust the venue, and including them would refuse trades constantly.
 */
export const NEWS_RISK_PATTERN =
  /\b(hack(?:ed|ing)?|exploit(?:ed)?|breach(?:ed)?|drained|rug ?pull|scam|fraud|ponzi|insolven(?:t|cy)|bankrupt(?:cy)?|collapse[sd]?|delist(?:ed|ing)?|halted|shut ?down|seized|indict(?:ed|ment)|charged with|sanction(?:s|ed))\b/i;

/** The minimal signal shape the gate needs — a stored row or a live `SignalEvent`. */
export interface RiskSignalInput {
  providerKey: string;
  name: string;
  symbol: string;
  direction: string;
  ts: Date | string;
}

/** The minimal news shape the gate needs. */
export interface RiskNewsInput {
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  /** True when new risk must not be taken (the trade gate refuses). */
  riskOff: boolean;
  /** Human-readable evidence, in the order it was found. */
  reasons: string[];
  /** The headlines that contributed, for the operator and the audit trail. */
  headlines: { headline: string; source: string; url: string }[];
  /** The signals that contributed. */
  signals: { symbol: string; name: string; direction: string }[];
  /** How much input the decision was made on. */
  counts: { signals: number; news: number };
}

/** Shown when the trade path refuses because the desk is risk-off. */
export const RISK_OFF_MESSAGE =
  "The desk is risk-off: recent news or signals argue for standing aside, so nothing was submitted.";

function withinRecency(when: Date | string, now: number): boolean {
  const t = when instanceof Date ? when.getTime() : Date.parse(when);
  return Number.isFinite(t) && now - t <= RECENCY_MS;
}

/**
 * Pure risk assessment. Deterministic and side-effect free: given the same inputs and
 * `now`, it returns the same verdict.
 */
export function assessRisk(input: {
  signals: RiskSignalInput[];
  news: RiskNewsInput[];
  now?: number;
}): RiskAssessment {
  const now = input.now ?? Date.now();
  const reasons: string[] = [];
  const headlines: RiskAssessment["headlines"] = [];
  const signals: RiskAssessment["signals"] = [];

  const recentSignals = input.signals.filter((s) => withinRecency(s.ts, now));
  const recentNews = input.news.filter((n) => withinRecency(n.publishedAt, now));

  let severe = false;

  // 1. Severe news events.
  for (const item of recentNews) {
    if (NEWS_RISK_PATTERN.test(item.headline)) {
      severe = true;
      headlines.push({ headline: item.headline, source: item.source, url: item.url });
      reasons.push(`News: “${item.headline}” (${item.source})`);
    }
  }

  // 2. A bearish regime signal on any instrument.
  for (const signal of recentSignals) {
    if (signal.direction === "bearish" && BEARISH_REGIME_KEYS.has(signal.providerKey)) {
      severe = true;
      signals.push({ symbol: signal.symbol, name: signal.name, direction: signal.direction });
      reasons.push(`Signal: ${signal.name} on ${signal.symbol}`);
    }
  }

  // 3. Extreme volatility — dangerous conditions, regardless of direction.
  const spikes = recentSignals.filter((s) => VOLATILITY_KEYS.has(s.providerKey));
  for (const spike of spikes) {
    signals.push({ symbol: spike.symbol, name: spike.name, direction: spike.direction });
    reasons.push(`Volatility: ${spike.name} on ${spike.symbol}`);
  }

  // 4. Desk-wide bearish breadth.
  const bearish = recentSignals.filter((s) => s.direction === "bearish").length;
  const bullish = recentSignals.filter((s) => s.direction === "bullish").length;
  if (bearish >= BREADTH_MIN_BEARISH && bearish > bullish * BREADTH_RATIO) {
    severe = true;
    reasons.push(
      `Breadth: ${bearish} bearish vs ${bullish} bullish signals in the last ${RECENCY_HOURS}h`
    );
  }

  const level: RiskLevel = severe ? "off" : spikes.length ? "elevated" : "normal";

  return {
    level,
    riskOff: level === "off",
    reasons,
    headlines,
    signals,
    counts: { signals: recentSignals.length, news: recentNews.length },
  };
}

/**
 * Assess the desk from stored signals and the live news feeds. Never throws: a feed or
 * database problem degrades to a smaller input set, and a risk gate that cannot read its
 * inputs returns `normal` (it must not invent a refusal either).
 */
export async function assessDeskRisk(opts: { now?: number } = {}): Promise<RiskAssessment> {
  const [stored, news] = await Promise.all([
    recentSignals(RECENT_SIGNAL_LIMIT).catch(() => []),
    storedRiskNews(),
  ]);

  return assessRisk({
    signals: stored.map((s) => ({
      providerKey: s.providerKey,
      name: s.name,
      symbol: s.symbol,
      direction: s.direction,
      ts: s.ts,
    })),
    news: news.map((n) => ({
      headline: n.headline,
      source: n.source,
      url: n.url,
      publishedAt: n.publishedAt,
    })),
    now: opts.now,
  });
}
