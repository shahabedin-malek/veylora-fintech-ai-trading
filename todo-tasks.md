# TODO TASKS — remaining / open

> Snapshot exported from the `.progress/` control plane, updated 2026-10-09 after the
> Phase 18/19 implementation pass. Sources: `.progress/TASK_STATUS.md`,
> `.progress/TASK_QUEUE.md`, `.progress/MASTER_PROGRESS.md`, plus this change.
> Total tasks: **213** — 202 verified at export · 7 advanced by this pass · 2 dropped.

## Completed in this pass

- `PHASE18-005` — on-chain custody transfers: `custodyDepositAddress()` + a
  custody-signed withdrawal (`src/lib/custody/transfers.ts`), wired to
  `startOnChainWithdrawalAction` and surfaced on `/wallet`. Spend-limited, compliance-
  gated, idempotent, and only reachable from a mainnet session with custody configured.
- `PHASE18-004` (follow-ups) — **persisted rolling spend ledger** (`CustodySpend` model
  + `src/lib/custody/spend-ledger.ts`) replaces the caller-supplied `spentTodayCents`,
  plus a `custody.spend` **audit trail**. `sendTransaction` added to the custody signer
  so the provider broadcasts (no RPC/key in the app).
- `PHASE18-007` / `PHASE19-010` — **pluggable compliance boundary**
  (`src/lib/compliance/`): provider contract + registry + fail-closed helpers, with an
  inert **no-op default** (`COMPLIANCE_PROVIDER=none`, reported as *not screening*).
  Wired into the real swap and on-chain withdrawal paths. Real vendor integration is
  still required to actually screen (see below).
- `PHASE19-008` — tests added: `tests/compliance.test.ts`,
  `tests/custody-transfers.test.ts`, `tests/integration/custody-withdraw.test.ts`
  (suite: **234 passing**).
- `PHASE19-009` — the offramp withdrawal button was already wired on `/wallet`; the
  on-chain deposit/withdraw surface was added here.

## Still open (account-side / decisions — not code)

- `PHASE19-007` — Coinbase CDP credentials sandbox→live and **key rotation**. The audit
  trail (`custody.spend` entries), the presence/shape audit (`/admin/credentials`,
  `npm run check:coinbase-credentials`) and a **rotation runbook**
  (`docs/KEY_ROTATION.md`) now exist. Deliberately still unbuilt: an in-app rotation
  endpoint (rotation is an administrative provider action, and a web endpoint that can
  change signing credentials is a larger attack surface than the console it replaces).
- `PHASE18-007` / `PHASE19-010` — compliance. **Partially done:**
  `COMPLIANCE_PROVIDER=sanctions-list` is a real, credential-free backend that screens
  wallet addresses and withdrawal destinations against the published **OFAC SDN** list,
  refuses a hit and fails closed when the list is unreadable
  (`src/lib/compliance/providers/sanctions-list.ts`); the default stays the honest no-op
  that reports screening as *off*. Still vendor work: KYC/identity and PEP screening,
  non-US lists (EU/UK/UN), a country source for jurisdiction gating, and licensing.
- `PHASE19-004` — the custody-signed Coinbase swap adapter is implemented; the QUEUE
  entry looks stale and should be reconciled in the task DB.
- `PHASE19-008` — sandbox coverage could still be extended (live Coinbase sandbox run
  is gated on credentials).

## Added since this export (2026-10-10)

- **Withdrawal approval workflow** — a non-admin user *requests* a withdrawal; the amount
  is reserved from their balance, and an admin approves or declines it at
  `/admin/withdrawals`. A decline **returns the amount to the user** (reason recorded); an
  approval settles the app-signable rail (compliance → spend caps → custody-signed
  transfer) or clears the Coinbase hand-off; a payout refused before signing is refunded,
  and one that may have been broadcast stays held until an admin releases it.
  `src/lib/withdrawals.ts`, `tests/integration/withdrawal-requests.test.ts`,
  `tests/e2e/withdrawal-approval.spec.ts`.
- **Account hold** — an admin can freeze an account's withdrawals and trades with a
  required reason and an audit entry. It never moves or forfeits the balance.
- **Dispute window & account ban** — a declined request opens a bounded window (business
  days, `DISPUTE_WINDOW_BUSINESS_DAYS`) argued in the support thread assigned to the
  declining admin; resolving it as *misuse confirmed* **bans** the account (login/access
  refused, existing sessions invalidated) and freezes the balance. It never transfers funds.
  `src/lib/withdrawals.ts`, `tests/withdrawals-window.test.ts`,
  `tests/integration/withdrawal-requests.test.ts`.
- **Market news from verified RSS feeds** — the home page shows picture cards and every
  other page an image-free sidebar (`NewsRail`), fed only by real, configured feeds
  (curated defaults verified in `docs/NEWS_SOURCES.md`). Each item carries its published
  image when the feed has one; headlines are never fabricated. `/markets` browses the full
  feed filtered by asset class (`?news=crypto|forex|equity`, `src/lib/market/news-filter.ts`).
  `src/lib/market/index.ts`, `src/components/NewsRail*.tsx`, `tests/news-images.test.ts`,
  `tests/news-filter.test.ts`.
- **Compliance screening is real, not a no-op, when configured** —
  `COMPLIANCE_PROVIDER=sanctions-list` screens wallet addresses and withdrawal
  destinations against the published OFAC SDN list (`PHASE18-007` / `PHASE19-010`).
- **Key rotation runbook** — `docs/KEY_ROTATION.md` (`PHASE19-007`).
- **Destinations are verified, not merely shaped** — burn address refused and EIP-55
  checksum enforced (`verifyEvmAddress`), and every money form carries a stable
  idempotency key (guarded by `tests/money-forms.test.ts`).

> Deliberately **not** built: any path that moves a declined, held or banned user's funds to
> an operator wallet (including `0x5a40…Bf8c`). Declining returns the amount; a hold or a ban
> freezes it. Forfeiture is a policy decision for a documented, adjudicated process — not an
> automatic side effect of a decline or a ban.

## Dropped (intentionally not done, 2)

- `PHASE10-002` — Distributed task router + Windows worker (optional, no current requirement)
- `PHASE3-002` — Prune verified temporary extraction data on the HDD (optional)

## Phase state

- **Closed:** Phase 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17
- **Still open:** Phase 18, Phase 19 (remaining items above are account-side or decisions)

> The `.progress/*.md` files are rendered from the task DB by
> `scripts/progress_report.py`. Update the DB (not just this file) to keep the
> authoritative counts in step.
