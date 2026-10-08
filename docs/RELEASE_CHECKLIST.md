# Release Readiness Checklist

Go / no-go gate for shipping **Veylora Fintech AI Trading**. Every box must be
checked, or the item must carry an explicit waiver with a recorded reason. This is
the release companion to `SIMULATION_BOUNDARY.md` and `DEPENDENCY_AUDIT.md`.

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
- [ ] Node.js 24 LTS on the target host.

## 2. Automated gates (run `npm run verify:deploy`)

- [ ] `npm run typecheck` — `tsc --noEmit` clean.
- [ ] `npm test` — all **84** Vitest tests pass (unit 21, error-recovery 12, deployment 12, docs 10, integration 29).
- [ ] `npm run test:e2e` — Playwright: full-journey + UI audit (13 routes × 3 widths) + fresh-session walkthrough pass.
- [ ] `npm run build` — production build succeeds; expected routes present.
- [ ] `npm audit` — **0 vulnerabilities**.
- [ ] UI audit report shows **0 horizontal overflow / 0 contrast failures / 0 console errors** (`apps/web/reports/ui-audit.md`).
- [ ] CI is green on the release commit (`ci.yml`: verify, e2e, docker, postgres — main/PR; `docs.yml`: docs — every branch).

## 3. Security

- [ ] Production **fails closed** with a weak/missing `SESSION_SECRET` (returns an error on a session-signing request, not a silent insecure fallback).
- [ ] Session cookie is `httpOnly`, `sameSite=lax`, `secure` in production.
- [ ] Secret scan clean: no private keys, AWS/GitHub/OpenAI tokens, or provider credentials in `src/**` (asserted by `tests/deployment.test.ts`).
- [ ] Authenticated routes leak no data when unauthenticated; role checks hold (`/admin` requires `ADMIN`).
- [ ] No API route handlers were added (mutations remain authenticated server actions).
- [ ] Dependency policy honoured: **no accepted production advisories** (see `DEPENDENCY_AUDIT.md`).

## 4. Simulation boundary (see `SIMULATION_BOUNDARY.md`)

- [ ] All trading is paper trading; no flow implies a real or guaranteed return.
- [ ] Every market value carries its `source` + `simulated` flag; fallbacks are labelled, never silent.
- [ ] News comes only from configured real RSS feeds; empty state shown when none respond; nothing fabricated.
- [ ] Wallet is `kind: "SIMULATED"`; **mainnet remains disabled**.
- [ ] Wording policy holds: "simulated P/L", "paper trade", "simulated platform fee"; the word "guaranteed" never appears near a figure.

## 5. Product & UX

- [ ] Core journey works end to end: register → login → deposit → start → force stop → withdraw → ticket → admin reply.
- [ ] Money maths in integer cents; withdrawal breakdown reconciles `initial + P/L − fee = total`.
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
- [ ] `docs/SIMULATION_BOUNDARY.md`, `docs/DEPENDENCY_AUDIT.md` and `docs/DEPLOYMENT.md` current.
- [ ] `.progress/*` checkpoint regenerated (`python3 scripts/progress_report.py`).

## 8. Publish gate — requires explicit user authorization

- [ ] User has explicitly authorized publishing.
- [ ] Then: create/confirm the target repo, confirm no secrets are staged, tag a release, and run the post-deploy smoke test below.

## 9. Post-deploy smoke test

- [ ] `GET /` returns 200 and renders the market snapshot.
- [ ] Log in as the seeded sample user; start and force-stop a simulated session.
- [ ] Open a support ticket as the user; triage it as the admin.
- [ ] Confirm the production server does **not** boot into an insecure session mode.

---

### Waivers

| Item | Reason | Approved by | Date |
| --- | --- | --- | --- |
| — | — | — | — |
