const FAQS = [
  {
    q: "Is this real trading?",
    a: "No. Everything on the trading desk is simulated paper trading. No real funds are ever moved, and no result shown is a real investment return.",
  },
  {
    q: "Where does the market data come from?",
    a: "Crypto prices come from the public CoinGecko API where reachable. Forex and equities use clearly-labelled deterministic simulated values. Every quote shows its source badge and timestamp.",
  },
  {
    q: "Why do I need a minimum balance to start?",
    a: "The simulated desk requires at least $20 (configurable) before it will start, so the flow mirrors a real desk. The UI always tells you exactly how much more is required.",
  },
  {
    q: "What happens if I stop trading too soon?",
    a: "If you stop within 5 minutes you get a warning, because short sessions are usually accidental. You can confirm with Force Stop.",
  },
  {
    q: "How is the withdrawal amount calculated?",
    a: "Initial balance + simulated P/L − simulated platform fee = withdrawal total. The breakdown is shown before you confirm and the fee is explicitly labelled simulated.",
  },
  {
    q: "How does support work?",
    a: "Open the support widget, send a message, and a CRM ticket is created and linked to your account. Admins can triage it, assign it and reply from the console.",
  },
];

export default function FaqPage() {
  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <h1>Frequently asked questions</h1>
      <div className="grid" style={{ gap: 12 }}>
        {FAQS.map((f) => (
          <details className="card" key={f.q}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>{f.q}</summary>
            <p className="muted" style={{ marginBottom: 0 }}>{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
