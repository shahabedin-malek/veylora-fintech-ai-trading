# Project Plan

## Mission

Build a portfolio-ready **fintech + CRM platform**: an AI-assisted financial
dashboard (crypto / forex / equities), market signals, charts, news, a clearly
**simulated** trading experience, wallet/deposit/withdrawal flows, and a
CRM/support layer with customer tickets and admin operations — on a modern,
responsive UI.

## Ground rules

- **Simulated only.** All trading is paper trading. No flow presents fake data as
  real, and no flow implies guaranteed returns.
- **No invented data.** Market data and news come from real providers or are
  explicitly labelled as simulated/offline.
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
| 18 | **Wallet auth + network-aware execution** — mainnet = real, testnet = simulated | **planned (roadmap change)** |

## Phase 18 — wallet auth + network-aware execution

The roadmap changed: the product is no longer simulation-only. Sign-in becomes
**wallet-based** (SIWE), and the signed-in network decides whether every action is
real or simulated — testnet ⇒ simulated, mainnet ⇒ real.

This is a re-architecture, not a flag flip. It replaces the email/password session,
the `kind: "SIMULATED"` invariant and the "no `MAINNET`" test with network gating,
and it needs custody, a real execution venue, irreversibility UX and compliance.
`docs/NETWORK_BOUNDARY.md` lists the blockers in full; the delivery tasks are
`PHASE18-001` … `PHASE18-009`. **Mainnet execution stays disabled until they land.**

## Critical path (value first)

Landing → login → dashboard → market data → charts → deposit → minimum balance →
start trading → simulated terminal → stop / force-stop → withdrawal calculation →
transaction history → support ticket → admin reply → responsive + a11y polish.

## Corpus vs. product

Corpus processing runs in parallel with product work. The corpus **informs** the
build (reusable patterns, market-data adapters, CRM modelling) but must not delay
the working vertical slice. 146/146 repositories are already extracted and indexed.

## Deliverables

- Working local app (`apps/web`, Next.js), startable with `pnpm dev`.
- Simulated trading state machine with deterministic UI rules.
- CRM/support tickets with an admin console.
- Global corpus DB + per-file Markdown knowledge base.
- Test suite (unit + integration + e2e) and a full-journey smoke script.
- Documentation set under `docs/` and checkpoints under `.progress/`.

## Machine plan

| Machine | Role |
| --- | --- |
| Linux `chris-pc` (this host) | Source of truth, DB, orchestration, app, tests |
| Windows `192.168.15.92` | Optional GPU/browser/media offload; never a SPOF |
