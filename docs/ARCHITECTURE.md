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

A **simulated** provider is always registered as a fallback and is clearly labelled
as simulated in the UI; real providers are added behind the same interface. Provider
failures degrade gracefully to the labelled fallback — the UI never shows invented
data as live.

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
- Wallet providers sit behind an adapter interface (simulated / testnet / mainnet).
- Mainnet flows are disabled by default; the app runs on the simulated adapter.
- All trading is paper trading; balances and P/L are labelled simulated.
- Auth currently uses hashed passwords + a signed session cookie (httpOnly,
  SameSite=Lax). **Target (Phase 18):** wallet connect + SIWE (EIP-4361) replaces
  email/password, and the session carries the signed-in network class
  (`TESTNET` ⇒ simulated, `MAINNET` ⇒ real) so server actions can gate execution
  without trusting a client-supplied flag. See `docs/NETWORK_BOUNDARY.md`.

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
