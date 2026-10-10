import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import { assessDeskRisk } from "@/lib/risk/assess";
import { RISK_NEWS_CACHE_KEY } from "@/lib/risk/news";
import { persistSignals } from "@/lib/signals/store";

/**
 * The risk gate is read by the money path, so it must be **deterministic and offline**:
 * it reads stored signals and a stored news snapshot, never a live feed. With no stored
 * input it is `normal` (absence of evidence is not danger), and neither a stale headline
 * nor the fetch layer can change the verdict.
 */

async function storeSnapshot(payload: string) {
  await prisma.marketCache.upsert({
    where: { key: RISK_NEWS_CACHE_KEY },
    create: { key: RISK_NEWS_CACHE_KEY, payload, source: "rss", fetchedAt: new Date() },
    update: { payload, source: "rss", fetchedAt: new Date() },
  });
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await prisma.signalEvent.deleteMany({});
  await prisma.marketCache.deleteMany({ where: { key: RISK_NEWS_CACHE_KEY } });
});

describe("assessDeskRisk", () => {
  it("is normal with nothing stored, and makes no network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const risk = await assessDeskRisk();
    expect(risk.level).toBe("normal");
    expect(risk.riskOff).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is risk-off from a stored news snapshot", async () => {
    await storeSnapshot(
      JSON.stringify([
        { headline: "Cross-chain bridge exploited for $20m", source: "example.com", url: "https://example.com/a", publishedAt: new Date().toISOString() },
      ])
    );

    const risk = await assessDeskRisk();
    expect(risk.riskOff).toBe(true);
    expect(risk.reasons[0]).toMatch(/exploited/);
  });

  it("ignores a stale headline in the snapshot", async () => {
    await storeSnapshot(
      JSON.stringify([
        { headline: "Protocol hacked", source: "example.com", url: "https://example.com/a", publishedAt: new Date(Date.now() - 72 * 3600_000).toISOString() },
      ])
    );

    const risk = await assessDeskRisk();
    expect(risk.riskOff).toBe(false);
  });

  it("is risk-off from stored signals alone", async () => {
    await persistSignals([
      {
        provider: "altfins",
        providerKey: "SIGNALS_SUMMARY_STRONG_UP_DOWN_TREND",
        name: "Strong Downtrend across Short- Medium- and Long-Term",
        symbol: "BTC",
        assetClass: "crypto",
        direction: "bearish",
        ts: new Date().toISOString(),
      },
    ]);

    const risk = await assessDeskRisk();
    expect(risk.riskOff).toBe(true);
    expect(risk.signals[0].symbol).toBe("BTC");
  });

  it("degrades to normal when the snapshot is corrupt rather than refusing on bad data", async () => {
    await storeSnapshot("not-an-array"); // valid JSON, wrong shape
    const risk = await assessDeskRisk();
    expect(risk.riskOff).toBe(false);
    expect(risk.counts.news).toBe(0);
  });
});
