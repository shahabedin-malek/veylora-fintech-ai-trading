/**
 * Per-provider health, for the operator console.
 *
 * A smoke test (or a sync) records the last outcome per provider so an operator can see
 * at a glance which feeds are alive, which need a key, and which need a plan upgrade —
 * without hunting through logs. Stored in the shared `MarketCache` table under one key;
 * never throws (a DB problem yields an empty health map).
 */

import { prisma } from "@/lib/db";

const HEALTH_KEY = "provider:health";
const HISTORY_KEY = "provider:health:history";
/** How many recent checks to retain per provider. */
export const HEALTH_HISTORY_LIMIT = 20;

export type ProviderHealthStatus = "ok" | "upgrade-required" | "rejected" | "error" | "unconfigured" | "presence-only";

export interface ProviderHealthEntry {
  provider: string;
  ok: boolean;
  status: ProviderHealthStatus;
  /** A short, key-free message (never contains a credential). */
  error?: string;
  latencyMs?: number;
  checkedAt: string;
}

export async function providerHealth(): Promise<Record<string, ProviderHealthEntry>> {
  try {
    const row = await prisma.marketCache.findUnique({ where: { key: HEALTH_KEY } });
    if (!row) return {};
    const parsed: unknown = JSON.parse(row.payload);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, ProviderHealthEntry>) : {};
  } catch {
    return {};
  }
}

/** The stored per-provider check history, newest last. Never throws. */
export async function providerHealthHistory(): Promise<Record<string, ProviderHealthEntry[]>> {
  try {
    const row = await prisma.marketCache.findUnique({ where: { key: HISTORY_KEY } });
    if (!row) return {};
    const parsed: unknown = JSON.parse(row.payload);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, ProviderHealthEntry[]>) : {};
  } catch {
    return {};
  }
}

/**
 * Merge entries into the stored latest map **and** append them to a capped per-provider
 * history (so an operator can see a timeline, not just the last result). Best-effort:
 * never throws into a caller.
 */
export async function recordProviderHealth(entries: ProviderHealthEntry[]): Promise<void> {
  if (!entries.length) return;
  try {
    const current = await providerHealth();
    for (const entry of entries) current[entry.provider] = entry;
    const payload = JSON.stringify(current);
    await prisma.marketCache.upsert({
      where: { key: HEALTH_KEY },
      create: { key: HEALTH_KEY, payload, source: "provider-smoke", fetchedAt: new Date() },
      update: { payload, source: "provider-smoke", fetchedAt: new Date() },
    });

    const history = await providerHealthHistory();
    for (const entry of entries) {
      const series = history[entry.provider] ?? [];
      series.push(entry);
      history[entry.provider] = series.slice(-HEALTH_HISTORY_LIMIT);
    }
    const historyPayload = JSON.stringify(history);
    await prisma.marketCache.upsert({
      where: { key: HISTORY_KEY },
      create: { key: HISTORY_KEY, payload: historyPayload, source: "provider-smoke", fetchedAt: new Date() },
      update: { payload: historyPayload, source: "provider-smoke", fetchedAt: new Date() },
    });
  } catch {
    // Health is a nicety; never let it break the caller.
  }
}
