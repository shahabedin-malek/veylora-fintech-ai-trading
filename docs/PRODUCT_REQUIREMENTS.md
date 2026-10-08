# Product Requirements

**Product name:** Veylora Fintech AI Trading (simulated).
**Status:** portfolio build. Every trading/balance figure is simulated and labelled.

## Safety boundary (non-negotiable)

- All trading is **paper trading**. No real order is ever placed.
- No flow presents simulated performance as a real or guaranteed return.
- Market data is real where a public source is available, otherwise clearly
  labelled simulated. The UI shows a per-quote source badge and timestamp.
- News is shown only from a **configured real RSS feed**; with no feed configured
  the UI shows an explanatory empty state — headlines are never fabricated.
- Mainnet wallet flows are disabled by default; the app uses the simulated adapter.

## Public experience

| Requirement | Implemented | Location |
| --- | --- | --- |
| Polished landing page | yes | `/` |
| Modern fintech visual identity | yes | design tokens in `globals.css` |
| Responsive desktop/tablet/mobile | yes (CSS grid, fluid) | all pages |
| Market overview | yes | `/`, `/dashboard` |
| Crypto market data | yes — real CoinGecko OHLC candles + quotes; simulated fallback | `/markets` |
| Forex market data | yes (simulated-labelled) | `/markets` |
| Global equities | yes (simulated-labelled) | `/markets` |
| Charts | yes — line / area / candlestick + volume histogram (dependency-free SVG) | `/markets` |
| Market signals | partial (24h change + P/L context) | `/markets`, `/dashboard` |
| News | **yes** — real public RSS (Cointelegraph, Investing.com, BBC Business), tagged by instrument; explanatory empty state if no feed responds | `/markets` |
| Documentation/research area | yes | `docs/` |
| FAQ (≥5 questions) | yes (6) | `/faq` |
| Support-chat widget | yes (bottom-right) | every page |

## User experience

| Requirement | Implemented | Location |
| --- | --- | --- |
| Login | **wallet connect + SIWE** (target, Phase 18). Today: email + password (scrypt + signed cookie) | `/login` |
| Execution mode | derived from the signed-in wallet's network — testnet ⇒ simulated, mainnet ⇒ real (**mainnet not built**) | everywhere |
| Wallet connection (simulated) | yes | `/wallet` |
| Portfolio / balances | yes | `/dashboard`, `/wallet` |
| Deposit flow | yes | `/wallet` |
| Trading dashboard | yes | `/trade` |
| Simulated AI trading terminal | yes (labelled, 3–30s cadence) | `/trade` |
| Start/stop trading controls | yes | `/dashboard`, `/trade` |
| Withdrawal of funds | yes | `/wallet` |
| Transaction/history view | yes | `/history` |
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

- "Simulated P/L", "paper trade", "simulated platform fee" are used consistently;
  the word "guaranteed" never appears.

## Responsive & accessibility

| Requirement | Implemented |
| --- | --- |
| Desktop / tablet / mobile layouts | yes — fluid `clamp()` headline, single-column collapse below 720/980px, 14px gutters on mobile |
| Tables on narrow screens | yes — `.table-wrap` scrolls horizontally instead of squashing |
| Mobile navigation | yes — nav wraps and the link row scrolls horizontally |
| Touch targets | yes — buttons carry a 44px min-height |
| Support launcher | yes — fixed, respects `env(safe-area-inset-bottom)`, smaller on mobile |
| Skip-to-content link | yes — first focusable element, reveals on focus |
| Single `h1` per page | yes — verified across all 12 routes |
| Labels & form semantics | yes — every input/select/textarea has an associated label |
| Focus states | yes — `:focus-visible` outline on links, buttons, inputs, summaries |
| Error / empty / loading / success states | yes — error boundary, `not-found`, `loading` skeleton, empty states |
| Live regions | yes — terminal uses `role="log" aria-live="polite"`; form errors use `role="alert"` |
| Disabled controls | yes — rendered as real disabled buttons, not focusable faux-links |
| Reduced motion | yes — `prefers-reduced-motion` disables shimmer/transitions |
| Automated UI audit | yes — Playwright checks 13 routes × 3 widths (375/768/1440) for horizontal overflow and WCAG AA contrast; writes `apps/web/reports/ui-audit.{md,json}` plus 39 screenshots |
| Full-journey e2e | yes — Playwright drives register → login → deposit → start trading → force stop → withdraw → open ticket → admin reply entirely through the UI, asserting the state-machine transitions and cleaning up its throwaway account |
| Fresh-session walkthrough gate | yes — a cookie-less context asserts public pages load, every protected route redirects to `/login` without leaking content, market data/chart/news render, and no secret reaches any page |
| Integration tests | yes — 29 tests call the real server actions against a throwaway SQLite database created from the committed migrations, covering auth/session, authorisation (401/403), deposit/withdrawal maths, the full money cycle, tickets, assignment and internal-note visibility. Only the framework boundary (`next/headers`, `next/navigation`, `next/cache`) is mocked. |

## Out of scope

- Real custody, real exchange connectivity, KYC/AML, regulatory reporting.
- GitHub/Vercel publishing until the user explicitly authorizes it.
