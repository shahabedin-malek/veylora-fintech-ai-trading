# Historical Project Audit

> Generated during Phase 0–2. Grounded in filesystem inspection of `/home/chris/trading-ai/old/`
> and the parsed corpus database. Each item is tagged with confidence:
> FACT (directly observed), PARSED FACT (from extracted data), INFERENCE (judgement).

## Summary

The corpus contains **5 historical projects** (`old/`) and **146 repository/package
artifacts** (`repo/`), giving **151 minimum corpus work units** (see
`docs/REPO_INVENTORY.md`). The task count is generated from the filesystem, never
hard-coded.

---

## OLD-0001 — `crypto-payment-backup` (9.1 GB)

**FACT.** Docker-oriented backup of an earlier crypto payment stack:
- `project-files/backend/server.js` (Node backend), `project-files/frontend` (Next.js app)
- `docker-compose-expanded.yml`, `docker-images.tar`, `database.sql`, `postgres-volume.tar.gz`
- GPG-encrypted + plain tar.gz backups with `.sha256` sidecars
- `docker-images.tar` + `postgres-volume.tar` dominate the size (bulk DB volume dumps)

**Classification:** DEPRECATED (archive/backup) — **REUSE (selectively)** any backend
payment logic that is not already superseded by `crypto-portal`.

**Risks:** contains `.env` and DB dumps — must never be committed; secrets are not
extracted into the knowledge base.

---

## OLD-0002 — `crypto-portal` (2.4 GB, with `node_modules` + `.next`)

**FACT — the strongest reusable asset in the corpus.** Next.js 16 (App Router),
React 19, TypeScript strict, Tailwind 4, wagmi 3 / viem 2 / RainbowKit 2 /
React Query, Prisma 7 + PostgreSQL, iron-session (SIWE), Zod, Vitest + Playwright.

**Routes present (FACT):** `/` (wallet onboarding), `/dashboard`, `/dashboard/payments*`,
`/dashboard/webhooks`, `/deposit`, `/portfolio`, `/trading`, `/cashout`, `/pay/[id]`,
plus `/api/{auth,payments,portfolio,webhooks,health,cron,debug}`.

**Prisma domain models (PARSED FACT):** `User`, `Wallet`, `Portfolio`, `LedgerEntry`,
`Payment`, `WebhookEndpoint`, `WebhookEvent`, `WebhookDelivery`; enums incl.
`UserRole`, `WalletType`, `AssetSymbol`, `LedgerType`, `PaymentStatus`, `PaymentAssetKind`.

**Tests (FACT):** 12 Vitest suites under `tests/payments/` (domain, verification,
webhooks, financial, concurrency, fuzz, resilience, integration) and 6 Playwright e2e
specs (payment flow, payment states, security headers, accessibility, app surfaces).

**Docs (FACT):** 21 numbered `plan/*.md` build steps plus security, deployment,
incident-response, launch-audit and e2e reports.

**Safety posture (FACT, from README):** mainnet payment execution disabled by default;
non-mainnet chains only (Sepolia, Base Sepolia, Arbitrum Sepolia, OP Sepolia, Polygon
Amoy); never store seed phrases/private keys; blockchain is authoritative.

**Classification:** KEEP + REUSE — this is the fintech application base.

---

## OLD-0003 — `crypto-portal-backup` (72 KB)

**FACT.** Historical component snapshots: `DepositModal.old.tsx`, `SendModal.old.tsx`,
`SwapModal.old{1,3}.tsx`, `Transactions.old.tsx`, `providers.old.tsx`, `index.old.js`,
and `pages/page.old1..7.tsx`.

**Classification:** REFERENCE ONLY — prior UI iteration history; superseded by the
live `crypto-portal` tree. No unique functionality that is not present (in current form)
in OLD-0002.

---

## OLD-0004 — `trading-ai-old` (0.8 MB)

**FACT.** Research/planning workspace: `PRODUCT_SPEC.md` (empty), `research_findings.md`
(empty), `RESEARCH_PLAN.md`, `PROMPT_TODO_CHECKLIST_SOLAR.md`, `names.md`,
`secrets_and_dependencies.md`, `prompt.txt`, and `research-data/` with a prior
`research.sqlite3`, `research_inputs.csv` (150 rows), `archive_metadata.csv`, and
scripts `research_inventory.py` / `inspect_zip_safely.py`.

**PARSED FACT.** `research_inputs.csv` already enumerates the legacy directories and
repository inputs with categories (legacy payment/backend, wallet/payment portal,
wallet portal backups, dashboard prototype), corroborating the 151-unit inventory.

**Classification:** KEEP — useful planning/provenance and the prior inventory tooling.

---

## OLD-0005 — `web3-dashboard-backup` (136 MB)

**FACT.** Minimal Vite + React + TypeScript dashboard prototype
(`src/main.tsx`, `src/App.tsx`, `src/App.css`, `src/index.css`, `src/assets/{hero.png,...}`),
oxlint config, `vite.config.ts`. No backend, no tests.

**Classification:** DEPRECATED — superseded by OLD-0002. Possible reuse: the hero
marketing asset.

---

## Repository corpus (`repo/`, 146 artifacts)

**PARSED FACT.** 146 artifacts: 134 zip, 8 gzip, 2 bzip2, 1 raw ELF binary
(`OctoBot_linux_x64`), 1 unrecognized. One confirmed duplicate pair:
`REPO-0001 AI-Trader-main.zip` ≡ `REPO-0002 AI-Trader1-main.zip`
(sha256 `f6b689ff…d17ba`).

**PARSED FACT — extraction results:** all 146 processed and VERIFIED; 229,811 files
ingested; 227,736 per-file Markdown records; 157,993 URLs; 9,885 distinct domains;
439,873 imports; 27,059 dependencies.

**PARSED FACT — category spread (by keyword evidence):** trading 75, AI/LLM 78,
UI/dashboard 74, crypto/wallet 69, market-data 66, charts 63, CRM/support 62,
forex 50, payments 42, news 34, ERP/accounting 32.

**PARSED FACT — most frequent technologies:** TypeScript, Jest, pandas, NumPy,
React, Svelte, Vitest, Express, Tailwind CSS, PyTorch, CCXT, scikit-learn, pytest,
OpenAI, viem, Next.js, MongoDB, FastAPI, ethers.js, LangChain.

See `docs/KNOWLEDGE_BASE.md` for the full synthesis and `docs/REPO_INVENTORY.md`
for the complete manifest.

---

## Reuse decision matrix

| Asset | Decision | Rationale |
| --- | --- | --- |
| OLD-0002 crypto-portal | **KEEP + REUSE** | Working Next.js fintech shell, wallet auth, tests |
| OLD-0004 trading-ai-old | **KEEP** | Planning + prior inventory provenance |
| OLD-0001 crypto-payment-backup | **REUSE (selective)** | Legacy payment/backend reference; archive otherwise |
| OLD-0003 crypto-portal-backup | **REFERENCE** | Superseded UI iterations |
| OLD-0005 web3-dashboard-backup | **DEPRECATED** | Superseded by OLD-0002 |
| trading/quant repos | **REFERENCE** | Market-data adapter + strategy patterns |
| CRM repos (SuiteCRM, twenty) | **REFERENCE** | Ticket/customer domain modelling |
| payment repos (blnk, shkeeper) | **REFERENCE** | Ledger/transfer modelling |
| duplicate/abandoned forks | **REJECT** | No unique value |

## What failed / what to avoid

- **INFERENCE.** Prior attempts split fintech logic across a Docker backup and a
  standalone portal with no shared CRM/support layer — the new product unifies a
  single user journey (landing → auth → market data → deposit → trading →
  withdrawal → support ticket → admin reply).
- **FACT.** `old/crypto-portal` ships `node_modules`/`.next`/`.env` in-tree; the new
  app must keep build artifacts and secrets out of version control.
- **FACT.** The old `PRODUCT_SPEC.md` and `research_findings.md` are empty — the
  product definition must be written fresh (see `docs/PRODUCT_REQUIREMENTS.md`).
