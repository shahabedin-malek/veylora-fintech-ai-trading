# Coinbase ↔ Veylora integration map

How Coinbase is added **on top of** the existing app, not in place of it. Everything
already built stays: SIWE wallet login, the fail-closed execution gate, the Coinbase
CDP custody boundary, and every route. Coinbase
enters as **additional providers/adapters** behind the same boundaries.

Read alongside:

- `docs/NETWORK_BOUNDARY.md` — a mainnet wallet is real; the practice networks are owner-only (fail closed).
- `docs/API_CREDENTIAL_REQUIREMENTS.md` — the credential rules (never a key in config).
- `docs/ARCHITECTURE.md`, `../../apps/web/README.md` — layers and routes.

Legend: **Existing** = already in `apps/web`; **Add** = new Coinbase work, owned by a
Phase 19 task (`.progress/TASK_QUEUE.md`).

## 0. Ground rules (unchanged)

- Custody keeps keys in the provider; the app holds only `CUSTODY_PROVIDER` +
  `CUSTODY_KEY_ID` and gets a signature back (`src/lib/custody/`).
- A mainnet session is **refused** by `src/lib/execution.ts` until a real executor
  exists. Coinbase work must extend that gate, never bypass it.
- Start in Coinbase **Sandbox** (`008`) with practice funds; custodial products
  need business verification, non-custodial do not (`004`).

## 1. Login

**Existing:** wallet connect + SIWE (`PHASE18-001`), session signed server-side
(`src/lib/session.ts`), `chainId → MAINNET|SANDBOX` bound to the session
(`PHASE18-002`). Routes: `/login`, `/dashboard`.

**Add — pick one or both, alongside SIWE (never replacing it):**

| Option | Docs | Notes |
| --- | --- | --- |
| Sign in with Coinbase (OAuth2) | `123`, `005`, `139` | Links a *Coinbase account*; server-side OAuth, no key in the browser. Maps to a `User` still keyed by wallet where known. |
| CDP embedded wallet auth (email/SMS/social) | `001`, `123`–`128`, `135` | Self-custody embedded wallet; email/SMS/social login. Produces an EVM address, so it can feed the **existing** SIWE/session path. |
| Social / OAuth providers | `124`–`128` | Google / Apple / X / Telegram configuration. |
| SIWE (already present) | `135` | Keep as the primary path; Coinbase OAuth is an alternate IdP. |

**Add — session hardening:** MFA (`129`–`134`) and auth-method linking (`136`) if
Coinbase accounts are linked to existing users.

**Task:** `PHASE19-002`.

## 2. Deposits

**Existing:** `/wallet` shows a deposit area and a transparent withdrawal breakdown;
amounts are integer cents (`src/lib/domain/`); `DEPOSIT_CAP_USD` refuses over-cap
deposits. Deposits are real (Coinbase-hosted) today.

**Add — funding paths (choose per product):**

| Path | Docs | Use |
| --- | --- | --- |
| Coinbase Onramp (hosted URL, headless, or App2App deep link) | `046`–`072`, `162`, `055`–`057` | User buys crypto with fiat; fund an embedded/connected wallet. |
| Deposit Destinations (custodial) | `021`–`025` | Stablecoin/fiat deposit addresses for a CDP account. |
| Transfers API | `026`, `101`, `161`, `027` | Programmatic transfer in; validate with `028` payload shapes. |
| Credit the ledger on webhooks | `029`, `030`, `041`, `042`, `043`, `066` | Verify `X-Hook0-Signature` before crediting — the only trustworthy deposit confirmation. |

**Task:** `PHASE19-003` (funding — **done**) and `PHASE19-006` (webhook ingestion —
**done**).

**Implemented:** `src/lib/coinbase/onramp.ts` (session-token request + hosted buy-URL
builder) and `startCoinbaseDepositAction`; the `/wallet` page shows the deposit address
and a fail-closed "Buy with Coinbase" hand-off. Incoming deposits are reconciled by the
webhook receiver and visible in the admin console at `/admin/webhooks`.

## 3. Trading

**Existing:** the `/trade` desk runs the real Coinbase swap venue; the execution gate
guards every real money path.

**Add — a real venue (`PHASE18-005`, implemented):**

| Path | Docs | Use |
| --- | --- | --- |
| CDP API-key wallet + swaps | `110`, `111`, `115`, `102`, `104`, `107` | On-chain swaps from a provider-held wallet. |
| Transfers API + Advanced Trade | `101`, `026`, `161` | Route orders/fills; keep order state in `src/lib/domain/`. |
| Borrow (collateralized) | `003` | Optional: leverage via Morpho Blue (Base mainnet only). |
| Policy enforcement | `156`, `157` | Per-transaction/daily limits, allowlists — mirror `src/lib/custody/policy.ts`. |

Implemented as a venue adapter that `src/lib/execution.ts` selects when
`network === "MAINNET"`, custody is configured and `REAL_EXECUTOR_IMPLEMENTED` is
true; `MAINNET_EXECUTION_ENABLED=0` is a kill switch. A practice session never reaches
a real path.

**Task:** `PHASE19-004` (feeds `PHASE18-005`).

## 4. Withdrawals

**Existing:** `/wallet` computes a transparent withdrawal breakdown (fee bps) and
`/history` lists ledger entries; real movements today.

**Add:**

| Path | Docs | Use |
| --- | --- | --- |
| Coinbase Offramp (hosted, headless, one-click-sell) | `058`–`067` | Sell crypto to fiat/bank. |
| Disbursements | `040`, `044` | Payout to a bank/crypto destination. |
| Transfers API (out) | `026`, `101`, `028` | Send crypto/stablecoin out. |
| Transaction status | `062`, `067`, `066` | Poll or consume webhooks to finalize a withdrawal. |

Withdrawals must pass the custody spend limits (`CUSTODY_MAX_PER_TX_USD`,
`CUSTODY_DAILY_LIMIT_USD`) **before** any signature, and record an idempotency key so
a retried webhook cannot pay twice.

**Implemented:** `src/lib/coinbase/offramp.ts` (shared Session Token API +
`pay.coinbase.com/v3/sell/input` URL builder, `redirectUrl` required) and
`startCoinbaseWithdrawalAction`; the `/wallet` page shows a fail-closed "Withdraw with
Coinbase" hand-off beside the on-chain custody withdrawal. The app never signs the sale, so
Offramp stays outside the execution gate. **Custodial disbursements / the Transfers API
remain follow-ups** — they need a verified custodial account. Reconciliation is
visible per user on `/history` and per operator on `/admin/webhooks`.

**Task:** `PHASE19-005` (withdrawals — **done**) and `PHASE19-006` (webhook ingestion —
**done**).

## Live credentials smoke test

`COINBASE_LIVE=1 npm run smoke:coinbase` (`tests/coinbase.live.test.ts`) exercises the
real APIs when credentials are present and skips otherwise: it mints a live onramp
session token, builds a live offramp URL, and — with `COINBASE_WEBHOOK_SECRET` — signs a
`payments.transfers.completed` delivery, verifies it locally, and optionally POSTs it to
`COINBASE_SMOKE_URL` expecting a `200`.

## 5. Cross-cutting

| Concern | Docs | Task |
| --- | --- | --- |
| CDP credentials, sandbox→live, secret hygiene/rotation | `004`, `005`, `006`, `008`, `007`, `160` | `PHASE19-007` |
| Sandbox + automated tests (unit/integration/e2e) | `008`, `010` | `PHASE19-008` |
| UI surfaces (connect / onramp / withdraw / trade) consistent with the existing design | `141`, `144`, `145`, `146` | `PHASE19-009` |
| KYC/AML, sanctions, jurisdiction gating | `019`, `089`, `065` | `PHASE19-010` (with `PHASE18-007`) |
| Agents / MCP access to the same accounts | `011`–`015`, `084`–`088` | optional, later |

## Env vars (additive)

Existing custody vars stay (`CUSTODY_*`, `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`,
`CDP_WALLET_SECRET`). New Coinbase surfaces add their own — follow the same rule:
**a reference or a public id only, never a signing key**. Candidate names (confirm
against the doc pages before wiring):

- `COINBASE_OAUTH_CLIENT_ID`, `COINBASE_OAUTH_CLIENT_SECRET` (login, `123`)
- `COINBASE_ONRAMP_APP_ID` (onramp URL, `049`)
- `COINBASE_WEBHOOK_SECRET` (verify `X-Hook0-Signature`, `030`/`042`)

Update `apps/web/.env.example` and `docs/API_CREDENTIAL_REQUIREMENTS.md` when each is
introduced; `npm run test:docs` fails if a read env var is undocumented.
