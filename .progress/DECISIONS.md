# DECISIONS

- D1: Reuse `old/crypto-portal` (Next.js 16 + Prisma + wagmi) as the fintech base rather than rebuilding.
- D2: Store corpus state in a single SQLite database; per-repo mirrors under `data/database/repos/`.
- D3: Bulk extraction on the HDD, active development on the SSD.
- D4: No GitHub/Vercel publish until explicit authorization.
- D5: Session signing fails closed in production: `getSessionSecret()` throws when
  `SESSION_SECRET` is missing or <16 chars, and only falls back to an insecure dev
  value outside production. Verified live against `next start` (see SESSION_LOG).
- D6: The secret guard is evaluated lazily, when a token is signed or verified —
  not at boot. A request that neither sets nor reads a session never touches the
  secret, which is intentional. To exercise it, send a well-formed 3-part session
  cookie (`userId.expiry.signature`) to a session-reading route.
- D7: Dependency policy — a production advisory is never accepted (upgrade or
  disable before release); a build/dev-only advisory with no upstream fix may be
  accepted with a recorded rationale and a follow-up. `npm audit` is currently
  clean. The Prisma CLI chain is closed with a `deepmerge-ts@^8` override rather
  than downgrading to a mismatched CLI/client.
- D8: `docs/SIMULATION_BOUNDARY.md` is the authoritative real-vs-simulated
  reference and a release gate; `docs/RELEASE_CHECKLIST.md` is the go/no-go gate
  (centred on `npm run verify:deploy`). Publishing stays blocked until the user
  explicitly authorizes it.
- D9: Release target is a self-hosted Docker image (`apps/web/Dockerfile`, Next
  `output: "standalone"`, non-root) with a compose `init` service for schema/seed;
  `docs/DEPLOYMENT.md` documents it, including the PostgreSQL switch and TLS note.
- D10: Postgres deploys reuse the single `schema.prisma` — the Dockerfile rewrites
  the datasource provider from the `DB_PROVIDER` build arg (no schema fork), and
  `docker-compose.postgres.yml` supplies db + web + init. Verified end to end
  against a real PostgreSQL 18.6 server.
- D11: `output: "standalone"` is opt-in via `NEXT_OUTPUT=standalone` (set only by
  the Docker builder) so `next start` stays supported for local runs and the
  Playwright webServer. CI (`.github/workflows/ci.yml`) has verify, e2e and docker
  jobs; the e2e job must run `db:push` **and** `db:seed` (the journey needs the
  seeded admin account).
- D12: Project copy uses neutral wording throughout (code, comments, docs,
  prompts, DB task titles). The seeded end-user account is now
  `trader@aurelia.dev` / "Aurelia Trader"; the local dev DB was reset + re-seeded
  accordingly.
- D13: The final walkthrough gate is a dedicated fresh-session Playwright spec
  (`tests/e2e/walkthrough.spec.ts`) covering what journey + UI audit do not:
  public content, protected-route redirects with no content leak, real
  chart/news/instrument rendering, and no secret exposure in any page. e2e is now
  3 specs; the gate passed on the release build.
- D14: Schema changes are versioned as committed Prisma migrations, one set per
  provider (`prisma/migrations` = SQLite, `prisma/migrations-postgres` =
  PostgreSQL) because Prisma locks a migrations folder to a single provider. The
  Docker build swaps in the matching set via `DB_PROVIDER`; the compose `init`
  service and CI run `prisma migrate deploy` (not `db push`), and the integration
  suite applies the SQLite migrations so drift fails `npm test`.
- D15: Reviewed the two optional tasks and dropped both. PHASE10-002 (distributed
  router + Windows worker): no workload needs it — the corpus is extracted and the
  app is built and tested — and it adds moving parts plus a potential single point
  of failure, against the stated architecture. PHASE3-002 (prune HDD temporary
  extraction): the HDD has ~741 GB free, so there is no pressure, and the
  extraction root also holds the durable knowledge base (`data/scraped` symlinks
  into it), making the task's premise unsafe as written. The real disk pressure is
  the SSD at 93% (`data/database`, ~3.5 GB, lives there) — a separate concern.
- D16: `docs/DATA_MODEL.md` is kept honest by a test (`tests/docs.test.ts`) that
  parses `prisma/schema.prisma` and the doc's Core-entities table and asserts the
  model set and every documented field name still match the schema. Doc drift now
  fails `npm test` instead of shipping. Extended to routes (every path in the app
  README's route table must have a `page.tsx`), scripts (every `npm run` named in
  docs must exist in package.json; every pipeline script must exist on disk) and
  env vars (every variable the code reads must be documented, and every
  `.env.example` key must be documented).
- D17: Doc-sync checks (`npm run test:docs`) live in their own workflow,
  `.github/workflows/docs.yml`, which runs on every branch push and PR so drift is
  caught immediately on any branch. The heavier `ci.yml` jobs
  (verify/e2e/docker) stay main-only plus PR. The doc-sync tests also run inside
  `verify` via `npm test`.
- D18: CI has a `postgres` job that boots the Postgres override stack in Docker,
  applies the committed Postgres migrations + seed via the `init` service, waits
  for health, and runs a smoke query (`count(*)` on `User` and on finished
  `_prisma_migrations`). This exercises the Postgres provider + migrations path
  end to end in CI, not just locally. The exact smoke SQL was verified against a
  real PostgreSQL 18.6 server (2 users, 1 applied migration).
- D19: Product renamed from the provisional "Aurelia — AI Market Desk" slug to
  **Veylora Fintech AI Trading** (slug `veylora`). The rebrand is complete, not
  cosmetic: site title/nav/icon, seeded accounts (`trader@veylora.dev`,
  `admin@veylora.dev`), RSS user-agent, package name, Docker image/volume/compose
  names, the Postgres service user/db, CI images and smoke SQL, and the docs. The
  dev DB was reset + re-seeded.
- D20: Published to GitHub as a **public** repository,
  <https://github.com/shahabedin-malek/veylora-fintech-ai-trading>, with the user's
  explicit authorization (PHASE16-001). Vercel deployment is tracked separately as
  PHASE16-002 and remains blocked until a `VERCEL_TOKEN` and a managed Postgres
  `DATABASE_URL` are provided — serverless filesystems do not persist SQLite.
- D21: The first real CI run on GitHub caught two failures that local runs could
  not: (a) `postgres:18` refuses to start with its volume at
  `/var/lib/postgresql/data`, so the override now mounts `/var/lib/postgresql`;
  (b) the e2e specs read `SESSION_SECRET` from the gitignored `apps/web/.env`, so
  they now prefer the environment variable. Both are fixed and guarded by tests;
  CI is green on `main` (verify, docs, e2e, docker, postgres).
- D22: Deployed to Vercel (PHASE16-002) against a managed Postgres (Tiger Cloud),
  with `DATABASE_URL`, `SESSION_SECRET` and `DB_PROVIDER=postgresql` set as project
  env vars and the project's Root Directory set to `apps/web`. Migrations were
  applied and seeded from this machine using the direct connection. Verified live:
  the seeded account signs in against the production database and the app renders
  real market data. `tests/e2e/live.spec.ts` makes that repeatable and skips
  without `LIVE_URL`, so CI is unaffected.
- D23: Incident — a provider credentials download
  (`tiger-cloud-db-51231-credentials.txt`, containing the Postgres password) was
  accidentally committed and pushed to the public repo. It lived in the HEAD
  commit only, so the commit was rewritten and force-pushed, the file is now
  gitignored, and the remote serves 404 and no longer has the objects. Because a
  public push cannot be assumed unread, the database password is treated as
  compromised and must be rotated. Lesson: scan staged files for credential
  *files* by name/pattern, not just for inline secret-looking strings.
- D24: The production alias `veylora-fintech-ai-trading.vercel.app` is owned by a
  pre-existing Vercel project (`web`), a second deployment of the same app that
  lacks the database env vars and therefore runs a SQLite Prisma client — signing
  in there fails. This project's working production URL is
  `veylora-fintech-ai-trading-black.vercel.app`; the plain domain would need to be
  moved off the `web` project (user's call).
- D25: Leaked Postgres password rotated via the Tiger CLI
  (`tiger service update-password --auto-generate`, authenticated non-interactively
  with `tiger auth login --public-key/--secret-key`). Verified: the old password
  now fails (`FATAL: password authentication failed`) and the new one works; the
  new `DATABASE_URL` was written to `.env.deploy` and PATCHed into Vercel, then the
  project was redeployed and the live smoke test re-passed. Already-committed
  passwords should be rotated, not just deleted from history.
- D26: Two traps worth remembering when using the Tiger CLI: (a) a hand-copied API
  public key that was one character short produced a generic "Invalid or missing
  authentication credentials" — the same message as a genuinely bad key, so verify
  the length before assuming wrong credentials; (b) `tiger db uri` returns a URI
  **without** the password, so building `DATABASE_URL` from it silently breaks
  production — the full string is in `tiger service get <id> --with-password`.
- D27: The Tiger MCP server is registered for VS Code
  (`~/.config/Code/User/mcp.json`) and the GitHub Copilot CLI
  (`~/.copilot/mcp-config.json`). The Gemini CLI install was skipped because the
  `gemini` binary is not on PATH; re-run `tiger mcp install gemini` once it is.


_Last rendered: 2026-10-08 17:21:59 UTC_
