# Network Boundary — Real by Default, Practice Networks Owner-Only

**Veylora Fintech AI Trading** is **wallet-authenticated**. There is no
email/password sign-in: a user connects a wallet, signs in (SIWE / EIP-4361), and
the **network of the wallet they signed in with decides the class of every
subsequent action.**

> One sentence: **public wallets are mainnet and real; the practice networks are owner-only.**

This document is the single reference for that boundary. It is a release gate:
nothing here may change without a review (see `RELEASE_CHECKLIST.md`).

## The rule

| Signed in with | Network class | Who may sign in | Execution | Funds |
| --- | --- | --- | --- | --- |
| Mainnet wallet (Ethereum, Base, Arbitrum) | `MAINNET` | everyone | **Real** — on-chain and venue actions | real funds at risk |
| Practice wallet (Sepolia, Base Sepolia, Arbitrum Sepolia) | `SANDBOX` | **the owner only** | the owner practice desk; no real path | no real funds |

The class is derived from the connected `chainId`, bound into the session at
sign-in, and **re-checked on every action** — it is never trusted from a
client-supplied flag or query parameter.

## Owner gating

The site owner is configured with `OWNER_WALLET_ADDRESSES` (comma-separated,
case-insensitive; empty ⇒ no owner). An owner is always `ADMIN`, and is the only
account that may:

- sign in on a **practice network** (`SANDBOX`) — refused for every other wallet in
  `verifySiweAction` with the same generic "unsupported network" message, so the
  capability is invisible to ordinary users; and
- credit **practice funds** to their own account (`ownerCreditPracticeFundsAction`) —
  a labelled ledger credit with no real backing, for exercising the desk.

Ownership is re-checked on every session read (`getCurrentUser`): a practice session
that somehow reached the database for a non-owner resolves to "signed out".

## Recorded design decisions

These were settled with the product owner and are **not open questions**. Future
work must match them; changing one is a roadmap decision, not an implementation
detail.

| Question | Decision |
| --- | --- |
| What is "real"? | **Both** — real on-chain transfers **and** real trading through a venue API. |
| Custody | **Custodial hot wallet.** Operational keys live in a KMS/HSM with spend limits — never a key in config, the repo, or logs. The non-custodial (user-signs-every-transfer) model was **not** chosen. |
| Chains | **Multiple chains**, selected via `wagmi`: Ethereum + Sepolia, Base + Base Sepolia, Arbitrum + Arbitrum Sepolia. |
| Email/password | **Removed entirely.** Wallet connect + SIWE is the only sign-in; admins sign in with a wallet too. No password fallback, no email field. |## Status: sign-in, classification, gate and custody implemented; real by default

**Wallet sign-in is implemented** (`PHASE18-001`): connect + SIWE/EIP-4361 with a
single-use server nonce, viem signature recovery, and a session that carries the
signed-in `chainId`. Email/password is gone — wallet is the only sign-in, admins
included. The `MAINNET` path now exists (see below) and is on by default.

**The execution gate is implemented** (`PHASE18-003`): `src/lib/execution.ts` is
the single decision point for a real money action. A `SANDBOX` class is refused
outright (no real path exists on a practice network). A `MAINNET` session is
**refused unless every layer allows it** — an implemented executor
(`REAL_EXECUTOR_IMPLEMENTED`) and available custody, with the kill switch clear
(`MAINNET_EXECUTION_ENABLED=0` refuses everything) — and it is **never
silently replaced** by a practice flow; the real swap path checks `executionGate()`
directly and throws/refuses rather than returning a value a caller could ignore.

**Network classification is implemented** (`PHASE18-002`):
`src/lib/network.ts` is the single source of truth mapping `chainId` →
`MAINNET`/`SANDBOX`, and the class is **derived server-side from the signed session
chain on every request** (`getSessionMode()` → `getCurrentUser().network`). Sign-in
**refuses a practice chain for a non-owner** (same generic message as an unknown
chain) and an unknown chain is refused outright, never defaulted; a session whose
chain is no longer offered **fails closed** — it resolves to "signed out" instead of
an ambiguous class.

The build is **real by default**: as soon as custody is configured a mainnet session
can execute a real Coinbase swap, with no opt-in needed; `MAINNET_EXECUTION_ENABLED=0`
is a kill switch that refuses every mainnet money action, and a deployment without
custody refuses too. Practice funds are a clearly labelled ledger credit with no real
backing, credited only by the owner to their own account — the custody-held venue key
is the only real key in the product.

**Custody is implemented** (`PHASE18-004`): `src/lib/custody/` is the single
boundary for a real key. It deals only in a **key reference**
(`CUSTODY_PROVIDER`/`CUSTODY_KEY_ID` — never key material; no private key, seed
phrase or signing secret is read, returned or logged), and it enforces **spend
limits** (`CUSTODY_MAX_PER_TX_USD`, `CUSTODY_DAILY_LIMIT_USD`) *before* any signer
is requested, refusing over-limit movements rather than trimming them. The wired
backend is **Coinbase CDP Server Wallets** (`CUSTODY_PROVIDER=coinbase-cdp`), where
the wallet key stays inside Coinbase and the app holds only API credentials; it is
imported lazily so the gate never loads the SDK just to answer "is custody
configured?". It still **fails closed**: custody unavailable ⇒ `requireCustody()`
throws and nothing is signed. Custody no longer blocks the boundary, and the real **venue**
(`PHASE18-005` / `PHASE19-004`) is now implemented as a Coinbase EVM swap adapter
(`src/lib/coinbase/trading.ts`) — **mainnet-only** (there is no practice-network
swap), custody-signed and spend-limited before any quote. Real execution therefore exists
**and is on by default**, gated only by configured custody and the kill switch.

### What is real today

| Surface | Source | Notes |
| --- | --- | --- |
| Crypto quotes | CoinGecko public API (no key) | read-only |
| Crypto OHLC candles + volume | CoinGecko public API | per-candle offline fallback is flagged |
| News headlines | Configured public RSS feeds | read-only; never fabricated |
| Support / CRM data | This app (SQLite/Postgres) | real persistence |

All real data is **read-only and public**; none of it can move money.

### What is not real

Forex/equity quotes and any market value fall back to a clearly-labelled offline
generator when a live source fails; they never move money. Owner **practice funds**
are a labelled ledger credit with no real backing. Nothing else in the product is
non-real: a **mainnet** session runs the real custody-signed venue (when custody is
configured) or is refused, never replaced by a practice flow.

## Required before mainnet can be enabled

Real execution is enabled and on by default (items 1–4 below are **done**); the items
that remain are hardening and compliance for production real-money traffic rather than
gates on the code path.

1. ~~**Wallet sign-in.**~~ **Done (`PHASE18-001`).** `wagmi`/`viem` + RainbowKit
   connect, SIWE nonce issuance, domain binding, viem signature verification and
   single-use replay protection replaced the email/password session entirely.
   Supported chains: Ethereum / Sepolia, Base / Base Sepolia, Arbitrum /
   Arbitrum Sepolia. The session records the signing `chainId`.
2. ~~**Network classification.**~~ **Done (`PHASE18-002`).** `src/lib/network.ts`
   maps `chainId` → `MAINNET`/`SANDBOX` and returns `null` — never a default class —
   for an unsupported chain. The class is derived from the signed session `chainId`
   on every read, so it cannot drift from the signed value; an unsupported chain
   fails closed. Sign-in validates the chain the client claims.
3. ~~**Custody.**~~ **Done (`PHASE18-004`).** A **custodial hot wallet**: the
   boundary and spend limits are in `src/lib/custody/`, and the backend is Coinbase
   CDP Server Wallets, which holds the wallet key in its own secure infrastructure
   — the app never sees it. Spend limits are enforced before any signature is
   requested. **A private key must never be an env var, in the repo, or in a log**,
   and nothing here reads, returns or logs one. *Done since:* the rolling spend ledger is
   **persisted** (`CustodySpend`, `src/lib/custody/spend-ledger.ts`), so the daily cap is
   derived from what actually moved rather than from a caller-supplied total; every signed
   movement also writes a `custody.spend` audit row; and rotation is a documented operator
   procedure (`KEY_ROTATION.md`).
4. ~~**Real execution venue.**~~ **Done (`PHASE19-004`, feeding `PHASE18-005`).**
   A real venue adapter (`src/lib/coinbase/trading.ts`) executes custody-signed
   Coinbase EVM swaps, **mainnet-only**, with the spend limits enforced before any
   quote. It handles slippage (basis points), unavailable liquidity and execution
   failure. It is behind the gate above, so it runs only when custody is configured
   and the kill switch is clear. *Follow-ups:* broader venues (Advanced Trade /
   Transfers API), partial-fill handling and per-user credentials.
5. **Irreversibility UX.** **Done.** Chain transfers are final, and every irreversible
   action treats them that way: an explicit server-enforced confirmation
   (`isConfirmed`) on deposit/withdraw/swap/on-chain withdrawal; a stable idempotency key
   on every money form, claimed in the same transaction as the movement, so a double
   submit or retry is a no-op (asserted by `tests/money-forms.test.ts`); spend caps
   (`DEPOSIT_CAP_USD`, `CUSTODY_MAX_PER_TX_USD`, `CUSTODY_DAILY_LIMIT_USD`) enforced before
   anything is signed; and **destination verification** — shape, a refused burn address
   (`0x000…0`) and an EIP-55 checksum check on a mixed-case address, so a plausible typo is
   refused rather than sent (`verifyEvmAddress`, re-checked at the custody boundary).
   Withdrawals are then **reviewed**: a non-admin requests one, the amount is reserved from
   their balance, and only an admin decides it. A decline **returns the amount to the user**
   (with the reason recorded) — a refusal never diverts or forfeits a balance, and an
   approved on-chain payout goes only to the destination the user named. An admin can also
   put an account on **hold**, which freezes withdrawals and trades while leaving the
   balance untouched (`src/lib/withdrawals.ts`, `/admin/withdrawals`). A decline opens a
   bounded **dispute window** argued in a support thread (`DISPUTE_WINDOW_BUSINESS_DAYS`,
   business days); resolving it as *misuse confirmed* **bans** the account (sign-in refused,
   sessions treated as signed out) and freezes the balance. A ban and a hold both stop
   movement, and neither takes the money.
6. **Compliance.** **Partly done.** Real sanctions screening of wallet addresses and
   withdrawal destinations exists and is opt-in: `COMPLIANCE_PROVIDER=sanctions-list`
   screens the published **OFAC SDN** list, refuses a hit and fails closed while the list is
   unavailable (`src/lib/compliance/providers/sanctions-list.ts`). The default stays the
   honest no-op, which reports screening as *off*. Still required: KYC/identity and PEP
   screening, non-US lists (EU/UK/UN), a jurisdiction source, and any licensing that
   applies where the operator and users are located.
7. **Key/secrets management.** **Partly done.** No operational key lives in the app
   (custody keys stay with the provider), the session secret and provider credentials are
   env-only and never logged, `custody.spend` entries are the audit trail, and rotation has
   a runbook (`KEY_ROTATION.md`) plus a presence/shape audit (`/admin/credentials`,
   `npm run check:coinbase-credentials`). Still required: provider-side KMS/HSM policy for
   the wallet, and an agreed rotation cadence actually being met.
8. **Reconciled accounting.** Ledger entries must reconcile against on-chain
   balance changes, not just internal intent.

## How the boundary must be enforced (defence in depth)

Carried over from the paper-only design, and extended:

1. **Type-level flags.** A generated `Quote` / `Candle` carries an offline flag; a
   consumer cannot render a source without it.
2. **Session-bound mode.** The network class is derived from the session's signed
   `chainId` on every read (`getSessionMode()`), so the client cannot set it and it
   cannot drift from the signed value. An unsupported chain yields no session.
   Done (`PHASE18-003`): the money paths branch on it — the real swap via
   `executionGate()`.
3. **Fail-visible fallback.** When a live market source fails, the offline provider
   is used **and clearly labelled** — never silently fake "live".
4. **Explicit dual code paths.** A `MAINNET` session must route to a real executor
   or refuse; it must never silently fall back, and a `SANDBOX` session must never
   touch a real venue.
5. **Tests as policy.** The old "no `MAINNET` token in `src/`" grep is gone. It is
   replaced by network-gating tests (`tests/execution.test.ts`,
   `tests/deployment.test.ts`, and the money-path refusal in the integration
   suite): a mainnet session is refused in every flag state; a practice (`SANDBOX`)
   session never reaches a real executor (`PHASE18-003`/`008`).
6. **UI labelling.** Every figure is labelled with its source and mode: a practice
   session shows practice wording; a mainnet session shows real balances and
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
- Mainnet execution is **on by default**, but stays refused unless a real executor
  exists and custody is configured; `MAINNET_EXECUTION_ENABLED=0` is a kill switch. The
  release checklist's real-funds section must be signed off before production traffic.
- Market values are always labelled with their source and offline flag.
- News only from configured real feeds; if none respond, show an empty state.
- No private key, seed phrase or signing secret is ever committed or logged.
