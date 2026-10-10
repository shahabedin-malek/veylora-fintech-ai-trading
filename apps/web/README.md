# Veylora Fintech AI Trading — web app

A portfolio-ready **fintech + CRM** dashboard: multi-market data, charts, a real,
custody-signed AI trading desk, wallet deposit/withdrawal flows, and built-in
support tickets with an admin CRM console.

> **Real execution** (a custody-signed Coinbase EVM swap) is on by default: a mainnet
> session runs it once a custody backend is configured. Without custody a mainnet
> money action is **refused** — never replaced by a practice flow.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind 4 ·
Prisma 6 (SQLite locally, PostgreSQL for deploy) · wagmi/viem + RainbowKit for
wallet sign-in (SIWE) · Vitest. No external chart vendor required.

## Quick start

```bash
npm install
cp .env.example .env          # set SESSION_SECRET
npm run db:deploy             # apply committed migrations
npm run db:seed               # sample + admin accounts
npm run dev                   # http://localhost:3000
```

Sign-in is **wallet-based** — there is no email or password. Connect a wallet and
sign the SIWE message. Seeded sample accounts (use one of these wallets, e.g. by
importing the address into a wallet on Base, or mint a session cookie as the e2e
suite does):

| Role | Wallet address |
| --- | --- |
| User | `0x1111111111111111111111111111111111111111` |
| Admin | `0x2222222222222222222222222222222222222222` (also listed in `ADMIN_WALLET_ADDRESSES`) |

## Scripts

```bash
npm run dev        # dev server
npm run build      # prisma generate + next build
npm run start      # production server
npm run typecheck  # tsc --noEmit
npm test                 # all vitest: unit + integration (451 tests across 47 files; 5 live tests skip without credentials)
npm run test:unit        # market + owner units only (no database)
npm run test:integration # server actions + real DB writes (throwaway SQLite)
npm run test:docs        # docs stay in sync with code (models, routes, scripts, env)
npm run test:e2e         # playwright: full-journey + wallet sign-in + Coinbase + owner surfaces + UI audit (3 widths) + walkthrough
npm run test:owner-gating # playwright: no owner-only surface renders for a non-owner (leak guard)
npm run smoke:coinbase   # live onramp/offramp + webhook smoke (skipped unless COINBASE_LIVE=1)
npm run check:coinbase-credentials # Coinbase credential hygiene check (operator CLI)
npm run check:provider-keys # live provider smoke test (read-only; never prints a key)
npm run scan:secrets # high-signal secret scan of the working tree (also the pre-commit hook)
npm run verify:deploy    # production build + full vitest suite (release gate)
npm run db:deploy  # apply committed migrations (deploy)
npm run db:migrate # create a new migration (development)
npm run db:reset   # reset + re-seed
```

## Key routes

| Route | Description |
| --- | --- |
| `/` | Landing page with market snapshot |
| `/login` | Sign in with a wallet (SIWE — no password) |
| `/markets` | Crypto/forex/equities with charts |
| `/dashboard` | Balance, state machine controls, notifications |
| `/trade` | Coinbase swap desk (custody-signed, mainnet-only) |
| `/wallet` | Deposit, request a withdrawal (admin-reviewed), transparent breakdown |
| `/wallet/receipt/[id]` | Printable receipt for one withdrawal request (owner or admin) |
| `/history` | Transactions and ledger |
| `/support` | Support conversations → CRM tickets |
| `/admin` | CRM console (admins only) |
| `/admin/desk` | Desk operations: desk risk state, provider pool/health, withdrawal requests awaiting review and recent venue orders (admins only) |
| `/admin/backtest` | Backtest lab: forward-return distributions per signal key (out-of-sample + by regime), read-only (admins only) |
| `/admin/withdrawals` | Withdrawal request queue, failed-payout release, dispute windows, account holds and bans |
| `/admin/tickets/[id]` | Ticket triage, reply, internal notes |
| `/admin/webhooks` | Verified webhook deliveries (Coinbase + Finnhub), filterable by provider and status (admins only) |
| `/admin/signals` | Stored market signals (read-only risk input) with an on-demand sync (admins only) |
| `/admin/execution` | Venue execution: gated WunderTrading orders with a mandatory stop loss (admins only) |
| `/admin/credentials` | Provider key pool (add/rotate encrypted API keys per provider) + live provider health/smoke + Coinbase credential hygiene (admins only) |
| `/faq` | Frequently asked questions |
| `/coinbase` | Public overview of the Coinbase Onramp/Offramp integration and security posture |
| `/status` | Public status: which integrations are configured (presence only, never a value) |

## Architecture

- **Domain layer** (`src/lib/domain/`) — pure, unit-tested: the deterministic
  trading state machine, money (integer cents), and the withdrawal calculation.
- **Market layer** (`src/lib/market/`) — a provider-neutral interface. `auto` routes by
  asset class: crypto → CoinGecko, equities → Finnhub (when `FINNHUB_API_KEY` is set),
  everything else → an always-available, clearly-labelled offline fallback.
- **Risk layer** (`src/lib/risk/`) — the desk risk gate: **stored** signals plus a synced
  news snapshot produce a `normal`/`elevated`/`off` verdict, and a risk-off desk refuses the
  real swap before anything is signed. It is a documented rule set that can only refuse, and
  it reads storage (never a feed) so the money path stays deterministic.
- **Custody layer** (`src/lib/custody/`) — the fail-closed boundary for a real
  key: it deals only in a **key reference** (never key material) and enforces
  per-transaction/daily spend limits before any signature. The backend is Coinbase
  CDP Server Wallets (`CUSTODY_PROVIDER=coinbase-cdp`), where the wallet key stays
  in the provider (`PHASE18-004`).
- **Coinbase layer** (`src/lib/coinbase/`) — an additive provider, never a
  replacement. Sign-in with Coinbase runs the same SIWE flow; deposits (Onramp) and
  withdrawals (Offramp) are fail-closed hand-offs to Coinbase-hosted checkout; verified
  webhook deliveries (`/api/webhooks/coinbase`) are reconciled to the ledger and
  visible per user on `/history`, on the `/dashboard` reconciliation feed and per
  operator on `/admin/webhooks`. Trading is a **real, custody-signed EVM swap adapter**
  (`trading.ts`, mainnet-only) and credential hygiene is audited by
  `credentials.ts` / `/admin/credentials`.
- **Signals layer** (`src/lib/signals/`) — a **read-only** input: the AltFins adapter
  normalises vendor signals into `SignalEvent` and `getSignalsSafe` never throws
  (empty + `degraded` when unconfigured or failing). It cannot move money; the
  provider catalogue and the pipeline/guardrail design live in `../../docs/signals/`.
- **Finnhub webhook** (`src/lib/finnhub/`, `/api/webhooks/finnhub`) — verifies the
  `X-Finnhub-Secret` header in constant time, fails closed when `FINNHUB_WEBHOOK_SECRET`
  is unset, records each verified delivery once in `WebhookEvent`, and applies no balance
  change. `/admin/webhooks` lists deliveries by provider and status.
- **CRM layer** — support messages create tickets linked to the customer; admins
  triage status/priority/assignee and add internal notes.

See `../../docs/ARCHITECTURE.md` and `../../docs/DATA_MODEL.md`.

## Safety

- Secrets live only in `.env` (git-ignored). A **secret scan** runs in CI (`.github/workflows/secrets.yml`, gitleaks) and locally via `npm run scan:secrets`; enable the pre-commit hook once per clone with `git config core.hooksPath .githooks`.
- `SESSION_SECRET` signs the httpOnly session cookie; in production the app
  refuses to sign with a missing or weak secret (fails closed).
- Sign-in is by wallet: the signed-in **network decides the mode** — a mainnet
  wallet runs real execution, and the practice networks are **owner-only**. Real
  execution (Coinbase swaps) is **on by default**: a mainnet session runs it once a
  custody backend is configured, and `MAINNET_EXECUTION_ENABLED=0` is a kill switch.
  Without custody a mainnet money action is refused, never replaced by a practice flow
  (`../../docs/NETWORK_BOUNDARY.md`). Custody holds only the swap taker key; the owner
  may credit labelled practice funds to their own account.

See `../../docs/NETWORK_BOUNDARY.md` for the real-vs-practice rule (it follows the
wallet you sign in with),
`../../docs/RELEASE_CHECKLIST.md` before shipping, and
`../../docs/DEPENDENCY_AUDIT.md` for the dependency posture.

