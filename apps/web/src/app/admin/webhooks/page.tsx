import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Webhook deliveries (`PHASE19-006` + Finnhub).
 *
 * Every verified delivery is recorded in `WebhookEvent`; this console shows them so
 * an operator can see what a provider sent and, for Coinbase, which events did **not**
 * reconcile to a user (`UNMATCHED` — no credit applied). Finnhub deliveries are
 * recorded value-free and stored as `IGNORED` because no handler consumes them yet.
 * Both filters are `searchParams` values so a view is linkable.
 */

const FILTERS = ["ALL", "PROCESSED", "UNMATCHED", "IGNORED", "RECEIVED"] as const;
type Filter = (typeof FILTERS)[number];

const PROVIDERS = ["ALL", "coinbase", "finnhub"] as const;
type ProviderFilter = (typeof PROVIDERS)[number];

const STATUS_TONE: Record<string, string> = {
  PROCESSED: "good",
  UNMATCHED: "warn",
  IGNORED: "",
  RECEIVED: "",
};

function isFilter(value: string | undefined): value is Filter {
  return value !== undefined && (FILTERS as readonly string[]).includes(value);
}

function isProvider(value: string | undefined): value is ProviderFilter {
  return value !== undefined && (PROVIDERS as readonly string[]).includes(value);
}

/** Build a `/admin/webhooks` URL, omitting default (ALL) values. */
function viewUrl(status: Filter, provider: ProviderFilter): string {
  const params = new URLSearchParams();
  if (status !== "ALL") params.set("status", status);
  if (provider !== "ALL") params.set("provider", provider);
  const qs = params.toString();
  return qs ? `/admin/webhooks?${qs}` : "/admin/webhooks";
}

export default async function AdminWebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; provider?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const filter: Filter = isFilter(sp.status) ? sp.status : "ALL";
  const provider: ProviderFilter = isProvider(sp.provider) ? sp.provider : "ALL";

  const where = {
    ...(filter === "ALL" ? {} : { status: filter }),
    ...(provider === "ALL" ? {} : { provider }),
  };

  const [events, grouped, byProvider] = await Promise.all([
    prisma.webhookEvent.findMany({ where, orderBy: { receivedAt: "desc" }, take: 100 }),
    prisma.webhookEvent.groupBy({ by: ["status"], where: provider === "ALL" ? {} : { provider }, _count: { _all: true } }),
    prisma.webhookEvent.groupBy({ by: ["provider"], _count: { _all: true } }),
  ]);

  const countFor = (status: string) =>
    grouped.find((g) => g.status === status)?._count._all ?? 0;
  const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
  const providerCount = (p: string) => byProvider.find((g) => g.provider === p)?._count._all ?? 0;
  const grandTotal = byProvider.reduce((sum, g) => sum + g._count._all, 0);

  const userIds = [...new Set(events.map((e) => e.userId).filter((id): id is string => Boolean(id)))];
  const owners = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, walletAddress: true, name: true },
      })
    : [];
  const ownerById = new Map(owners.map((o) => [o.id, o]));

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <h1 style={{ margin: 0 }}>Webhook events</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          Verified deliveries from configured providers. Coinbase{" "}
          <span className="mono">UNMATCHED</span> events matched no account and credited nothing;
          Finnhub deliveries are recorded value-free until a handler exists.{" "}
          <Link className="link" href="/admin">
            Back to CRM console
          </Link>
        </p>
      </div>

      <div className="grid cols-3">
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Total events{provider !== "ALL" ? ` · ${provider}` : ""}</div>
          <div className="mono" style={{ fontSize: 26 }}>{total}</div>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Processed (credited)</div>
          <div className="mono pos" style={{ fontSize: 26 }}>{countFor("PROCESSED")}</div>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Unmatched (no credit)</div>
          <div className="mono" style={{ fontSize: 26 }}>{countFor("UNMATCHED")}</div>
        </div>
      </div>

      <nav className="grid" style={{ gap: 8 }}>
        <div className="muted" style={{ fontSize: 12 }}>Provider</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PROVIDERS.map((p) => {
            const active = p === provider;
            const count = p === "ALL" ? grandTotal : providerCount(p);
            return (
              <Link
                key={p}
                href={viewUrl(filter, p)}
                className={`badge ${active ? "good" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {p} ({count})
              </Link>
            );
          })}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>Filter by status</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const active = f === filter;
            const count = f === "ALL" ? total : countFor(f);
            return (
              <Link
                key={f}
                href={viewUrl(f, provider)}
                className={`badge ${active ? "good" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {f} ({count})
              </Link>
            );
          })}
        </div>
      </nav>

      <section className="card table-wrap">
        <h2 style={{ marginTop: 0 }}>Events{filter !== "ALL" ? ` · ${filter}` : ""}</h2>
        {events.length === 0 ? (
          <p className="muted">No webhook events have been received{filter !== "ALL" ? " with this status" : ""} yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Received</th>
                <th>Provider</th>
                <th>Type</th>
                <th>Status</th>
                <th>Event ID</th>
                <th>Account</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const owner = e.userId ? ownerById.get(e.userId) : undefined;
                return (
                  <tr key={e.id}>
                    <td className="mono muted">{e.receivedAt.toLocaleString()}</td>
                    <td className="mono">{e.provider}</td>
                    <td className="mono">{e.eventType}</td>
                    <td>
                      <span className={`badge ${STATUS_TONE[e.status] ?? ""}`}>{e.status}</span>
                    </td>
                    <td className="mono muted" style={{ overflowWrap: "anywhere" }}>{e.eventId}</td>
                    <td className="muted">
                      {owner ? (
                        <>
                          {owner.name} · <span className="mono">{owner.walletAddress.slice(0, 10)}…</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
