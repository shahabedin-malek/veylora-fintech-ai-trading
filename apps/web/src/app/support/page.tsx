import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createTicketAction, sendTicketMessageAction } from "@/lib/actions";

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ ticket?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;

  const tickets = await prisma.ticket.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: "desc" } });
  const selectedId = sp.ticket || tickets[0]?.id;
  const selected = selectedId
    ? await prisma.ticket.findFirst({ where: { id: selectedId, ownerId: user.id }, include: { messages: { where: { internal: false }, orderBy: { createdAt: "asc" }, include: { author: true } } } })
    : null;

  const PRIORITY_COLOR: Record<string, string> = { LOW: "", NORMAL: "", HIGH: "sim", URGENT: "sim" };

  return (
    <div className="grid cols-2" style={{ alignItems: "start" }}>
      <div className="grid" style={{ gap: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Support</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>Your conversations raise a ticket in our CRM.</p>
        </div>

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>New conversation</h2>
          <form action={createTicketAction} className="grid" style={{ gap: 10 }}>
            <div>
              <label className="field" htmlFor="subject">Subject</label>
              <input className="input" id="subject" name="subject" required placeholder="e.g. Withdrawal question" />
            </div>
            <div>
              <label className="field" htmlFor="body">Message</label>
              <textarea className="textarea" id="body" name="body" rows={3} required placeholder="Tell us what you need help with…" />
            </div>
            <button className="btn primary" type="submit">Start conversation</button>
          </form>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Your tickets</h2>
          {tickets.length === 0 ? (
            <p className="muted">No tickets yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/support?ticket=${t.id}`} className="card" style={{ display: "block", padding: 12, borderColor: t.id === selectedId ? "var(--accent-2)" : undefined }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong style={{ fontSize: 14 }}>{t.subject}</strong>
                      <span className={`badge ${PRIORITY_COLOR[t.priority] ?? ""}`}>{t.status}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t.number} · updated {t.updatedAt.toLocaleString()}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        {!selected ? (
          <p className="muted">Select a conversation to view it.</p>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{selected.subject}</h2>
              <span className="badge">{selected.number} · {selected.status}</span>
            </div>
            <div className="grid" style={{ gap: 10, marginTop: 14 }}>
              {selected.messages.map((m) => (
                <div key={m.id} className="card" style={{ padding: 12, background: m.author.role === "ADMIN" ? "rgba(76,141,255,.08)" : undefined }}>
                  <div className="muted" style={{ fontSize: 12 }}>{m.author.name} · {m.createdAt.toLocaleString()}</div>
                  <div style={{ marginTop: 4 }}>{m.body}</div>
                </div>
              ))}
            </div>
            <form action={sendTicketMessageAction} className="grid" style={{ gap: 10, marginTop: 16 }}>
              <input type="hidden" name="ticketId" value={selected.id} />
              <textarea className="textarea" name="body" rows={3} required placeholder="Type a reply…" />
              <button className="btn primary" type="submit">Send</button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
