# Network Boundary — Real vs Simulated by Wallet

**Veylora Fintech AI Trading** is **wallet-authenticated**. There is no
email/password sign-in: a user connects a wallet, signs in (SIWE / EIP-4361), and
the **network of the wallet they signed in with decides whether every subsequent
action is real or simulated.**

> One sentence: **the login wallet picks the mode — testnet is a simulation, mainnet is real money.**

This document is the single reference for that boundary. It is a release gate:
nothing here may change without a review (see `RELEASE_CHECKLIST.md`).

## The rule

| Signed in with | Network class | Execution | Funds |
| --- | --- | --- | --- |
| Testnet wallet (e.g. Sepolia, Base Sepolia, Arbitrum Sepolia) | `TESTNET` | **Simulated** — paper trading, simulated wallet balances | no real funds |
| Mainnet wallet (e.g. Ethereum, Base, Arbitrum) | `MAINNET` | **Real** — real on-chain/venue actions | real funds at risk |

The class is derived from the connected `chainId`, bound into the session at
sign-in, and **re-checked on every action** — it is never trusted from a
client-supplied flag or query parameter.

## Status: not implemented

The current build is **simulated in effect**: there is no wallet sign-in, and
every wallet is created `kind: "SIMULATED"`. This document describes the target
behaviour; the work is tracked as **Phase 18** in the task database. Until those
tasks are complete, the app must keep labelling everything as simulated.

### What is real today

| Surface | Source | Notes |
| --- | --- | --- |
| Crypto quotes | CoinGecko public API (no key) | read-only |
| Crypto OHLC candles + volume | CoinGecko public API | per-candle simulated fallback is flagged |
| News headlines | Configured public RSS feeds | read-only; never fabricated |
| Support / CRM data | This app (SQLite/Postgres) | real persistence |

All real data is **read-only and public**; none of it can move money.

### What is simulated today

Everything value-bearing: trading (paper), P/L, wallet (`kind: "SIMULATED"`),
deposits, withdrawals (initial + sim P/L − sim fee), platform fee, forex/equity
quotes. There is **no MAINNET code path**.

## Required before mainnet can be enabled

This is the honest gap between the current build and the requested roadmap. Real
execution is not a flag flip; each item below is a blocker.

1. **Wallet sign-in.** `wagmi`/`viem` connect + SIWE nonce issuance, domain
   binding, signature verification and replay protection, replacing the
   email/password session entirely.
2. **Network classification.** A single source of truth mapping `chainId` →
   `TESTNET`/`MAINNET`, stored on the session and enforced server-side.
3. **Custody.** Real withdrawals need either (a) a custodial hot wallet whose keys
   live in a KMS/HSM with spend limits, or (b) a non-custodial model where the user
   signs every transfer. Neither exists. **A private key must never be an env var.**
4. **Real execution venue.** Real "trading" needs an exchange/broker API with
   per-user credentials, or on-chain DEX swaps routed through the user's wallet —
   including slippage, MEV and failure handling that paper trading has no concept of.
5. **Irreversibility UX.** Chain transfers are final: explicit confirmation,
   address verification, spend caps, idempotency keys, and no silent retries.
6. **Compliance.** KYC/AML, sanctions screening, jurisdiction gating and any
   licensing that applies where the operator and users are located.
7. **Key/secrets management.** KMS/HSM for any operational key; rotation; audit
   trail. The session secret and provider keys follow existing practice.
8. **Reconciled accounting.** Ledger entries must reconcile against on-chain
   balance changes, not just internal intent.

## How the boundary must be enforced (defence in depth)

Carried over from the simulation-only design, and extended:

1. **Type-level flags.** `Quote.simulated` / `Candle.simulated` mark generated
   values; a consumer cannot render a source without the flag.
2. **Session-bound mode.** The network class lives on the server session, derived
   from `chainId` at sign-in. Server actions read it; the client cannot set it.
3. **Fail-visible fallback.** When a live market source fails, the simulated
   provider is used **and labelled `simulated: true`** — never silently fake "live".
4. **Explicit dual code paths.** A `MAINNET` session must route to a real executor
   or refuse; it must never silently fall back to simulated execution, and a
   `TESTNET` session must never touch a real venue.
5. **Tests as policy.** `tests/deployment.test.ts` currently asserts the source
   contains `kind: "SIMULATED"` and **no `MAINNET`** — that invariant must be
   replaced by network-gating tests (mainnet requires an explicit enable flag;
   testnet never reaches a real executor) as part of Phase 18.
6. **UI labelling.** Every figure is labelled with its source and mode: a testnet
   session shows "simulated" everywhere; a mainnet session shows real balances and
   an unambiguous "real funds" state. The word *"guaranteed"* never appears near a
   figure.
7. **Wording policy.** No surface may imply investment returns. Claims must match
   the session's actual mode — the app must not advertise real trading before the
   Phase 18 work lands.
8. **Fail-closed secret.** In production the session secret must be ≥16 chars or
   the app refuses to sign a session (`src/lib/secret.ts`).

## Non-negotiables on any release

- A session's mode is derived from the signed-in network and re-checked server-side
  on every action.
- Mainnet execution stays **disabled** until Phase 18 is complete and the release
  checklist's real-funds section is signed off.
- Market values are always labelled with their source and simulated flag.
- News only from configured real feeds; if none respond, show an empty state.
- No private key, seed phrase or signing secret is ever committed or logged.
