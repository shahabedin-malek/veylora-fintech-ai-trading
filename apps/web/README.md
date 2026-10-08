# Veylora Fintech AI Trading — web app

A portfolio-ready **fintech + CRM** dashboard: multi-market data, charts, a fully
**simulated** AI trading desk, wallet deposit/withdrawal flows, and built-in
support tickets with an admin CRM console.

> **Simulated only.** All trading is paper trading. No real funds move and no
> simulated result is a real investment return.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind 4 ·
Prisma 6 (SQLite locally, PostgreSQL for deploy) · Vitest. No external chart or
auth vendor required.

## Quick start

```bash
npm install
cp .env.example .env          # set SESSION_SECRET
npm run db:deploy             # apply committed migrations
npm run db:seed               # sample + admin accounts
npm run dev                   # http://localhost:3000
```

Sample accounts (seeded):

| Role | Email | Password |
| --- | --- | --- |
| User | `trader@veylora.dev` | `password123` |
| Admin | `admin@veylora.dev` | `admin12345` |

## Scripts

```bash
npm run dev        # dev server
npm run build      # prisma generate + next build
npm run start      # production server
npm run typecheck  # tsc --noEmit
npm test                 # all vitest: unit + integration (84 tests)
npm run test:unit        # domain + market units only (no database)
npm run test:integration # server actions + real DB writes (throwaway SQLite)
npm run test:docs        # docs stay in sync with code (models, routes, scripts, env)
npm run test:e2e         # playwright: full-journey + UI audit (3 widths) + fresh-session walkthrough
npm run verify:deploy    # production build + full vitest suite (release gate)
npm run db:deploy  # apply committed migrations (deploy)
npm run db:migrate # create a new migration (development)
npm run db:reset   # reset + re-seed
```

## Key routes

| Route | Description |
| --- | --- |
| `/` | Landing page with market snapshot |
| `/login` | Sign in / register |
| `/markets` | Crypto/forex/equities with charts |
| `/dashboard` | Balance, state machine controls, notifications |
| `/trade` | Simulated trading desk + activity terminal |
| `/wallet` | Deposit + transparent withdrawal breakdown |
| `/history` | Transactions and ledger |
| `/support` | Support conversations → CRM tickets |
| `/admin` | CRM console (admins only) |
| `/admin/tickets/[id]` | Ticket triage, reply, internal notes |
| `/faq` | Frequently asked questions |

## Architecture

- **Domain layer** (`src/lib/domain/`) — pure, unit-tested: the deterministic
  trading state machine, money (integer cents), and the withdrawal calculation.
- **Market layer** (`src/lib/market/`) — a provider-neutral interface with a live
  CoinGecko provider and an always-available, clearly-labelled simulated fallback.
- **CRM layer** — support messages create tickets linked to the customer; admins
  triage status/priority/assignee and add internal notes.

See `../../docs/ARCHITECTURE.md` and `../../docs/DATA_MODEL.md`.

## Safety

- Secrets live only in `.env` (git-ignored).
- `SESSION_SECRET` signs the httpOnly session cookie; in production the app
  refuses to sign with a missing or weak secret (fails closed).
- Mainnet wallet flows are disabled; the app uses the simulated wallet.

See `../../docs/SIMULATION_BOUNDARY.md` for exactly what is real vs simulated,
`../../docs/RELEASE_CHECKLIST.md` before shipping, and
`../../docs/DEPENDENCY_AUDIT.md` for the dependency posture.

