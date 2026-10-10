# Coinbase Onramp — integration & readiness

A single, honest view of where the Coinbase **Onramp** (buy crypto with fiat) integration
stands on Veylora Fintech AI Trading: **what is already built in code**, **what only a
human with portal access can do**, and **what the app is still waiting on**. It exists so
the operator and Coinbase CDP Support can read the same page.

Companion docs: `coinbase/INTEGRATION.md` (the full Coinbase ↔ app map),
`docs/API_CREDENTIAL_REQUIREMENTS.md` (credential rules), `docs/NETWORK_BOUNDARY.md`
(the real-vs-practice boundary), `docs/DEPLOYMENT.md` (how to deploy).

**CDP case context**
- Project ID: **`c191acef-47fd-4845-a3ad-dc98e060faaa`**
- Live app: **`https://veylora-fintech-ai-trading.vercel.app`**
- Support reply: CDP Support (Technical Services Engineer), **09 Oct 2026, 11:09 pm**
- Status: **Onramp not yet registered for the project** → the app cannot mint a session
  token, so the "Buy with Coinbase" hand-off bounces back with a generic error.

---

## 1. What CDP told us (verbatim facts to act on)

1. The **project ID is not registered for Onramp**. The fix is a **portal step**, not a
   code change:
   - Go to **Products > Payments > Onramp & Offramp** in the CDP portal.
   - Be on the right project — the URL should look like
     `https://portal.cdp.coinbase.com/entity_xxxxxx/payments/onramp?project=c191acef-47fd-4845-a3ad-dc98e060faaa`.
   - Opening that page **auto-registers** the project ID for Onramp, which clears the
     `failed to find app with cloud project id` error.
2. On the live app, clicking **"Buy with Coinbase"** produced **no `pay.coinbase.com`
   URL**; instead it showed **"Coinbase could not start a deposit right now. Please try
   again in a moment."** CDP reads this as "Onramp is not integrated yet".
3. **Temporary integration limits:** up to **25 transactions**, **max $5 per
   transaction**.
4. Quickstart: <https://docs.cdp.coinbase.com/onramp/introduction/quickstart>
5. Elaborate the **usage intent** for the **"Purchase Goods"** and **"Bundled Services"**
   categories (a written justification is expected). Draft in §5.
6. Implement the **security requirements**:
   <https://docs.cdp.coinbase.com/onramp/security-requirements> — mapped in §6.
7. When fully integrated, **reply to the case** and Coinbase continues verification.
   Draft reply in §7.

> **Why the app showed that exact message.** `startCoinbaseDepositAction`
> (`apps/web/src/lib/actions.ts`) calls `createOnrampUrl`; when the Coinbase session-token
> request fails it redirects to `/wallet?coinbase=error`, whose notice string is
> *"Coinbase could not start a deposit right now. Please try again in a moment."* That is
> the **correct fail-closed behaviour** — the app refuses rather than showing a broken
> widget. The root cause is the unregistered project (fact 1), not a missing integration.

---

## 2. What is already built (DONE — code, no human required)

Onramp **is integrated in code**. The session-token flow, the hosted buy-URL builder, the
fail-closed hand-off, reconciliation and the operator surfaces all exist and are covered by
tests. What is missing is only the portal registration and the live end-to-end pass.

| Piece | Where | What it does |
| --- | --- | --- |
| Onramp config gate | `apps/web/src/lib/coinbase/onramp.ts` → `coinbaseOnrampConfigured()` | True only when `CDP_API_KEY_ID` **and** `CDP_API_KEY_SECRET` are set. |
| Session Token API call | `onramp.ts` → `fetchOnrampSessionToken()` | Signs a short-lived **CDP JWT** (`@coinbase/cdp-sdk/auth`) and `POST`s to `https://api.developer.coinbase.com/onramp/v1/token` with the user's address, `clientIp` and blockchains. Surfaces Coinbase's own error text. |
| Hosted buy-URL builder | `onramp.ts` → `buildOnrampUrl()` / `createOnrampUrl()` | Builds `https://pay.coinbase.com/buy/select-asset?sessionToken=…&defaultNetwork=base&defaultAsset=USDC…`. Deterministic + unit-tested. |
| Deposit action | `apps/web/src/lib/actions.ts` → `startCoinbaseDepositAction` | Server action behind the **"Buy with Coinbase"** button; fail-closed (unconfigured / API error → redirect back with a reason, never a broken widget). |
| Offramp (the sibling) | `apps/web/src/lib/coinbase/offramp.ts` → `createOfframpUrl()` | Same Session Token API + `https://pay.coinbase.com/v3/sell/input` (redirectUrl required). `startCoinbaseWithdrawalAction`. |
| Webhook receiver | `apps/web/src/app/api/webhooks/coinbase/route.ts` | Verifies `X-Hook0-Signature` (`src/lib/coinbase/webhook.ts`, constant-time HMAC, timestamp window) **before** anything reaches the ledger; `503` when unconfigured, `401` on a bad signature. |
| Ledger reconciliation | `apps/web/src/lib/coinbase/ingest.ts` | De-duplicates by `eventID`; only `payments.transfers.completed` with a resolvable user **and** a stablecoin amount credits. Unmatched events credit nothing. |
| Per-user + operator visibility | `/history`, `/dashboard` reconciliation feed, `/admin/webhooks` | Deposits show up after a verified webhook, filterable by provider/status. |
| Credential hygiene | `src/lib/coinbase/credentials.ts`, `/admin/credentials`, `npm run check:coinbase-credentials` | Presence/shape only — never prints a value. |
| Live smoke test | `tests/coinbase.live.test.ts`, `npm run smoke:coinbase` | With `COINBASE_LIVE=1` + credentials: mints a live session token, builds a live offramp URL, signs+verifies a webhook delivery. |
| Unit/integration tests | `tests/coinbase-*.test.ts`, `tests/coinbase-trading.test.ts` | Cover config gates, URL building, signature verification, ingestion de-dup. |

**In short:** the code path exists end to end; it is simply gated on a project that
Coinbase has not yet registered for Onramp.

---

## 3. What only a human can do (HUMAN — portal / account access required)

These cannot be done from code. Each needs a person with CDP portal and account access.

| # | Action | Where | Why human |
| --- | --- | --- | --- |
| H1 | **Register the project for Onramp** | CDP portal → Products > Payments > Onramp & Offramp, on project `c191acef-…` | Portal session; auto-registers the project ID. **This is the single blocker.** |
| H2 | **Provide the Onramp usage-intent justification** (Purchase Goods / Bundled Services) | Reply to the CDP case | A written business statement, not code — draft in §5. |
| H3 | **Implement/park the CDP security requirements** | <https://docs.cdp.coinbase.com/onramp/security-requirements> | Some are policy/attestations; see §6 for what code already covers and what needs a decision. |
| H4 | **Confirm the project is live (not sandbox)** and Onramp is enabled for it | CDP portal | Account state is not visible to the app. |
| H5 | **Set prod credentials** `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` (and `COINBASE_WEBHOOK_SECRET`) on Vercel | Vercel project env | Secrets must be entered by the account owner; never committed. |
| H6 | **Deploy the (already-built) build** with those vars and click through the live flow | Vercel | Needs a deploy + a real browser session. |
| H7 | **Reply to the CDP case** once green, requesting verification | Support case | Account-holder action. Draft in §7. |
| H8 | **Keep within the temporary caps** (25 tx, $5/tx) while integrating | runtime discipline | Operational. |

> The **only** thing standing between the current deployment and a working Onramp widget
> is **H1**, followed by **H5/H6** to prove it end to end.

---

## 4. Human vs. done — at a glance

| Requirement | Status |
| --- | --- |
| Session Token API request (CDP JWT) | **DONE** (code) |
| Hosted buy-URL construction | **DONE** (code) |
| "Buy with Coinbase" button + fail-closed hand-off | **DONE** (code) |
| Webhook verification + ledger reconciliation | **DONE** (code) |
| Operator visibility (`/admin/webhooks`, `/admin/credentials`) | **DONE** (code) |
| Live smoke test harness | **DONE** (code) |
| Unit/integration test coverage | **DONE** (code) |
| Register project for Onramp | **HUMAN (H1)** — blocking |
| Usage-intent justification | **HUMAN (H2)** |
| Security-requirements sign-off | **HUMAN (H3)** — partly code, see §6 |
| Prod credentials on Vercel | **HUMAN (H5)** |
| Live end-to-end pass + reply to case | **HUMAN (H6/H7)** |

---

## 5. Onramp usage intent (draft for "Purchase Goods" & "Bundled Services")

CDP asked for the usage intent to be elaborated. This is a **draft** the operator can edit;
it states only what the product actually does and does not over-claim.

> **Onramp usage intent — Veylora Fintech AI Trading**
>
> Veylora is a self-custody portfolio and trading dashboard. Coinbase Onramp is used as a
> **fiat funding rail only**: a signed-in user who wants to fund their **own** wallet with a
> stablecoin (USDC) or ETH can be handed off to Coinbase's hosted buy widget to pay with a
> card or bank. Coinbase delivers the crypto to the **user's own wallet address**; Veylora
> never takes custody of the fiat, the crypto, or the payment instrument, and never holds a
> signing key for the user's wallet.
>
> **"Purchase Goods"** applies in the narrow sense that Onramp here is used to purchase a
> digital asset (USDC/ETH) that the user then holds in their own wallet and may use within
> the product (e.g. to fund a self-directed swap on a supported network). It is *not* used
> to sell physical goods or services.
>
> **"Bundled Services"** applies because the onramp hand-off is one feature of a bundled
> dashboard product: market data, portfolio views, a self-directed trading desk, and
> self-custody wallet tooling. Onramp is not sold as a standalone money-transmission
> service; it is a funding convenience inside the app.
>
> Veylora does **not** move users' funds on the Onramp path — the funds land in the user's
> own wallet. Real movement the app can perform (custody-signed swaps/withdrawals) runs
> through a separate, explicitly-gated execution boundary and is out of scope for this
> Onramp application.
>
> Temporary limits (25 transactions / $5 per transaction) are respected during
> integration/testing.

**Operator TODO (H2):** confirm the above matches the account's intended business purpose,
adjust wording, and paste it into the CDP case reply.

---

## 6. CDP security requirements — mapped

CDP requires implementing <https://docs.cdp.coinbase.com/onramp/security-requirements>.
The table below maps each theme to what already exists in code and what still needs a
human decision. (Confirm the exact current wording on the CDP page before replying.)

| Security theme | Already in code | Still human |
| --- | --- | --- |
| **Server-side session-token minting** (never expose API keys to the browser) | The CDP JWT is signed **server-only** in `onramp.ts`; `@coinbase/cdp-sdk/auth` is imported dynamically so it never reaches a client bundle. | — |
| **Short-lived, single-use tokens** | Session tokens are single-use and short-lived by design; the app requests one per hand-off and never stores it. | — |
| **End-user IP passed for validation** | `fetchOnrampSessionToken` requires and forwards `clientIp` (from `x-forwarded-for` in the action). | Verify the deploy sets the correct forwarded header behind Vercel. |
| **Signature verification of inbound webhooks** | `X-Hook0-Signature` verified constant-time with a timestamp window; endpoint disabled (`503`) without `COINBASE_WEBHOOK_SECRET`. | Set `COINBASE_WEBHOOK_SECRET`. |
| **Idempotency / replay protection** | Webhook events de-duplicated by `eventID`; ledger credits run through `runOnce`. | — |
| **Secret hygiene / rotation** | `/admin/credentials` + `npm run check:coinbase-credentials` (presence & shape only); `docs/KEY_ROTATION.md`. | Rotate per cadence; set prod values (H5). |
| **No custody of user keys** | The app holds only CDP **API** credentials; the user's wallet key stays with the user. | — |
| **Fraud / abuse controls** | Server actions are authenticated; deposits require an explicit server-side confirmation; on-hold/banned accounts are refused. | Decide whether an edge WAF / rate limit is needed (see `docs/OPEN_TASKS_AND_IDEAS.md` §9). |
| **Monitoring / logs** | Provider/webhook health surfaces on `/admin/*`; no secrets logged. | Decide on structured logging / error tracking (§9). |
| **KYC / sanctions posture** | Opt-in OFAC SDN screening (`COMPLIANCE_PROVIDER=sanctions-list`); default is an honest no-op reporting screening **off**. | Onramp KYC is handled by **Coinbase**; the operator should note that Veylora itself does not collect KYC on this path. |

**Operator TODO (H3):** open the CDP security-requirements page, tick each item against the
table above, and record any gap as a follow-up in `docs/OPEN_TASKS_AND_IDEAS.md` §9.

---

## 7. Reply template to the CDP case (for the operator to send)

> Hi CDP team,
>
> Thanks for the detailed pointers.
>
> **On the project registration:** understood — I'll open **Products > Payments > Onramp &
> Offramp** on project `c191acef-47fd-4845-a3ad-dc98e060faaa` to register it for Onramp, and
> confirm once done.
>
> **On the app:** Onramp **is** integrated server-side. The deposit button calls the CDP
> Session Token API (`POST https://api.developer.coinbase.com/onramp/v1/token` with a
> server-signed CDP JWT), then hands the user off to
> `https://pay.coinbase.com/buy/select-asset?sessionToken=…`. The message you saw —
> *"Coinbase could not start a deposit right now…"* — is our **fail-closed** fallback for
> when the session-token request fails, which matches the
> `failed to find app with cloud project id` error: the project simply wasn't registered,
> so we refused rather than showing a broken widget. Once the project is registered and the
> prod credentials are set, the hand-off should produce a `pay.coinbase.com` URL.
>
> **Usage intent (Purchase Goods / Bundled Services):** [paste the §5 statement]
>
> **Security requirements:** [state which are implemented and any in progress, per §6]
>
> **Temporary limits:** noted — 25 transactions, $5 per transaction during integration.
>
> I'll reply again once the live flow produces a Coinbase URL for verification.
>
> Thanks,
> [name]

---

## 8. Verification checklist (after H1 + H5)

Run these once the project is registered and prod credentials are set:

- [ ] `npm run check:coinbase-credentials` → exits 0 (no flagged credential).
- [ ] `COINBASE_LIVE=1 npm run smoke:coinbase` → the live onramp session-token + offramp
      URL smoke tests pass (previously skipped).
- [ ] On the deployed app, signed in with a wallet on a supported network:
      **"Buy with Coinbase"** redirects to a **`pay.coinbase.com/buy/select-asset`** URL
      (no "could not start a deposit" message).
- [ ] A completed test purchase (≤ $5) delivers USDC on **Base** to the user's own wallet.
- [ ] A signed `payments.transfers.completed` delivery is accepted by
      `/api/webhooks/coinbase` and appears on `/admin/webhooks`; a replayed delivery is a
      no-op.
- [ ] Reply to the CDP case requesting verification.

---

## 9. References

- Onramp quickstart — <https://docs.cdp.coinbase.com/onramp/introduction/quickstart>
- Onramp security requirements — <https://docs.cdp.coinbase.com/onramp/security-requirements>
- CDP portal — <https://portal.cdp.coinbase.com/>
- App-side code: `apps/web/src/lib/coinbase/{onramp,offramp,webhook,ingest,credentials}.ts`,
  `apps/web/src/lib/actions.ts`, `apps/web/src/app/api/webhooks/coinbase/route.ts`,
  `apps/web/src/app/admin/{webhooks,credentials}/page.tsx`.
- Credential rules: `docs/API_CREDENTIAL_REQUIREMENTS.md`, `docs/KEY_ROTATION.md`.
