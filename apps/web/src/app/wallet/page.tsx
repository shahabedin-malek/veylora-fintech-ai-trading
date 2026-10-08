import { redirect } from "next/navigation";
import { getAccountContext } from "@/lib/account";
import { formatUsd } from "@/lib/domain/money";
import { depositAction, withdrawAction } from "@/lib/actions";

export default async function WalletPage() {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/login");

  const { wallet, withdrawal, controls } = ctx;
  const feePct = withdrawal.feeBps / 100;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <h1 style={{ margin: 0 }}>Wallet</h1>

      <div className="grid cols-2">
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Deposit (simulated)</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            Funds are simulated and never touch a real chain or bank. Minimum ${"20"} to start trading.
          </p>
          <form action={depositAction} className="grid" style={{ gap: 12 }}>
            <div>
              <label className="field" htmlFor="amount">Amount (USD)</label>
              <input className="input" id="amount" name="amount" type="number" min="1" step="1" defaultValue="100" required />
            </div>
            <button className="btn good" type="submit">Deposit simulated funds</button>
          </form>
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[50, 100, 500, 1000].map((v) => (
              <span key={v} className="badge">quick ${v}</span>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Balance</h2>
          <div className="mono" style={{ fontSize: 34 }}>{formatUsd(wallet.balanceCents)}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            {wallet.kind.toLowerCase()} wallet · <span className="mono">{wallet.address}</span>
          </div>
          <dl style={{ marginTop: 16, fontSize: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><dt className="muted">Initial balance</dt><dd className="mono" style={{ margin: 0 }}>{formatUsd(withdrawal.initialCents)}</dd></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><dt className="muted">+ Simulated P/L</dt><dd className={`mono ${withdrawal.pnlCents >= 0 ? "pos" : "neg"}`} style={{ margin: 0 }}>{formatUsd(withdrawal.pnlCents, { sign: true })}</dd></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><dt className="muted">− Simulated fee ({feePct}%)</dt><dd className="mono" style={{ margin: 0 }}>{formatUsd(withdrawal.feeCents)}</dd></div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8 }}>
              <dt><strong>= Withdrawal total</strong></dt><dd className="mono" style={{ margin: 0 }}><strong>{formatUsd(withdrawal.totalCents)}</strong></dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Withdrawal</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          The platform fee is <b>simulated</b>. Withdrawal is available only while trading is not active.
        </p>
        <form action={withdrawAction}>
          <button className="btn primary" type="submit" disabled={!controls.withdraw}>
            {controls.withdraw ? `Withdraw ${formatUsd(withdrawal.totalCents)} (simulated)` : "Withdrawal unavailable while trading"}
          </button>
        </form>
        {!controls.withdraw && controls.reason && <p className="muted" style={{ marginBottom: 0, fontSize: 13 }}>{controls.reason}</p>}
      </section>
    </div>
  );
}
