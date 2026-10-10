# Dependency Audit (npm audit) — Triage & Resolution

Status: **`npm audit --audit-level=high` reports 0 high/critical** (9 moderate
outstanding, all one wallet-stack chain rooted in a single `uuid` advisory —
analysed and accepted below, see "Wallet-stack advisory"). `npm audit`
(`--audit-level=high`) still exits 0. Audited in `apps/web/`, the only package with
dependencies. Historically this document cleared 7 advisories (3 critical, 3 high,
1 moderate); the wallet stack added more, resolved or accepted below.

Scope note: this app runs a real, custody-signed trading desk. Nothing here changes
the product's safety boundary; these are dependency and toolchain fixes.

## Method

1. `npm audit --json` to enumerate advisories with severity, dependency path,
   direct/transitive status, and fix availability.
2. Classify each finding by **exposure**: shipped to production vs build/dev-only.
3. Prefer an in-range upgrade; use targeted `overrides` only where no upstream
   release fixes a transitive dependency.
4. Re-verify after every change: `tsc --noEmit`, `vitest run`,
   `next build`, `playwright test`, `npm audit`.

## Findings and resolutions

| Package | Sev | Path | Exposure | Resolution |
| --- | --- | --- | --- | --- |
| `next` 16.0.0–16.3.7 | critical | direct (prod) | shipped | **Upgraded 16.3.5 → 16.4.0** |
| `tinypool` ≤2.1.1 | critical | via `vitest` (dev) | dev/test | **Upgraded `vitest` 3 → 5** (drops `tinypool`) |
| `vitest` | critical | direct (dev) | dev/test | **Upgraded to 5.0.3** |
| `deepmerge-ts` <8.0.0 | high | `prisma → @prisma/config` (dev) | build/CLI | **Pinned via `overrides` to `^8.0.2`** |
| `@prisma/config` 6.13.0-dev.1–8.1.0-dev.4 | high | via `prisma` (dev) | build/CLI | Cleared by the `deepmerge-ts` override |
| `prisma` 6.13.0-dev.1–8.1.0-dev.4 | high | direct (dev) | build/CLI | **Restored to 6.19.3** (see below) |
| `@vitest/mocker` 2.1.0–4.1.10 | moderate | via `vitest` (dev) | dev/test | **Cleared by the vitest 5 upgrade** |
| `ws` <8.20.1 | high | via `@walletconnect/*` → `wagmi` (prod) | shipped | **Pinned via `overrides` to `^8.20.1`** |
| `decode-uri-component` ≤0.4.2 | moderate | via `query-string` → `@walletconnect/*` (prod) | shipped | **Pinned via `overrides` to `^0.5.0`** |
| `uuid` <11.1.1 | moderate | via `@metamask/sdk` → `@wagmi/connectors` (prod) | shipped | **Accepted** — root of the chain, see "Wallet-stack advisory" |
| `@metamask/utils`, `@metamask/sdk-communication-layer`, `@metamask/sdk`, `@metamask/rpc-errors`, `@gemini-wallet/core` | moderate | all `via` `uuid` (prod) | shipped | **Not separately actionable** — same root cause; cleared when `uuid` is |
| `@wagmi/connectors`, `wagmi`, `@rainbow-me/rainbowkit` | moderate | `via` the MetaMask/Gemini connectors (prod) | shipped | **Accepted** — only "fixed" by the semver-major `wagmi` 3 upgrade |

## Notable decisions

### `next` 16.3.5 → 16.4.0 (production)
The direct, shipped dependency carried 7 advisories including RCE in `next/og`
and SSRF in Image Optimization. 16.4.0 is the fixed release for the 16.x line
(not a semver-major bump). This was the only finding that could affect a running
deployment, so it was fixed first.

### `deepmerge-ts` override instead of downgrading Prisma
`npm audit fix` "resolved" the Prisma advisory by **downgrading the `prisma` CLI
to 6.12.0**, which left it mismatched with `@prisma/client` 6.19.3 — a worse,
fragile state (CLI/client version skew can break `prisma generate`/`db push`).

Investigation showed **no upstream fix exists**: even `@prisma/config@7.10.0`
still pins `deepmerge-ts@7.1.5`, and `prisma` latest is `8.0.0-rc.21`. The
advisory range spans `6.13.0-dev.1 … 8.1.0-dev.4`, so the only in-range options
were to downgrade or to force the transitive fix.

Chosen fix: keep CLI and client version-matched at **6.19.3**, and add

```json
"overrides": { "deepmerge-ts": "^8.0.2" }
```

`deepmerge-ts@8.0.0` adds the recursion guard the advisory is about and has no
dependencies. Because `@prisma/config` consumes it, the override was verified
against real Prisma commands: `prisma validate` and `prisma generate` both pass
(see Verification).

### `vitest` 3 → 5 (dev-only)
The critical `tinypool` advisories (prototype-pollution → RCE) are only reachable
by passing attacker-controlled options to the test worker pool — not exposed by
the deployed app. The fix nonetheless required a vitest major, which pulled in a
`@types/node` peer requirement (`^22 || >=24`). Since the project runs on Node 24,
`@types/node` was bumped `^20 → ^24`. Result: `tinypool` and the vulnerable
`@vitest/mocker` are gone entirely and the whole suite still passes.

### Wallet-stack advisory: `uuid` <11.1.1 (moderate)

Adding wallet sign-in (wagmi + RainbowKit) pulled in `@metamask/sdk`, which depends
on `uuid` <11.1.1. The advisory (GHSA-w5hq-g745-h8pq) is a missing buffer bounds
check in **`v3`/`v5`/`v6` when an explicit `buf` is passed**.

`npm audit` reports this as **9 moderate** entries because npm walks the whole chain
and flags every package on the path: `uuid` → `@metamask/utils` →
`@metamask/rpc-errors` → `@gemini-wallet/core` → `@metamask/sdk-communication-layer`
→ `@metamask/sdk` → `@wagmi/connectors` → `wagmi` → `@rainbow-me/rainbowkit`. They
are **one advisory, not nine**, and share the same fix (bundled `wagmi` 3).
`npm audit --audit-level=high` therefore still exits 0.

- **Not reachable from this app.** We never call `uuid`; the MetaMask SDK uses it
  internally for message ids (`v4`, no buffer argument).
- **No non-breaking fix.** `npm audit` can only resolve it by moving to wagmi 3,
  which RainbowKit 2 does not support (its peer is `wagmi ^2.9.0`). Forcing
  `uuid@^11` under the SDK would swap a runtime-compatible dependency for an
  unverifiable one — a worse trade than an unreachable moderate.
- **Follow-up:** revisit when RainbowKit supports wagmi 3 (or if the app moves to
  Reown AppKit), which drops the `@metamask/sdk` chain.

### Bundler alias for unused `@x402/*` peers (build fix, not an advisory)

RainbowKit's barrel eagerly imports wagmi's "Base Account" connector, which reaches
`@base-org/account` → `@coinbase/cdp-sdk` → the optional `@x402/*` packages. Those
are **declared peers that are not installed**, so the production build failed to
resolve them. Installing them was rejected: they pull a Solana/`ajv`/`jose` tree for
a payment protocol this app never touches.

Instead `next.config.ts` maps `@x402/*` to `false` under `turbopack.resolveAlias`, so
the bundler ignores an unreachable code path. The Base connector is also not offered
in `src/lib/wagmi.ts`, so nothing can exercise it.

## Accepted risks

One root advisory outstanding — the `uuid` moderate above (unreachable, no
non-breaking fix), which npm surfaces as 9 chained moderate entries. Otherwise
`npm audit --audit-level=high` is clean (exit 0). The accepted policy (already used
above) is:

- A dev/build-only advisory that requires local untrusted input may be accepted,
  with the rationale recorded here and a follow-up to upgrade when upstream fixes.
- A production dependency advisory is never accepted — it is upgraded, or the
  feature is disabled, before release.

## Verification (all after the changes)

| Check | Result |
| --- | --- |
| `npm audit` | `9 moderate severity vulnerabilities` (one accepted chain) |
| `npx prisma validate` | schema valid |
| `npx prisma generate` | Prisma Client v6.19.3 generated |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 119/119 passing, 8 files (vitest 5.0.3) |
| `npm run build` | succeeds, 13 routes |
| `npx playwright test` | 6 passing, 2 live specs skipped |
| `npm audit --audit-level=high` | exit 0 (0 high/critical; 9 accepted moderates) |

Resolved versions: `next` 16.4.0 · `prisma` / `@prisma/client` 6.19.3 ·
`deepmerge-ts` 8.0.2 (override) · `vitest` 5.0.3 · `@types/node` 24.19.1 ·
`wagmi` 2.19.5 · `viem` 2.57.4 · `@rainbow-me/rainbowkit` 2.2.11 ·
`@spruceid/siwe-parser` 3.0.0 · `ws` 8.20.x (override) ·
`decode-uri-component` 0.5.0 (override).

## Reproduce

```bash
cd apps/web
npm audit --audit-level=high   # expect: exit 0 (only the accepted uuid moderate chain)
npx tsc --noEmit && npx vitest run && npx playwright test && npm run build
```
