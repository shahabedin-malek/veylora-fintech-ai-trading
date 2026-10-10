import Link from "next/link";

import { statusSummary } from "@/lib/status";

/**
 * Public status page — which capabilities are configured on this deployment.
 *
 * Presence only: it renders a boolean per integration and never a value. It is deliberately
 * honest about what is *off* (a capability that is not configured is shown as such) and
 * about what degrades gracefully versus what fails closed. Read-only; it changes nothing.
 */

export const metadata = {
  title: "Status",
  description: "Which integrations are configured on this deployment.",
};

export default function StatusPage() {
  const { items, ready, coreReady, missingRequired } = statusSummary();

  return (
    <div className="grid" style={{ gap: 20, maxWidth: 820 }}>
      <div>
        <h1 style={{ margin: 0 }}>Status</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          Whether each capability is configured on this deployment. Only <b>presence</b> is shown —
          no key, secret or connection string is ever displayed. Unconfigured items are listed
          honestly: some degrade gracefully, real money paths fail closed.
        </p>
      </div>

      <section className="card" data-status-core={coreReady ? "ready" : "degraded"}>
        <h2 style={{ marginTop: 0 }}>Core</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          <span className={`badge ${coreReady ? "good" : "neg"}`}>
            {coreReady ? "core services ready" : "core services incomplete"}
          </span>{" "}
          {ready} of {items.length} capabilities configured.
          {missingRequired.length > 0 && (
            <> Missing: <span className="mono">{missingRequired.join(", ")}</span>.</>
          )}
        </p>
      </section>

      <section className="card table-wrap">
        <table className="data">
          <thead>
            <tr><th>Capability</th><th>State</th><th>Detail</th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.label}
                  {item.required && <span className="badge" style={{ marginLeft: 8 }}>required</span>}
                </td>
                <td>
                  <span className={`badge ${item.configured ? "good" : item.required ? "neg" : ""}`}>
                    {item.configured ? "configured" : "not configured"}
                  </span>
                </td>
                <td className="muted" style={{ fontSize: 12 }}>{item.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Looking for the Coinbase integration? <Link className="link" href="/coinbase">See the integration overview</Link>.
      </p>
    </div>
  );
}
