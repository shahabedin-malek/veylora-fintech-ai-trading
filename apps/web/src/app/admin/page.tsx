import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ownerCreditPracticeFundsAction } from "@/lib/actions";
import { prisma } from "@/lib/db";
import KpiCount from "@/components/KpiCount";
import KpiAmount from "@/components/KpiAmount";
import AnimatedList from "@/components/reactbits/AnimatedList";

/** Results the owner practice-funds form can bounce back to this page. */
const OWNER_NOTICE: Record<string, string> = {
  credited: "Practice funds credited to your account.",
  invalid: "Enter a positive amount.",
  cap: "That amount is above the per-credit cap. Nothing was credited.",
  duplicate: "That credit was already applied — it was not applied twice.",
  error: "The credit could not be applied.",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const ownerNotice = sp.owner ? OWNER_NOTICE[sp.owner] : undefined;

  const [tickets, customers, audit, deposits] = await Promise.all([
    prisma.ticket.findMany({ orderBy: { updatedAt: "desc" }, include: { owner: true, assignee: true, _count: { select: { messages: true } } } }),
    prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { walletAddress: true } } },
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { actor: true } }),
    prisma.ledgerEntry.aggregate({ where: { type: "DEPOSIT" }, _sum: { amountCents: true } }),
  ]);

  const open = tickets.filter((t) => t.status === "OPEN").length;
  const pending = tickets.filter((t) => t.status === "PENDING").length;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <h1 style={{ margin: 0 }}>CRM console</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 13, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Link className="link" href="/admin/withdrawals">Withdrawal requests &amp; holds →</Link>
          <Link className="link" href="/admin/webhooks">Webhook deliveries →</Link>
          <Link className="link" href="/admin/signals">Signals (risk input) →</Link>
          <Link className="link" href="/admin/execution">Venue execution →</Link>
          <Link className="link" href="/admin/credentials">Coinbase credential hygiene →</Link>
          <Link className="link" href="/admin/desk">Desk operations →</Link>
          <Link className="link" href="/admin/backtest">Backtest lab →</Link>
        </p>
      </div>

      {user.isOwner && (
        <section className="card" data-owner-only="">
          <h2 style={{ marginTop: 0 }}>Owner controls</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Signed in as the site owner (<span className="mono">{user.walletAddress}</span>).
            Practice funds are a ledger credit with no real backing, for exercising the desk —
            they are not a deposit and cannot be withdrawn on-chain or swapped.
          </p>
          <form action={ownerCreditPracticeFundsAction} className="grid" style={{ gap: 10, maxWidth: 360 }}>
            <input type="hidden" name="idempotencyKey" value={randomUUID()} />
            <div>
              <label className="field" htmlFor="owner-amount">Amount (USD)</label>
              <input className="input" id="owner-amount" name="amount" type="number" min="1" step="1" placeholder="1000" required />
            </div>
            <label className="muted" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
              <input type="checkbox" name="confirm" required style={{ marginTop: 3 }} />
              <span>I understand this credits practice funds with no real value.</span>
            </label>
            <button className="btn primary" type="submit">Credit practice funds</button>
          </form>
          {ownerNotice && (
            <p role="status" className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>
              {ownerNotice}
            </p>
          )}
        </section>
      )}

      <div className="grid cols-3">
        <div className="card"><div className="muted" style={{ fontSize: 13 }}>Open tickets</div><div style={{ marginTop: 4 }}><KpiCount value={open} /></div></div>
        <div className="card"><div className="muted" style={{ fontSize: 13 }}>Pending</div><div style={{ marginTop: 4 }}><KpiCount value={pending} /></div></div>
        <div className="card"><div className="muted" style={{ fontSize: 13 }}>Deposits</div><div style={{ marginTop: 4 }}><KpiAmount cents={deposits._sum.amountCents ?? 0} /></div></div>
      </div>

      <section className="card table-wrap">
        <h2 style={{ marginTop: 0 }}>Tickets</h2>
        {tickets.length === 0 ? (
          <p className="muted">No tickets yet.</p>
        ) : (
          <table className="data">
            <thead><tr><th>Number</th><th>Subject</th><th>Customer</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Msgs</th><th /></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.number}</td>
                  <td>{t.subject}</td>
                  <td className="muted">{t.owner.name}</td>
                  <td><span className={`badge ${t.priority === "URGENT" || t.priority === "HIGH" ? "warn" : ""}`}>{t.priority}</span></td>
                  <td><span className="badge">{t.status}</span></td>
                  <td className="muted">{t.assignee?.name ?? "—"}</td>
                  <td className="mono">{t._count.messages}</td>
                  <td><Link className="link" href={`/admin/tickets/${t.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid cols-2">
        <section className="card table-wrap">
          <h2 style={{ marginTop: 0 }}>Customers</h2>
          <table className="data">
            <thead><tr><th>Name</th><th>Wallet</th><th>Tier</th></tr></thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}><td>{c.name}</td><td className="muted mono">{c.user.walletAddress}</td><td><span className="badge">{c.tier}</span></td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Audit log</h2>
          {audit.length === 0 ? (
            <p className="muted">No activity yet.</p>
          ) : (
            <AnimatedList
              className="feed-list"
              itemClassName="feed-item"
              enableArrowNavigation={false}
              items={audit.map((a) => (
                <span key={a.id} style={{ fontSize: 13 }}>
                  <span className="mono muted">{a.createdAt.toLocaleString()}</span>{" "}
                  <strong>{a.action}</strong> <span className="muted">{a.subject}</span>
                  {a.actor && <span className="muted"> · {a.actor.name}</span>}
                </span>
              ))}
            />
          )}
        </section>
      </div>
    </div>
  );
}
