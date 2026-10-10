import { randomUUID } from "node:crypto";

import Link from "next/link";
import { redirect } from "next/navigation";

import { startWundertradingOrderAction } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { warmCredentialCache } from "@/lib/credentials/pool";
import { prisma } from "@/lib/db";
import { executionGate } from "@/lib/execution";
import { venueSpendLimits, wundertradingConfigured } from "@/lib/wundertrading/client";

/**
 * Venue execution console.
 *
 * WunderTrading orders act on the **desk's** exchange API profiles rather than on one
 * user's balance, so this is an operator surface. It shows whether the executor is
 * allowed and what the desk's real-money caps are, and it is the only place a venue
 * order can be placed — through the gated server action, never from the client.
 */

const NOTICE: Record<string, string> = {
  disabled:
    "Venue orders are refused on this deployment — either real execution is switched off (MAINNET_EXECUTION_ENABLED=0) or WunderTrading is not configured.",
  risk: "The desk is risk-off: recent news or signals argue for standing aside, so nothing was submitted.",
  invalid: "That order was not valid — check the amount and the USD notional.",
  refused:
    "The order was refused: it carried no stop loss, or it exceeds the desk's real-money cap. Nothing was submitted.",
  error: "WunderTrading could not complete the order. Nothing was submitted.",
};

function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function AdminExecutionPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const notice = sp.venue ? NOTICE[sp.venue] : undefined;

  // Reflect any pool-managed venue key in the synchronous execution gate.
  await warmCredentialCache(["wundertrading"]);
  const gate = executionGate(user.network, "wundertrading");
  const configured = wundertradingConfigured();
  const limits = venueSpendLimits();

  const orders = await prisma.transaction.findMany({
    where: { kind: "VENUE_ORDER" },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <h1 style={{ margin: 0 }}>Venue execution</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          Real orders through WunderTrading, on the desk&apos;s exchange API profiles. Every order
          carries a stop loss and is held to the desk&apos;s caps.{" "}
          <Link className="link" href="/admin">
            Back to CRM console
          </Link>
        </p>
      </div>

      <div className="grid cols-3">
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Executor</div>
          <div className="mono" style={{ fontSize: 16 }}>
            <span className={`badge ${gate.allowed ? "good" : "warn"}`}>
              {gate.allowed ? "allowed" : "refused"}
            </span>
          </div>
          {!gate.allowed && (
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{gate.reason}</div>
          )}
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Configured</div>
          <div className="mono" style={{ fontSize: 16 }}>
            {configured ? "WUNDERTRADING_API_KEY" : "not configured"}
          </div>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Caps</div>
          <div className="mono" style={{ fontSize: 16 }}>
            {usd(limits.maxPerTransactionCents)} / order
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {usd(limits.maxDailyCents)} per day
          </div>
        </div>
      </div>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Place an order</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Values are the venue&apos;s own (exchange codes, pair codes, profile codes and order
          types). A stop loss is mandatory: an order without one is refused. The USD notional is
          what the desk cap is enforced on.
        </p>
        <form action={startWundertradingOrderAction} className="grid" style={{ gap: 10, maxWidth: 460 }}>
          <input type="hidden" name="idempotencyKey" value={randomUUID()} />
          <div>
            <label className="field" htmlFor="venue-exchange">Exchange code</label>
            <input className="input" id="venue-exchange" name="exchangeCode" placeholder="e.g. BINANCE" autoComplete="off" required />
          </div>
          <div>
            <label className="field" htmlFor="venue-pair">Pair code</label>
            <input className="input" id="venue-pair" name="pairCode" placeholder="e.g. BTCUSDT" autoComplete="off" required />
          </div>
          <div>
            <label className="field" htmlFor="venue-profiles">API profile codes (comma-separated)</label>
            <input className="input" id="venue-profiles" name="profilesCodes" placeholder="e.g. abc123" autoComplete="off" required />
          </div>
          <div>
            <label className="field" htmlFor="venue-side">Side</label>
            <select className="input" id="venue-side" name="side" defaultValue="buy">
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>
          <div>
            <label className="field" htmlFor="venue-order-type">Order type</label>
            <input className="input" id="venue-order-type" name="orderType" placeholder="e.g. MARKET" autoComplete="off" required />
          </div>
          <div>
            <label className="field" htmlFor="venue-amount">Amount</label>
            <input className="input" id="venue-amount" name="amountPerTrade" placeholder="e.g. 10" inputMode="decimal" autoComplete="off" required />
          </div>
          <div>
            <label className="field" htmlFor="venue-amount-type">Amount type</label>
            <input className="input" id="venue-amount-type" name="amountPerTradeType" placeholder="e.g. PERCENT" autoComplete="off" required />
          </div>
          <div>
            <label className="field" htmlFor="venue-amount-notional">USD notional (cap basis)</label>
            <input className="input" id="venue-amount-notional" name="notionalUsd" placeholder="e.g. 250" inputMode="decimal" autoComplete="off" required />
          </div>
          <div>
            <label className="field" htmlFor="venue-stop">Stop loss (required)</label>
            <input className="input" id="venue-stop" name="stopLoss" placeholder="e.g. 100.55" inputMode="decimal" autoComplete="off" required />
          </div>
          <div>
            <label className="field" htmlFor="venue-take">Take profit (optional)</label>
            <input className="input" id="venue-take" name="takeProfit" placeholder="optional" inputMode="decimal" autoComplete="off" />
          </div>
          <label className="muted" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
            <input type="checkbox" name="confirm" required style={{ marginTop: 3 }} />
            <span>I understand this places a <b>real order</b> on a live exchange account.</span>
          </label>
          <button className="btn primary" type="submit" disabled={!gate.allowed}>
            Submit venue order
          </button>
        </form>
        {notice && (
          <p role="status" className="muted" style={{ margin: "12px 0 0", fontSize: 13 }}>{notice}</p>
        )}
      </section>

      <section className="card table-wrap">
        <h2 style={{ marginTop: 0 }}>Recent venue orders</h2>
        {orders.length === 0 ? (
          <p className="muted">No venue orders have been submitted yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Kind</th>
                <th>Notional</th>
                <th>Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="mono muted">{order.createdAt.toLocaleString()}</td>
                  <td className="mono">{order.kind}</td>
                  <td className="mono">{usd(order.amountCents)}</td>
                  <td><span className="badge good">{order.status}</span></td>
                  <td className="muted" style={{ overflowWrap: "anywhere" }}>{order.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
