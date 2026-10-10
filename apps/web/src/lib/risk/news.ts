/**
 * News snapshot for the risk gate.
 *
 * The money path must be **deterministic and must not depend on a third-party feed
 * being reachable**, so the gate does not fetch RSS at trade time. Instead the real
 * feeds are fetched by an explicit sync (from `/admin/signals`, the same place signals
 * are synced) and stored as a single snapshot row in `MarketCache`. The gate then reads
 * that row, offline, in constant time.
 *
 * The snapshot is still only ever real feed content — nothing is fabricated, and an
 * empty snapshot means "no news evidence", not "good news".
 */

import { prisma } from "@/lib/db";
import { getNews } from "@/lib/market";
import type { RiskNewsInput } from "@/lib/risk/assess";

/** `MarketCache` key holding the snapshot. One row. */
export const RISK_NEWS_CACHE_KEY = "risk:news";

const RISK_NEWS_LIMIT = 40;

function isRiskNews(value: unknown): value is RiskNewsInput {
  if (!value || typeof value !== "object") return false;
  const n = value as Partial<RiskNewsInput>;
  return typeof n.headline === "string" && typeof n.publishedAt === "string";
}

/**
 * Read the stored snapshot. Never throws: a missing or corrupt row yields an empty
 * list, so a broken cache degrades the gate rather than breaking a request.
 */
export async function storedRiskNews(): Promise<RiskNewsInput[]> {
  try {
    const row = await prisma.marketCache.findUnique({ where: { key: RISK_NEWS_CACHE_KEY } });
    if (!row) return [];
    const parsed = JSON.parse(row.payload) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRiskNews) : [];
  } catch {
    return [];
  }
}

/**
 * Fetch the real feeds and store the snapshot the gate reads. Returns how many items
 * were fetched and stored (the same number — the snapshot is a straight copy).
 */
export async function refreshRiskNews(): Promise<{ fetched: number; stored: number }> {
  const news = await getNews(undefined, RISK_NEWS_LIMIT);
  const snapshot: RiskNewsInput[] = news.map((n) => ({
    headline: n.headline,
    source: n.source,
    url: n.url,
    publishedAt: n.publishedAt,
  }));

  await prisma.marketCache.upsert({
    where: { key: RISK_NEWS_CACHE_KEY },
    create: {
      key: RISK_NEWS_CACHE_KEY,
      payload: JSON.stringify(snapshot),
      source: "rss",
      fetchedAt: new Date(),
    },
    update: { payload: JSON.stringify(snapshot), source: "rss", fetchedAt: new Date() },
  });

  return { fetched: snapshot.length, stored: snapshot.length };
}
