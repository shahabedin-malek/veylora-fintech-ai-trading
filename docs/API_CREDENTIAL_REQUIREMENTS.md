# API & Credential Requirements

The app runs **fully with only two required variables**. Everything else is optional
and each optional key unlocks a specific enhancement. Never commit real secrets.

## Required

| Env var | Service | Purpose | How to set |
| --- | --- | --- | --- |
| `DATABASE_URL` | local SQLite / PostgreSQL | Prisma datasource | local: `file:./dev.db`; deploy: Postgres URL |
| `SESSION_SECRET` | app (self) | signs the session cookie | 32+ random bytes: `openssl rand -base64 32` |

## Optional

| Env var | Service | Mandatory? | Signup | Scopes | Used by | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `MARKET_PROVIDER` | — | no | n/a | n/a | `src/lib/market` | `auto` \| `coingecko` \| `finnhub` \| `offline`. `auto` (default) routes by asset class: crypto → CoinGecko, equities → Finnhub when `FINNHUB_API_KEY` is set, everything else → the labelled offline generator |
| (none — public) | CoinGecko public API | no | https://www.coingecko.com/en/api | read-only, no key | crypto quotes/candles | Falls back to an offline provider on failure |
| `NEWS_FEEDS` | any public RSS feed | no | n/a | n/a | `src/lib/market#getNews` | comma-separated feed URLs; unset ⇒ the curated, verified defaults in `docs/NEWS_SOURCES.md`; no feed ⇒ empty state |
| `WITHDRAW_FEE_BPS` | app (self) | no | n/a | n/a | withdrawal maths | 100 = 1% fee |
| `MIN_TRADE_USD` | app (self) | no | n/a | n/a | trading state machine | default 20 |
| `DEPOSIT_CAP_USD` | app (self) | no | n/a | n/a | deposit spend cap | default 10000; a larger deposit is refused, never trimmed |
| `DISPUTE_WINDOW_BUSINESS_DAYS` | app (self) | no | n/a | n/a | withdrawal dispute window | default 3 **business days** (Mon–Fri, UTC; no public-holiday calendar). A declined withdrawal request gives the user this long to argue the case in the support thread before an admin resolves it. Shown to the user as an exact date, not a computed deadline |
| `COMPLIANCE_PROVIDER` | compliance screening | no | n/a for `sanctions-list`; vary for a vendor | n/a | `src/lib/compliance` | Default `none` = inert no-op: no screening runs, and the app says so (`/wallet`, `complianceStatus()`). `sanctions-list` = the real, **credential-free** backend: screens wallet addresses and withdrawal destinations against the published **OFAC SDN** list, refusing on a hit and failing closed while the list is unreachable (US/OFAC lists only — no KYC/PEP or other jurisdictions; see `docs/KEY_ROTATION.md`). A vendor adapter can be registered by slug (`PHASE18-007` / `PHASE19-010`) |
| `COMPLIANCE_SANCTIONS_LIST_URL` | OFAC / mirror | no | n/a | n/a | `src/lib/compliance/providers/sanctions-list` | Optional override for the SDN list URL (mirror or pinned snapshot); default is OFAC's Sanctions List Service CSV export |
| `COMPLIANCE_SANCTIONS_CACHE_MS` | app | no | n/a | n/a | `src/lib/compliance/providers/sanctions-list` | Optional cache window for the parsed list in ms (default 21600000 = 6h). A garbage value falls back to the default |

## Wallet / chain integration (Phase 18 — login becomes wallet-based)

Sign-in is moving to **wallet connect + SIWE (EIP-4361)**, and email/password is
being removed entirely — wallet is the only sign-in, including for admin. The
signed-in network is **mainnet by default**: Ethereum, Base and Arbitrum run real
execution. Three practice chains (Sepolia, Base Sepolia, Arbitrum Sepolia) exist
but are **owner-only** — refused for every other wallet at sign-in — so ordinary
users never see a practice session or its surfaces. Custody is a **custodial hot wallet**
whose keys live in a KMS/HSM — never in config. "Real" covers both on-chain
transfers and venue-API trading.

The wallet connection uses **RainbowKit + wagmi/viem** (the connect modal, injected
browser wallets and WalletConnect). Implemented variables:

| Env var | Service | Purpose | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect/Reown Cloud | WalletConnect QR in the connect modal | public, **not** a secret; empty ⇒ injected wallets still work |
| `SIWE_DOMAIN` | app | pins the domain the SIWE message must name | optional; anti-phishing; defaults to the request host |
| `ADMIN_WALLET_ADDRESSES` | app | comma-separated addresses granted ADMIN at sign-in | optional; role can also be set in the DB |
| `OWNER_WALLET_ADDRESSES` | app | comma-separated addresses treated as the **site owner** | optional; empty ⇒ no owner and every owner-only path is unreachable. An owner is always ADMIN, may sign in on a practice network, and may credit practice funds to their own account (`src/lib/owner.ts`) |

Per-chain wallet RPC endpoints. Each is optional — an unset chain falls back to
viem's default public RPC. They are `NEXT_PUBLIC_*` because **wagmi runs in the
browser**, so the URL is part of the client bundle:

| Env var | Service | Purpose | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_WALLET_RPC_URL_ETHEREUM` | Alchemy / Infura / public RPC | Ethereum wallet reads | **PUBLIC** — restrict the key at the provider |
| `NEXT_PUBLIC_WALLET_RPC_URL_SEPOLIA` | Alchemy / Infura / public RPC | Sepolia wallet reads | **PUBLIC** |
| `NEXT_PUBLIC_WALLET_RPC_URL_BASE` | Alchemy / Infura / public RPC | Base wallet reads | **PUBLIC** |
| `NEXT_PUBLIC_WALLET_RPC_URL_BASE_SEPOLIA` | Alchemy / Infura / public RPC | Base Sepolia wallet reads | **PUBLIC** |
| `NEXT_PUBLIC_WALLET_RPC_URL_ARBITRUM` | Alchemy / Infura / public RPC | Arbitrum wallet reads | **PUBLIC** |
| `NEXT_PUBLIC_WALLET_RPC_URL_ARBITRUM_SEPOLIA` | Alchemy / Infura / public RPC | Arbitrum Sepolia wallet reads | **PUBLIC** |

> A hosted-RPC key in a `NEXT_PUBLIC_*` URL is readable by anyone who loads the
> site. That is inherent to browser-side RPC, not a misconfiguration: set an origin
> allowlist and rate limits on the provider key. Never put a **write-capable**
> (custody) key here — see the rules below.

Execution gating (`PHASE18-003` — the server-side real-execution gate):

| Env var | Service | Purpose | Notes |
| --- | --- | --- | --- |
| `MAINNET_EXECUTION_ENABLED` | app | kill switch for real execution | real execution is **on by default**; set to `0` to refuse every mainnet money action. One layer of the gate: a mainnet session also needs an implemented executor and configured custody (`src/lib/execution.ts`) |

Custodial hot-wallet custody (`PHASE18-004` — a provider-held key with spend limits).
A `CUSTODY_*` variable is a **reference to** a key held by the provider, never key
material; the app gets a signature back and nothing else. The implemented backend is
`coinbase-cdp` (Coinbase CDP Server Wallets — the wallet key stays inside Coinbase).
Custody is what lets the real venue sign: a mainnet money action runs only when the
executor is implemented, custody is configured, **and** the kill switch is clear
(`MAINNET_EXECUTION_ENABLED` not `0`). If any one is missing, the session is refused
(`src/lib/custody`, `src/lib/execution.ts`):

| Env var | Service | Purpose | Notes |
| --- | --- | --- | --- |
| `CUSTODY_PROVIDER` | KMS/HSM / wallet custodian | selects the custody backend | optional; empty ⇒ custody unavailable. Implemented value: `coinbase-cdp`. **Never** a key — just the provider name |
| `CUSTODY_KEY_ID` | provider | provider-side key/account identifier | optional; empty ⇒ custody unavailable. **Not a secret** (for `coinbase-cdp` it is the account name) |
| `CUSTODY_MAX_PER_TX_USD` | app | largest single real movement | default 1000; a larger amount is refused, never trimmed |
| `CUSTODY_DAILY_LIMIT_USD` | app | rolling daily real-movement cap | default 5000; a movement that would breach it is refused |

Coinbase CDP credentials — required **only** when `CUSTODY_PROVIDER="coinbase-cdp"`.
These authorise the API; they are not the wallet key (which never leaves Coinbase):

| Env var | Service | Purpose | Notes |
| --- | --- | --- | --- |
| `CDP_API_KEY_ID` | Coinbase CDP | API key id | server-only secret; from the CDP Portal |
| `CDP_API_KEY_SECRET` | Coinbase CDP | API key secret | server-only secret; never expose to the browser |
| `CDP_WALLET_SECRET` | Coinbase CDP | authorises wallet signing operations | server-only secret; not the wallet key |

Rules that must not be relaxed:

- **Never** a seed phrase, private key or signing secret in an env var, the repo,
  or logs. The custodial hot wallet's keys belong in a KMS/HSM, not in config;
  `CUSTODY_PROVIDER`/`CUSTODY_KEY_ID` describe *where* the key lives, they are not
  the key.
- Real execution is **on by default** and requires a mainnet session, an implemented
  executor (the Coinbase EVM swap adapter, `src/lib/coinbase/trading.ts`) **and**
  configured custody — independent checks, all server-side (`src/lib/execution.ts`);
  `MAINNET_EXECUTION_ENABLED=0` is a kill switch that refuses every mainnet money
  action. A practice-network session never reaches a real path (swaps are mainnet-only),
  and a mainnet session never falls back. A real movement also passes
  the custody boundary first (`src/lib/custody`), which enforces the `CUSTODY_*` spend
  limits and demands a provider-held signer before anything is signed.
- RPC/explorer keys are read-only; a compromised read key must not be able to move
  funds. `NEXT_PUBLIC_WALLET_RPC_URL_*` is public by design and must never hold a
  signing or custody key.
- The WalletConnect project id is a public identifier; treating it as a secret adds
  no security and breaks the build when it is missing.

See `docs/NETWORK_BOUNDARY.md` for the full list of blockers before mainnet.

## Coinbase integration (Phase 19 — planned, not yet wired)

Extending Coinbase coverage beyond custody to **login / deposits / trading /
withdrawals** (tasks `PHASE19-001` … `PHASE19-010`; reference docs under `coinbase/`,
mapped in `coinbase/INTEGRATION.md`).

**Implemented.** Coinbase login (`PHASE19-002`) is wallet-based: it uses the
**Coinbase Wallet connector that already ships in the build** and then the existing
SIWE flow, so it adds **no new credential** — a user still signs in with a wallet.
The webhook receiver (`PHASE19-006`) verifies Coinbase's `X-Hook0-Signature`:

| Env var | Service | Purpose | Notes |
| --- | --- | --- | --- |
| `COINBASE_WEBHOOK_SECRET` | Coinbase CDP | verify `X-Hook0-Signature` on webhook deliveries | server-only secret; from the webhook subscription. Unset ⇒ `/api/webhooks/coinbase` is disabled and accepts nothing (fail closed) |

**Real trading (`PHASE19-004`)** adds **no new credential**: a Coinbase EVM swap is
priced and signed by the same CDP account the custody backend uses, so it reuses
`CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` / `CDP_WALLET_SECRET` plus
`CUSTODY_PROVIDER=coinbase-cdp` / `CUSTODY_KEY_ID`. Swaps are **mainnet-only** and
run only when the execution gate allows it (see above).

**Credential hygiene (`PHASE19-007`)** is an audit of the credentials above: which are
present, which surface each unlocks, and whether a present value looks unsafe (a
placeholder, an obviously short secret, stray whitespace). It reads presence and shape
**only — never a value** — and is available at `/admin/credentials` and from the
operator CLI `npm run check:coinbase-credentials`. **Rotating** them (cadence, the
issue → deploy → verify → revoke order, the hard-cutover case for `CDP_WALLET_SECRET`,
and the emergency procedure) is the runbook in `docs/KEY_ROTATION.md`.

**Planned (not yet read by code).** When the remaining surfaces are wired they must
follow the same rule — **a reference or a public id only, never a signing key** — and
be added here together with `apps/web/.env.example` (a `.env.example` key without a
documented row fails `npm run test:docs`). Candidate names to confirm against the
Coinbase docs first: `COINBASE_OAUTH_CLIENT_ID` / `COINBASE_OAUTH_CLIENT_SECRET`
(account-based login), `COINBASE_ONRAMP_APP_ID` (onramp URL).

## Market-signal providers

A hand-off of third-party **signal, indicator and market-data** APIs lives in
`signals/signals.txt` (git-ignored — it carries live keys). The sanitised knowledge base,
including which endpoints were verified live and the adapter/risk design, is in
[`docs/signals/`](./signals/README.md). All of these variables are **server-only** and
**fail closed** (absent ⇒ the surface is inert and says so).

**Implemented and read by code:**

| Env var | Service | Purpose | Notes |
| --- | --- | --- | --- |
| `ALTFINS_API_KEY` | AltFins | `X-API-KEY` for the signals feed (138 signals) | server-only secret; **read by `src/lib/signals/altfins.ts`**; its presence enables the adapter, absent ⇒ signals are inert; verified live 2026-10-10 |
| `FINNHUB_WEBHOOK_SECRET` | Finnhub | shared secret Finnhub sends in `X-Finnhub-Secret` on every delivery | server-only secret; **read by `src/app/api/webhooks/finnhub/route.ts` + `src/lib/finnhub/webhook.ts`**; unset ⇒ the receiver returns `503` and accepts nothing. The receiver verifies + records only; it applies no balance change |
| `FINNHUB_API_KEY` | Finnhub | equity/crypto quotes (`X-Finnhub-Token` header) | server-only secret; **read by `src/lib/market/finnhub.ts`**; presence enables the Finnhub leg of `auto`. Forex is a premium resource on this key (403), so forex stays on the offline fallback |
| `WUNDERTRADING_API_KEY` | WunderTrading | HMAC API key for the venue-order executor | server-only; **can move funds** — behind the execution gate (`executor: "wundertrading"`, `src/lib/execution.ts`) and refused when unset |
| `WUNDERTRADING_SECRET_KEY` | WunderTrading | HMAC-SHA256 signing secret | **signing material**; read by `src/lib/wundertrading/client.ts`; never in the client bundle or logs |
| `VENUE_MAX_PER_TX_USD` | app | per-order real-money cap for venue orders | default `1000`; read by `src/lib/config.ts` (`config.venue.spendLimits`); an over-cap order is **refused, never trimmed** |
| `VENUE_DAILY_LIMIT_USD` | app | rolling 24h real-money cap for venue orders | default `5000`; read by `src/lib/config.ts` (`config.venue.spendLimits`) |
| `CRON_SECRET` | app | bearer secret Vercel Cron sends to `/api/cron/sync-desk` | server-only; unset ⇒ the endpoint returns `503` and accepts nothing. The route syncs provider signals + the risk-news snapshot only — it touches no money |
| `FREECRYPTOAPI_API_KEY` | FreeCryptoAPI | `Authorization: Bearer` for the keyed alternate market source | server-only; **read by `src/lib/signals/freecryptoapi.ts`**; unset ⇒ that adapter is inert (the keyless alternates still run) |
| `TAAPI_API_KEY` | TAAPI.IO | `Authorization: Bearer` for technical indicators (RSI/MACD, neutral context) | server-only; **read by `src/lib/signals/taapi.ts`**; pooled/rotatable. Unset ⇒ inert. **The supplied key was inactive (401)** — regenerate before use |
| `COINMARKETCAP_API_KEY` | CoinMarketCap | optional keyed Pro API (`X-CMC_PRO_API_KEY`) | **not required** — read by `src/lib/signals/coinmarketcap.ts`; absent ⇒ the keyless `…/public-api` root is used |
| `SIGNAL_MOVE_THRESHOLD_PCT` | app | 24h move (percent) that becomes a neutral market-move signal | default `5`; read by `src/lib/config.ts` (`config.signals.moveThresholdPct`). The event is `neutral`, so it raises the desk to `elevated` at most and can never make it risk-off |
| `CREDENTIAL_ENCRYPTION_KEY` | app | encrypts admin-added provider keys at rest (AES-256-GCM) | server-only; **read by `src/lib/credentials/crypto.ts`**; generate with `openssl rand -base64 32`. Unset ⇒ the key pool is **disabled** (fail closed) and only env-var keys are used; keys added while set cannot be decrypted after a change, so rotate it deliberately (`docs/KEY_ROTATION.md`) |

**Planned — documented so the keys have a home, not yet read by code:**

| Env var | Service | Purpose | Notes |
| --- | --- | --- | --- |
| `COINGECKO_API_KEY` | CoinGecko | optional keyed upgrade of the keyless integration | **not** required — the app already works keyless |
| `APIBRICKS_API_KEY` | APIBricks | market data | undocumented in the hand-off — do not wire until confirmed |
| `RAPIDAPI_KEY` | RapidAPI | gateway authorisation key | needs a matching `RAPIDAPI_HOST` to be usable |
| `RAPIDAPI_HOST` | RapidAPI | target API host (`X-RapidAPI-Host`) | not supplied for this account |

## Deployment (only after explicit authorization)

| Env var | Service | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Vercel Postgres / Neon | production database |
| `SESSION_SECRET` | app | production cookie signing |

## Security rules

- `.env` is git-ignored; only `.env.example` (placeholders) is committed.
- `SESSION_SECRET` must be unique per environment.
- No secret is ever logged or rendered.
- Nothing is published to GitHub/Vercel without explicit user authorization.
