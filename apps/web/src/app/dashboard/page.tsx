import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountContext } from "@/lib/account";
import { formatUsd } from "@/lib/domain/money";
import { TRADING_STATE_LABEL } from "@/lib/domain/trading";
import { getQuotesSafe } from "@/lib/market";
import { TradeControls } from "@/components/TradeControls";

export default async function DashboardPage() {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/login");

  const { quotes, degraded } = await getQuotesSafe(["BTC", "ETH", "EURUSD", "AAPL"]);
  const { controls, wallet, withdrawal } = ctx;

  return (
    <div className="grid" style={{ gap: 22 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Welcome back, {ctx.user.name.split(" ")[0]}</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>Simulated account · state {controls.state} ({TRADING_STATE_LABEL[controls.state]})</p>
        </div>
        {degraded && <span className="badge sim">market data: simulated fallback</span>}
      </div>

      <div className="grid cols-3">
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Simulated balance</div>
          <div className="mono" style={{ fontSize: 30, marginTop: 6 }}>{formatUsd(wallet.balanceCents)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{wallet.kind.toLowerCase()} wallet · {wallet.address}</div>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Simulated P/L</div>
          <div className={`mono ${withdrawal.pnlCents >= 0 ? "pos" : "neg"}`} style={{ fontSize: 30, marginTop: 6 }}>
            {formatUsd(withdrawal.pnlCents, { sign: true })}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>from paper trading</div>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Withdrawable (simulated)</div>
          <div className="mono" style={{ fontSize: 30, marginTop: 6 }}>{formatUsd(withdrawal.totalCents)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>fee {formatUsd(withdrawal.feeCents)} simulated</div>
        </div>
      </div>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Controls</h2>
        <TradeControls controls={controls} />
        {controls.reason && <p className="muted" style={{ marginBottom: 0 }}>{controls.reason}</p>}
      </section>

      <section className="grid cols-2">
        <div className="card table-wrap">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Market snapshot</h2>
            <Link className="link" href="/markets">View all →</Link>
          </div>
          <table className="data" style={{ marginTop: 8 }}>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.symbol}>
                  <td><strong>{q.symbol}</strong><div className="muted" style={{ fontSize: 12 }}>{q.name}</div></td>
                  <td className="mono">${q.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td className={q.change24hPct >= 0 ? "pos" : "neg"}>{q.change24hPct >= 0 ? "+" : ""}{q.change24hPct.toFixed(2)}%</td>
                  <td><span className={`badge ${q.simulated ? "sim" : "live"}`}>{q.simulated ? "sim" : q.source}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 style={{ margin: 0, fontSize: 18 }}>Notifications</h2>
          {ctx.notifications.length === 0 ? (
            <p className="muted" style={{ marginTop: 10 }}>No notifications yet. Deposit funds to get started.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 10 }}>
              {ctx.notifications.map((n) => (
                <li key={n.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                  <strong style={{ fontSize: 14 }}>{n.title}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>{n.body}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
