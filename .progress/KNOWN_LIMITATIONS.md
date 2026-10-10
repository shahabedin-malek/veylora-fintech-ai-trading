# KNOWN LIMITATIONS

- Corpus extraction runs single-process on this 6-core AMD FX-6100; concurrency
  tuning is deliberately conservative to protect the ~15 GB SSD and 17 GB RAM.
- Bulk extraction data lives on the HDD at `/mnt/private-ai-data/trading-ai-extractions`.
- No GPU on this Linux host; GPU-heavy tasks must target the Windows machine or
  remain CPU-only.
- Nested-archive recursion is limited to depth 1 by default.
- Text content is truncated at 200 KB per file in the DB and FTS index.
- The distributed Windows worker is not yet connected (checked in Phase 10).
- There is no background-job system in the app, so the "background tasks" test
  category does not apply; long-running work would need to be added first.
- `npm audit --audit-level=high` is clean (exit 0), but `npm audit` reports **9
  moderate** advisories — all one chain rooted in `uuid` <11.1.1, pulled in by
  `@metamask/sdk` → `@wagmi/connectors` (wallet sign-in). It is unreachable from
  this app and its only fix is the semver-major `wagmi` 3, which RainbowKit 2 does
  not support, so it is an accepted moderate recorded in
  `docs/DEPENDENCY_AUDIT.md`. Phase 15-002 did clear the earlier critical/high set:
  `next` upgraded to 16.4.0, `vitest` to 5, and a `deepmerge-ts@^8` override closes
  the Prisma CLI chain.
- The production session-secret guard is lazy: it triggers only when a session
  token is signed or verified. A route that never reads the session (e.g. `/`)
  still responds normally with a weak secret; login/session routes fail closed.
- Shell environment variables take precedence over `apps/web/.env` at runtime, so
  an operator can override the file value by exporting `SESSION_SECRET`.
- The production Docker image has not been built in this environment (Docker is
  not installed here); the first build should be smoke-checked on a Docker host.
  See `docs/DEPLOYMENT.md`.
- Sign-in is wallet-based (SIWE), so the e2e suite cannot complete a real sign-in:
  CI has no wallet extension and no demo wallet is provided (a deliberate choice).
  The e2e specs mint a session cookie with the app's own signer for a seeded or
  throwaway account, and `tests/e2e/login-wallet.spec.ts` asserts the sign-in
  surface. The SIWE signature path itself is covered by the integration suite with
  real signatures (valid, replayed, wrong domain, wrong signer, unknown nonce).
- The WalletConnect/QR connector is only offered when
  `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set: with a placeholder, Reown rejects
  the origin and every page logs a console error. Empty is a supported mode
  (injected wallets only).
- Real execution is **on by default**: `REAL_EXECUTOR_IMPLEMENTED` is true and the
  Coinbase EVM swap venue adapter can move real funds once custody is configured and
  the kill switch is clear. It is refused (never replaced by a practice flow) whenever
  custody is unavailable or `MAINNET_EXECUTION_ENABLED=0`, and a practice (`SANDBOX`)
  session never reaches a real path (docs/NETWORK_BOUNDARY.md).
- Custody (`PHASE18-004`) is implemented: `src/lib/custody/` enforces
  per-transaction/daily spend limits and resolves a signer from the `coinbase-cdp`
  backend (Coinbase CDP Server Wallets — the wallet key stays in the provider; the app
  holds only API credentials), so `REAL_CUSTODY_IMPLEMENTED` is `true`. It fails
  closed when unconfigured, so a deployment without the `CDP_*` credentials (and
  `CDP_WALLET_SECRET` in particular) refuses every mainnet money action. Key
  rotation/audit trail, a persisted rolling spend ledger (today
  `authorizeCustodySpend()` takes `spentTodayCents` from the caller) and compliance
  (KYC/AML, sanctions, jurisdiction gating) remain follow-ups.
- The wallet-auth migration is **breaking**: it drops `User.email`/`passwordHash`
  and requires `walletAddress`, so it cannot carry existing accounts. Any existing
  deployment (including the Vercel + Tiger Cloud one) must run
  `npm run db:deploy` and `npm run db:seed` — and will lose its old accounts —
  before the new code is served. Do not deploy the wallet-auth build to an
  un-migrated database.
