# Open Tasks & Ideas

A consolidated, honest snapshot of **what is still open** on Veylora Fintech AI Trading
and **ideas** for where it could go next. It complements — and does not replace — the
authoritative task control plane in `.progress/` (`.progress/TASK_QUEUE.md`,
`.progress/TASK_STATUS.md`), the release gate in `docs/RELEASE_CHECKLIST.md`, the network
boundary in `docs/NETWORK_BOUNDARY.md`, and the current `todo-tasks.md` export.

> **How to read this.** Sections 1–5 are **open work** (things that are not finished or
> not done in production). Section 6 records **accepted limitations**. Sections 7–11 are
> **ideas** — proposals, not commitments; none of them should move ahead of the
> non-negotiables in `NETWORK_BOUNDARY.md`.

Current automated state: `npm run typecheck` clean · `npm test` **444 tests (439 pass,
5 live-skip) in 46 files** · `npm run build` clean (26 routes). If a doc still says "178
tests", it is stale — §5 was fixed so the docs reference the `npm test` gate instead.

> **Coinbase Onramp / CDP:** the operator-facing status — the portal blocker, what is
already built in code, what needs a **human**, the security-requirements mapping and
reply drafts — lives in `docs/COINBASE_ONRAMP_READINESS.md`.

---

## 1. Release / production blockers (must-do before going live)

> **Every item here is a human/ops step** (portal, secrets, deploy, backups) — no code
> change is pending for them. The Coinbase-specific portal work is detailed in
> `docs/COINBASE_ONRAMP_READINESS.md`.

- [ ] **Apply the pending migrations to dev and prod.** Not yet run against the deployed
      Postgres:
      `20261010180000_signal_events`, `20261010200000_provider_credentials`,
      `20261010210000_credential_usage`. Use `npm run db:deploy` with the migrations
      directory swap described in `docs/DEPLOYMENT.md`.
- [x] **Production secrets — done in part.** `CRON_SECRET` (generated),
      `CREDENTIAL_ENCRYPTION_KEY` (generated) and `OWNER_WALLET_ADDRESSES` are now set on Vercel
      production and the app redeployed; `/status` reports them configured.
- [ ] **Production secrets — remaining (rotate first, then set).** `ALTFINS_API_KEY`,
      `FREECRYPTOAPI_API_KEY`, `TAAPI_API_KEY`, `COINMARKETCAP_API_KEY`, `FINNHUB_API_KEY`,
      `FINNHUB_WEBHOOK_SECRET`, `COINBASE_WEBHOOK_SECRET`, `WUNDERTRADING_API_KEY` /
      `WUNDERTRADING_SECRET_KEY`, `VENUE_MAX_PER_TX_USD` / `VENUE_DAILY_LIMIT_USD`. Deliberately
      **not** copied from `signals/signals.txt`: every key there must be regenerated at the
      provider first (see the next item).
- [ ] **Rotate every key that lived in `signals/signals.txt`.** That file carried live
      keys and was untracked-but-not-ignored until it was added to `.gitignore`; treat
      every key in it as compromised. TAAPI.IO's supplied key is inactive (401) and
      FreeCryptoAPI's has no TA entitlement — regenerate both if those surfaces are wanted.
- [ ] **Repoint the Finnhub webhook subscription** from the site root
      (`https://…vercel.app/`) to `/api/webhooks/finnhub`, and set the matching
      `FINNHUB_WEBHOOK_SECRET`.
- [ ] **Build and smoke-check the Docker image** on a Docker host (Docker is not
      installed in this environment, so the image has never been built here).
- [ ] **Confirm the Coinbase CDP project is live** (not sandbox), that Coinbase Onramp is
      enabled for it, and that `CDP_*` / `CUSTODY_PROVIDER` / `CUSTODY_KEY_ID` are correct.
- [ ] **Back up the datastore and identify a rollback path** before deploy
      (`RELEASE_CHECKLIST.md` §6), and run the post-deploy smoke test.

## 2. Phase 18/19 open items (product / compliance / custody)

- [ ] **Compliance is only partly done** (`PHASE18-007` / `PHASE19-010`). Real OFAC SDN
      sanctions screening exists and is opt-in; still required: KYC/identity, PEP
      screening, non-US lists (EU/UK/UN), a jurisdiction/country source, and whatever
      licensing applies where the operator and users are. The default stays the honest
      no-op that reports screening as *off*.
- [ ] **Provider-side KMS/HSM policy and a met rotation cadence** for the custody wallet
      (`PHASE18-004` / `PHASE19-007`). The runbook and presence/shape audit exist; the
      operational commitment does not yet.
- [ ] **Reconciled accounting** (`NETWORK_BOUNDARY.md` item 8): ledger entries must
      reconcile against **on-chain** balance changes, not just internal intent. No live
      deposit indexer exists yet.
- [ ] **Custody spend ledger** exists (`CustodySpend`), but a periodic reconciliation job
      that flags drift between the ledger and the chain/venue is still open.
- [ ] **Reconcile stale queue entries** (`PHASE19-004` reads as pending though the swap
      adapter shipped) so the task DB matches reality.
- [ ] **Extend live/sandbox Coinbase coverage** (`PHASE19-008`) once credentials exist.

## 3. Signals / market-data backlog

- [x] **Signal evaluation & backtesting.** `src/lib/signals/evaluate.ts` (pure engine) +
      `src/lib/signals/backtest.ts` (loader) score stored signals forward-only, per
      `signalKey`/horizon, out-of-sample and by regime, with **coverage** surfaced (scores
      use only prices stored on signals — a floor, not a price history). Surfaced read-only
      at `/admin/backtest`; `tests/signals-evaluate.test.ts` pins the maths. The trust step in
      `docs/signals/IMPLEMENTATION.md` §8.
- [ ] **Ensembles & position sizing.** Today the risk gate is a refuse-only rule set; a
      real scoring/ensemble layer (and any sizing) is deliberately unbuilt.
- [ ] **Remaining providers**: CoinGecko **keyed** upgrade, deeper CoinMarketCap
      (sentiment / CMC AI), **APIBricks**, **RapidAPI** — all documented, none wired.
- [ ] **FreeCryptoAPI TA** (`/getBreakouts`, `/getFearGreed`, `/getTechnicalAnalysis`) and
      **TAAPI.IO** (`/indicator/rsi|macd`) are wired **defensively** but key-gated: they
      emit nothing until the plans/keys are live.
- [ ] **Live on-chain deposit indexer** so `DEPOSIT` ledger entries reconcile with
      observed chain events.
- [ ] **Forex coverage.** Finnhub forex is premium (403) and no provider currently prices
      forex live; it falls back to the labelled offline generator.

## 4. Tests / CI / tooling

- [ ] **Wire the E2E sign-in limitation into CI cleanly.** CI has no wallet, so the e2e
      specs mint a session cookie; the SIWE path is covered by integration tests. Fine,
      but worth documenting in CI as an explicit exception.
- [ ] **E2E `ui-audit` / `walkthrough` fail only from blocked RainbowKit telemetry**
      (`pulse.walletconnect.org` CORS). The audit's own overflow/contrast/aria checks are
      clean; either set a real `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, stub the telemetry
      in the test, or exempt the request — currently unresolved and unrelated to app code.
- [ ] **CI coverage gaps.** Consider a job that runs the new credential/signal provider
      tests against a mocked fetch matrix so a provider wire-format change fails CI rather
      than a live smoke test only.
- [x] **Provider contract tests.** `tests/provider-contracts.test.ts` (16 tests) pins the
      documented wire shape of AltFins / Finnhub / CoinMarketCap / FreeCryptoAPI / TAAPI
      **offline**, so a vendor format change fails CI instead of a live smoke test.

## 5. Documentation drift (cheap, real)

- [x] `RELEASE_CHECKLIST.md`, `PRODUCT_REQUIREMENTS.md` and `DEPLOYMENT.md` no longer cite a
      frozen count — they reference the `npm test` **gate**. (Root README + this file + the new
      Coinbase readiness doc are all indexed.)
- [x] The app README's test **file** count is asserted by `tests/docs.test.ts` against the
      real tree; the exact *test* count stays hand-maintained (loops/`.each` make static
      counting unreliable). Found + fixed a real bug while adding it: `.gitignore`'s
      `coinbase*credentials*` rule was swallowing `tests/coinbase-credentials.test.ts`, so
      that test never shipped — a negation now re-includes it.
- [ ] Regenerate `.progress/*` via `python3 scripts/progress_report.py` so the corpus counts
      include this work (needs the corpus DB + scripts).

## 6. Accepted limitations (not bugs — recorded on purpose)

- `npm audit` reports **9 moderate** advisories, all one chain via `uuid` < 11.1.1 pulled
  in by `@metamask/sdk` → `@wagmi/connectors`; unreachable from the app, fix needs a
  semver-major `wagmi` 3 that RainbowKit 2 does not support. Recorded in
  `docs/DEPENDENCY_AUDIT.md`.
- The production **session-secret guard is lazy**: a route that never reads the session
  (e.g. `/`) responds with a weak secret; login/session routes fail closed.
- The **wallet-auth migration is breaking** (drops `email`/`passwordHash`); an un-migrated
  database must not serve the new build.
- No GPU on this host; the distributed Windows worker is not connected (deliberately
  dropped, `PHASE10-002`).
- Tests do not load `apps/web/.env` (only `vitest.config` `env` + stubs), which is why the
  credential-presence cache is kept in a **db-free module** — importing Prisma would load
  `.env` and change env-sensitive tests.

---

## Ideas (proposals — not commitments)

Kept strictly behind the guardrails: a provider never moves funds by itself, the risk gate
can only refuse, and no flow implies a return.

### 7. Product & UX

- ✅ **Shipped — Desk operations dashboard** (`/admin/desk`): desk risk verdict, provider
  pool alerts + last smoke result, withdrawal requests awaiting review, recent venue orders
  and the latest reconciliation — the "is the desk healthy and what needs me?" view. It is
  read-only and linked from `/admin`.
- ✅ **Shipped — Strategy backtest lab** (`/admin/backtest`, read-only): forward-return
  distributions per signal key and horizon, out-of-sample split and by regime, with coverage
  and the data caveats stated. It scores history; it does **not** replay arbitrary rule sets
  or size anything — those remain deliberately unbuilt.
- **Portfolio analytics**: allocation, drawdown and realised P/L with every figure labelled
  by source and mode (practice vs mainnet wording).
- **Onboarding wizard**: connect wallet → understand real-vs-practice mode → first
  (small) action, with the irreversibility confirmations inline.
- ✅ **Shipped (CSV + receipt; JSON still open) — Export & receipts**: `src/lib/export.ts`
  (RFC-4180 CSV) behind the authenticated, user-scoped `/history/export?type=…`, plus a
  printable `/wallet/receipt/[id]` page.
- **Recurring buys (DCA)** as an explicit, capped, idempotent schedule — refusing beyond
  the `CUSTODY_*` / `VENUE_*` caps, never silent.

### 8. Risk & operations

- **Out-of-band alerts**: email/webhook (a service like Resend) for risk-off transitions,
  provider-pool exhaustion, a withdrawal request awaiting review, and a failed payout.
  The health/pool state now exists to trigger them.
- **Desk-wide kill switches per provider**: a feature flag that disables a single provider
  or the venue executor from the console without a redeploy (the global
  `MAINNET_EXECUTION_ENABLED` already exists).
- **Request budgets dashboard**: per-provider daily request/credit budgets with a hard cap,
  so a runaway loop cannot burn a plan (FreeCryptoAPI credits scale with rows).
- **Incident timeline**: a single chronological feed of audit-log, webhook and health
  events for post-incident review.
- ✅ **Shipped (internal bookkeeping only) — Reconciler**: `src/lib/reconcile.ts` +
  `/api/cron/reconcile` check that every custody movement recorded its audit row and surface
  payouts held for review; drift writes an audit entry. It does **not** diff against the chain
  — that still needs the on-chain deposit indexer.

### 9. Infrastructure & security

- **Step-up auth for admin money actions**: passkey/WebAuthn or a second wallet
  confirmation before a venue order or an approval.
- **Staging environment** with preview deploys and **sandbox** keys, separate from prod.
- **Observability**: structured logs + error tracking (Sentry/OpenTelemetry) and a simple
  `/status` page; today "logs and errors are observable" is a manual claim.
- **Server-action rate limiting / WAF**, and CSRF/abuse controls at the edge.
- **Secret scanning in CI** (gitleaks) plus a pre-commit hook — the `signals.txt` close
  call is exactly what this prevents.
- **Postgres backups + restore drills**, with the restore path exercised, not just written
  down.
- **Key-pool hardening**: optional per-key IP allow-list metadata and an automatic
  "retire after N consecutive failures" policy.

### 10. Data & ML

- **Signal trust scoreboard**: per provider/key historical hit-rate, drift and coverage —
  the input to retiring a stale signal (follows §3's evaluation work).
- **Regime-aware features**: encode the regime (`UP_DOWN_TREND`) explicitly and measure
  signal performance per regime, rather than treating signals as unconditional.
- **Anomaly detection on market data**: label (never hide) a provider that returns stale
  or implausible values, feeding the health surface.
- **Correlation grouping** before any ensemble score, so ten momentum signals from one
  move count once.
- **Human-in-the-loop research agent**: expose read-only market/signal context via the
  vendors' MCP servers, with the model never holding a signing key and never constructing
  a signed request.

### 11. Accessibility & reach

- **Mobile PWA** with an installable shell and push notifications (behind the same gates).
- **i18n** scaffold (locale files + number/date formatting) with the wording policy kept
  per-locale.
- **Accessibility debt**: continue the UI-audit pass (labels, focus order, reduced motion)
  and add a screen-reader pass on the money-confirmation dialogs.
- **Public status/uptime page** for the read-only surfaces (distinct from the operator
  console).

---

## Suggested sequencing

1. **Ship-safely first** — §1 (migrations, env, key rotation, webhook repoint) and §5
   (docs drift). These unblock a real deployment with no new features.
2. **Trust the signals** — §3 evaluation/backtesting + §7 backtest lab; only then consider
   ensembles or sizing.
3. **Operate it** — §8 alerts + budgets dashboard + reconciler, on top of the health/pool
   state that now exists.
4. **Harden** — §9 step-up auth, observability, backups, secret scanning.
5. **Grow** — §7 product surfaces and §11 reach, each behind the existing guardrails.

> Reminder: publishing (GitHub/Vercel) requires **explicit user authorization**
> (`PHASE16-001`), and nothing here changes the standing refusal — **no path moves a
> declined, held or banned user's funds to an operator wallet.**
