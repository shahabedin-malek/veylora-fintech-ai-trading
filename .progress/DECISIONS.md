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
  accepted with a recorded rationale and a follow-up. `npm audit --audit-level=high`
  is clean (exit 0); the only accepted finding is the unreachable `uuid` moderate
  chain from wallet sign-in (9 chained entries, one root cause — see
  `docs/DEPENDENCY_AUDIT.md`). The Prisma CLI chain is closed with a
  `deepmerge-ts@^8` override rather than downgrading to a mismatched CLI/client.
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
- D28: **Roadmap change (user-directed): the product is no longer simulation-only.**
  Sign-in becomes **wallet-based** (SIWE / EIP-4361) and the signed-in network
  decides the mode: a **testnet** wallet runs simulated paper flows, a **mainnet**
  wallet runs real ones — read on every action from the server-side session, never
  from a client flag. `docs/SIMULATION_BOUNDARY.md` is superseded by
  `docs/NETWORK_BOUNDARY.md`, and `docs/PROJECT_PLAN.md` gains Phase 18 with tasks
  `PHASE18-001` … `PHASE18-009`. This is a re-architecture, not a flag flip: it needs
  wallet auth, network classification, custody (KMS/HSM — never a private key in
  config), a real execution venue, irreversibility UX and compliance. **Mainnet
  execution stays disabled until those land**, and the user-facing copy must not
  claim real trading before then. The existing "source contains no `MAINNET`"
  invariant is deliberately kept until `PHASE18-008` replaces it with network-gating
  tests, so the current build cannot accidentally ship a real-money path.
- D29: The four open questions from the D28 roadmap change are now **closed and
  recorded** in `docs/NETWORK_BOUNDARY.md` ("Recorded design decisions") and
  `docs/API_CREDENTIAL_REQUIREMENTS.md`, and reflected in the Phase 18 task
  titles: (1) **what is real** = both real on-chain transfers *and* real
  venue-API trading; (2) **custody** = a **custodial hot wallet** whose keys live
  in a KMS/HSM with spend limits (the non-custodial `user-signs-every-transfer`
  model was rejected — no private key in config, repo or logs); (3) **chains** =
  multiple, selected via `wagmi` (Ethereum + Sepolia, Base + Base Sepolia,
  Arbitrum + Arbitrum Sepolia); (4) **email/password is removed entirely** —
  wallet connect + SIWE is the only sign-in, admins included, with no password
  fallback. These are decisions, not options: reversing one is a roadmap change.
- D30: **PHASE18-001 implemented (wallet connect + SIWE replace email/password).**
  Details worth keeping:
  - **No `siwe` package.** It requires `ethers` purely to recover an address; the app
    already has viem. Parsing uses `@spruceid/siwe-parser` (the canonical EIP-4361
    parser) and verification uses viem's `verifyMessage` (`src/lib/siwe.ts`).
  - **Single-use nonces in the database** (`AuthNonce`): issued before the signature
    is requested and consumed with one atomic `updateMany` *before* verification, so
    a captured message cannot be replayed and a failed attempt cannot be retried
    (`docs/DATA_MODEL.md`).
  - **Session carries the chain.** Token format is now
    `userId.chainId.expiry.signature`. The primitives moved to `src/lib/session-token.ts`
    (no framework imports) so the e2e suite mints real tokens from the same code
    instead of re-implementing the HMAC.
  - **Identity is the wallet address** (`User.walletAddress`, unique, lower-cased).
    `email` + `passwordHash` are dropped and `Customer.email` became optional — a
    deliberate breaking migration for both providers, so the database must be reset
    and re-seeded (`.progress/KNOWN_LIMITATIONS.md`, migration comments).
  - **RainbowKit + WalletConnect, explicit connector list** (not `getDefaultConfig`),
    because the kitchen-sink default pulls wagmi's Base Account connector. Two build
    consequences, both recorded in `docs/DEPENDENCY_AUDIT.md`: `@x402/*` (optional
    peers of `@coinbase/cdp-sdk`) are ignored via `turbopack.resolveAlias` rather than
    installed, and `ws` + `decode-uri-component` are pinned by `overrides`. One
    `uuid` moderate is accepted (unreachable, no non-binding fix).
  - **WalletConnect is offered only with a real project id.** A placeholder does not
    fail silently: Reown rejects the origin (403) and every page logs a console
    error, which broke the e2e console-error assertions. Empty id ⇒ injected wallets
    only, no network calls.
  - **RainbowKit is themed** with the app's dark palette + accent. Its default blue
    on white text is 4.18:1 and failed the UI audit's WCAG AA contrast check.
  - **Admin access = both** (D29): `ADMIN_WALLET_ADDRESSES` grants ADMIN at sign-in,
    and an existing DB role is preserved.
  - **No demo wallet** (per the user): CI has no wallet extension, so the e2e specs
    mint a session cookie for a seeded/throwaway account and a new
    `login-wallet.spec.ts` asserts the sign-in surface; the *signature* path is
    covered by the integration suite with real signatures (valid, replayed, wrong
    domain, wrong signer, unknown nonce, chain recorded).
  - **Execution is still simulated, deliberately.** Every wallet is still provisioned
    `kind: "SIMULATED"`, there is no `MAINNET` path in `src/`, and
    `tests/deployment.test.ts` still asserts that — `PHASE18-002/003` introduce the
    class and the gate, and `PHASE18-008` replaces the invariant with the gating
    tests, exactly as D28 planned.
  - Seeded accounts are now **wallet addresses with fixed ids**
    (`prisma/seed-accounts.ts`): `0x1111…1111` (user) and `0x2222…2222` (admin), so a
    session can be minted for a known account without querying the database first.
- D31: **Per-chain wallet RPC endpoints wired from the user's Alchemy key.**
  `NEXT_PUBLIC_WALLET_RPC_URL_{ETHEREUM,SEPOLIA,BASE,BASE_SEPOLIA,ARBITRUM,ARBITRUM_SEPOLIA}`
  are read in `src/lib/wagmi.ts` (`transportFor`), falling back to viem's default
  public RPC when unset. Notes:
  - The key came from `Alchemy.txt` (a 573 KB saved Alchemy chat export in the repo
    root that embeds it). Nine candidate strings appear in that file; only **one** is
    a live key — established by probing each with a read-only `eth_blockNumber` call
    rather than guessing (the rest are doc placeholders). All six networks respond
    for it.
  - The key was written **only** to the gitignored `apps/web/.env`. `Alchemy.txt` is
    now gitignored too, so it cannot be committed by accident.
  - These are deliberately `NEXT_PUBLIC_*`: wagmi runs in the browser, so the URL
    (and the key in it) ships to every visitor. That is inherent to browser-side RPC
    — the mitigation is an origin allowlist + rate limits at the provider, and never
    a custody/signing key in one of these. Documented in
    `docs/API_CREDENTIAL_REQUIREMENTS.md` and `docs/DEPLOYMENT.md`.
  - `NEXT_PUBLIC_*` is inlined at **build** time, so adding or changing one needs a
    rebuild (and a Vercel env var + redeploy). Verified: all six endpoints appear in
    the built client bundle.
- D32: **Wallet-auth build deployed to production**, after migrating and reseeding
  the managed Postgres (Tiger Cloud). How it was done, and what to repeat next time:
  - The Postgres migration is **breaking** (`DELETE FROM "User"` + `ADD COLUMN
    "walletAddress" TEXT NOT NULL`). Before running it, the exact SQL was executed
    against the live database **inside a transaction and rolled back** (Postgres has
    transactional DDL) to prove it applies to the real schema and data; the rollback
    was verified to leave the 2 existing accounts intact. Prefer this over a dry-run
    on a different server.
  - Applied with `prisma migrate deploy` against a *scratch* schema directory
    (provider=postgresql) so the checked-in `schema.prisma` is never modified. A
    scratch dir **outside** the project does not work: Prisma fails to resolve its
    own CLI there. Seeding used `select-provider.mjs` to switch the provider in
    place, then switched back and verified the file hash was **identical**.
  - Vercel env: added `NEXT_PUBLIC_WALLET_RPC_URL_*` (6) and
    `ADMIN_WALLET_ADDRESSES` to production/preview/development.
    `SESSION_SECRET`/`DATABASE_URL`/`DB_PROVIDER` were already set.
    `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is deliberately unset (no real id) ⇒
    injected-wallet sign-in only, with no Reown 403s.
  - The deploy had to run from the **repository root** because the project's Root
    Directory is `apps/web` (deploying from `apps/web` looks for `apps/web/apps/web`).
    A root `.vercelignore` was added so the ~20 GB of git-ignored corpus is never
    uploaded; the CLI link was mirrored to a root `.vercel/` (git-ignored).
  - Verified: production alias serves 200, `/login` renders the wallet sign-in
    surface with no secret leakage, `tests/e2e/live.spec.ts` passes **2/2**
    (including a minted session reaching DB-backed `/dashboard`, `/history`,
    `/markets`), and all six Alchemy endpoints are present in the deployed client
    bundle.
  - Note: an anonymous `curl /dashboard` returns **200 with the app shell and no
    protected content** — Next streams the redirect client-side, so a browser (and
    the live spec) lands on `/login`. Not a data leak, but don't read a 200 here as
    "the route is public".
  - Security: the Vercel CLI's npm wrapper **echoed the `--token` flag** into the
    session transcript (it prints the resolved argv). Later commands used the
    `VERCEL_TOKEN` environment variable instead, which the CLI reads natively and
    which is never echoed. The exposed Vercel token should be rotated.
- D33: **WalletConnect/Reown project id wired, so the QR/mobile connector ships.**
  The id came from `reown-info.txt` (a 179 KB saved Reown dashboard/docs export in
  the repo root). Notes:
  - Only the **Project ID** (`Project ID:` line, 32 hex chars) was used, and only as
    the public `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — written to the gitignored
    `apps/web/.env` and added to Vercel for production/preview/development.
  - That same file also contains a **Dashboard API key** and an **AppKit Auth API
    key**. Those were deliberately **not** added anywhere: they are manage-the-project
    credentials, not browser values. `reown-info.txt` is now gitignored (`reown*.txt`)
    and should be moved out of the repository; if either key was shared anywhere,
    rotate it.
  - This flips `walletConnectEnabled` in `src/lib/wagmi.ts` to true, so the
    WalletConnect connector is now constructed (previously omitted precisely because
    a placeholder id makes Reown 403 on every page). Verified locally with **no**
    Reown/origin console errors, so no origin allowlist change was needed.
  - New tests assert the goal rather than the config: `login-wallet.spec.ts` opens
    the connect modal and requires *WalletConnect* to be offered (skipped when no id
    is configured), and `live.spec.ts` does the same against the real deployment —
    which also proves Reown accepts the production origin.
  - Deployed and verified: the id is inlined in the deployed client bundle, the live
    suite passes **2/2**, and local `tsc`/`vitest` stay clean (89/89).
- D34: **PHASE18-002 implemented (chainId → TESTNET/MAINNET classification).**
  `src/lib/network.ts` is the single source of truth: a `SUPPORTED_CHAINS` table
  (`chainId` → name/class) plus `classifyChain()`, which returns `null` — never a
  default class — for an unsupported chain. Notes:
  - The class is **derived, not stored**: `getSessionMode()` in `src/lib/session.ts`
    classifies the signed session `chainId` on every read and hands it to
    `getCurrentUser().network`. There is no client-supplied flag anywhere, and
    because it is recomputed from the signed value it cannot drift.
  - **Fail closed.** `verifyCurrentSession()` returns `null` (⇒ "signed out") when the
    session's chain is no longer supported, rather than an ambiguous class. Sign-in
    also refuses an unsupported `chainId` up front (`verifySiweAction`).
  - `dashboard` now renders the active mode from the session, so the class is visible
    to the user rather than implicit.
  - `tests/network.test.ts` (8 tests) covers classification, the no-default-for-
    unknown-chain rule, and the fail-closed session read; the integration suite
    gained session-binding tests. Suite is now **100/100**; `tsc` clean; e2e 5 passed.
  - **Deliberately unchanged:** execution still does not branch on the class and every
    wallet is still `kind: "SIMULATED"`, so the app remains simulated in effect. The
    enforcement gate is `PHASE18-003`, and `deployment.test.ts` keeps asserting the
    "no `MAINNET` in `src/`" invariant until `PHASE18-008` replaces it.
- D35: **PHASE18-003 and PHASE18-008 implemented (server-side execution gate +
  network-gating tests).** `src/lib/execution.ts` is the single real-vs-simulated
  decision point:
  - `executionModeFor(network)` names the path (`TESTNET` → `SIMULATED`, `MAINNET` →
    `REAL`), so a caller cannot leave it implicit.
  - `executionGate(network)` resolves whether a value-bearing action may run, and
    `requireExecution(network)` **throws** `ExecutionUnavailableError` otherwise —
    modelled on the existing `requireUser`/`requireAdmin` idiom, so a MAINNET
    session can never *silently* fall back to simulated flows.
  - **Fail closed, twice over.** `MAINNET_EXECUTION_ENABLED=1` is an opt-in gate,
    and `REAL_EXECUTOR_IMPLEMENTED` is deliberately `false`, so a mainnet session is
    refused with **and** without the flag. There is no configuration in which this
    build moves real money.
  - Wired into the money paths in `src/lib/actions.ts` (`depositAction`,
    `withdrawAction`, `startTradingAction`, `stopTradingAction`). Wallets stay
    `kind: "SIMULATED"`; no real custody or venue exists.
  - **The old invariant is gone (`PHASE18-008`).** `tests/deployment.test.ts` no
    longer greps `src/` for the absence of the `MAINNET` token (a proxy that the
    gate now makes meaningless). It asserts the *property* instead, and new
    `tests/execution.test.ts` (8 tests) plus an integration test (a mainnet session
    is refused and **writes nothing**; a testnet control still deposits) carry it.
    Suite: **110/110**, 8 files. e2e 6 passed / 2 skipped; `tsc` clean; build 13
    routes.
  - The env var name matches the one already planned in
    `docs/API_CREDENTIAL_REQUIREMENTS.md`; it is now documented as implemented and
    added to `.env.example` (empty ⇒ disabled).
  - **Deliberately still open:** custody (`004`), real venues (`005`),
    irreversibility UX (`006`), compliance (`007`) and the copy/FAQ rewrite (`009`)
    — all need keys, infrastructure or legal decisions, so mainnet execution
    remains disabled and the app stays simulated in effect.
- D36: **PHASE18-009 (user-facing copy + FAQ for the wallet-typed model).** The
  landing copy and the sign-in surface were already wallet-typed (no email/password,
  "sign in with wallet", supported networks in the logo loop), so the remaining gap
  was the FAQ. `/faq` gained a seventh entry, **"Which wallet should I connect?"**,
  that states the network sets the mode, a testnet wallet runs the simulated desk,
  and a mainnet wallet is **refused** for money actions until real execution ships
  — i.e. it documents the `PHASE18-003` gate in plain language instead of leaving a
  mainnet user with a bare error. FAQ count in `PRODUCT_REQUIREMENTS.md` updated
  (6 → 7). Verified: `tsc` clean, 110/110 unit/integration, build 13 routes, e2e 6
  passed / 2 skipped including the UI audit across `/faq` at 3 widths.
- D37: **PHASE18-006 groundwork landed — spend safety on the money paths.** Marked
  `IN_PROGRESS`, not done: this is the simulation-safe half of the task. What
  landed:
  - **Idempotency keys.** New `IdempotencyKey` model (unique on
    `userId, scope, key`) + `src/lib/idempotency.ts`. `runOnce(userId, scope, key,
    fn)` claims the key **inside the same interactive transaction** as the
    movement it guards, so claim + effect are atomic and a replay throws
    `DuplicateOperationError` (treated as a no-op) instead of applying twice. A
    sequential replay is caught by a pre-check, with the unique constraint as the
    race guarantee. Keys live in the database, not memory, because a real desk is
    multi-instance. Applied to all four money actions (`deposit`, `withdraw`,
    `start_trading`, `stop_trading`); the forms send an explicit key (a
    server-rendered `crypto.randomUUID()`, or a `useState`-stable one in the
    client `StopWithWarning` dialog).
  - **Explicit spend confirmation.** Deposit and withdrawal require `confirm=on`
    and it is checked **server-side** — the `required` checkbox is a convenience,
    not the guard. An unconfirmed call writes nothing (asserted in tests).
  - **Spend cap.** `DEPOSIT_CAP_USD` (default 10000) refuses an oversized deposit
    outright rather than trimming it.
  - New `prisma/migrations{,-postgres}/20261009120000_spend_safety/`; the SQLite
    one is exercised by `tests/integration/global-setup.ts` (`migrate deploy`), so
    drift breaks `npm test`. **The Postgres migration is written but not verified
    here** (no Docker on this host) — the CI `postgres` job covers it.
  - **Test churn worth knowing:** the integration `form()` helper now defaults
    `confirm: "on"` (tests act as a confirmed user; pass `{ confirm: "" }` for the
    negative path), and `withdrawAction()` gained an optional `FormData` so it can
    read the confirmation. The journey e2e ticks both new checkboxes.
  - **Concurrency coverage.** Two tests race the *same* key (`Promise.allSettled`)
    for deposit and withdrawal and assert **at most once**: one balance change, one
    ledger row, one transaction, one notification and one key row. They deliberately
    do not assert *which* submit wins — the guarantee is "at most once", not "first
    wins" — and a loser is allowed to reject (a serialized SQLite writer can surface
    contention) because a refusal is still safe. Verified stable over repeated runs.
    Note: the SQLite query engine serializes writes, so the loser normally takes the
    clean `DuplicateOperationError` path; the unique constraint is what makes it
    correct when two requests genuinely interleave (e.g. on Postgres, where the
    concurrent path is not exercised locally — no Docker here).
  - Verified: `tsc` clean; **119/119** (integration 38 → 47, +9 spend-safety and
    concurrency tests); build 13 routes; e2e 6 passed / 2 skipped including the full
    journey.
  - **Still open in this task (why it is not VERIFIED):** address verification,
    spend caps enforced at the custody layer, and "no silent retries" against a
    real venue — all meaningless until `PHASE18-004`/`005` exist.

- D38: **PHASE18-004 groundwork landed — the custody boundary + spend limits.**
  Marked `IN_PROGRESS`, not done: the KMS/HSM adapter itself needs provider
  credentials and cannot be built or verified on this host. What landed:
  - `src/lib/custody/` is the **single boundary for a real key**. It deals only in a
    **key reference** (`CustodyKeyReference` = `{ provider, keyId }`, from
    `CUSTODY_PROVIDER`/`CUSTODY_KEY_ID`) and exposes no field for key material — a
    test fails the build if the module ever grows `privateKey`/`mnemonic`/etc. The
    provider would resolve the reference internally and sign on its side; nothing
    here can read, return or log a key. This is the concrete form of D29's custody
    rule (custodial hot wallet, keys in a KMS/HSM, never in config).
  - **Spend limits** (`src/lib/custody/policy.ts`) are pure and enforced *before*
    any signer is requested: a per-transaction cap (`CUSTODY_MAX_PER_TX_USD`, default
    1000) and a rolling daily cap (`CUSTODY_DAILY_LIMIT_USD`, default 5000). An
    amount over a cap is **refused, never trimmed** — matching the existing
    `DEPOSIT_CAP_USD` rule rather than inventing a second convention. The daily cap
    takes `spentTodayCents` from the caller; persisting a rolling spend ledger is
    part of the adapter work still to come.
  - **Fail closed, as with the execution gate.** `REAL_CUSTODY_IMPLEMENTED` is
    deliberately `false`, so `requireCustody()` throws with **and** without config —
    setting a provider id cannot conjure a signer. `authorizeCustodySpend()` checks
    the caps first, so an over-limit movement is refused even with no custody; a
    within-limit movement is still refused for want of a signer. There is no
    configuration in which this build signs a real transaction.
  - **Deliberately not wired to a real path** — none exists (venues are
    `PHASE18-005`). This is the sandboxed half of `004`, exactly as D37 did for
    `006`. `REAL_EXECUTOR_IMPLEMENTED` stays false and every wallet stays
    `kind: "SIMULATED"`.
  - Env vars documented in `API_CREDENTIAL_REQUIREMENTS.md` and `.env.example`
    (the doc-sync test enforces both), and the status surfaces
    (`NETWORK_BOUNDARY`, `PROJECT_PLAN`, `ARCHITECTURE`, `PRODUCT_REQUIREMENTS`,
    `RELEASE_CHECKLIST`) now say "custody boundary done, adapter to come" rather
    than "nothing exists".
  - **Still open in this task:** the actual KMS/HSM adapter (e.g. AWS KMS / GCP KMS
    / a custodian SDK), key rotation + audit trail, a persisted rolling spend
    ledger, and address/chain binding for withdrawals. All need provider choices and
    credentials, so mainnet execution remains disabled.

- D39: **PHASE18-004 completed — Coinbase CDP Server Wallets is the custody backend.**
  Chosen after checking the Gravity catalog (no KMS/HSM signing provider exists there)
  and then pricing the real options: the user wanted a **free** backend they can
  issue **API keys** for, and Coinbase CDP Server Wallets gives 5,000 wallet
  operations/month free (then $0.005/op) — versus Turnkey/Openfort free tiers of only
  ~25 signatures/month and AWS/GCP KMS which are paid with no permanent free tier.
  It also helps that `@coinbase/cdp-sdk@1.58.0` was **already in the dependency tree**
  (transitively, via wagmi — D30), so this adds no new dependency graph, only an
  explicit `package.json` entry. What landed:
  - **A real, provider-agnostic boundary.** `src/lib/custody/types.ts` defines
    `CustodySigner` (address + `sign`/`signMessage`/`signTransaction`) and the
    `CustodyAdapter` contract; `index.ts` holds the adapter registry and resolves a
    signer. The wallet key never crosses the boundary — the app holds a *reference*
    (`CUSTODY_PROVIDER`/`CUSTODY_KEY_ID`) plus API credentials, and gets a signature
    back. `REAL_CUSTODY_IMPLEMENTED` is now `true`.
  - **The `coinbase-cdp` adapter** (`providers/coinbase-cdp.ts`) uses
    `cdp.evm.getOrCreateAccount({ name: CUSTODY_KEY_ID })` and delegates signing to
    the provider. The SDK is imported **lazily** (`await import`) so the execution
    gate can ask "is custody configured?" without pulling the SDK (and its
    Solana/axios tree) into every server render.
  - **Fail closed, still.** Selecting an unknown provider, leaving the reference
    unset, or omitting credentials each yields "cannot sign" — `requireCustody()`
    throws with a specific reason, and `authorizeCustodySpend()` refuses over-cap
    amounts *before* a signer is requested. There is no local-key fallback.
  - **The gate now requires custody too** (`src/lib/execution.ts`): after the
    executor check, a mainnet session is refused unless custody is available. Since
    `REAL_EXECUTOR_IMPLEMENTED` is still `false`, behaviour is unchanged and mainnet
    remains disabled — **a signer alone does not move funds**. `PHASE18-005` (a real
    venue) is now the single remaining blocker.
  - **Reverses part of D30's bundling stance deliberately:** D30 avoided the Base
    connector because it drags in `@coinbase/cdp-sdk`; here we *want* the SDK, used
    server-side only, behind a lazy import and the existing `@x402/*` aliases.
  - **Credentials are the user's to supply.** Three `CDP_*` secrets go in the
    gitignored env / host secret store; the adapter is unit-tested with a mocked SDK
    so CI needs no live account. Live signing is verified by the user adding
    credentials (documented in `API_CREDENTIAL_REQUIREMENTS.md`).
  - **Still open:** key rotation + audit trail, and a **persisted rolling spend
    ledger** (today `authorizeCustodySpend()` takes `spentTodayCents` from the
    caller). Neither blocks the boundary.
- D40: **Coinbase docs split into a first-class knowledge base and mapped to a new
  Phase 19 task set (user-directed).** The user supplied a 74k-line CDP docs export
  with live credentials in its header and asked for it to be split into `.md` files
  under `/coinbase` and turned into development tasks that add Coinbase
  login/deposit/trade/withdrawals **alongside** the current setup (never replacing
  it). What landed:
  - **`scripts/coinbase_extract.py`** splits the export on the docs-generator marker,
    de-duplicates pages by content hash (287 pages → **163 unique**), and writes
    `coinbase/docs/NNN-<slug>.md` + `coinbase/MANIFEST.md`. It reads the credential
    values from the export header **at runtime** and redacts them, then drops the
    header block entirely, so no secret — and no secret-shaped literal — is stored in
    the script or the output. `--check` asserts the result. `coinbase-api-and-docs.txt`
    is now git-ignored.
  - **`coinbase/README.md`** is the curated topic index and **`coinbase/INTEGRATION.md`**
    maps each Coinbase product (OAuth/embedded wallets → login; Onramp/Deposit
    Destinations/Transfers → deposits; Trade API/Swaps → trading; Offramp/
    Disbursements → withdrawals; webhooks → ledger) onto the existing SIWE session,
    execution gate and `coinbase-cdp` custody boundary.
  - **Phase 19 tasks** (`PHASE19-001` … `PHASE19-010`) added to `corpus_tasks.py`
    with `depends_on` wiring; the seeder now supports `(id, phase, title, prio,
    depends_on)` and a `PRE_DONE` set so the knowledge-base task (`001`) seeds
    VERIFIED idempotently. `.progress/` regenerated (213 tasks).
  - **Security follow-ups flagged to the user:** the export header's API key, secret
    key and private key were sitting in a plaintext, non-ignored file in a **public**
    repo — they should be rotated in the CDP Portal.

- D41: **PHASE19-002 (Coinbase login) and PHASE19-006 (Coinbase webhooks)
  implemented, and the `/coinbase` docs reorganised into category subfolders.**
  - **Login is wallet-based, on purpose.** The identity model is "a user *is* their
    wallet" (D28/D30, guarded by tests), so Coinbase enters as a *wallet provider*: a
    one-click "Sign in with Coinbase" (`components/CoinbaseSignIn.tsx`) connects the
    Coinbase Wallet connector that already ships in the build, then runs the **same**
    SIWE verification every other wallet uses. The browser half of SIWE was extracted
    into `components/useSiweSignIn.ts`, shared by `WalletSignIn` and `CoinbaseSignIn`.
    There is **no new credential, no schema change and no separate account** — an
    account-based OAuth2 login would break the model and is left as a documented
    follow-up. `src/lib/coinbase/login.ts` is framework-free and unit-tested.
  - **Webhooks are real and fail-closed.** `src/lib/coinbase/webhook.ts` implements
    Coinbase's `X-Hook0-Signature` scheme exactly as documented (HMAC-SHA256 over
    `t.h.headerValues.body`, constant-time compare, 5-minute freshness window) from
    the split docs (`coinbase/docs/payments/030-verification.md`). The receiver at
    `src/app/api/webhooks/coinbase/route.ts` refuses everything when
    `COINBASE_WEBHOOK_SECRET` is unset (`503`), rejects a bad signature (`401`) or a
    non-object body (`400`). `src/lib/coinbase/ingest.ts` records every event once in
    a new `WebhookEvent` model (unique `eventId` ⇒ a retry cannot credit twice) and
    credits only `payments.transfers.completed` for a stable asset to a **resolvable**
    user (target address matching a `Wallet`, or a stored transfer ref) — otherwise it
    stores the event `UNMATCHED` and credits nothing. The credit runs through the same
    `runOnce` guard as the deposit path (new `webhook_deposit` scope). This is the
    first **API route handler** in the app; it needs the raw body, so it reads text and
    verifies before parsing.
  - **Docs reorganised.** `scripts/coinbase_extract.py` now files the 163 pages under
    `coinbase/docs/<category>/` (11 categories: platform, wallets, custody, payments,
    onramp-offramp, stablecoins, auth, x402, agents, sdk-ui, security) with a generated
    breadcrumb cross-linking every page back to the index and manifest, and a
    category-grouped `MANIFEST.md`. `coinbase/README.md` mirrors the categories.
  - **Schema/migrations/docs kept in sync:** the `WebhookEvent` model shipped with
    **both** provider migrations (`prisma/migrations` + `prisma/migrations-postgres`,
    D14), a `DATA_MODEL.md` row+section and the `COINBASE_WEBHOOK_SECRET` credential row
    + `.env.example` key (so `npm run test:docs` stays green). New tests:
    `tests/coinbase.test.ts` (unit) and `tests/integration/coinbase-webhook.test.ts`
    (real DB: credit-once, replay no-op, unmatched credits nothing). `npm run build`,
    typecheck and the full suite (154 passing, 2 live-custody skipped) are green.

- D42: **PHASE19-003 (Coinbase deposits via Onramp) + an admin webhook console + e2e
  coverage added.**
  - **Deposits are a Coinbase-hosted hand-off, not an app custody path.**
    `src/lib/coinbase/onramp.ts` signs a short-lived CDP JWT (via
    `@coinbase/cdp-sdk/auth`, lazily imported) and calls the documented Session Token
    API (`POST https://api.developer.coinbase.com/onramp/v1/token`), then builds the
    documented `https://pay.coinbase.com/buy/select-asset` URL. Coinbase delivers
    crypto to the user's **own** wallet, so onramp deliberately does **not** run
    through `requireExecution` (which guards funds the *app* moves); instead
    `startCoinbaseDepositAction` is fail-closed on three axes — unconfigured
    (`/wallet?coinbase=unconfigured`), a testnet session (`?coinbase=testnet`, since
    onramp delivers real crypto), and a Coinbase error (`?coinbase=error`). `/wallet`
    shows the deposit card (address + supported networks) with the buy form only when
    configured, plus a not-configured note otherwise.
  - **Admin webhook console** (`/admin/webhooks`, `PHASE19-006` follow-on): lists
    `WebhookEvent` rows with status counts and a linkable `?status=` filter, so an
    operator can see which deliveries did **not** reconcile (`UNMATCHED`). Linked from
    `/admin`.
  - **e2e coverage** (`tests/e2e/coinbase.spec.ts`): the login Coinbase button and no
    leaks; the wallet deposit card (address + networks); the admin webhook console and
    its status filter; and that the console is admin-only. `/admin/webhooks` was added
    to the `ui-audit` route set and passes the overflow/contrast audit at all three
    widths. New unit/integration tests: `tests/coinbase-onramp.test.ts` and
    `tests/integration/coinbase-deposit.test.ts`. Full suite 168 passing (+2
    live-custody skipped); the `WebhookEvent` migration was applied to the dev DB.
  - **No new env var:** onramp reuses `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` (already
    documented), so only `apps/web/README.md`'s route table needed a new row.

- D43: **PHASE19-005 (Coinbase withdrawals via Offramp) + a live-credentials smoke
  test + per-user webhook history added.**
  - **Withdrawals are the mirrored hand-off.** `src/lib/coinbase/offramp.ts` reuses the
    shared Session Token API (`fetchOnrampSessionToken` — same endpoint as Onramp) and
    builds the documented `https://pay.coinbase.com/v3/sell/input` URL, where
    `redirectUrl` is **required**. `startCoinbaseWithdrawalAction` is fail-closed the
    same way as the deposit hand-off (unconfigured / testnet / API error → `/wallet`
    with a reason) and redirects back to `/wallet?coinbase=offramp` on completion. The
    app never signs the sale, so Offramp stays outside the execution gate. `/wallet`
    gained a "Withdraw with Coinbase" card alongside the simulated withdrawal.
    Disbursements / the custodial Transfers API remain follow-ups (they need a verified
    custodial account) — the hosted sell flow is the honest, credential-light path.
  - **Live smoke test** (`tests/coinbase.live.test.ts`, `npm run smoke:coinbase`):
    skipped unless `COINBASE_LIVE=1`, so CI never calls out. With real credentials it
    mints a live onramp session token, builds a live offramp URL, and — with
    `COINBASE_WEBHOOK_SECRET` — signs a `payments.transfers.completed` delivery, asserts
    it verifies (and a tampered body does not), and optionally POSTs it to
    `COINBASE_SMOKE_URL` expecting `200`. Mirrors the existing `custody.live.test.ts`
    pattern.
  - **Per-user reconciliation history**: `/history` gained a "Coinbase reconciliation"
    table (`WebhookEvent` rows resolved to the signed-in user) next to transactions and
    the ledger, so a user sees what Coinbase sent and its status; the operator view is
    `/admin/webhooks`.
  - **Tests/docs:** `tests/coinbase-offramp.test.ts` (unit) and
    `tests/integration/coinbase-withdrawal.test.ts` (fail-closed paths, real DB); the
    coinbase e2e spec now also asserts the "Withdraw with Coinbase" card and the
    history section. Full suite **178 passing (+5 live-custody/-smoke skipped)**; build,
    typecheck, docs-sync and the e2e set (coinbase, journey, login-wallet, walkthrough,
    ui-audit at 3 widths) are green. `apps/web/README.md` gained the
    `smoke:coinbase` script and a Coinbase-layer note.

- D44: **Mainnet execution is on by default (user-directed); `MAINNET_EXECUTION_ENABLED`
  becomes a kill switch.** The user asked for mainnet to be "fully operational from
  now" and chose the option that makes real execution **default-on in code** rather
  than an env opt-in, for both local and the production deployment. What changed:
  - `src/lib/execution.ts`: `mainnetExecutionEnabled()` now returns true unless
    `MAINNET_EXECUTION_ENABLED=0`. The gate keeps its other layers, so this is not the
    whole decision: a mainnet session still needs `REAL_EXECUTOR_IMPLEMENTED` (true)
    **and** configured custody, and a deployment without the `CDP_*` credentials still
    **refuses** every mainnet money action rather than signing. There is no silent
    simulated fallback, and a testnet session can never reach a real path.
  - **Paper-only desk guarded (`requireSimulation`).** Opening the gate exposed a
    latent gap: the paper `deposit`/`withdraw`/`start`/`stop` actions only move
    simulated balances, and `requireExecution` would now *allow* a mainnet session
    through them (custody configured ⇔ allowed), i.e. silently simulate. A new
    `requireSimulation()` throws for a `MAINNET` session whatever the flag/custody
    state, and those four actions use it (the real swap path checks `executionGate()`
    directly). `requireExecution` stays for paths that can genuinely move real funds.
  - The inverted flag is deliberate: an operator can refuse **all** real movement with
    an env change (`MAINNET_EXECUTION_ENABLED=0`) and no code deploy — the kill switch
    is the replacement for the old opt-in. The docs' "off by default" wording was
    updated everywhere (`NETWORK_BOUNDARY`, `API_CREDENTIAL_REQUIREMENTS`,
    `RELEASE_CHECKLIST`, `DEPLOYMENT`, `ARCHITECTURE`, `PROJECT_PLAN`,
    `coinbase/INTEGRATION`, `apps/web/README.md`) plus `.env.example` and the
    generated `KNOWN_LIMITATIONS` template.
  - Tests updated to the new semantics: `tests/execution.test.ts` asserts default-on,
    the kill switch, *and* that custody remains required;
    `tests/deployment.test.ts` and
    `tests/integration/{actions,coinbase-trading}.test.ts` follow (the integration
    money-path refusal now pins custody unconfigured so it is deterministic, and the
    swap test drives the kill switch by value).
  - **Security note:** the repository is public and the app now defaults to the
    real-money path. The fail-closed custody layer is the only thing standing between
    a mainnet session and a live swap, so `CDP_WALLET_SECRET` is load-bearing and must
    never be committed. **Open:** `CDP_WALLET_SECRET` is still absent from
    `apps/web/.env`, so real swaps are refused locally until it is added; compliance
    (`PHASE18-007`/`PHASE19-010`), the tail of irreversibility UX (`PHASE18-006`) and
    on-chain reconciliation remain follow-ups, and production still needs the custody
    credentials plus a redeploy.

- D45: **Deployed the mainnet-on build to production and hardened the deploy upload.**
  - **Deploy:** `vercel deploy --prod` from the repository root (the project's Root
    Directory is `apps/web`), authenticated with the `VERCEL_TOKEN` **env var** — never
    `--token`, which the CLI echoes into the transcript (D32). Live alias
    `https://veylora-fintech-ai-trading-black.vercel.app`; deployment
    `veylora-fintech-ai-trading-ljgg9vdc9.vercel.app`. The remote build passed (15
    routes) and the sign-in surface smoke passed.
  - **`.vercelignore` hardened first:** a CLI deploy uploads the *working tree*, so the
    saved credential exports were in the upload path. Now excluded: `.env`,
    `.env.*` (except `.env.example`), `*.txt` (the `coinbase-api-and-docs.txt`,
    `vercel-token.txt`, `tiger-*.txt`, `reown-info.txt` hand-offs), `*.pem/.key/.p8`,
    and the root `/coinbase/` + `/docs/` reference trees. **Trap:** an unanchored
    `coinbase/` pattern also matched the app's own `apps/web/src/lib/coinbase/` and
    broke the first remote build (`Module not found`) — root-only patterns must be
    anchored as `/coinbase/`.
  - **Production custody is still unconfigured.** `vercel env ls production` shows no
    `CDP_*`/`CUSTODY_*`, and `CDP_WALLET_SECRET` is absent everywhere on this host, so a
    mainnet session **refuses** real money actions in production. The deploy did not
    turn on real funds; wiring custody in production means adding the `CDP_*` vars
    (esp. `CDP_WALLET_SECRET`) and redeploying.
  - **Two findings.** (1) WalletConnect/Reown returns **403** for the production
    origin (`Origin … not found on Allowlist`), so the live spec's QR/connector check
    fails until the origin is added at cloud.reown.com — unrelated to the mainnet
    change, but it means QR/mobile sign-in is degraded in production (injected wallets
    still work). (2) No `CDP_WALLET_SECRET` exists in the repo or env, so live custody
    signing cannot be verified until one is generated in the CDP portal.
  - **UI gating covered:** `apps/web/tests/e2e/wallet-network.spec.ts` (2 tests) — a
    testnet session is offered the paper deposit/withdrawal forms; a mainnet session
    is not, and is pointed at the Coinbase surfaces.

- D46: **Consolidated production onto the clean URL and resolved the WalletConnect
  403.**
  - The clean domain `veylora-fintech-ai-trading.vercel.app` was held by the stale
    duplicate project `web` (D24). It was removed from `web` and added to our project
    via the Vercel API (`DELETE /v9/projects/{webId}/domains/…`, then
    `POST /v10/projects/{ourId}/domains`), then the now-redundant `-black` domain was
    removed. Production is served only at
    **`https://veylora-fintech-ai-trading.vercel.app`**. (`web` still exists but is
    domainless — delete it if it is not wanted.)
  - **This resolves the WalletConnect 403 from D45:** Reown allows the *clean* origin,
    so `-black` was simply not on its allowlist. The live spec passes against the clean
    URL — the sign-in surface (including the WalletConnect connector, no origin 403)
    **and** a minted session reaching DB-backed `/dashboard`, `/history`, `/markets`
    (run with the production `SESSION_SECRET`, pulled to a temp file and deleted).
  - Still open: the `CDP_*` custody credentials (incl. `CDP_WALLET_SECRET`) are not set
    on Vercel, so production still refuses real money actions (D45).

- D47: **Production custody pre-configured; the Wallet Secret is the last piece and it
  cannot be obtained programmatically.**
  - Set on Vercel production (Secret type): `CUSTODY_PROVIDER=coinbase-cdp`,
    `CUSTODY_KEY_ID=veylora-hot-wallet`, `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`.
    Custody still reports **unavailable** without `CDP_WALLET_SECRET`, so mainnet stays
    refused — these are inert until the secret is added and a redeploy runs.
  - **`CDP_WALLET_SECRET` does not exist anywhere on this host and has no API.**
    Coinbase's docs are explicit: it is created at
    `portal.cdp.coinbase.com/wallets/non-custodial/security` → Generate Wallet Secret,
    shown **exactly once**. The `coinbase-api-and-docs.txt` header carries only the API
    key JSON — verified by hash that its `id`/`privateKey` are exactly the
    `CDP_API_KEY_ID`/`CDP_API_KEY_SECRET` already in `.env`, not a wallet secret. Live
    signing (`CUSTODY_LIVE=1 … custody.live.test.ts`) is therefore **blocked** until a
    freshly generated secret is pasted in.
  - **Finding — live onramp fails:** `COINBASE_LIVE=1 … coinbase.live.test.ts` returns
    **HTTP 404** from the Session Token API, so Coinbase deposits/withdrawals are not
    working against the live account. Likely the Onramp product is not enabled/approved
    for this CDP project (an app id may also be required). Separate from custody;
    flagged for follow-up.

- D48: **Production made fully operational: live custody wired, pending Postgres
  migrations applied, and the `/trade` 500 fixed.**
  - **Live custody signing verified.** `CDP_WALLET_SECRET` was added to `apps/web/.env`
    (git-ignored) and Vercel production, then `CUSTODY_LIVE=1 … custody.live.test.ts`
    passed: the app obtained a signature from a key it does not hold and the signature
    recovered to the signer address.
  - **The production database was behind and 500-ing.** `vercel logs` showed
    `prisma.webhookEvent.findMany() → P2021: table public.WebhookEvent does not exist`,
    which made `/trade`, `/wallet` and `/history` error for **every** session (not just
    mainnet). The `spend_safety` and `coinbase_webhooks` Postgres migrations had never
    been applied to production (D32 applied only up to `wallet_auth`). Applied with
    `prisma migrate deploy` against the production `DATABASE_URL`, using the provider
    switch + migrations-dir swap; the local `schema.prisma` and both migration dirs were
    restored and verified **identical**.
  - **Mainnet execution is now live in production.** Redeployed with
    `CUSTODY_PROVIDER=coinbase-cdp`, `CUSTODY_KEY_ID`, `CDP_API_KEY_ID` /
    `CDP_API_KEY_SECRET` / `CDP_WALLET_SECRET` on Vercel. Verified against the clean URL:
    `/trade` renders the real Coinbase swap form for a mainnet session (custody
    available, gate open), and `/trade`, `/wallet`, `/history`, `/dashboard`, `/markets`
    plus the sign-in/WalletConnect surface all render.
  - **Process gap:** production migrations are applied manually; CI's `postgres` job
    only exercises a fresh database. Run `prisma migrate deploy` against production
    after any schema change until that is automated.
  - **Still open:** compliance (KYC/AML, sanctions, jurisdiction gating) remains undone
    by explicit user direction, and the live onramp/offramp Session Token API returns
    HTTP 404 (D47). Mainnet swaps now move **real funds**.

- D49: **Onramp/Offramp 404 root-caused: the CDP project has no Onramp app.**
  - The live smoke's failure was an opaque `HTTP 404`. A probe against the real Session
    Token API returned the body:
    `{"code":"ERROR_CODE_NOT_FOUND","message":"NotFound: failed to find app with cloud
    project id c191acef-47fd-4845-a3ad-dc98e060faaa: mongo: no documents in result"}`.
    That id is exactly the project in the API-key export (verified by hash), so the JWT
    and credentials are correct — Coinbase simply has **no Onramp app provisioned** for
    the project.
  - **The fix is account-side, not code:** enable/onboard Onramp for the project
    (CDP Portal → Payments → Onramp & Offramp; full access via
    https://support.cdp.coinbase.com/onramp-onboarding). The onramp/offramp code is
    otherwise correct — its body matches the API reference — so it will work once the
    app exists. (Coinbase-hosted Guest Checkout is deprecated 2026-06-30 in favour of
    Headless Onramp, which is also gated on approval.)
  - `fetchOnrampSessionToken` now includes Coinbase's `message`/`code` in the thrown
    error rather than a bare status, so this is diagnosable in logs, the UI plumbing and
    the live smoke (with a unit test). Suite **213 passing**.
  - **Alternative if Onramp cannot be enabled:** implement on-chain transfers through
    the custody wallet (deposit = receive to the custody address; withdraw =
    custody-signed transfer) — the `PHASE18-005` on-chain path. Not started; needs a
    decision (it moves real funds and compliance is still undone).

- D50: **PHASE18-005 on-chain custody transfers + PHASE18-004 ledger/audit + PHASE18-007/19-010 compliance boundary (implementation pass).**
  - **On-chain transfers.** `src/lib/custody/transfers.ts` adds `custodyDepositAddress()`
    and `sendCustodyTransfer()` — a custody-signed transfer broadcast through the
    provider (`signer.sendTransaction`, CDP `evm.sendTransaction`; the app holds no key
    and needs no RPC). `startOnChainWithdrawalAction` gates it: mainnet session + the
    execution gate (custody configured, kill switch clear), a valid destination, a live
    ETH notional, compliance screening, an explicit confirmation, and the persisted spend
    cap — all before the signer is used. Surfaced on `/wallet`. Real funds move; this was
    an explicit user decision.
  - **Persisted rolling spend ledger.** New `CustodySpend` model (migration
    `20261009160000_custody_spend_ledger`, both SQLite and Postgres dirs) plus
    `src/lib/custody/spend-ledger.ts`. The daily cap is now read from what actually
    moved (`custodySpentTodayCents`), not from a caller-supplied total; the swap action
    switches to it. Every real movement also writes a `custody.spend` `AuditLog` entry
    carrying only the key **reference** (provider:keyId) — the audit-trail half of the
    rotation follow-up.
  - **Compliance boundary.** `src/lib/compliance/` defines `ComplianceProvider`
    (`screenUser` / `screenTransfer` / `allowedJurisdiction`), a registry with
    `registerComplianceProvider`, and fail-closed helpers. The default is an inert
    **no-op** selected by `COMPLIANCE_PROVIDER=none`; `complianceConfigured()` is false
    and `complianceStatus()` says screening is **not running** — no fake compliance. The
    swap and on-chain withdrawal paths call it before moving funds. No vendor wired (per
    the user's "provider integration only" choice).
  - **Tests/docs.** +3 files (`compliance.test.ts`, `custody-transfers.test.ts`,
    `integration/custody-withdraw.test.ts`); suite **234 passing**; `tsc --noEmit` clean.
    `DATA_MODEL.md` and `API_CREDENTIAL_REQUIREMENTS.md` updated for `CustodySpend` and
    `COMPLIANCE_PROVIDER`. Note: the integration withdrawal test clears CDP/custody env
    in `beforeEach` because Prisma auto-loads `apps/web/.env`.
  - **Still open:** Onramp/Offramp enablement (D49, account-side), a real compliance
    vendor, and automated key rotation.

_Last rendered: 2026-10-09 15:44:48 UTC_
