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
| `User` | Wallet account + role. `banned` is an **access** control only: the address is refused at sign-in and existing sessions are treated as signed out. It never moves or forfeits a balance (funds are frozen separately, on `Wallet`) | `id`, `walletAddress` (unique, lower-case 0x), `chainId` (last signed-in chain), `name`, `role` (USER/ADMIN), `banned`, `bannedReason`, `bannedAt`, `createdAt` |
| `Wallet` | Wallet account (real ledger, credited by reconciled deposits) | `id`, `userId`, `address`, `network` (default `mainnet`), `kind` (MAINNET/SANDBOX), `balanceCents`, `blocked` + `blockedReason` + `blockedAt` (an admin **hold**: movement is frozen, the balance is never moved or forfeited) |
| `LedgerEntry` | Money movement | `id`, `userId`, `type` (DEPOSIT/WITHDRAWAL/FEE/PAPER_PNL), `amountCents` (signed), `ref`, `note`, `createdAt` |
| `Portfolio` | Holdings snapshot | `id`, `userId`, `asset`, `qty`, `valueCents` |
| `TradingSession` | Trading run record | `id`, `userId`, `status` (IDLE/ACTIVE/STOPPED), `startedAt`, `stoppedAt`, `pnlCents`, `strategy`, `createdAt` |
| `TradeEvent` | Terminal activity stream | `id`, `sessionId`, `kind` (SCAN/ANALYZE/OPEN/UPDATE/CLOSE/INFO), `message`, `createdAt` |
| `Transaction` | User-facing history | `id`, `userId`, `kind` (DEPOSIT/WITHDRAWAL/PAPER_TRADE/FEE), `amountCents`, `status` (PENDING/COMPLETED/FAILED), `detail`, `ref` (what caused it, e.g. a `WithdrawalRequest` id), `createdAt` |
| `Notification` | In-app notifications | `id`, `userId`, `title`, `body`, `read`, `createdAt` |
| `Customer` | CRM customer record | `id`, `userId`, `name`, `email` (optional — sign-in is wallet-based), `tier`, `createdAt` |
| `Ticket` | CRM support ticket | `id`, `number`, `customerId`, `ownerId`, `assigneeId`, `subject`, `status` (OPEN/PENDING/RESOLVED/CLOSED), `priority` (LOW/NORMAL/HIGH/URGENT), `createdAt`, `updatedAt` |
| `TicketMessage` | Conversation | `id`, `ticketId`, `authorId`, `body`, `internal`, `createdAt` |
| `AuditLog` | Admin/action audit | `id`, `actorId`, `action`, `subject`, `detail`, `createdAt` |
| `MarketCache` | Cached market payloads; also holds the risk gate's news snapshot under the key `risk:news` (the gate reads it offline, never a live feed) | `key` (PK), `payload`, `source`, `fetchedAt` |
| `AuthNonce` | Single-use SIWE sign-in nonces | `id`, `nonce` (unique), `address`, `expiresAt`, `usedAt`, `createdAt` |
| `WithdrawalRequest` | A user's withdrawal request and the admin decision on it (PHASE18-006). A declined or released request always credits the amount back to the requesting user — a refusal is never a forfeiture, and no path sends a user's reservation anywhere but to the user or to the destination they named. A decline also opens a **dispute window** (business days) that the user argues in a support thread; resolving it as misuse confirmed bans the account and freezes the balance | `id`, `userId`, `amountCents` (reserved from the balance), `rail` (CUSTODY_ONCHAIN/COINBASE_OFFRAMP), `chainId`, `destination` (verified address), `nativeWei` (exact amount, priced at request time), `status` (PENDING/APPROVED/DECLINED/FAILED/RELEASED), `reason`, `disputeOpensAt`, `disputeClosesAt`, `disputeOutcome` (CLEARED/MISUSE_CONFIRMED), `txHash`, `decidedById`, `decidedAt`, `createdAt` |
| `IdempotencyKey` | Money-path replay guard (PHASE18-006) | `id`, `userId`, `scope` (deposit/withdraw/start_trading/stop_trading/webhook_deposit/coinbase_swap/custody_withdraw/owner_practice_funds/withdraw_request/withdraw_decision/withdraw_release/account_hold/dispute_resolution/account_ban), `key`, `createdAt`; unique on (`userId`, `scope`, `key`) |
| `CustodySpend` | Persisted rolling custody spend ledger (PHASE18-004) | `id`, `userId`, `address` (custody signer address or key id), `amountCents`, `ref` (tx hash / idempotency key), `createdAt` |
| `WebhookEvent` | Verified webhook deliveries (Coinbase `PHASE19-006` and Finnhub), de-duplicated by `eventId` | `id`, `provider` (default `coinbase`), `eventId` (unique), `eventType`, `status` (RECEIVED/PROCESSED/IGNORED/UNMATCHED), `userId` (null when unmatched), `payload`, `receivedAt` |
| `SignalEvent` | Persisted market signals from a provider (see `docs/signals/`). A **read-only input** to risk: a signal never moves funds. Identity is the event, not a vendor id, so an overlapping re-fetch de-duplicates | `id`, `provider`, `providerKey`, `name`, `symbol` (catalog symbol), `assetClass` (crypto/forex/equity), `direction` (bullish/bearish/neutral), `ts` (when the signal fired), `priceUsd`, `marketCapUsd`, `changePct`, `raw` (raw provider item, JSON), `createdAt`; unique on (`provider`, `providerKey`, `symbol`, `direction`, `ts`) |
| `ProviderCredential` | Admin-managed provider API keys (the key pool, `src/lib/credentials/`). Several keys per provider let the resolver rotate to a backup when one is rate-limited, exhausted or revoked. `secret` is AES-256-GCM ciphertext of the field map; the plaintext key is never stored, rendered or logged, `fingerprint` is a non-reversible hash for recognition, and the failover state lives on the row | `id`, `provider`, `label`, `secret`, `fingerprint`, `priority`, `enabled`, `status`, `lastError`, `successCount`, `failureCount`, `cooldownUntil`, `lastUsedAt`, `createdById`, `createdAt`, `updatedAt` |

### Sessions & auth

Authentication is **wallet-based (SIWE / EIP-4361)** — there is no email or password.
A user *is* their wallet address, and the address is only trusted after a signature
over a server-issued nonce has been verified (`src/lib/siwe.ts`).

Sessions are otherwise **stateless** — there is no `Session` model. On sign-in the app
issues an HMAC-SHA256 signed, `httpOnly` cookie named `fin_session` holding
`userId.chainId.expiry.signature` (`src/lib/session-token.ts`). The `chainId` records
the network the wallet signed in on, which is the basis of the real-vs-practice split
(see `NETWORK_BOUNDARY.md`). The network class itself is **not stored** — it is
re-derived from that signed `chainId` on every read (`src/lib/network.ts` +
`getSessionMode()`), so it can never drift from the value the wallet actually signed. The signature is verified with a timing-safe compare and
expiry check on each request; the signing secret comes from `SESSION_SECRET` and, in
production, the app refuses to sign with a missing or weak secret (`src/lib/secret.ts`).

`AuthNonce` is the only auth-related table: a nonce is issued before a signature is
requested and consumed (single-use) on verification, so a captured message cannot be
replayed. Expired nonces are cleared opportunistically.

Sign-in with Coinbase (`PHASE19-002`) is the same wallet flow: the Coinbase Wallet
connector produces a `0x…` address that is then SIWE-verified, so it creates no new
table and no separate account — the session and `User` row are identical to any other
wallet.

### Webhooks

Webhook deliveries are recorded in `WebhookEvent`, keyed uniquely by `eventId`. A
delivery is de-duplicated before any movement, so a retry cannot double-credit; a
value-in event is applied through the same `IdempotencyKey` guard as the deposit path
(scope `webhook_deposit`). An event that resolves to no app user is stored with a null
`userId` and credits nothing.

Coinbase (`PHASE19-006`) signs each delivery and its events can credit a balance.
Finnhub authenticates with a static shared secret (not a per-request HMAC) and its
deliveries are recorded **value-free** with status `IGNORED`, because no Finnhub event
type is a value-in instruction; the row is kept so deliveries are auditable and a
subscription that fails to acknowledge can be diagnosed.

### Signals

`SignalEvent` stores market signals pulled from a provider (currently AltFins). A row is
keyed by its **identity** — (`provider`, `providerKey`, `symbol`, `direction`, `ts`) —
because the vendors supply no stable per-item id, so re-syncing an overlapping window
updates rather than duplicates. Signals are desk-wide market facts, so there is no
foreign key to `User`.

A signal is a **read-only input**: it feeds the risk gate (`src/lib/risk/`), which can
refuse a trade, but no code path lets a signal move funds. Persistence exists so the
desk can audit "why was a trade allowed or refused?" and evaluate a signal's forward
behaviour before trusting it. `raw` keeps the provider item for that audit and is never
parsed on a hot path.

### Rules

- Money is stored as integer cents (the `*Cents` fields) to avoid float drift; the UI
  formats to currency.
- Wallet addresses are stored lower-cased; the wallet identity is `User.walletAddress`
  and the `Wallet` row reuses it as its `address`.
- `TradingSession.status` drives the UI state machine (see `ARCHITECTURE.md`).
- Every withdrawal writes a `LedgerEntry(FEE)` when a fee is configured and labels
  the fee explicitly.
- Ticket `number` is a human-readable sequential id (e.g. `TCK-1001`).
- Money-path idempotency keys (`IdempotencyKey`) are claimed **inside the same
transaction** as the movement they guard, so a replayed submit (double click,
refresh, network replay) is a no-op instead of a second deposit/withdrawal
(`src/lib/idempotency.ts`). Deposit/withdraw also require an explicit server-side
confirmation, and a deposit above `DEPOSIT_CAP_USD` is refused.
