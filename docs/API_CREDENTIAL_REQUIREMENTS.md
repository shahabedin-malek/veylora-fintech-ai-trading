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

## Wallet / chain integration (Phase 18 — login becomes wallet-based)

Sign-in is moving to **wallet connect + SIWE (EIP-4361)**. The signed-in network
sets the execution mode: a testnet wallet is simulated, a mainnet wallet is real.
Recommended testnets: Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia.

Required for that work:

| Env var | Service | Purpose | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect/Reown Cloud | wallet connect UI | public, not a secret |
| `WALLET_RPC_URL_<CHAIN>` | RPC provider (Alchemy/Infura/public) | read chain state, verify balances | read URLs only |
| `SIWE_DOMAIN` | app | binds the SIWE message to this origin | anti-phishing |
| `MAINNET_EXECUTION_ENABLED` | app | hard kill-switch for real execution | must default to disabled |

Rules that must not be relaxed:

- **Never** a seed phrase or private key in an env var, the repo, or logs. Any
  operational key for real withdrawals belongs in a KMS/HSM, not in config.
- Real execution requires `MAINNET_EXECUTION_ENABLED` **and** a mainnet session —
  two independent checks, both server-side.
- RPC/explorer keys are read-only; a compromised read key must not be able to move
  funds.

See `docs/NETWORK_BOUNDARY.md` for the full list of blockers before mainnet.

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
