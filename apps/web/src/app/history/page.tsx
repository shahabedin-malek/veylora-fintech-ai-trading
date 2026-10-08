import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/domain/money";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [transactions, ledger] = await Promise.all([
    prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.ledgerEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return (
    <div className="grid" style={{ gap: 20 }}>
      <h1 style={{ margin: 0 }}>History</h1>

      <section className="card table-wrap">
        <h2 style={{ marginTop: 0 }}>Transactions</h2>
        {transactions.length === 0 ? (
          <p className="muted">No transactions yet. Make a simulated deposit to begin.</p>
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
      </section>

      <section className="card table-wrap">
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
      </section>
    </div>
  );
}
