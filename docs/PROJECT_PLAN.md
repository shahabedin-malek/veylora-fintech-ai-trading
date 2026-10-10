# Project Plan

## Mission

Build a portfolio-ready **fintech + CRM platform**: an AI-assisted financial
dashboard (crypto / forex / equities), market signals, charts, news, a
trading experience whose mode follows the signed-in wallet, wallet/deposit/
withdrawal flows, and a CRM/support layer with customer tickets and admin
operations — on a modern, responsive UI.

## Ground rules

- **Mode follows the wallet.** A mainnet wallet runs real execution (on by default;
  custody must be configured, and `MAINNET_EXECUTION_ENABLED=0` is a kill switch); the
  practice networks are **owner-only** and never reach a real path — see
  `docs/NETWORK_BOUNDARY.md`. No flow presents fake data as real, and no flow implies
  guaranteed returns.
- **No invented data.** Market data and news come from real providers or are
  explicitly labelled as an offline fallback.
- **No publishing.** No GitHub push or Vercel deploy until the user explicitly
  authorizes it.
- **Recover, don't rebuild.** Reuse proven work from `old/crypto-portal`.
- **Checkpoint always.** Durable state lives in `data/database/trading_ai_corpus.sqlite`
  and `.progress/*.md`.

## Phases

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Machine/project audit, control plane, DB schema | done |
| 1 | Corpus inventory, hashing, manifests, stable IDs | done |
| 2 | Historical project audit + reusable extraction | done |
| 3 | SSD/HDD staging + cleanup policy | done |
| 4 | Extraction/scraping framework + per-file knowledge | done (146/146) |
| 5 | Per-repository work units | done (146/146 VERIFIED) |
| 6 | Central knowledge synthesis | done (first pass) |
| 7 | Product requirements + architecture | done |
| 8 | Branding / names | done (Veylora Fintech AI Trading) |
| 9 | API credential requirements | done |
| 10 | Windows + Linux distributed development | done (optional router dropped) |
| 11 | Core app vertical slice | done |
| 12 | CRM/support tickets + admin | done |
| 13 | UI/UX polish + responsive | done |
| 14 | Test suite | done |
| 15 | Security + release readiness | done |
| 16 | GitHub/Vercel publish + deploy | done (public repo, Vercel + managed Postgres) |
| 17 | Final walkthrough gate | done |
| 18 | **Wallet auth + network-aware execution** — mainnet = real, practice networks owner-only | done (gate + custody + venue; real on by default) |
| 19 | **Coinbase integration** — login/deposit/trade/withdrawals added alongside the existing setup | in progress (login/deposits/trading/withdrawals/webhooks done) |

## Phase 18 — wallet auth + network-aware execution

The roadmap changed: the product is no longer paper-only. Sign-in is **wallet-based**
(SIWE), and the signed-in network decides the class of every action — a mainnet wallet
is real, and the practice networks are owner-only.

This was a re-architecture, not a flag flip. It replaced the email/password session and
the paper-only invariants with network gating, and it needed custody, a real execution
venue, irreversibility UX and compliance.
`docs/NETWORK_BOUNDARY.md` lists the blockers in full; the delivery tasks are
`PHASE18-001` … `PHASE18-009`. **Mainnet execution is on by default** and runs once a
real executor exists and custody is configured; `MAINNET_EXECUTION_ENABLED=0` is a kill
switch.

Progress: `PHASE18-001` (wallet connect + SIWE login), `PHASE18-002` (chainId →
`MAINNET`/`SANDBOX` classification, derived server-side from the session and
fail-closed for unsupported chains) and `PHASE18-003` (the server-side execution
gate, `src/lib/execution.ts`) are **done**. The gate *enforces* the class on the
money paths: a practice session never reaches a real path, and a mainnet session runs
real once the executor is implemented and custody is configured (otherwise it is
**refused**, never replaced); `MAINNET_EXECUTION_ENABLED=0` is a kill switch.
`PHASE18-008`'s invariant replacement also landed — the old "no `MAINNET` token in
`src/`" grep is replaced by network-gating tests. The copy/FAQ pass (`PHASE18-009`)
also landed (`/faq` now explains the wallet-network mode in plain language).
`PHASE18-004` is **implemented** — a fail-closed custody boundary with spend limits
(`src/lib/custody/`) backed by **Coinbase CDP Server Wallets**, where the wallet key
stays in the provider and the app holds only a key reference. The real **venue**
(`PHASE18-005`) is implemented as a Coinbase EVM swap adapter (`PHASE19-004`), so
**real execution is on by default**; still open are irreversibility UX (`006`) and
compliance (`007`), which need legal/operational decisions rather than code gates.

## Phase 19 — Coinbase integration

The user supplied Coinbase CDP documentation and asked to add **Coinbase login,
deposits, trading and withdrawals** to the current product while **keeping the
existing setup** (SIWE wallet login, the execution gate and the `coinbase-cdp`
custody boundary). The docs are split, de-duplicated and
indexed under **`coinbase/`** (`README.md`, `INTEGRATION.md`, `MANIFEST.md`, `docs/`),
regenerable with `python3 scripts/coinbase_extract.py`.

The delivery tasks are `PHASE19-001` … `PHASE19-010` (see `.progress/TASK_QUEUE.md`):
the knowledge base (`001`, done), Coinbase **login** alongside SIWE (`002`, **done** —
a wallet provider, not a separate account), Onramp/Deposit-Destination **deposits**
(`003`, **done** — a Coinbase-hosted buy hand-off with a fail-closed server action and
an admin reconciliation view), a real-venue **trade** adapter feeding `PHASE18-005`
(`004`), Offramp **withdrawals** (`005`, **done** — the mirrored Coinbase-hosted sell
hand-off; custodial disbursements remain a follow-up), verified **webhook** ingestion
(`006`, **done**, with per-user history on `/history` and an operator view on
`/admin/webhooks`), CDP credential hygiene (`007`), sandbox + tests (`008` — including
the `npm run smoke:coinbase` live smoke), UI surfaces (`009`), and compliance (`010`). Each is **additive**: Coinbase becomes an additional provider
behind the existing boundaries, never a replacement, and mainnet real execution runs
behind the same custody + kill-switch gate (`src/lib/execution.ts`).

## Critical path (value first)

Landing → login → dashboard → market data → charts → fund the account → trade
(custody-signed Coinbase swap) → withdraw → transaction history → support ticket →
admin reply → responsive + a11y polish.

## Corpus vs. product

Corpus processing runs in parallel with product work. The corpus **informs** the
build (reusable patterns, market-data adapters, CRM modelling) but must not delay
the working vertical slice. 146/146 repositories are already extracted and indexed.

## Deliverables

- Working local app (`apps/web`, Next.js), startable with `pnpm dev`.
- Real, custody-signed money flows with deterministic server-side gates.
- CRM/support tickets with an admin console.
- Global corpus DB + per-file Markdown knowledge base.
- Test suite (unit + integration + e2e) and a full-journey smoke script.
- Documentation set under `docs/` and checkpoints under `.progress/`.

## Machine plan

| Machine | Role |
| --- | --- |
| Linux `chris-pc` (this host) | Source of truth, DB, orchestration, app, tests |
| Windows `192.168.15.92` | Optional GPU/browser/media offload; never a SPOF |
