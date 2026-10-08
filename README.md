# Veylora Fintech AI Trading

An AI-assisted financial dashboard covering crypto, forex and global equities,
with charts, market data, a trading desk, wallet deposit/withdrawal flows, and a
built-in CRM/support layer with an admin console.

> **The login wallet picks the mode.** Sign-in is by wallet: a **testnet** wallet
> runs fully **simulated** paper flows, a **mainnet** wallet is intended to run
> **real** ones. Mainnet execution is **not implemented yet** (Phase 18 — see
> `docs/NETWORK_BOUNDARY.md`), so today every wallet is `kind: "SIMULATED"` and no
> real funds can move. No result shown is a real or guaranteed investment return.
>
> **Published.** Source: <https://github.com/shahabedin-malek/veylora-fintech-ai-trading>
> (public, CI green on `main`). Live: <https://veylora-fintech-ai-trading-black.vercel.app>
> (Next.js on Vercel + managed Postgres). Note that the shorter
> `veylora-fintech-ai-trading.vercel.app` belongs to a separate, misconfigured
> deployment of this app and does not work — see `.progress/DECISIONS.md` (D24).

## Repository layout

```
apps/web/            The product (Next.js 16 + React 19 + Prisma + Tailwind 4)
.github/workflows/   CI: verify:deploy gate, Playwright e2e, Docker image build
scripts/             Corpus pipeline (inventory, extraction, analysis, progress)
docs/                Audit, plan, architecture, data model, requirements, branding,
                     release checklist, simulation boundary, dependency audit,
                     deployment notes
.progress/           Durable checkpoint / task-state control plane (Markdown)
data/                Corpus database, manifests, scraped knowledge (git-ignored)
old/                 Historical projects (corpus source, git-ignored)
repo/                146 repository/package artifacts (corpus source, git-ignored)
logs/                Pipeline run logs (git-ignored)
```

## Product quick start

```bash
cd apps/web
npm install
cp .env.example .env        # then set SESSION_SECRET
npm run db:deploy && npm run db:seed
npm run dev                 # http://localhost:3000
```

Accounts: `trader@veylora.dev / password123` (user), `admin@veylora.dev / admin12345` (admin).
See `apps/web/README.md` for routes and scripts.

## Corpus pipeline

```bash
python3 scripts/corpus_db.py          # create/upgrade the corpus database
python3 scripts/corpus_inventory.py   # hash + manifest old/ and repo/ -> stable IDs
python3 scripts/corpus_extract.py     # extract, parse, knowledge → DB + Markdown
python3 scripts/corpus_tasks.py       # seed the durable task queue
python3 scripts/corpus_analyze.py     # synthesize docs/KNOWLEDGE_BASE.md
python3 scripts/progress_report.py    # render .progress/*.md from the DB
```

Results so far: **5 historical projects + 146 repository artifacts = 151 minimum
work units**, all 146 repositories extracted and verified — 229,811 files,
227,736 per-file Markdown records, 157,993 URLs, 27,059 dependencies, 0 errors.

## Status & recovery

State is durable in two places:

- `data/database/trading_ai_corpus.sqlite` (structured source of truth)
- `.progress/*.md` (human-readable checkpoints)

If a new session starts with the single message `continue`, read
`.progress/CONTINUATION_PROMPT.md`, verify the real filesystem/DB state, and resume
the first incomplete task. Never redo verified work.

## Continuous integration

Two workflows run once the repo is pushed (publishing is blocked until authorized):

- **`.github/workflows/ci.yml`** — main pushes and PRs. **verify** (`typecheck`,
  `npm audit`, `verify:deploy`), **e2e** (migrations + seed, build, Playwright
  journey + UI audit + walkthrough), **docker** (validate both compose files,
  build the SQLite and Postgres images, boot-smoke the container), **postgres**
  (boot the Postgres override, apply migrations + seed, run a smoke query).
- **`.github/workflows/docs.yml`** — every branch push and PR. **docs**: the
  doc-sync tests (models, routes, scripts and env vars stay matching the code).

## Machine plan

| Machine | Role |
| --- | --- |
| Linux `chris-pc` / `192.168.15.91` | source of truth, DB, orchestration, app, tests |
| Windows `192.168.15.92` | optional GPU/browser/media offload; never a single point of failure |
