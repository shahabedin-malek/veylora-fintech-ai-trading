import Link from "next/link";

import { ONRAMP_BLOCKCHAINS, ONRAMP_DEFAULT_ASSET, coinbaseOnrampConfigured } from "@/lib/coinbase/onramp";

/**
 * Coinbase integration overview — a public, read-only page describing how Onramp and
 * Offramp are wired into the app. It exists so a reviewer (and the operator) can see the
 * integration without reading the source. It contains no credentials and no configuration
 * values, and it cannot move money.
 */

export const metadata = {
  title: "Coinbase integration",
  description: "How Coinbase Onramp and Offramp are integrated.",
};

export default function CoinbaseIntegrationPage() {
  const onrampConfigured = coinbaseOnrampConfigured();

  return (
    <div className="grid" style={{ gap: 20, maxWidth: 780 }}>
      <div>
        <h1 style={{ margin: 0 }}>Coinbase integration</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          How Veylora uses Coinbase to fund and cash out a user&apos;s <b>own</b> wallet. The app
          never takes custody of the fiat or the crypto, and never holds a signing key for a
          user&apos;s wallet.
        </p>
      </div>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Onramp — buy crypto with fiat</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          A signed-in user can buy {ONRAMP_DEFAULT_ASSET} with a card or bank through Coinbase.
          The app asks Coinbase for a short-lived session token (server-side, authenticated with
          a CDP API key — never exposed to the browser), then redirects the user to Coinbase&apos;s
          hosted buy page. Coinbase collects the payment and delivers the crypto to the
          user&apos;s own address on {ONRAMP_BLOCKCHAINS.join(" or ")}. Nothing is credited to an
          app balance until a verified webhook reconciles the transfer.
        </p>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          <li>Session token: <span className="mono">POST api.developer.coinbase.com/onramp/v1/token</span> (signed CDP JWT).</li>
          <li>Hand-off: <span className="mono">pay.coinbase.com/buy/select-asset</span> with the single-use token.</li>
          <li>Delivery: to the user&apos;s own wallet address, not to the platform.</li>
        </ul>
        <p className="muted" style={{ marginBottom: 0, marginTop: 10, fontSize: 13 }}>
          Configuration status:{" "}
          <span className={`badge ${onrampConfigured ? "good" : ""}`}>
            {onrampConfigured ? "credentials set" : "not configured on this deployment"}
          </span>
        </p>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Offramp — sell crypto for fiat</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          The reverse hand-off: the app mints the same kind of session token and sends the user to
          Coinbase&apos;s One-Click-Sell flow (<span className="mono">pay.coinbase.com/v3/sell/input</span>,
          which requires a redirect URL). The user sends crypto from their own wallet and Coinbase
          pays out to their bank. The app signs nothing on this path.
        </p>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Webhooks and reconciliation</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Coinbase deliveries arrive at <span className="mono">/api/webhooks/coinbase</span>. Each
          delivery is verified against its signature in constant time before anything is recorded,
          de-duplicated by event id, and only credits a ledger entry when a stablecoin transfer
          maps to a wallet the app knows. A delivery that cannot be matched is stored as unmatched
          and credits nothing. The receiver is disabled (fail closed) unless its signing secret is
          configured. Deposits and sales show up per user on the history page only after a verified
          webhook.
        </p>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Security posture</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          <li>CDP API keys are used server-side only; nothing that can sign is shipped to the browser.</li>
          <li>Session tokens are single-use and short-lived; the end-user IP is passed for validation.</li>
          <li>Inbound webhooks are signature-verified and de-duplicated before any ledger effect.</li>
          <li>The app holds CDP <b>API</b> credentials, never a user&apos;s wallet key.</li>
          <li>Operator tools show credential presence and a non-reversible fingerprint — never a value.</li>
        </ul>
      </section>

      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Questions about this integration? <Link className="link" href="/faq">See the FAQ</Link> or{" "}
        <Link className="link" href="/support">open the support chat</Link>.
      </p>
    </div>
  );
}
