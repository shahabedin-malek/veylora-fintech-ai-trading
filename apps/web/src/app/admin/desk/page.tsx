import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/domain/money";
import { assessDeskRisk } from "@/lib/risk/assess";
import { providerPoolAlerts, providerPoolStatus, warmCredentialCache } from "@/lib/credentials/pool";
import { providerHealth } from "@/lib/credentials/health";
import { PROVIDER_DEFS } from "@/lib/credentials/providers";
import { lastReconciliation } from "@/lib/reconcile";

/**
 * Desk operations dashboard — the single "is the desk healthy, and what needs me?"
 * view (`docs/OPEN_TASKS_AND_IDEAS.md` §7/§8).
 *
 * It only **reads**: the desk risk verdict, the provider key-pool state, the last smoke
 * result per provider, the withdrawal requests awaiting a decision, and the most recent
 * venue orders. It offers no action of its own — every link goes to the console that
 * owns the decision, so this page can never move money or change state.
 */

const LEVEL_TONE: Record<string, string> = { normal: "good", elevated: "warn", off: "neg" };
const HEALTH_TONE: Record<string, string> = {
  ok: "good",
  "upgrade-required": "warn",
  rejected: "neg",
  error: "neg",
  unconfigured: "",
  "presence-only": "",
};

export default async function AdminDeskPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  // Reflect any pool-managed keys in the synchronous gates before reading status.
  await warmCredentialCache(PROVIDER_DEFS.map((d) => d.id));

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [risk, alerts, health, statuses, pendingWithdrawals, venueOrders, venueToday, reconciliation] =
    await Promise.all([
      assessDeskRisk(),
      providerPoolAlerts(),
      providerHealth(),
      Promise.all(PROVIDER_DEFS.map((d) => providerPoolStatus(d.id))),
      prisma.withdrawalRequest.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 10,
        select: { id: true, amountCents: true, rail: true, createdAt: true, userId: true },
      }),
      prisma.transaction.findMany({
        where: { kind: "VENUE_ORDER" },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, amountCents: true, status: true, detail: true, createdAt: true },
      }),
      prisma.transaction.aggregate({
        where: { kind: "VENUE_ORDER", createdAt: { gte: since } },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      lastReconciliation(),
    ]);

  const healthEntries = PROVIDER_DEFS.map((d) => health[d.id]).filter(Boolean);
  const okProviders = statuses.filter((s) => s.state === "ok").length;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <h1 style={{ margin: 0 }}>Desk operations</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          A read-only roll-up of desk risk, provider health and what is waiting on an operator.{" "}
          <Link className="link" href="/admin">
            Back to CRM console
          </Link>
        </p>
      </div>

      <div className="grid cols-3">
        <div className="card" data-desk-risk={risk.level}>
          <div className="muted" style={{ fontSize: 13 }}>Desk risk</div>
          <div className="mono" style={{ fontSize: 26 }}>
            <span className={`badge ${LEVEL_TONE[risk.level] ?? ""}`}>{risk.level}</span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {risk.riskOff ? "Real execution is refused while risk-off." : "Not refusing new risk."}
          </div>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Providers healthy</div>
          <div className="mono" style={{ fontSize: 26 }}>
            {okProviders}<span className="muted">/{statuses.length}</span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {alerts.length ? `${alerts.length} need attention` : "No provider alerts."}
          </div>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Withdrawals awaiting review</div>
          <div className="mono" style={{ fontSize: 26 }}>{pendingWithdrawals.length}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            <Link className="link" href="/admin/withdrawals">Open the queue →</Link>
          </div>
        </div>
      </div>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Risk gate</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Stored signals and the synced news snapshot can only <b>refuse</b> new risk — this rule
          set never opens or sizes a position. Inputs: {risk.counts.signals} signal(s),{" "}
          {risk.counts.news} news item(s).
        </p>
        {risk.reasons.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No risk reasons — normal.</p>
        ) : (
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {risk.reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" data-desk-reconciliation={reconciliation?.ok ? "ok" : "drift"}>
        <h2 style={{ marginTop: 0 }}>Reconciliation</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Internal bookkeeping only — custody spend vs its audit trail, and payouts held for
          review. It does <b>not</b> compare against on-chain balances (that needs a deposit
          indexer that does not exist yet).
        </p>
        {!reconciliation ? (
          <p className="muted" style={{ margin: 0 }}>
            No reconciliation has run yet — enable the{" "}
            <span className="mono">/api/cron/reconcile</span> schedule.
          </p>
        ) : (
          <>
            <p className="muted" style={{ margin: "0 0 8px", fontSize: 13 }}>
              Last run {new Date(reconciliation.checkedAt).toLocaleString()} · window{" "}
              {reconciliation.windowDays}d ·{" "}
              <span className={`badge ${reconciliation.ok ? "good" : "neg"}`}>
                {reconciliation.ok ? "no drift" : `${reconciliation.findings.length} finding(s)`}
              </span>
            </p>
            <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              <li>
                Custody movements: {reconciliation.custodySpendCount} row(s) /{" "}
                {formatUsd(reconciliation.custodySpendCents)} · audit rows:{" "}
                {reconciliation.custodyAuditCount}
              </li>
              <li>Payouts held for review: {reconciliation.heldWithdrawals.length}</li>
            </ul>
            {reconciliation.findings.length > 0 && (
              <ul className="muted" style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>
                {reconciliation.findings.map((finding, index) => (
                  <li key={index}>
                    <span className="mono">{finding.code}</span> — {finding.detail}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Provider key pool</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          A provider with no usable key stops producing signals or quotes.{" "}
          <Link className="link" href="/admin/credentials">Manage keys →</Link>
        </p>
        {alerts.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Every provider has a usable key.</p>
        ) : (
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {alerts.map((alert) => (
              <li key={alert.provider}>
                <span className="mono">{alert.provider}</span> —{" "}
                {alert.state === "unconfigured"
                  ? "no key configured"
                  : `all ${alert.poolEnabled} pool key(s) cooling down`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card table-wrap">
        <h2 style={{ marginTop: 0 }}>Provider health (last check)</h2>
        {healthEntries.length === 0 ? (
          <p className="muted">No smoke test has run yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr><th>Provider</th><th>Status</th><th>Latency</th><th>Checked</th></tr>
            </thead>
            <tbody>
              {healthEntries.map((h) => (
                <tr key={h.provider}>
                  <td className="mono">{h.provider}</td>
                  <td><span className={`badge ${HEALTH_TONE[h.status] ?? ""}`}>{h.status}</span></td>
                  <td className="mono muted">{h.latencyMs != null ? `${h.latencyMs}ms` : "—"}</td>
                  <td className="mono muted">{new Date(h.checkedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card table-wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Withdrawal requests awaiting review</h2>
          <Link className="link" href="/admin/withdrawals">Decide in the queue →</Link>
        </div>
        {pendingWithdrawals.length === 0 ? (
          <p className="muted">Nothing is waiting on a decision.</p>
        ) : (
          <table className="data">
            <thead>
              <tr><th>Requested</th><th>Amount</th><th>Route</th></tr>
            </thead>
            <tbody>
              {pendingWithdrawals.map((r) => (
                <tr key={r.id}>
                  <td className="mono muted">{r.createdAt.toLocaleString()}</td>
                  <td className="mono">{formatUsd(r.amountCents)}</td>
                  <td>{r.rail === "CUSTODY_ONCHAIN" ? "On-chain" : "Coinbase"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 12 }}>
          A hold or a ban never moves funds; only an approval pays a destination.
        </p>
      </section>

      <section className="card table-wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Recent venue orders</h2>
          <span className="muted" style={{ fontSize: 12 }}>
            Last 24h: {venueToday._count._all} order(s), {formatUsd(venueToday._sum.amountCents ?? 0)}
          </span>
        </div>
        {venueOrders.length === 0 ? (
          <p className="muted">No venue orders placed yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr><th>Placed</th><th>Notional</th><th>Status</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {venueOrders.map((o) => (
                <tr key={o.id}>
                  <td className="mono muted">{o.createdAt.toLocaleString()}</td>
                  <td className="mono">{formatUsd(o.amountCents)}</td>
                  <td><span className={`badge ${o.status === "COMPLETED" ? "good" : "warn"}`}>{o.status}</span></td>
                  <td className="muted" style={{ fontSize: 12, overflowWrap: "anywhere" }}>{o.detail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
