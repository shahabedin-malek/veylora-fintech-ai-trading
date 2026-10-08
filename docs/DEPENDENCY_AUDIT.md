# Dependency Audit (npm audit) — Triage & Resolution

Status: **resolved — `npm audit` reports 0 vulnerabilities** (was 7: 3 critical,
3 high, 1 moderate). Audited in `apps/web/`, the only package with dependencies.

Scope note: this app runs a **simulated** trading desk. Nothing here changes the
product's safety boundary; these are dependency and toolchain fixes.

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

## Accepted risks

**None outstanding.** `npm audit` is clean at the time of writing. If a future
advisory appears in build/dev tooling where no fixed release exists, the accepted
policy is:

- A dev/build-only advisory that requires local untrusted input may be accepted,
  with the rationale recorded here and a follow-up to upgrade when upstream fixes.
- A production dependency advisory is never accepted — it is upgraded, or the
  feature is disabled, before release.

## Verification (all after the changes)

| Check | Result |
| --- | --- |
| `npm audit` | `found 0 vulnerabilities` |
| `npx prisma validate` | schema valid |
| `npx prisma generate` | Prisma Client v6.19.3 generated |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 84/84 passing (vitest 5.0.3) |
| `npm run build` | succeeds, 13 routes |
| `npx playwright test` | 2/2 passing |

Resolved versions: `next` 16.4.0 · `prisma` / `@prisma/client` 6.19.3 ·
`deepmerge-ts` 8.0.2 (override) · `vitest` 5.0.3 · `@types/node` 24.19.1.

## Reproduce

```bash
cd apps/web
npm audit                 # expect: found 0 vulnerabilities
npx tsc --noEmit && npx vitest run && npx playwright test && npm run build
```
