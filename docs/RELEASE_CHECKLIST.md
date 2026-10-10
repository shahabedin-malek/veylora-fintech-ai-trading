# Release Readiness Checklist

Go / no-go gate for shipping **Veylora Fintech AI Trading**. Every box must be
checked, or the item must carry an explicit waiver with a recorded reason. This is
the release companion to `NETWORK_BOUNDARY.md` and `DEPENDENCY_AUDIT.md`.

**Release format:** self-hosted Next.js 16 app + Prisma datastore, shipped as a
Docker image (`apps/web/Dockerfile`; see `DEPLOYMENT.md`).
**Current publication status:** 🚫 **BLOCKED** — no GitHub push or Vercel deploy
until the user explicitly authorizes it (`PHASE16-001`).

---

## 1. Preconditions

- [ ] Working tree reviewed; no stray debug code, `console.log`, or TODO shims in `apps/web/src`.
- [ ] `apps/web/.env` exists (git-ignored) and is **not** committed; `.env.example` is current.
- [ ] `SESSION_SECRET` is unique to this environment and ≥16 chars (32+ recommended: `openssl rand -base64 32`).
- [ ] `DATABASE_URL` points at the intended datastore (SQLite locally, PostgreSQL for deploy).
- [ ] `OWNER_WALLET_ADDRESSES` is set to the owner's wallet address(es) for this environment — or deliberately empty, which disables every owner-only surface (owner sign-in on a practice chain, the `/admin` owner card, and the practice-funds credit). Verify whichever value is intended, not just that the variable exists.
- [ ] Node.js 24 LTS on the target host.

## 2. Automated gates (run `npm run verify:deploy`)

- [ ] `npm run typecheck` — `tsc --noEmit` clean.
- [ ] `npm test` — **the whole suite passes** (unit + integration: owner practice-funds, custody, Coinbase, deployment, docs, network, owner, execution, market, compliance). Reference the **gate**, not a frozen count: the live tests skip without credentials (Coinbase with `COINBASE_LIVE=1`, custody with `CUSTODY_LIVE=1`), and the exact numbers drift every change. `npm run verify:deploy` runs this for you.
- [ ] `npm run test:e2e` — Playwright: full-journey + wallet sign-in + Coinbase + owner surfaces + UI audit (15 routes × 3 widths) + fresh-session walkthrough + mobile-nav pass.
- [ ] `npm run test:owner-gating` — the owner-surface leak guard passes: no `data-owner-only` marker, owner heading, credit button or amount field renders on **any** route for an anonymous visitor, a non-owner user or a non-owner admin, and the owner positive control still renders them (so the assertion is not vacuous).
- [ ] `npm run build` — production build succeeds; expected routes present.
- [ ] `npm audit` — no high/critical; `npm audit --audit-level=high` exits 0 and the accepted moderates are recorded in `DEPENDENCY_AUDIT.md`.
- [ ] UI audit report shows **0 horizontal overflow / 0 contrast failures / 0 nested live regions / 0 console errors** (`apps/web/reports/ui-audit.md`).
- [ ] CI is green on the release commit (`ci.yml`: verify, e2e, docker, postgres — main/PR; `docs.yml`: docs — every branch).

## 3. Security

- [ ] Production **fails closed** with a weak/missing `SESSION_SECRET` (returns an error on a session-signing request, not a silent insecure fallback).
- [ ] Session cookie is `httpOnly`, `sameSite=lax`, `secure` in production.
- [ ] Secret scan clean: no private keys, AWS/GitHub/OpenAI tokens, or provider credentials in `src/**` (asserted by `tests/deployment.test.ts`).
- [ ] Credential hygiene audited (`npm run check:coinbase-credentials` exits 0; `/admin/credentials` shows no flagged value), and every credential is inside its rotation cadence — procedure in `docs/KEY_ROTATION.md`.
- [ ] Authenticated routes leak no data when unauthenticated; role checks hold (`/admin` requires `ADMIN`, granted by `ADMIN_WALLET_ADDRESSES`, the owner allowlist or the DB role).
- [ ] No API route handlers were added (mutations remain authenticated server actions).
- [ ] Dependency policy honoured: **no accepted production advisories** (see `DEPENDENCY_AUDIT.md`).

## 4. Network boundary (see `NETWORK_BOUNDARY.md`)

- [ ] Session mode is derived from the signed-in network and verified server-side.
- [ ] A practice-network session never reaches real execution; a mainnet session
      reaches only the real executor (or refuses) — never a silent fallback.
- [ ] Practice (`SANDBOX`) networks are **owner-only**: sign-in refuses a practice chain
      for a non-owner, and a practice session that exists anyway is rejected server-side
      by `getCurrentUser` (fail closed, not an error page).
- [ ] The owner-only practice-funds credit is gated on the owner allowlist; with
      `OWNER_WALLET_ADDRESSES` empty the action refuses and no owner surface renders.
- [ ] Mainnet execution is on by default; confirm a custody backend is configured and the kill switch (`MAINNET_EXECUTION_ENABLED=0`) is understood.
- [ ] No flow implies a real or guaranteed return; claims match the session's mode.
- [ ] Every market value carries its `source` label and an offline flag; fallbacks are labelled, never silent.
- [ ] News comes only from configured real RSS feeds; empty state shown when none respond; nothing fabricated.
- [ ] **Mainnet is real** — the execution gate routes a mainnet session to the custody-signed venue or refuses it, and never falls back to a practice flow. `MAINNET_EXECUTION_ENABLED=0` is the kill switch (`src/lib/execution.ts`).
- [ ] No custody key material is readable anywhere; the custody boundary deals only in a **key reference**, enforces the `CUSTODY_*` spend limits before signing, and fails closed when unconfigured. The wallet key stays in the provider (`coinbase-cdp`) — the app holds only API credentials (`src/lib/custody`, PHASE18-004).
- [ ] Wording policy holds: every figure is labelled by its source and mode; the word "guaranteed" never appears near a figure.

## 5. Product & UX

- [ ] Core journey works end to end: sign in with a wallet → deposit → start → force stop → withdraw → ticket → admin reply.
- [ ] Sign-in is wallet-only: no email or password field anywhere; the SIWE nonce is single-use (a replayed message is refused) and the domain is bound.
- [ ] Money maths in integer cents; withdrawal breakdown reconciles `initial + P/L − fee = total`.
- [ ] Every money action carries an idempotency key claimed in the same transaction as the mutation, and every money **form** renders one (`tests/money-forms.test.ts` is the structural guard); deposit/withdraw require an explicit server-side confirmation; a deposit above `DEPOSIT_CAP_USD` is refused (`src/lib/idempotency.ts`, PHASE18-006).
- [ ] An on-chain withdrawal destination is **verified**, not just shaped: 0x + 40 hex, not the burn address, and a valid EIP-55 checksum when mixed-case (`verifyEvmAddress`, re-checked at the custody boundary).
- [ ] Non-admin withdrawals go through the review queue: the amount is reserved at request time, only an admin decides, and a **declined request returns the amount to the user** (nothing can divert a user's reservation to another account — verified by `tests/integration/withdrawal-requests.test.ts`). A payout refused before signing is refunded; one that may have been broadcast stays held until an admin releases it.
- [ ] An **account hold** freezes withdrawals and trades with a required reason and an audit entry, and leaves the balance untouched (`/admin/withdrawals`).
- [ ] A declined request opens a bounded **dispute window** the user argues in a support thread; resolving it as misuse confirmed **bans** the account (sign-in refused, existing sessions treated as signed out) and freezes the balance. A ban, like a hold, **never moves a balance** — only an approval pays a destination (`tests/integration/withdrawal-requests.test.ts`).
- [ ] Compliance screening state is truthful: the default no-op reports screening as **off**; if `COMPLIANCE_PROVIDER=sanctions-list` is set, a sanctioned address is refused and an unreachable list refuses rather than allows.
- [ ] Loading, empty, error and success states present on every data surface.
- [ ] Responsive at 375 / 768 / 1440; tables scroll rather than squash; touch targets ≥44px.
- [ ] Single `h1` per page; every form control labelled; `:focus-visible` on interactive elements.
- [ ] `prefers-reduced-motion` honoured; live regions (`role="log"` / `role="alert"`) present.
- [ ] FAQ and support widget reachable from every page.

## 6. Data & operations

- [ ] Container image builds and the container starts as a non-root user (see `DEPLOYMENT.md`).
- [ ] Migrations applied (the `init` service / `npm run db:deploy`) and seeded; sample + admin accounts exist.
- [ ] If deploying on Postgres: schema push + seed verified against the target server version via `docker-compose.postgres.yml`.
- [ ] Migrations/backups: deploy datastore backed up; rollback path identified.
- [ ] Logs and errors are observable; no secrets are logged.
- [ ] Health of external read-only sources (CoinGecko, RSS) tolerated on failure via labelled fallback.

## 7. Documentation

- [ ] Root `README.md` and `apps/web/README.md` accurate (stack, routes, scripts, test counts).
- [ ] `docs/ARCHITECTURE.md`, `DATA_MODEL.md`, `PRODUCT_REQUIREMENTS.md` current.
- [ ] `docs/NETWORK_BOUNDARY.md`, `docs/DEPENDENCY_AUDIT.md`, `docs/DEPLOYMENT.md` and `docs/KEY_ROTATION.md` current.
- [ ] `.progress/*` checkpoint regenerated (`python3 scripts/progress_report.py`).

## 8. Publish gate — requires explicit user authorization

- [ ] User has explicitly authorized publishing.
- [ ] Then: create/confirm the target repo, confirm no secrets are staged, tag a release, and run the post-deploy smoke test below.

## 9. Post-deploy smoke test

- [ ] `GET /` returns 200 and renders the market snapshot.
- [ ] Log in as the seeded sample user and reach the authenticated dashboard.
- [ ] Open a support ticket as the user; triage it as the admin.
- [ ] Confirm the production server does **not** boot into an insecure session mode.
- [ ] Run the automated live smoke test against the deployment (verifies the
      database is reachable, the seeded account signs in, and no secret leaks):

      ```bash
      LIVE_URL=https://<deployment-url> npx playwright test tests/e2e/live.spec.ts
      ```

      It is skipped automatically when `LIVE_URL` is unset, so CI is unaffected.

---

### Waivers

| Item | Reason | Approved by | Date |
| --- | --- | --- | --- |
| — | — | — | — |
