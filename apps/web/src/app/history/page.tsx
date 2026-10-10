import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/domain/money";
import SpotlightCard from "@/components/reactbits/SpotlightCard";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [transactions, ledger, coinbaseEvents] = await Promise.all([
    prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.ledgerEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    // Coinbase webhook deliveries reconciled to this account (PHASE19-006).
    prisma.webhookEvent.findMany({
      where: { userId: user.id },
      orderBy: { receivedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>History</h1>
        <p className="muted" style={{ margin: 0, fontSize: 13, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <a className="link" href="/history/export?type=transactions">Export transactions (CSV)</a>
          <a className="link" href="/history/export?type=ledger">Export ledger (CSV)</a>
        </p>
      </div>

      <SpotlightCard className="card table-wrap" spotlightColor="#4c8dff" intensity={0.12} proximity={60}>
        <h2 style={{ marginTop: 0 }}>Transactions</h2>
        {transactions.length === 0 ? (
          <p className="muted">No transactions yet. Make a deposit to begin.</p>
        ) : (
          <table className="data">
            <thead><tr><th>Date</th><th>Kind</th><th>Detail</th><th>Status</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="muted">{t.createdAt.toLocaleString()}</td>
                  <td>{t.kind}</td>
                  <td className="muted">{t.detail}</td>
                  <td><span className="badge">{t.status}</span></td>
                  <td className="mono" style={{ textAlign: "right" }}>{formatUsd(t.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SpotlightCard>

      <SpotlightCard className="card table-wrap" spotlightColor="#38d39f" intensity={0.12} proximity={60}>
        <h2 style={{ marginTop: 0 }}>Ledger</h2>
        {ledger.length === 0 ? (
          <p className="muted">Ledger is empty.</p>
        ) : (
          <table className="data">
            <thead><tr><th>Date</th><th>Type</th><th>Note</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
            <tbody>
              {ledger.map((l) => (
                <tr key={l.id}>
                  <td className="muted">{l.createdAt.toLocaleString()}</td>
                  <td>{l.type}</td>
                  <td className="muted">{l.note}</td>
                  <td className={`mono ${l.amountCents >= 0 ? "pos" : "neg"}`} style={{ textAlign: "right" }}>{formatUsd(l.amountCents, { sign: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SpotlightCard>

      <SpotlightCard className="card table-wrap" spotlightColor="#5227FF" intensity={0.12} proximity={60}>
        <h2 style={{ marginTop: 0 }}>Coinbase reconciliation</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Coinbase webhook events reconciled to your account. Deposits and sales are credited here
          only after a verified signature; anything that could not be matched to an account credits
          nothing.
        </p>
        {coinbaseEvents.length === 0 ? (
          <p className="muted">No Coinbase events reconciled to your account yet.</p>
        ) : (
          <table className="data">
            <thead><tr><th>Received</th><th>Event</th><th>Status</th></tr></thead>
            <tbody>
              {coinbaseEvents.map((e) => (
                <tr key={e.id}>
                  <td className="muted">{e.receivedAt.toLocaleString()}</td>
                  <td className="mono">{e.eventType}</td>
                  <td><span className={`badge ${e.status === "PROCESSED" ? "good" : ""}`}>{e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SpotlightCard>
    </div>
  );
}
