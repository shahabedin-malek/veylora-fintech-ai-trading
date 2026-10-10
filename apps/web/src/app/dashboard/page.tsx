import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountContext } from "@/lib/account";
import { networkModeLabel } from "@/lib/network";
import { getQuotesSafe } from "@/lib/market";
import { assessDeskRisk } from "@/lib/risk/assess";
import { RiskBanner } from "@/components/RiskBanner";
import KpiAmount from "@/components/KpiAmount";
import AnimatedList from "@/components/reactbits/AnimatedList";

export default async function DashboardPage() {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/login");

  const [{ quotes, degraded }, risk] = await Promise.all([
    getQuotesSafe(["BTC", "ETH", "EURUSD", "AAPL"]),
    assessDeskRisk(),
  ]);
  const { wallet } = ctx;

  return (
    <div className="grid" style={{ gap: 22 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Welcome back, {ctx.user.name.split(" ")[0]}</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            Mainnet account · real funds
          </p>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 12, overflowWrap: "anywhere" }}>
            {networkModeLabel(ctx.user.chainId)} · <span className="mono">{ctx.user.walletAddress}</span>
          </p>
        </div>
        {degraded && <span className="badge warn">market data: offline fallback</span>}
      </div>

      <RiskBanner assessment={risk} />

      <div className="grid cols-3">
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Account balance</div>
          <div style={{ marginTop: 6 }}><KpiAmount cents={wallet.balanceCents} /></div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{wallet.address}</div>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Deposits</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Card or bank via Coinbase, or an on-chain transfer. Credited only after a verified
            webhook reconciles the movement.
          </div>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Withdrawals</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Cash out to your bank via Coinbase, or send crypto on-chain from the custody account.
          </div>
        </div>
      </div>

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
                  <td><span className={`badge ${q.offline ? "warn" : "live"}`}>{q.offline ? "offline" : q.source}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 style={{ margin: 0, fontSize: 18 }}>Notifications</h2>
          {ctx.notifications.length === 0 ? (
            <p className="muted" style={{ marginTop: 10 }}>No notifications yet. Make a deposit to get started.</p>
          ) : (
            <div style={{ marginTop: 10 }}>
              <AnimatedList
                className="feed-list"
                itemClassName="feed-item"
                enableArrowNavigation={false}
                items={ctx.notifications.map((n) => (
                  <span key={n.id}>
                    <strong style={{ fontSize: 14, display: "block" }}>{n.title}</strong>
                    <span className="muted" style={{ fontSize: 13 }}>{n.body}</span>
                  </span>
                ))}
              />
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Coinbase reconciliation</h2>
          <Link className="link" href="/history">Full history →</Link>
        </div>
        <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          Verified Coinbase webhook deliveries reconciled to your account. A deposit or a sale
          changes your balance only after its signature verifies; an event that matched no
          account credits nothing.
        </p>
        {ctx.coinbaseEvents.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>No Coinbase events reconciled to your account yet.</p>
        ) : (
          <div style={{ marginTop: 6 }}>
            <AnimatedList
              className="feed-list"
              itemClassName="feed-item"
              enableArrowNavigation={false}
              items={ctx.coinbaseEvents.map((e) => (
                <span key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span className="mono" style={{ fontSize: 13 }}>{e.eventType}</span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {e.status} · {e.receivedAt.toLocaleString()}
                  </span>
                </span>
              ))}
            />
          </div>
        )}
      </section>
    </div>
  );
}
