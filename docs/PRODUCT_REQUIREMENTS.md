# Product Requirements

**Product name:** Veylora Fintech AI Trading.
**Status:** live build. Mainnet wallets run real, custody-signed execution (on by
default; a deployment without configured custody refuses rather than replaces it).
The practice networks are **owner-only** — see `docs/NETWORK_BOUNDARY.md`.

## Safety boundary (non-negotiable)

- **Execution mode follows the signed-in wallet:** a mainnet wallet is real; the
  practice networks are **owner-only** and never reach a real path. Real execution is
  on by default and refuses (rather than replaces) when custody is unconfigured.
- No flow presents any figure as a real or guaranteed investment return.
- Market data is real where a public source is available, otherwise clearly
  labelled as an offline fallback. The UI shows a per-quote source badge and timestamp.
- News is shown only from a **configured real RSS feed**; with no feed configured
  the UI shows an explanatory empty state — headlines are never fabricated.
- Mainnet wallet flows run real, custody-signed execution and are on by default; a
  deployment without configured custody refuses (never falls back).

## Public experience

| Requirement | Implemented | Location |
| --- | --- | --- |
| Polished landing page | yes | `/` |
| Modern fintech visual identity | yes | design tokens in `globals.css` |
| Responsive desktop/tablet/mobile | yes (CSS grid, fluid) | all pages |
| Market overview | yes | `/`, `/dashboard` |
| Crypto market data | yes — real CoinGecko OHLC candles + quotes; offline fallback | `/markets` |
| Forex market data | yes (offline-labelled) | `/markets` |
| Global equities | yes (offline-labelled) | `/markets` |
| Charts | yes — line / area / candlestick + volume histogram (dependency-free SVG) | `/markets` |
| Market signals | partial (24h change + P/L context) | `/markets`, `/dashboard` |
| News | **yes** — real public RSS (Cointelegraph, Investing.com, BBC Business), tagged by instrument; explanatory empty state if no feed responds | `/markets` |
| Documentation/research area | yes | `docs/` |
| FAQ (≥5 questions) | yes (7, incl. wallet-network mode) | `/faq` |
| Support-chat widget | yes (bottom-right) | every page |

## User experience

| Requirement | Implemented | Location |
| --- | --- | --- |
| Login | **wallet connect + SIWE** (EIP-4361, single-use server nonce) — email/password removed | `/login` |
| Execution mode | Real by default on a mainnet wallet; the practice networks are **owner-only** and never reach a real path. `src/lib/execution.ts` gates money paths: a mainnet session runs the custody-signed venue (or is refused, never replaced); `MAINNET_EXECUTION_ENABLED=0` is a kill switch | everywhere |
| Wallet connection | yes | `/wallet` |
| Portfolio / balances | yes | `/dashboard`, `/wallet` |
| Deposit flow | yes | `/wallet` |
| Trading dashboard | yes | `/trade` |
| Coinbase swap terminal | yes | `/trade` |
| Start/stop trading controls | yes | `/dashboard`, `/trade` |
| Market news (RSS) | yes — headlines come only from real, configured RSS feeds (`NEWS_FEEDS`, or the curated defaults in `docs/NEWS_SOURCES.md`); nothing is fabricated. The home page shows picture cards (the feed's own image), every other page an image-free sidebar, and `/markets` browses the full feed filtered by asset class (All / Crypto / Forex / Equities). The feed list is the intended input to news-driven risk signals | `/`, `/markets`, every other page |
| Withdrawal of funds | yes | `/wallet` |
| Withdrawal approval workflow | yes — a non-admin user **requests** a withdrawal; the amount is reserved from their balance and an admin approves or declines it in the CRM. Declining returns the amount to the user (with the reason); approving settles the app-signable rail or clears the Coinbase hand-off. An admin can still withdraw directly | `/wallet`, `/admin/withdrawals` |
| Account hold (abuse review) | yes — an admin can freeze an account's withdrawals and trades with a required reason, an audit entry and a user notification. A hold **never moves or forfeits the balance**: the funds stay the user's and lifting the hold restores access | `/admin/withdrawals` |
| Dispute window & ban | yes — a declined request opens a bounded window (business days, `DISPUTE_WINDOW_BUSINESS_DAYS`) that the user argues in the support thread assigned to the declining admin. Resolving it as *misuse confirmed* **bans** the account (login/access refused, existing sessions invalidated) and **freezes** the balance, with a required reason and audit entries. Nothing is ever transferred | `/admin/withdrawals`, `/support` |
| Spend safety (PHASE18-006) | yes — explicit server-enforced confirmation on deposit/withdraw, a per-deposit spend cap (`DEPOSIT_CAP_USD`), an idempotency key on every money form so a replay is a no-op, and **destination verification** (shape + no burn address + EIP-55 checksum) on an on-chain withdrawal | `/wallet`, `/dashboard`, `/trade` |
| Compliance screening | opt-in, and honest about it — the default no-op reports screening as **off**; `COMPLIANCE_PROVIDER=sanctions-list` screens wallet addresses and withdrawal destinations against the published OFAC SDN list, refusing a hit and failing closed while the list is unreachable. No KYC/PEP or non-US lists yet | `/wallet` (status), `src/lib/compliance` |
| Custody (PHASE18-004) | yes — a fail-closed custody boundary that deals only in **key references** (never key material) with per-transaction/daily spend limits, backed by Coinbase CDP Server Wallets (the wallet key stays in the provider). Not reachable until a real venue exists (`PHASE18-005`) | `src/lib/custody` |
| Transaction/history view | yes | `/history` |
| Export & receipts | yes — CSV of the account's own transactions/ledger (authenticated, user-scoped) at `/history/export`, and a printable receipt per withdrawal request at `/wallet/receipt/[id]` | `/history`, `/wallet` |
| Notifications | yes | `/dashboard` |
| Support tickets | yes | `/support` |

## CRM / admin

| Requirement | Implemented | Location |
| --- | --- | --- |
| Customers | yes | `/admin` |
| Contacts | yes (customer email/name) | `/admin` |
| Tickets | yes | `/admin`, `/support` |
| Ticket conversation | yes | `/support`, `/admin/tickets/[id]` |
| Ticket status | yes | admin triage form |
| Priority | yes | admin triage form |
| Assignment | yes | admin triage form |
| Internal notes | yes (hidden from customer) | `/admin/tickets/[id]` |
| Customer timeline | partial (ticket update timestamps) | `/admin` |
| User management | partial (role enforcement) | `/admin` |
| Transaction monitoring | yes (deposit aggregate, ledger) | `/admin` |
| Audit log | yes | `/admin` |
| Support dashboard | yes | `/admin` |
| Desk operations dashboard | yes — read-only roll-up of the desk risk verdict, provider pool alerts + health, pending withdrawal requests and recent venue orders; moves no money | `/admin/desk` |
| Backtest lab (signal evaluation) | yes — read-only forward-test of stored signals: per-`signalKey` forward-return distributions, out-of-sample split and by regime, with coverage caveats; scores history only, never sizes | `/admin/backtest` |

## Trading state machine (deterministic)

```
STATE 0  NOT LOGGED IN   deposit✗ start✗ stop✗ withdraw✗
STATE 1  LOGGED IN       deposit✓ start✗ stop✗ withdraw✗   (balance < MIN_TRADE_USD = $20)
STATE 2  FUNDED          deposit✓ start✓ stop✗ withdraw✓
STATE 3  TRADING ACTIVE  deposit✓ start→StopTrade✓ stop✓ forceStop✓ withdraw✗
STATE 4  STOPPED         deposit✓ start✓ stop✗ withdraw✓
```

- Below the minimum, the UI states how much more is required (`shortfallCents`).
- Stopping under 5 minutes shows a warning with a **Force Stop** option.
- Withdrawal is disabled while trading is active.

## Terminology

- Figures are labelled honestly by source and mode, and the word "guaranteed"
  never appears near a figure.

## Responsive & accessibility

| Requirement | Implemented |
| --- | --- |
| Desktop / tablet / mobile layouts | yes — fluid `clamp()` headline, single-column collapse below 720/980px, 14px gutters on mobile |
| Tables on narrow screens | yes — `.table-wrap` scrolls horizontally instead of squashing |
| Mobile navigation | yes — nav wraps and the link row scrolls horizontally |
| Touch targets | yes — buttons carry a 44px min-height |
| Support launcher | yes — fixed, respects `env(safe-area-inset-bottom)`, smaller on mobile |
| Skip-to-content link | yes — first focusable element, reveals on focus |
| Single `h1` per page | yes — verified across all 15 routes |
| Labels & form semantics | yes — every input/select/textarea has an associated label |
| Focus states | yes — `:focus-visible` outline on links, buttons, inputs, summaries |
| Error / empty / loading / success states | yes — error boundary, `not-found`, `loading` skeleton, empty states |
| Live regions | yes — the terminal is a single `role="log" aria-live="polite"` region that announces each event once (its chips opt out of their own `role="status"`); form errors use `role="alert"`; the UI audit fails on any live region nested inside another |
| Disabled controls | yes — rendered as real disabled buttons, not focusable faux-links |
| Reduced motion | yes — `prefers-reduced-motion` disables shimmer/transitions |
| Automated UI audit | yes — Playwright checks 15 routes × 3 widths (375/768/1440) for horizontal overflow, WCAG AA contrast and nested live regions, on both the reduced-motion fallbacks and the animated markup; writes `apps/web/reports/ui-audit.{md,json}` plus 45 screenshots |
| Full-journey e2e | yes — Playwright drives register → login → deposit → start trading → force stop → withdraw → open ticket → admin reply entirely through the UI, asserting the state-machine transitions and cleaning up its throwaway account |
| Fresh-session walkthrough gate | yes — a cookie-less context asserts public pages load, every protected route redirects to `/login` without leaking content, market data/chart/news render, and no secret reaches any page |
| Integration tests | yes — the integration suite calls the real server actions against a throwaway SQLite database created from the committed migrations, covering auth/session, authorisation (401/403), deposit/withdrawal maths, the full money cycle, tickets, assignment and internal-note visibility. Only the framework boundary (`next/headers`, `next/navigation`, `next/cache`) is mocked. See `npm test` for the current count — it is the gate, not a frozen number. |

## Out of scope

- A real exchange/venue (so real custody cannot yet *move* funds), KYC/AML and regulatory reporting. Custody can sign, but nothing calls it on a value-bearing path until `PHASE18-005`.
- GitHub/Vercel publishing until the user explicitly authorizes it.
