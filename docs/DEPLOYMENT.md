# Deployment Notes

Concrete target for `RELEASE_CHECKLIST.md`: a **self-hosted Docker image** of the
Next.js app with a Prisma datastore. Read `SIMULATION_BOUNDARY.md` first — the
deployed app is still **simulated**: no real funds, no mainnet, no live orders.

> **Publishing is blocked.** Nothing here authorizes a GitHub push or a Vercel
> deploy; that needs explicit user approval (`PHASE16-001`).

## The image

`apps/web/Dockerfile` is a three-stage build:

| Stage | Purpose |
| --- | --- |
| `deps` | `npm ci` from the lockfile (reproducible). |
| `builder` | `prisma generate` + `npm run build` → `.next/standalone`. Also the image used for the one-off schema/seed task. |
| `runner` | Node 24 slim, **non-root**, serving only the standalone bundle + Prisma engine. |

The builder sets `NEXT_OUTPUT=standalone`, which `next.config.ts` maps to
`output: "standalone"`, so the runner ships a self-contained `server.js` instead
of the full toolchain. Local runs leave it unset so `next start` stays supported
(as the Playwright web server relies on).

> ⚠️ **Base image must match.** Prisma detects its engine target at build time
> (`debian-openssl-3.0.x` on `node:24-bookworm-slim`). Build and run from the
> **same** base or the engine will not load. To target a different libc, add a
> matching `binaryTargets` to the Prisma generator.

## Prerequisites

- Docker Engine 24+ with Compose v2.
- A strong `SESSION_SECRET` (≥16 chars; 32+ recommended): `openssl rand -base64 32`.
- A writable volume for the SQLite file (the compose file defines `veylora-data`).

## Environment variables

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | `file:/app/data/prod.db` | SQLite path, or a Postgres URL (see below). |
| `SESSION_SECRET` | **yes** | — | In production the app **fails closed** if missing/weak. |
| `MARKET_PROVIDER` | no | `auto` | `auto` \| `coingecko` \| `simulated`. |
| `NEWS_FEEDS` | no | real public defaults | Comma-separated RSS URLs; empty ⇒ Cointelegraph / Investing.com / BBC Business. |
| `MIN_TRADE_USD` | no | `20` | Simulated minimum trade. |
| `WITHDRAW_FEE_BPS` | no | `100` | Simulated fee, basis points (100 = 1%). |
| `PORT` | no | `3000` | Container listen port. |

No market-data or wallet credentials are needed: CoinGecko's public API is
keyless, news is public RSS, and the wallet is simulated.

## Quick start (Docker Compose)

```bash
cd apps/web
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env   # read for substitution

docker compose run --rm init      # 1. apply migrations + seed sample/admin accounts
docker compose up -d              # 2. start the app
open http://localhost:3000        #    trader@veylora.dev / password123
```

`init` builds the `builder` stage and runs `npm run db:deploy && npm run db:seed`
(`prisma migrate deploy`) against the shared `veylora-data` volume. The seed is
idempotent upserts, so you can run it again any time.

Stop: `docker compose down` (add `-v` to also delete the database volume).

## Quick start (plain Docker)

```bash
cd apps/web
docker build -t veylora-web .

# apply migrations + seed (reuses the builder stage's toolchain)
docker run --rm \
  -e DATABASE_URL=file:/app/data/prod.db \
  -v veylora-data:/app/data \
  veylora-init:local sh -c "npm run db:deploy && npm run db:seed"

docker run --rm -d --name veylora \
  -p 3000:3000 \
  -e SESSION_SECRET="$(openssl rand -base64 32)" \
  -v veylora-data:/app/data \
  veylora-web
```

## PostgreSQL (recommended for real deployments)

SQLite is ideal for local use; Postgres is better for concurrency and backups.
`docker-compose.postgres.yml` is an **override** that adds a Postgres service and
rebuilds the app image with the `postgresql` datasource provider — no schema file
is duplicated:

```bash
cd apps/web
export POSTGRES_PASSWORD="$(openssl rand -hex 16)"
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" >> .env   # read for substitution

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.postgres.yml"
$COMPOSE run --rm init      # apply migrations + seed sample accounts
$COMPOSE up -d              # start web + db
```

How the provider switch works: the Dockerfile accepts a `DB_PROVIDER` build arg,
rewrites the **single** `prisma/schema.prisma` during `prisma generate`, and swaps
in the matching migrations directory — so the schema stays the one source of
truth. To do it by hand instead:

1. In `prisma/schema.prisma`, change `provider = "sqlite"` to `"postgresql"`.
2. Point `DATABASE_URL` at Postgres and rebuild.

The Postgres override keeps the base file's unused SQLite volume mounted but
empty; only `pg-data` is used.

> **Volume path:** `pg-data` is mounted at **`/var/lib/postgresql`**, not
> `/var/lib/postgresql/data`. From `postgres:18` the image stores data in a
> version-specific subdirectory and **refuses to start** if the volume is
> mounted at the old `…/data` path. This was caught by the CI `postgres` job and
> is now guarded by `tests/deployment.test.ts`.

### Migrations

Prisma locks a migrations directory to **one** provider, so the project commits
one set per provider and the build selects the right one:

| Directory | Provider | Used by |
| --- | --- | --- |
| `prisma/migrations/` | SQLite | local dev, CI, the default image |
| `prisma/migrations-postgres/` | PostgreSQL | images built with `DB_PROVIDER=postgresql` |

The Dockerfile renames `migrations-postgres` to `migrations` when building for
Postgres. The `init` service then applies them with `prisma migrate deploy`, so
the deployed schema is reproducible rather than `db push`-drift.

Create new migrations with `npm run db:migrate` (`prisma migrate dev`) against the
provider you are targeting, and **commit both sets** so SQLite and Postgres stay
in step.

## TLS and reverse proxy

Terminate TLS in front of the container (nginx, Caddy, Traefik, or a cloud LB) and
forward to `web:3000`. The session cookie is `httpOnly`, `sameSite=lax`, and
**`secure` when `NODE_ENV=production`** — so serve over **HTTPS**:

- Browsers treat `http://localhost` as a secure context, so the quick start works
  locally. On a remote host over plain HTTP, the login cookie will not persist —
  put it behind HTTPS.
- Set `X-Forwarded-Proto`/`Host` correctly so redirects and cookies behave.

## Operations

- **Health:** `docker compose ps` shows the container health (a TCP check on the
  listen port). The checklist's post-deploy smoke test is the deeper check.
- **Logs:** `docker compose logs -f web`.
- **Upgrade:** rebuild (`docker compose build web`), then `docker compose up -d`.
  The data volume persists across replacements.
- **Rollback:** keep the previous image tag (`veylora-web:<version>`) and
  `docker compose up -d` against it; the schema is backward-compatible for the
  current models.
- **Backups:** SQLite — copy `prod.db` from the volume (`docker run --rm -v
  veylora-data:/d alpine cp /d/prod.db /d/prod.db.bak`); Postgres — `pg_dump`.

## Security notes

- The container runs as a **non-root** user (`nextjs`, uid 1001).
- Secrets are supplied at runtime via env vars; nothing is baked into the image
  (`.dockerignore` excludes `.env*`).
- Production **fails closed**: with a missing/weak `SESSION_SECRET`, session
  signing throws rather than falling back to an insecure default.
- Wallet is `kind: "SIMULATED"`; mainnet stays disabled. Do not wire real funds.
- Keep the base image patched; rerun `npm audit` on upgrades (see
  `DEPENDENCY_AUDIT.md`).

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Unable to load the Prisma query engine` | build/run base mismatch | rebuild from the same base, or add a matching `binaryTarget`.
| Provider mismatch on Postgres (`sqlite` client against Postgres) | image built without `DB_PROVIDER=postgresql` | use `docker-compose.postgres.yml`, or rebuild with `--build-arg DB_PROVIDER=postgresql`.
| `migrations were created with provider X` | migrations set does not match the datasource | build with the matching `DB_PROVIDER` (the build swaps the migrations directory).
| `The table ... does not exist` | `init` not run | `docker compose run --rm init` |
| Login "does nothing" on a remote host | `Secure` cookie over HTTP | serve over HTTPS |
| `SESSION_SECRET must be set to at least 16 characters` | secret missing/weak | set a strong `SESSION_SECRET` and restart |
| Port already in use | another service on 3000 | change the published port (`"8080:3000"`) |

## Verification status

The Dockerfile, `.dockerignore`, and compose files were authored in an environment
**without Docker installed**, so the image itself has **not been built here**. The
build-side assumptions it relies on are verified locally: building with
`NEXT_OUTPUT=standalone` produces `.next/standalone/server.js` (with the Prisma
client traced in), and the full suite
(`tsc`, 84 Vitest tests, Playwright, `next build`) passes.

**Migrations are verified against both providers.** On a fresh SQLite file and on
an ephemeral PostgreSQL 18.6 server, `prisma migrate deploy` applied the committed
migrations (13 tables each), the client was generated, and the real
`prisma/seed.ts` wrote 2 users, 2 wallets, 2 customers, 1 ticket and 3 messages —
all confirmed by SQL. The integration suite also applies the SQLite migrations on
every run, so drift is caught by `npm test`.

See the checklist evidence below.

First *image* build should still be treated as a smoke check on a Docker host.
