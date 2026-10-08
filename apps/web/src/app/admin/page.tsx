import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/domain/money";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const [tickets, customers, audit, deposits] = await Promise.all([
    prisma.ticket.findMany({ orderBy: { updatedAt: "desc" }, include: { owner: true, assignee: true, _count: { select: { messages: true } } } }),
    prisma.customer.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { actor: true } }),
    prisma.ledgerEntry.aggregate({ where: { type: "DEPOSIT" }, _sum: { amountCents: true } }),
  ]);

  const open = tickets.filter((t) => t.status === "OPEN").length;
  const pending = tickets.filter((t) => t.status === "PENDING").length;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <h1 style={{ margin: 0 }}>CRM console</h1>

      <div className="grid cols-3">
        <div className="card"><div className="muted" style={{ fontSize: 13 }}>Open tickets</div><div className="mono" style={{ fontSize: 30 }}>{open}</div></div>
        <div className="card"><div className="muted" style={{ fontSize: 13 }}>Pending</div><div className="mono" style={{ fontSize: 30 }}>{pending}</div></div>
        <div className="card"><div className="muted" style={{ fontSize: 13 }}>Simulated deposits</div><div className="mono" style={{ fontSize: 30 }}>{formatUsd(deposits._sum.amountCents ?? 0)}</div></div>
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
                  <td><span className={`badge ${t.priority === "URGENT" || t.priority === "HIGH" ? "sim" : ""}`}>{t.priority}</span></td>
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
            <thead><tr><th>Name</th><th>Email</th><th>Tier</th></tr></thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}><td>{c.name}</td><td className="muted">{c.email}</td><td><span className="badge">{c.tier}</span></td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Audit log</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {audit.length === 0 && <li className="muted">No activity yet.</li>}
            {audit.map((a) => (
              <li key={a.id} style={{ fontSize: 13, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                <span className="mono muted">{a.createdAt.toLocaleString()}</span>{" "}
                <strong>{a.action}</strong> <span className="muted">{a.subject}</span>
                {a.actor && <span className="muted"> · {a.actor.name}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
