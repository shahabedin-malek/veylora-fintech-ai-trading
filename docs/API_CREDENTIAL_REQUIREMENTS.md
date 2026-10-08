# API & Credential Requirements

The app runs **fully with only two required variables**. Everything else is optional
and each optional key unlocks a specific enhancement. Never commit real secrets.

## Required

| Env var | Service | Purpose | How to set |
| --- | --- | --- | --- |
| `DATABASE_URL` | local SQLite / PostgreSQL | Prisma datasource | local: `file:./dev.db`; deploy: Postgres URL |
| `SESSION_SECRET` | app (self) | signs the session cookie | 32+ random bytes: `openssl rand -base64 32` |

## Optional

| Env var | Service | Mandatory? | Signup | Scopes | Used by | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `MARKET_PROVIDER` | — | no | n/a | n/a | `src/lib/market` | `auto` \| `coingecko` \| `simulated` |
| (none — public) | CoinGecko public API | no | https://www.coingecko.com/en/api | read-only, no key | crypto quotes/candles | Falls back to simulated on failure |
| `NEWS_FEEDS` | any public RSS feed | no | n/a | n/a | `src/lib/market#getNews` | comma-separated feed URLs; no feed ⇒ empty state |
| `WITHDRAW_FEE_BPS` | app (self) | no | n/a | n/a | withdrawal maths | 100 = 1% simulated fee |
| `MIN_TRADE_USD` | app (self) | no | n/a | n/a | trading state machine | default 20 |

## Wallet / chain integration (not enabled by default)

If a real or testnet wallet is ever wired in, use the adapter interface
(`kind` = SIMULATED / TESTNET / MAINNET). Mainnet stays disabled until explicitly
enabled. Recommended testnets: Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia.
Required vars would be added as `WALLET_RPC_URL_*`, `WALLET_CHAIN_ID`, and a
read-only explorer key — **never** a seed phrase or private key.

## Deployment (only after explicit authorization)

| Env var | Service | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Vercel Postgres / Neon | production database |
| `SESSION_SECRET` | app | production cookie signing |

## Security rules

- `.env` is git-ignored; only `.env.example` (placeholders) is committed.
- `SESSION_SECRET` must be unique per environment.
- No secret is ever logged or rendered.
- Nothing is published to GitHub/Vercel without explicit user authorization.
