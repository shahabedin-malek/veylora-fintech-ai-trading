# Simulation Boundary — Real vs Simulated

**Veylora Fintech AI Trading** deliberately mixes a *few real, read-only public data
sources* with a *fully simulated* trading and custody experience. This document is
the single reference for what is real, what is simulated, and how each is enforced
and surfaced to the user. It is a release gate: nothing here may change without a
review (see `RELEASE_CHECKLIST.md`).

> One sentence: **read the real market, trade nothing real.**

## What is real

| Surface | Source | Notes |
| --- | --- | --- |
| Crypto quotes | CoinGecko public API (no key) | read-only |
| Crypto OHLC candles + volume | CoinGecko public API | real intervals; simulated fallback is per-candle flagged |
| News headlines | Configured public RSS feeds (defaults: Cointelegraph, Investing.com, BBC Business) | read-only; never fabricated |
| Accounts / auth | This app (`scrypt` + HMAC-signed httpOnly cookie) | local, no third-party identity |
| Support / CRM data | This app (SQLite/Postgres) | real persistence of *simulated* activity |

Real data is **read-only and public**. No credential, no write scope, no key is
required for any of it, and none of it can move money.

## What is simulated

| Surface | Nature | Why it is safe |
| --- | --- | --- |
| Trading | Paper trading via a deterministic state machine | no venue, no order, no fill |
| P/L | Computed from simulated state | labelled "simulated P/L" |
| Wallet | `kind: "SIMULATED"`, address `sim_…`, network `simulated` | no chain, no keys, no RPC |
| Deposits | Simulated credits in integer cents | no payment rail |
| Withdrawals | Pure calculation: initial + sim P/L − sim fee | never touches real funds |
| Platform fee | `WITHDRAW_FEE_BPS` applied to the sim balance | simulated |
| Forex & equities | Simulated quotes/candles | public feeds for these are not free/licensed |
| Mainnet | Disabled | no adapter is wired |

## How the boundary is enforced

Defence in depth — the boundary is expressed in **types, providers, UI labels,
tests and tests-as-policy**, not just in prose:

1. **Type-level flags.** `Quote.simulated` and `Candle.simulated` mark generated
   values; `NewsItem.simulated` is documented as *always `false`*. A consumer
   cannot render a source without the flag being present.
2. **Provider interface.** `MarketDataProvider` exposes an `id`; `getQuotesSafe`
   / `getCandlesSafe` return `{ …, degraded, source }` so the UI can name the
   source and flag degradation instead of hiding it.
3. **Fail-visible fallback.** When a live source fails, the simulated provider is
   used **and clearly labelled `simulated: true`** — the app degrades honestly
   rather than silently showing fake "live" numbers.
4. **Wallet kind.** Every wallet is created `kind: "SIMULATED"` (`actions.ts`,
   `account.ts`). There is no MAINNET path in the codebase.
5. **Tests as policy.** `tests/deployment.test.ts` asserts the source contains
   `kind: "SIMULATED"` and contains **no `MAINNET`**, and scans `src/**` for
   committed credentials. `tests/error-recovery.test.ts` asserts the simulated
   fallback is always flagged and that news is never fabricated.
6. **UI labelling.** Per-quote/per-candle source badges: a `.badge.live` shows the
   real source name, `.badge.sim` shows "simulated"; `/markets` shows the active
   `source` and a degraded state.
7. **Wording policy.** "Simulated P/L", "paper trade", "simulated platform fee"
   are used consistently; the word *"guaranteed"* never appears near a figure.
8. **Surface minimisation.** The app has **no API route handlers** — all mutations
   go through authenticated server actions, which shrinks the attack surface.
9. **Fail-closed secret.** In production the session secret must be ≥16 chars or
   the app refuses to sign a session (`src/lib/secret.ts`).

## Going live would require (out of scope today)

Turning any of this into a real product is a separate, regulated effort. At
minimum it would add: a `TESTNET` then explicitly-enabled `MAINNET` wallet adapter
with key custody/HSM, real order routing and exchange connectivity, KYC/AML,
regulatory reporting, licensing per jurisdiction, and a secrets-management
strategy. None of that exists here, by design.

## Non-negotiables for any release

- All trading stays paper trading; no flow implies a real or guaranteed return.
- News only from configured real feeds; if none respond, show an empty state.
- Market values are always labelled with their source and a simulated flag.
- Mainnet stays disabled; the simulated wallet stays the default.
- The wording policy above is enforced in copy and reviewed in the checklist.
