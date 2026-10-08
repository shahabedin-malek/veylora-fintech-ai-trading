import Link from "next/link";
import { getQuotesSafe } from "@/lib/market";
import { formatUsd } from "@/lib/domain/money";

const FEATURES = [
  { title: "Multi-market desk", body: "Crypto, forex and equities in one responsive dashboard with charts and 24h stats." },
  { title: "Simulated AI terminal", body: "A paper-trading desk with a live activity stream. Clearly labelled simulated — no real funds." },
  { title: "Deterministic controls", body: "Deposit, start, stop, force-stop and withdraw gated by an explicit trading state machine." },
  { title: "Wallet flows", body: "Simulated wallet with deposit, transparent withdrawal maths and full transaction history." },
  { title: "Built-in CRM", body: "Support chat raises a CRM ticket that admins can triage, assign and answer." },
  { title: "Provider-neutral data", body: "Real public market data with graceful, clearly-labelled simulated fallback." },
];

export default async function LandingPage() {
  const symbols = ["BTC", "ETH", "SOL", "EURUSD", "AAPL"];
  const { quotes, degraded } = await getQuotesSafe(symbols);

  return (
    <div className="grid" style={{ gap: 32 }}>
      <section className="card" style={{ padding: 32 }}>
        <span className="badge sim">Simulated trading environment · not financial advice</span>
        <h1 className="hero-title">The AI market desk for crypto, forex &amp; equities</h1>
        <p className="muted" style={{ fontSize: 18, maxWidth: 720 }}>
          Research markets, follow signals, and practise on a fully simulated trading desk — with a
          support experience built in. No real funds are ever moved.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 22, flexWrap: "wrap" }}>
          <Link className="btn primary" href="/login">Get started</Link>
          <Link className="btn" href="/markets">Explore markets</Link>
        </div>
      </section>

      <section>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Market snapshot</h2>
          {degraded && (
            <span className="badge sim" title="Live source unavailable — showing deterministic simulated values">
              simulated fallback
            </span>
          )}
        </div>
        <div className="grid cols-3" style={{ marginTop: 14 }}>
          {quotes.map((q) => (
            <div className="card" key={q.symbol}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{q.symbol}</strong>
                <span className={`badge ${q.simulated ? "sim" : "live"}`}>{q.simulated ? "simulated" : q.source}</span>
              </div>
              <div className="mono" style={{ fontSize: 24, marginTop: 8 }}>${formatUsd(Math.round(q.priceUsd * 100)).replace("$", "")}</div>
              <div className={q.change24hPct >= 0 ? "pos" : "neg"} style={{ fontSize: 13 }}>
                {q.change24hPct >= 0 ? "+" : ""}{q.change24hPct.toFixed(2)}% · 24h
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{q.name} · {q.assetClass}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>What you get</h2>
        <div className="grid cols-3" style={{ marginTop: 14 }}>
          {FEATURES.map((f) => (
            <div className="card" key={f.title}>
              <strong>{f.title}</strong>
              <p className="muted" style={{ margin: "8px 0 0", fontSize: 14 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>How it works</h2>
        <ol className="muted" style={{ lineHeight: 1.9, paddingLeft: 20 }}>
          <li>Create an account — you get a simulated wallet instantly.</li>
          <li>Deposit simulated funds (minimum $20 to start trading).</li>
          <li>Start the simulated AI desk and watch the paper-trading terminal.</li>
          <li>Stop trading — within 5 minutes you&apos;ll see a warning with a Force Stop option.</li>
          <li>Withdraw and see the transparent simulated fee calculation.</li>
          <li>Need help? Open the support widget to raise a CRM ticket.</li>
        </ol>
        <Link className="btn primary" href="/login">Open your dashboard</Link>
      </section>
    </div>
  );
}
