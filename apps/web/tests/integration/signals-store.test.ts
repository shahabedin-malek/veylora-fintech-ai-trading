import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import { persistSignals, recentSignals, signalCounts } from "@/lib/signals/store";
import { syncSignals } from "@/lib/signals/sync";
import type { SignalEvent } from "@/lib/signals/types";

/**
 * Signals are persisted so the desk can audit why a trade was allowed or refused, so the
 * properties that matter are: an event is stored once, re-syncing an overlapping window
 * de-duplicates instead of inflating history, and a sync with no provider configured is
 * inert rather than throwing or inventing data.
 */

function event(over: Partial<SignalEvent> = {}): SignalEvent {
  return {
    provider: "altfins",
    providerKey: "SIGNALS_SUMMARY_BULL_POWER",
    name: "Bull Power",
    symbol: "SOL",
    assetClass: "crypto",
    direction: "bullish",
    ts: "2026-10-08T16:48:25.000Z",
    priceUsd: 109.83,
    marketCapUsd: 64822436701,
    changePct: 0.69,
    raw: { signalKey: "SIGNALS_SUMMARY_BULL_POWER" },
    ...over,
  };
}

function searchResponse(content: unknown[]): Response {
  return new Response(JSON.stringify({ content }), { status: 200 });
}

function altfinsItem(over: Record<string, unknown> = {}) {
  return {
    timestamp: "2026-10-08T16:48:25Z",
    direction: "BULLISH",
    signalKey: "SIGNALS_SUMMARY_BULL_POWER",
    signalName: "Bull Power",
    symbol: "SOL",
    lastPrice: "109.83",
    marketCap: "64,822,436,701",
    priceChange: "0.69%",
    ...over,
  };
}

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await prisma.signalEvent.deleteMany({});
});

describe("persistSignals", () => {
  it("stores an event once and de-duplicates an identical re-sync", async () => {
    const first = await persistSignals([event()]);
    expect(first).toEqual({ inserted: 1, duplicate: 0 });

    const second = await persistSignals([event()]);
    expect(second).toEqual({ inserted: 0, duplicate: 1 });

    expect(await prisma.signalEvent.count()).toBe(1);
  });

  it("keeps events that differ only by direction or timestamp", async () => {
    await persistSignals([event(), event({ direction: "bearish" }), event({ ts: "2026-10-09T16:48:25.000Z" })]);
    expect(await prisma.signalEvent.count()).toBe(3);
  });

  it("returns the newest first and reports counts", async () => {
    await persistSignals([
      event({ ts: "2026-10-01T00:00:00.000Z", symbol: "BTC" }),
      event({ ts: "2026-10-09T00:00:00.000Z", symbol: "ETH" }),
    ]);
    const recent = await recentSignals(10);
    expect(recent.map((s) => s.symbol)).toEqual(["ETH", "BTC"]);

    const counts = await signalCounts();
    expect(counts.total).toBe(2);
    expect(counts.byProvider[0]).toMatchObject({ provider: "altfins" });
  });
});

describe("syncSignals", () => {
  it("records nothing when every provider answers empty (no fabrication)", async () => {
    vi.stubEnv("ALTFINS_API_KEY", "");
    // Keyless alternates are always present now; an empty payload must stay empty.
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncSignals();
    expect(result).toMatchObject({ fetched: 0, inserted: 0, unmapped: 0 });
    expect(await prisma.signalEvent.count()).toBe(0);
  });

  it("degrades (and does not throw) when every provider fails", async () => {
    vi.stubEnv("ALTFINS_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));

    const result = await syncSignals();
    expect(result).toMatchObject({ fetched: 0, inserted: 0, degraded: true });
    expect(await prisma.signalEvent.count()).toBe(0);
  });

  it("stores what the provider returns and reports the mapping", async () => {
    vi.stubEnv("ALTFINS_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => searchResponse([altfinsItem(), altfinsItem({ symbol: "PEPE" })])));

    const result = await syncSignals({ symbols: ["SOL"] });
    expect(result).toMatchObject({ fetched: 1, inserted: 1, duplicate: 0, unmapped: 1, degraded: false });

    const stored = await recentSignals(5);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ symbol: "SOL", provider: "altfins", direction: "bullish" });
  });

  it("is idempotent across two syncs of the same window", async () => {
    vi.stubEnv("ALTFINS_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => searchResponse([altfinsItem()])));

    await syncSignals({ symbols: ["SOL"] });
    const second = await syncSignals({ symbols: ["SOL"] });
    expect(second).toMatchObject({ inserted: 0, duplicate: 1 });
    expect(await prisma.signalEvent.count()).toBe(1);
  });
});
