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
- `npm audit` is clean (Phase 15-002): `next` upgraded to 16.4.0, `vitest` to 5,
  and a `deepmerge-ts@^8` override closes the Prisma CLI chain. See
  `docs/DEPENDENCY_AUDIT.md`. No outstanding advisories are accepted.
- The production session-secret guard is lazy: it triggers only when a session
  token is signed or verified. A route that never reads the session (e.g. `/`)
  still responds normally with a weak secret; login/session routes fail closed.
- Shell environment variables take precedence over `apps/web/.env` at runtime, so
  an operator can override the file value by exporting `SESSION_SECRET`.
- The production Docker image has not been built in this environment (Docker is
  not installed here); the first build should be smoke-checked on a Docker host.
  See `docs/DEPLOYMENT.md`.
- Publishing to GitHub / deploying to Vercel remains blocked on explicit user
  authorization.
