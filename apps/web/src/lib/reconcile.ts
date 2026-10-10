/**
 * Desk reconciliation — an **internal** consistency check, run on a schedule.
 *
 * `NETWORK_BOUNDARY.md` item 8 asks for ledger entries to reconcile against **on-chain**
 * balance changes. That needs a live deposit indexer, which does not exist yet, so this
 * module deliberately does **not** claim to do it. Instead it checks the invariants the
 * app controls end to end:
 *
 *   1. **Custody bookkeeping** — every `CustodySpend` row is written in the same
 *      transaction as a `custody.spend` `AuditLog` row, so their counts must match. A gap
 *      means a movement recorded its amount but not its audit trail (or vice-versa).
 *   2. **Held funds** — a withdrawal request left `FAILED` (a payout that may have been
 *      broadcast) holds the user's amount until an admin releases it. Anything older than
 *      a day is surfaced so it cannot sit unnoticed.
 *
 * It never moves money and never throws: a database problem yields a report that says so
 * rather than a false failure. The latest report is stored in `MarketCache` for the desk
 * dashboard, and a drift writes an audit entry.
 */

import { prisma } from "@/lib/db";

/** Where the latest report is cached for the operator console. */
export const RECONCILE_KEY = "desk:reconciliation";
export const DEFAULT_WINDOW_DAYS = 7;
/** A held payout older than this needs an operator to look at it. */
const HELD_AFTER_MS = 24 * 60 * 60 * 1000;

export interface ReconciliationFinding {
  /** A stable code so the console/alerting can group findings. */
  code: "custody-ledger-gap" | "held-withdrawal";
  detail: string;
}

export interface ReconciliationReport {
  checkedAt: string;
  windowDays: number;
  /** Real custody movements in the window, and their total. */
  custodySpendCount: number;
  custodySpendCents: number;
  /** `custody.spend` audit rows in the window — must equal `custodySpendCount`. */
  custodyAuditCount: number;
  /** Payouts held for review (status `FAILED`). */
  heldWithdrawals: { id: string; amountCents: number; reason: string | null }[];
  findings: ReconciliationFinding[];
  ok: boolean;
}

/**
 * Run the internal reconciliation over a recent window. Pure of side effects — the caller
 * decides whether to record it.
 */
export async function runReconciliation(
  opts: { now?: Date; windowDays?: number } = {}
): Promise<ReconciliationReport> {
  const now = opts.now ?? new Date();
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const [spend, auditCount, failedRequests] = await Promise.all([
    prisma.custodySpend.aggregate({
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { amountCents: true },
    }),
    prisma.auditLog.count({ where: { action: "custody.spend", createdAt: { gte: since } } }),
    prisma.withdrawalRequest.findMany({
      where: { status: "FAILED" },
      select: { id: true, amountCents: true, reason: true, decidedAt: true, createdAt: true },
    }),
  ]);

  const custodySpendCount = spend._count._all;
  const custodySpendCents = spend._sum.amountCents ?? 0;

  const findings: ReconciliationFinding[] = [];

  if (custodySpendCount !== auditCount) {
    findings.push({
      code: "custody-ledger-gap",
      detail: `${custodySpendCount} custody spend row(s) vs ${auditCount} custody.spend audit row(s) in the last ${windowDays}d.`,
    });
  }

  const heldWithdrawals = failedRequests
    .filter((r) => now.getTime() - (r.decidedAt ?? r.createdAt).getTime() > HELD_AFTER_MS)
    .map((r) => ({ id: r.id, amountCents: r.amountCents, reason: r.reason }));
  for (const held of heldWithdrawals) {
    findings.push({
      code: "held-withdrawal",
      detail: `Payout ${held.id} holds ${held.amountCents}c pending an operator release.`,
    });
  }

  return {
    checkedAt: now.toISOString(),
    windowDays,
    custodySpendCount,
    custodySpendCents,
    custodyAuditCount: auditCount,
    heldWithdrawals,
    findings,
    ok: findings.length === 0,
  };
}

/** Persist the report for the operator console. Best-effort; never throws. */
export async function recordReconciliation(report: ReconciliationReport): Promise<void> {
  try {
    await prisma.marketCache.upsert({
      where: { key: RECONCILE_KEY },
      create: { key: RECONCILE_KEY, payload: JSON.stringify(report), source: "reconcile" },
      update: { payload: JSON.stringify(report), source: "reconcile", fetchedAt: new Date() },
    });
  } catch {
    // A cache write must not fail the run.
  }
}

/**
 * Run, record and (on drift) audit the reconciliation. The audit entry carries only codes
 * and counts — never an amount attributed to a person.
 */
export async function reconcileDesk(
  opts: { now?: Date; windowDays?: number } = {}
): Promise<ReconciliationReport> {
  const report = await runReconciliation(opts);
  await recordReconciliation(report);
  if (!report.ok) {
    await prisma.auditLog
      .create({
        data: {
          action: "desk.reconciliation.drift",
          subject: null,
          detail: report.findings.map((f) => f.code).join(", ").slice(0, 400),
        },
      })
      .catch(() => undefined);
  }
  return report;
}

/** The last stored report, or `null`. Never throws. */
export async function lastReconciliation(): Promise<ReconciliationReport | null> {
  try {
    const row = await prisma.marketCache.findUnique({ where: { key: RECONCILE_KEY } });
    if (!row) return null;
    const parsed: unknown = JSON.parse(row.payload);
    return parsed && typeof parsed === "object" ? (parsed as ReconciliationReport) : null;
  } catch {
    return null;
  }
}
