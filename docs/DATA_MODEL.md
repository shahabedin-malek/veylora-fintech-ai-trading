# Data Model

Two databases exist in this project:

1. **Corpus database** (analysis/history) —
   `data/database/trading_ai_corpus.sqlite` (schema in `scripts/corpus_db.py`).
2. **Product database** (the running app) — Prisma schema in `apps/web/prisma/schema.prisma`.

---

## 1. Corpus database

Single-file SQLite, WAL mode, foreign keys on. 48 tables/views. Grouped as:

**Sources** — `old_projects`, `repositories` (stable `OLD-XXXX` / `REPO-XXXX` IDs,
sha256, format, status), `hashes`, `extractions`, `archives`.

**Files/knowledge** — `files`, `directories`, `text_content`, `code_symbols`,
`imports`, `dependencies`, `packages`, `executables`, `urls`, `domains`,
`organizations`, `products`, `projects`, `technologies`, `frameworks`, `models`,
`apis`, `features`, `categories`, `tags`, `knowledge_documents`,
`research_sources`, `research_claims`, `relationships`, `duplicates`, plus the
`files_fts` FTS5 index.

**Operations** — `processing_runs`, `processing_errors`, `machines`, `workers`,
`tasks`, `checkpoints`, `api_requirements`, `credential_requirements`,
`token_usage`, `search_events`, `audit_log`.

Every knowledge row carries provenance (`file_id`, `repo_id`) and every document is
tagged with a confidence class: FACT · PARSED FACT · INFERENCE · EXTERNAL RESEARCH ·
UNCERTAIN · CONFLICTING.

Per-repo mirrors live under `data/database/repos/REPO-XXXX.sqlite`.

---

## 2. Product database (Prisma)

Provider: SQLite for local development (single file, zero external services);
swappable to PostgreSQL for deployment via the `DB_PROVIDER` build arg + `DATABASE_URL`.
Schema changes are versioned as committed migrations — one set per provider
(`prisma/migrations` for SQLite, `prisma/migrations-postgres` for PostgreSQL) —
applied with `prisma migrate deploy`.

### Core entities

| Model | Purpose | Key fields |
| --- | --- | --- |
| `User` | Account + role | `id`, `email`, `passwordHash`, `name`, `role` (USER/ADMIN), `createdAt` |
| `Wallet` | Simulated wallet (custody is not enabled) | `id`, `userId`, `address`, `network` (default `simulated`), `kind` (SIMULATED/TESTNET/MAINNET), `balanceCents` |
| `LedgerEntry` | Money movement | `id`, `userId`, `type` (DEPOSIT/WITHDRAWAL/FEE/PAPER_PNL), `amountCents` (signed), `ref`, `note`, `createdAt` |
| `Portfolio` | Holdings snapshot | `id`, `userId`, `asset`, `qty`, `valueCents` |
| `TradingSession` | Simulated trading run | `id`, `userId`, `status` (IDLE/ACTIVE/STOPPED), `startedAt`, `stoppedAt`, `pnlCents`, `strategy`, `createdAt` |
| `TradeEvent` | Terminal activity stream | `id`, `sessionId`, `kind` (SCAN/ANALYZE/OPEN/UPDATE/CLOSE/INFO), `message`, `createdAt` |
| `Transaction` | User-facing history | `id`, `userId`, `kind` (DEPOSIT/WITHDRAWAL/PAPER_TRADE/FEE), `amountCents`, `status` (PENDING/COMPLETED/FAILED), `detail`, `createdAt` |
| `Notification` | In-app notifications | `id`, `userId`, `title`, `body`, `read`, `createdAt` |
| `Customer` | CRM customer record | `id`, `userId`, `name`, `email`, `tier`, `createdAt` |
| `Ticket` | CRM support ticket | `id`, `number`, `customerId`, `ownerId`, `assigneeId`, `subject`, `status` (OPEN/PENDING/RESOLVED/CLOSED), `priority` (LOW/NORMAL/HIGH/URGENT), `createdAt`, `updatedAt` |
| `TicketMessage` | Conversation | `id`, `ticketId`, `authorId`, `body`, `internal`, `createdAt` |
| `AuditLog` | Admin/action audit | `id`, `actorId`, `action`, `subject`, `detail`, `createdAt` |
| `MarketCache` | Cached market payloads | `key` (PK), `payload`, `source`, `fetchedAt` |

### Sessions & auth (no table)

Sessions are **stateless** — there is no `Session` model. On sign-in the app issues an
HMAC-SHA256 signed, `httpOnly` cookie named `fin_session` holding
`userId.expiry.signature` (`src/lib/session.ts`). The signature is verified with a
timing-safe compare and expiry check on each request; the signing secret comes from
`SESSION_SECRET` and, in production, the app refuses to sign with a missing or weak
secret (`src/lib/secret.ts`). Passwords are hashed with `scrypt` and stored on
`User.passwordHash`.

### Rules

- Money is stored as integer cents (the `*Cents` fields) to avoid float drift; the UI
  formats to currency.
- `TradingSession.status` drives the UI state machine (see `ARCHITECTURE.md`).
- Every withdrawal writes a `LedgerEntry(FEE)` when a fee is configured and labels
  the fee explicitly as **simulated**.
- Ticket `number` is a human-readable sequential id (e.g. `TCK-1001`).
