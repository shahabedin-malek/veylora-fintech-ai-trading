# Architecture

## Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  apps/web  — Next.js (App Router) + React + TypeScript + Tailwind     │
│                                                                       │
│  Public      User                          Admin (CRM)                 │
│  /           /dashboard /markets           /admin                     │
│  /faq        /trade  /wallet               /admin/tickets             │
│  /docs       /history /support             /admin/tickets/[id]        │
│              /portfolio                    /admin/customers           │
│                                                                       │
│  API route handlers (server) under apps/web/src/app/api/*             │
└───────────────┬──────────────────────────────────────────────────────┘
                │
     ┌──────────┼───────────────────────────┬─────────────────┐
     │          │                           │                 │
 ┌───▼───┐  ┌───▼──────────┐          ┌─────▼──────┐   ┌──────▼──────┐
 │Domain │  │ Market data  │          │ Trading    │   │ CRM/support │
 │ledger │  │ abstraction  │          │ state      │   │ tickets     │
 │(cents)│  │ (providers)  │          │ machine    │   │ + admin     │
 └───┬───┘  └───┬──────────┘          └─────┬──────┘   └──────┬──────┘
     │          │                           │                 │
 ┌───▼──────────▼───────────────────────────▼─────────────────▼──────┐
 │ Prisma (SQLite local / Postgres deploy) — see docs/DATA_MODEL.md   │
 └────────────────────────────────────────────────────────────────────┘
```

## Layers

**Presentation** — App Router pages + React server/client components. A shared
design system (tokens, cards, buttons, states) drives visual consistency. A
bottom-right support widget is available on authenticated routes.

**Domain** — pure TypeScript modules (no framework imports) for the ledger,
trading state machine, and withdrawal calculation. These are unit-tested directly.

**Market data** — a provider-neutral interface:

```ts
interface MarketDataProvider {
  id: string;
  kinds: ("crypto" | "forex" | "equity" | "news" | "candles")[];
  getQuotes(symbols: string[]): Promise<Quote[]>;
  getCandles(symbol: string, range: Range): Promise<Candle[]>;
  getNews(): Promise<NewsItem[]>;
}
```

An **offline** provider is always registered as a fallback and is clearly labelled
as offline in the UI; real providers are added behind the same interface. Provider
failures degrade gracefully to the labelled fallback — the UI never shows invented
data as live.

With `MARKET_PROVIDER=auto` (the default) a **composite** provider routes each
instrument to the source that can actually price it: crypto → CoinGecko
(`coingecko.ts`), equities → Finnhub when `FINNHUB_API_KEY` is set (`finnhub.ts`),
and everything else — including anything a provider cannot answer, such as forex,
which is premium at Finnhub — to the labelled offline generator. The provider list is
computed per call, so an unconfigured source is simply skipped rather than asked and
failed.

News is read only from real configured RSS feeds (`NEWS_FEEDS`, or the curated
defaults verified in `docs/NEWS_SOURCES.md`), never fabricated. Each item carries its
published image when the feed provides one (`enclosure` / `media:content` /
`media:thumbnail` / an `<img>` in the body). The landing page renders picture cards;
every other route renders an image-free sidebar (`NewsRail`), and the feed's
`category` / `relatedSymbols` are the intended input to news-driven risk signals.

**Signals** — a read-only input layer (`src/lib/signals/`), separate from market data
because a signal is an *interpreted event*, not a quote. `SignalProvider` mirrors
`MarketDataProvider`: `src/lib/signals/altfins.ts` normalises AltFins' wire format
(string/comma-formatted numerics, a Spring page object, bare tickers mapped onto the
instrument catalog) into a `SignalEvent`, dropping and **counting** anything outside
the catalog. `getSignalsSafe` never throws: an unconfigured or failing provider returns
an empty, `degraded` result so "no data" is never mistaken for "no signal". Nothing in
this layer can move money — see `docs/signals/IMPLEMENTATION.md` for the pipeline and
the guardrails.

Signals are **persisted** (`SignalEvent`) so the desk can audit "why was this trade
allowed or refused?" and evaluate a signal before trusting it; a row is keyed by the
event's identity, so re-syncing an overlapping window de-duplicates (`src/lib/signals/store.ts`,
`/admin/signals`). The **risk gate** (`src/lib/risk/assess.ts`) combines recent news
with the stored signals into a single `normal | elevated | off` verdict and can only
**refuse** — it is a documented rule set, not a model, and every verdict carries its
reasons.

**Trading state machine** — deterministic, single source of truth:

```
STATE 0  NOT LOGGED IN   deposit✗ start✗ stop✗ withdraw✗
STATE 1  LOGGED IN       deposit✓ start✗ stop✗ withdraw✗   (no funds)
STATE 2  FUNDED          deposit✓ start✓ stop✗ withdraw✓   (start requires balance ≥ MIN_TRADE_USD = 20)
STATE 3  TRADING         deposit ✓ start→StopTrade✓ stop✓ withdraw✗
STATE 4  STOPPED         withdraw✓  (can restart)
```

If the balance is below the minimum, the UI states exactly how much more is
required. Stopping within 5 minutes raises a warning and offers **Force Stop**.

**CRM/support** — opening the support widget creates a `Ticket`, links it to the
`Customer`, and persists messages. Admin can triage (status, priority, assignee),
reply, add internal notes, and view the customer timeline.

## Security & safety boundary

- Secrets are read only from environment variables; never committed.
- Wallet providers sit behind an adapter interface (mainnet / practice network).
- Mainnet is the default and runs real, custody-signed execution; the practice
  networks are **owner-only** and never reach a real path.
- Market values fall back to a clearly-labelled offline generator when a live source
  fails — never to invented data shown as live.
- Auth is **wallet-based (SIWE / EIP-4361)** — no email or password. A single-use
  server-issued nonce (`AuthNonce`) is signed by the wallet; viem recovers the
  address and the account is keyed by `User.walletAddress` (`src/lib/siwe.ts`). The
  signed session cookie (httpOnly, SameSite=Lax) carries `userId.chainId.expiry` and
  an HMAC-SHA256 signature (`src/lib/session-token.ts`), so every request knows which
  chain the wallet signed in on.
- The execution class is **derived from that `chainId` server-side, never trusted
  from the client**: `src/lib/network.ts` maps `chainId` → `MAINNET`/`SANDBOX` and
  returns `null` for anything unsupported (no default class), and `getSessionMode()`
  classifies the signed session on every read. Sign-in rejects an unsupported chain,
  and a session on a chain no longer offered fails closed. This is `PHASE18-002`.
- **Custody boundary** (`src/lib/custody/`) — the single place a real key is used.
  It deals only in a **key reference** (never key material), enforces
  per-transaction and daily **spend limits** before any signature is requested, and
  **fails closed**: an unconfigured or unknown backend cannot sign. The wired
  backend is Coinbase CDP Server Wallets (`CUSTODY_PROVIDER=coinbase-cdp`), where
  the wallet key stays in the provider and the SDK is imported lazily
  (`PHASE18-004`). See `docs/NETWORK_BOUNDARY.md`.
- **Coinbase layer** (`src/lib/coinbase/`, `PHASE19`) — additive, never a
  replacement for the layers above. **Login** (`PHASE19-002`) is a *wallet provider*:
  the Coinbase Wallet connector runs the same SIWE flow (`components/CoinbaseSignIn.tsx`
  over the shared `components/useSiweSignIn.ts`), so a Coinbase sign-in is an ordinary
  wallet session with no separate account. **Webhooks** (`PHASE19-006`) are served by
  `src/app/api/webhooks/coinbase/route.ts`: it reads
  the raw body and verifies Coinbase's `X-Hook0-Signature`
  (`src/lib/coinbase/webhook.ts`, fail-closed when `COINBASE_WEBHOOK_SECRET` is unset)
  **before** `src/lib/coinbase/ingest.ts` records the event once in `WebhookEvent`
  (dedupe by `eventId`) and credits only a resolvable, stable-asset
  `payments.transfers.completed` transfer, through the same `runOnce` idempotency guard
  as the deposit path. **Deposits** (`PHASE19-003`) are a Coinbase-hosted hand-off:
  `src/lib/coinbase/onramp.ts` signs a short-lived CDP JWT and calls the documented
  Session Token API to build a `pay.coinbase.com` buy URL, delivering crypto to the
  user's **own** wallet — so onramp does not run through the app's execution gate, and
  `startCoinbaseDepositAction` is fail-closed (unconfigured / practice network / API error).
  **Withdrawals** (`PHASE19-005`) mirror it: `src/lib/coinbase/offramp.ts` builds the
  documented `pay.coinbase.com/v3/sell/input` URL (shared Session Token API,
  `redirectUrl` required) and `startCoinbaseWithdrawalAction` is fail-closed the same
  way. Reconciliation is visible per user on `/history` ("Coinbase reconciliation") and
  per operator at `/admin/webhooks`. Reference docs and the product mapping live in
  `coinbase/`.
- **Finnhub webhook** (`src/app/api/webhooks/finnhub/route.ts`) — the second receiver.
  Finnhub authenticates with a **static shared secret** in `X-Finnhub-Secret` (not a
  per-request HMAC), so `src/lib/finnhub/webhook.ts` verifies it in constant time and
  fails closed when `FINNHUB_WEBHOOK_SECRET` is unset (the endpoint then returns `503`
  and accepts nothing). `src/lib/finnhub/ingest.ts` records each verified delivery once
  in the shared `WebhookEvent` table, de-duplicated by a body-derived id, and applies
  **no balance change** — no Finnhub event type is value-in. `/admin/webhooks` shows and
  filters deliveries by provider and status.
- **Phase 18 execution:** the money paths branch on the class — a `MAINNET` session
  runs the real, custody-signed swap and on-chain transfer paths, and a `SANDBOX`
  (practice) session never reaches a real path. The real **venue** (a Coinbase EVM
  swap) exists and real execution is **on by default**, so a mainnet session moves real
  funds once custody is configured; a deployment without custody refuses rather than
  falls back, and `MAINNET_EXECUTION_ENABLED=0` is a kill switch. The owner practice
  funds are a labelled ledger credit with no real backing. See `docs/NETWORK_BOUNDARY.md`.
- **Risk gate** (`src/lib/risk/assess.ts`): before a real swap is signed, the desk is
  assessed from recent news and signals. A severe headline
  (hack/exploit/insolvency/delisting/seizure), a bearish regime signal, extreme
  volatility, or desk-wide bearish breadth makes the desk **risk-off**, and the trade is
  refused with a reason (`/trade?coinbase=risk`).

  Both inputs are read from **stored state**, never fetched at trade time: the signals
  from `signalEvent`, and the news from a synced snapshot of the real RSS feeds
  (`src/lib/risk/news.ts`, `MarketCache` key `risk:news`). That keeps the money path
  deterministic and independent of a provider or feed being reachable — and makes an
  explicit sync (`/admin/signals`) the thing that keeps the gate current. With nothing
  stored the gate is `normal`: absence of evidence is not danger, and it is not a reason
  to invent a refusal either. A signal feed being unavailable never stops trading: the
  **keyless alternate providers** (`coingecko-derived`, `coinmarketcap` — see
  `src/lib/signals/index.ts`) are always registered and emit **neutral** `MARKET_MOVE_24H`
  events, which can raise the desk to `elevated` but can never make it `off`. The gate can
  only refuse; it can never open, size or move anything, and it runs before any signature
  and before the compliance screen.
- **Scheduled desk sync** (`src/app/api/cron/sync-desk/route.ts`, `apps/web/vercel.json`):
  a cron entry (daily, `0 6 * * *`) calls the route, which runs `syncSignals()` **and**
  `refreshRiskNews()` — the two stored inputs the risk gate reads — so the gate stays
  current without an operator clicking Sync. It touches no money. It fails closed like
  every inbound surface: with `CRON_SECRET` unset it returns `503` and accepts nothing;
  otherwise it requires an exact `Authorization: Bearer <CRON_SECRET>` (compared in
  constant time). Any scheduler works — point a GitHub Action or an uptime pinger at the
  same route with the same header.
- **WunderTrading venue executor** (`src/lib/wundertrading/`, executor `wundertrading`):
  a second real executor behind the same `src/lib/execution.ts` gate. Where the Coinbase
  swap is custody-signed, a WunderTrading order is signed by the venue's own HMAC API, so
  the gate requires its credentials instead of custody — but it is still **mainnet-only**
  and still obeys the `MAINNET_EXECUTION_ENABLED` kill switch. An order is **refused**
  unless it carries a positive `stopLoss`, and it is held to the desk's own caps
  (`VENUE_MAX_PER_TX_USD` / `VENUE_DAILY_LIMIT_USD`, `config.venue.spendLimits`) — refused,
  never trimmed. It acts on the desk's exchange API profiles rather than one user's
  balance, so the operator surface is `/admin/execution` (admins only), reached only
  through the gated server action `startWundertradingOrderAction`, never from the client.
  Every attempt is idempotent (`venue_order`) and audited.
- **Provider key pool** (`src/lib/credentials/`): an operator can add several API keys per
  provider from `/admin/credentials`, and the resolver (`pool.ts`) tries the environment key
  first, then each pooled key by priority, **rotating to the next when one is rejected**
  (401/402/403/429 — expired, gated or rate-limited). A rejected key is cooled down on its row
  (exponential backoff, capped at an hour) and retried later, so a single exhausted key does not
  take a feed — or trading — down. Keys are stored **AES-256-GCM encrypted** under
  `CREDENTIAL_ENCRYPTION_KEY`; only a non-reversible fingerprint is ever rendered. The store
  fails closed when that key is unset (env-only keys, exactly as before). A network/parse error
  is *not* a credential problem, so it never burns through the pool. Wired into AltFins,
  FreeCryptoAPI, TAAPI.IO, CoinMarketCap, Finnhub, WunderTrading and the Coinbase CDP custody
  backend. The console raises an **alert** when a provider has no usable key or every key is
  cooling down, and keeps a short **per-provider health history** (`src/lib/credentials/health.ts`).
- **Compliance boundary** (`PHASE18-007` / `PHASE19-010`): every real movement passes
  `src/lib/compliance` before anything is signed, and the money paths never call a vendor
  directly. The provider is selected by `COMPLIANCE_PROVIDER`; the default is an inert
  no-op that reports screening as **off** (so the app never claims coverage it does not
  have). `sanctions-list` is a real, credential-free backend: it indexes the published
  **OFAC SDN** list's digital-currency addresses, screens the account's wallet and (on an
  on-chain withdrawal) the destination, refuses a hit, and **fails closed** when the list
  cannot be read — a broken list refuses movements rather than allowing them. KYC/PEP,
  non-US lists and a jurisdiction source remain vendor work. See `docs/KEY_ROTATION.md`
  for credential handling and `docs/NETWORK_BOUNDARY.md` item 6 for what is still open.
- **Irreversibility** (`PHASE18-006`): the irreversible paths share one shape — an
  explicit server-enforced confirmation, a spend cap, an idempotency key claimed in the
  same transaction as the mutation (with a stable key rendered by every money form, guarded
  by `tests/money-forms.test.ts`), and destination verification for on-chain withdrawals
  (`verifyEvmAddress`: shape, burn-address refusal, EIP-55 checksum). Nothing retries
  silently: a replay is a no-op, and a failure is reported instead of re-sent.
- **Withdrawal review** (`src/lib/withdrawals.ts`, `/admin/withdrawals`): a non-admin user
  cannot move funds out directly. They **request** a withdrawal, which reserves the amount
  from their spendable balance (so it cannot be spent twice while it waits) and lands in an
  admin queue. An admin decides it: **declining returns the amount** to the user with the
  reason recorded — a refusal is never a forfeiture, and no code path sends a user's
  reservation anywhere but to the user or to the destination they named. Approving settles
  the app-signable rail (compliance screening, spend caps, then a custody-signed transfer)
  or clears the Coinbase hand-off, whose real debit arrives later as a reconciled webhook.
  A payout refused *before* signing is refunded; one that may have been broadcast keeps its
  funds **held** until an admin checks and releases them, so a retry cannot pay twice. An
  **account hold** (`Wallet.blocked`) freezes withdrawals and trades while an account is
  reviewed, with a required reason and an audit entry — it never moves or forfeits the
  balance. A decline also opens a bounded **dispute window** (business days,
  `DISPUTE_WINDOW_BUSINESS_DAYS`) that the user argues in a support thread; resolving it as
  `MISUSE_CONFIRMED` **bans** the account — sign-in refused, existing sessions invalidated —
  and freezes the balance, again without moving a single unit.

## Corpus pipeline (parallel subsystem)

```
repo/*.zip ──► corpus_inventory.py ──► manifests + stable IDs + hashes
                    │
                    ▼
              corpus_extract.py  (safe extract → hash → type → parse → Markdown → DB)
                    │
                    ▼
              trading_ai_corpus.sqlite  +  RECORD files  +  data/scraped/**/*.md
                    │
                    ▼
              corpus_analyze.py ──► docs/KNOWLEDGE_BASE.md
```

Bulk/extracted data lives on the HDD (`/mnt/private-ai-data/trading-ai-extractions`);
the SSD holds code, manifests, the DB, and active development.

## Distributed compute

Windows `192.168.15.92` is optional. Workers never write to the shared SQLite DB
directly: they produce a verified artifact, transfer it, and Linux performs canonical
ingestion. If Windows is offline, portable tasks are requeued on Linux and work continues.
