# Reply to the CDP Onramp ticket

Ready to paste into the CDP case (09 Oct 2026, 11:09 pm — "Thanks for applying for
Coinbase Onramp"). Written to be sent as-is; edit the name/links to match the account.

---

Hi,

Thanks for the quick turnaround, and for the specifics — those helped.

On the project ID: that was the missing piece. I hadn't opened the Onramp & Offramp page
for project `c191acef-47fd-4845-a3ad-dc98e060faaa`, so it was never registered for Onramp.
I've now gone to Products > Payments > Onramp & Offramp on that project, which should
register it. I'll confirm here once the session-token call stops returning "failed to find
app with cloud project id".

On the app itself — and this is probably why it looked un-integrated — the Onramp hand-off
is actually wired up. The failure you saw was our own error message, not Coinbase's. Here's
what the "Buy with Coinbase" button does:

1. It calls your Session Token API — `POST https://api.developer.coinbase.com/onramp/v1/token` —
   authenticated with a short-lived CDP JWT signed server-side from the CDP API key id and
   secret. The request carries the user's own wallet address, the end-user client IP, and
   the blockchains we support (`ethereum`, `base`).
2. On a 200 it builds
   `https://pay.coinbase.com/buy/select-asset?sessionToken=…&defaultNetwork=base&defaultAsset=USDC`
   and redirects the user there.

"Coinbase could not start a deposit right now. Please try again in a moment." is our
fail-closed fallback: when step 1 fails we show a generic message and never hand the user a
broken widget. With the project unregistered, step 1 was failing with exactly the
`failed to find app with cloud project id` error you quoted, which is why no
`pay.coinbase.com` URL was ever produced. Once the registration and the production keys are
in place, that button should produce the pay URL — I'll test it end to end and report back.

The rest of the integration is in place too, for context:

- Offramp uses the same Session Token API and then hands off to
  `https://pay.coinbase.com/v3/sell/input` (with the required `redirectUrl`).
- `POST /api/webhooks/coinbase` verifies the `X-Hook0-Signature` header in constant time
  before anything is recorded, de-duplicates deliveries by `eventID`, and only credits a
  webhook when a stablecoin transfer maps to a wallet we know (or a stored transfer id).
  Anything that can't be matched is stored as unmatched and credits nothing. The endpoint
  stays disabled (503) until the webhook signing secret is set.

On the usage intent, so it isn't vague for the "Purchase Goods" and "Bundled Services"
categories:

> Veylora is a self-custody portfolio and trading dashboard. Coinbase Onramp is used purely
> as a fiat funding rail: a signed-in user who wants to fund their own wallet with USDC or
> ETH is handed off to Coinbase's hosted buy flow to pay by card or bank. Coinbase delivers
> the crypto to the user's own wallet — we never take custody of the fiat, the crypto, or
> the payment instrument, and we never hold a signing key for the user's wallet.
>
> "Purchase Goods" applies in the narrow sense that the user is purchasing a digital asset
> (USDC/ETH) that they then hold themselves; we are not selling physical goods or services.
> "Bundled Services" applies because the onramp is one feature of a bundled dashboard —
> market data, a portfolio view, a self-directed desk, and wallet tooling — not a standalone
> money-transmission product.
>
> Onramp stays outside the app's execution boundary: this path moves nothing on the user's
> behalf. Real movements the app itself can make (a custody-signed swap) run through a
> separate, explicitly gated path and are not part of this Onramp application.

On the security requirements you linked, here's where each one stands:

- **Server-side token minting / no API keys in the browser** — done. The CDP JWT is signed
  server-side only; the auth SDK is imported on the server and never reaches the client
  bundle.
- **Single-use, short-lived session tokens** — done. One token per hand-off, never stored.
- **Client IP passed for validation** — done. We send the end-user IP from the forwarded
  header.
- **Webhook signature verification** — done. Constant-time HMAC over the raw body with a
  timestamp window, and the receiver is disabled when the secret is unset.
- **Replay / idempotency** — done. Events are de-duplicated by `eventID`; ledger credits are
  claimed under an idempotency key so a retried delivery cannot double-credit.
- **Secret handling** — done. Credentials live only in the server environment; the console
  shows presence/shape and a non-reversible fingerprint, never a value.
- **No custody of user keys** — done. We hold CDP API credentials, not the user's wallet key.
- **Monitoring / abuse controls** — partly. We surface provider and webhook health to
  operators and refuse on-hold or banned accounts, and there are server-enforced spend caps;
  edge rate limiting / a WAF is something we're still evaluating. If it's a hard requirement
  for Onramp review, tell me and I'll prioritise it.

I've also put a short integration overview up for your review at
`https://veylora-fintech-ai-trading.vercel.app/coinbase` — it covers the Onramp/Offramp
hand-offs, the webhook/reconciliation behaviour and the security posture above, without any
credentials in it.

Two last notes: we'll stay inside the temporary limits (25 transactions, $5 per transaction)
while we test, and the temporary message on the site is our fail-closed fallback described
above, not a sign that Onramp is missing. I'll follow up once the production session token
comes back and a small test purchase is reconciled, so you can verify.

Thanks,
John
