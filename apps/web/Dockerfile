# syntax=docker/dockerfile:1
#
# Production image for Veylora Fintech AI Trading (simulated).
#
#   build:  docker build -t veylora-web ./apps/web
#   run:    docker run --rm -p 3000:3000 \
#             -e SESSION_SECRET="$(openssl rand -base64 32)" \
#             -v veylora-data:/app/data veylora-web
#
# See docs/DEPLOYMENT.md. Note: the `init` compose service (target `builder`)
# creates the schema and seeds sample data into the same /app/data volume.

# ---------------------------------------------------------------------------
# base — shared base image. Build and runtime MUST use the same Debian base so
# Prisma's generated engine target (debian-openssl-3.0.x) matches at runtime.
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------------------------------------------------------------------------
# deps — install dependencies from the lockfile (reproducible).
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder — generate the Prisma client and produce the standalone server.
# Also used as the `init` image for `prisma db push` + seeding (it has the
# full toolchain: prisma CLI and tsx).
# ---------------------------------------------------------------------------
FROM base AS builder
# Prisma needs the datasource env var present to load the schema when generating.
ENV DATABASE_URL="file:./build.db"
# Emit the self-contained .next/standalone server bundle consumed by the runner.
ENV NEXT_OUTPUT=standalone
# Datasource provider for the generated client. Keep the single schema.prisma as
# the source of truth and switch it here for Postgres deploys.
#   docker build --build-arg DB_PROVIDER=postgresql .
ARG DB_PROVIDER=sqlite
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN if [ "$DB_PROVIDER" = "postgresql" ]; then \
      sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma; \
      rm -rf prisma/migrations && mv prisma/migrations-postgres prisma/migrations; \
    fi \
 && npx prisma generate \
 && npm run build

# ---------------------------------------------------------------------------
# runner — minimal, non-root runtime serving .next/standalone.
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL="file:/app/data/prod.db"
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs \
 && mkdir -p /app/data \
 && chown -R nextjs:nodejs /app

# Standalone server bundle + static assets.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The Prisma client + query engine are not always traced into the standalone
# bundle, so copy them explicitly from the build stage.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000

# SQLite lives on a volume so it survives container replacement.
VOLUME ["/app/data"]

# Verify the HTTP server is listening (DB-independent, so it works before init).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('net').connect(process.env.PORT || 3000, '127.0.0.1').on('connect', () => process.exit(0)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
