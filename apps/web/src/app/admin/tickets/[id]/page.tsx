import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { adminUpdateTicketAction } from "@/lib/actions";

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { owner: true, customer: true, assignee: true, messages: { orderBy: { createdAt: "asc" }, include: { author: true } } },
  });
  if (!ticket) notFound();

  const agents = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true, name: true } });

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>{ticket.subject}</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>{ticket.number} · {ticket.owner.name} ({ticket.owner.email}) · created {ticket.createdAt.toLocaleString()}</p>
        </div>
        <Link className="btn ghost" href="/admin">Back to console</Link>
      </div>

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Conversation</h2>
          <div className="grid" style={{ gap: 10 }}>
            {ticket.messages.map((m) => (
              <div key={m.id} className="card" style={{ padding: 12, borderColor: m.internal ? "var(--warn)" : undefined }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  {m.author.name} · {m.createdAt.toLocaleString()} {m.internal && <span className="badge sim" style={{ marginLeft: 6 }}>internal note</span>}
                </div>
                <div style={{ marginTop: 4 }}>{m.body}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Triage & reply</h2>
          <form action={adminUpdateTicketAction} className="grid" style={{ gap: 12 }}>
            <input type="hidden" name="ticketId" value={ticket.id} />
            <div className="grid cols-2" style={{ gap: 10 }}>
              <div>
                <label className="field" htmlFor="status">Status</label>
                <select className="select" id="status" name="status" defaultValue={ticket.status}>
                  {["OPEN", "PENDING", "RESOLVED", "CLOSED"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="field" htmlFor="priority">Priority</label>
                <select className="select" id="priority" name="priority" defaultValue={ticket.priority}>
                  {["LOW", "NORMAL", "HIGH", "URGENT"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="field" htmlFor="assigneeId">Assignee</label>
              <select className="select" id="assigneeId" name="assigneeId" defaultValue={ticket.assigneeId ?? "none"}>
                <option value="none">Unassigned</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field" htmlFor="body">Reply</label>
              <textarea className="textarea" id="body" name="body" rows={4} placeholder="Write a reply…" />
            </div>
            <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" name="internal" /> Save as internal note (not visible to customer)
            </label>
            <button className="btn primary" type="submit">Update ticket</button>
          </form>
        </section>
      </div>
    </div>
  );
}
