const FAQS = [
  {
    q: "Is this real trading?",
    a: "Yes. You sign in with a wallet and the desk runs real, custody-signed Coinbase swaps: those move real funds on-chain and are final. Real execution is on by default, and a deployment without configured custody refuses every money action rather than pretending.",
  },
  {
    q: "Which wallet should I connect?",
    a: "Any wallet on Ethereum, Base or Arbitrum signs you in — there is no password and no email. Your wallet address is your account, and it is only trusted after you sign a one-time message that costs no gas and moves no funds.",
  },
  {
    q: "Where does the market data come from?",
    a: "Crypto prices come from the public CoinGecko API where reachable. Forex and equities use clearly-labelled deterministic fallback values. Every quote shows its source badge and timestamp.",
  },
  {
    q: "How do deposits work?",
    a: "Buy crypto with a card or bank through Coinbase — it is delivered to your own wallet — or receive an on-chain transfer. Your balance here is credited only after a verified Coinbase webhook reconciles the movement; an event that matches no account credits nothing.",
  },
  {
    q: "How do withdrawals work?",
    a: "Cash out to your bank through Coinbase's One-Click-Sell flow, or send crypto on-chain from the platform custody account. A withdrawal is signed at the custody boundary, spend limits are enforced before anything is signed, and it is final — it cannot be undone.",
  },
  {
    q: "What protects my funds?",
    a: "Custody keys never live in this app: the platform holds only a key reference and API credentials, and signing happens inside the custody provider. Every real movement passes spend limits, an explicit server-side confirmation and a compliance boundary before it is sent.",
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
