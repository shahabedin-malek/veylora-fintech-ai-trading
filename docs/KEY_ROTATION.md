# Credential Rotation Runbook

Operator procedure for rotating every credential the app holds (`PHASE19-007`). The
companion documents are `DEPLOYMENT.md` (where each value goes),
`API_CREDENTIAL_REQUIREMENTS.md` (what each value does) and `NETWORK_BOUNDARY.md` (why
the money paths refuse rather than degrade).

**Design principle: there is no rotation endpoint in the app.** Rotation is an
administrative action performed at the provider, then deployed. The app deliberately
exposes no "rotate key" route or server action — a web-facing endpoint that can change
signing credentials is a much larger attack surface than the operator console it
replaces, and rotation is rare, deliberate and auditable work.

**Why a mistake here is survivable:** every money path fails *closed*. With custody
credentials missing, malformed or rejected, `src/lib/custody` reports itself
unconfigured and the execution gate refuses mainnet money actions
(`src/lib/execution.ts`). A botched rotation therefore produces **refusals**, not
movements to an unintended destination. Verify that property before you start:

```bash
# /wallet renders the custody status; an unconfigured deployment says so explicitly.
npm run check:coinbase-credentials   # exit 0 = healthy, 1 = present-but-flagged/half-configured
```

## What to rotate, and how urgent

| Credential | Protects | Blast radius if leaked | Cadence | Rotated at |
| --- | --- | --- | --- | --- |
| `SESSION_SECRET` | signing session cookies | forged sessions for **your** deployment | 90 days, and on suspicion | this machine (`openssl rand`) |
| `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` | authenticating CDP API calls | API calls billed/limited to your CDP project | 90 days, and on suspicion | CDP Portal → API Keys |
| `CDP_WALLET_SECRET` | authorising wallet operations (signing/sending) | provider-side wallet operations for the project | 90 days, and on suspicion | CDP Portal → Non-custodial Wallet → Security |
| `COINBASE_WEBHOOK_SECRET` | webhook signature verification | forged deposit events (credit only if they match a real user + pass dedupe) | on suspicion, or when a subscription is replaced | CDP Portal → webhook subscription |
| `DATABASE_URL` (Postgres role) | reading/writing all app data | full data access | per provider policy (typically 90 days) | Postgres provider (e.g. Neon) |
| `CUSTODY_KEY_ID` (not a secret) | names the signing account | **not** a leak risk — a migration risk | on wallet migration only | CDP Portal / provider |
| `VERCEL_TOKEN` | deploying from this machine | deploy access to the Vercel project | 90 days, and on suspicion | Vercel account settings |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_WALLET_RPC_URL_*` | public client config | **none** — public by design | only if abused (see below) | Reown / RPC provider |

Order of operations is always the same, and it is the whole point of the runbook:

**issue new → deploy → verify → revoke old → record.** Revoking first is what creates
an outage; verifying last is what leaves a deployment silently signed by a credential
you believe you retired.

---

## 1. `SESSION_SECRET` (app-owned)

The lowest-risk rotation, and the one users notice: it invalidates every existing
session, so everyone signs in again.

1. Generate in a terminal that will not end up in your shell history you keep:
   `openssl rand -base64 32`.
2. Set it in the deployment's environment (Vercel → Settings → Environment Variables,
   or the container's env/compose file). Use a **different** value per environment.
3. Redeploy / restart.
4. Verify: `GET /` responds, a fresh sign-in works end to end, and an old session
   cookie is rejected (that is the intended outcome, not a failure).
5. Record it (see [Recording a rotation](#recording-a-rotation)). Never paste the
   value.

Local `.env` files and shell exports both override file values — a shell export wins
at runtime, so rotate the shell/environment too, not just the file.

## 2. `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` (zero-downtime)

CDP lets an API key be created before the old one is revoked, so this rotation has no
outage window. Rotate the **pair** together: a key id with the wrong secret is a
credential mismatch, which the audit reports as flagged.

1. CDP Portal → **API Keys** (`portal.cdp.coinbase.com/api-keys/secret`) → create a
   new secret API key and download it. The secret is shown **once**.
2. Put the new id/secret into the deployment environment. Keep the old pair in place
   nowhere — replace it — and keep the old key **still valid** in the portal.
3. Deploy.
4. Verify against production (a read path is enough — it proves authentication):
   - `npm run check:coinbase-credentials` on the operator machine, with the new
     values in `apps/web/.env`, exits `0` with no flagged entries.
   - `/admin/credentials` shows the CDP surfaces as `set` with no warnings.
   - A live read: the custody deposit address still resolves on `/wallet`, or
     `COINBASE_LIVE=1 npm run smoke:coinbase` for the full onramp/offramp + webhook
     smoke.
5. **Only then** revoke the old key in the CDP Portal.
6. Verify once more that the app still works — that re-read is the difference between
   "we revoked the unused key" and "we revoked the working one".

## 3. `CDP_WALLET_SECRET` (hard cutover — schedule it)

This is the credential to be careful with. Per the Coinbase CDP docs
(`coinbase/docs/wallets/002-api-key-wallets-quickstart.md`,
`coinbase/docs/auth/123-wallet-authentication.md`):

- It is generated at **Portal → Non-custodial Wallet → Security → Generate Wallet
  Secret** and is **shown exactly once** — miss it and you must generate another.
- It is *developer-managed, rotatable* key material that authorises account
  operations (creating accounts, signing and sending transactions) by minting
  short-lived JWTs for CDP's signing environment. Read-only calls (e.g. listing
  accounts or balances) need only the API key.
- Because it is an **authentication factor and not seed material**, the wallet
  addresses are created and held by CDP and do **not** change when the secret
  rotates. Verify that rather than trusting it — step 4 below is exactly that check.

If the portal invalidates the previous secret the moment a new one is generated, there
is no overlap: the deployment refuses custody actions until the new value is live.
That window is *fail-closed*, which is acceptable — but schedule it, and prefer a quiet
period over a busy one.

1. Confirm the current wallet's address and balance first (`/wallet` shows the deposit
   address) so you can prove continuity afterwards.
2. Optionally freeze new real movements for the window: set
   `MAINNET_EXECUTION_ENABLED=0` and redeploy. Mainnet money actions are then refused
   before custody is reached, so the rotation cannot race a live trade.
3. Generate the new wallet secret in the portal and copy it **once**, straight into
   your secrets manager.
4. Update `CDP_WALLET_SECRET` in the deployment environment and redeploy.
5. Verify, in this order:
   - `npm run check:coinbase-credentials` exits `0`.
   - The custody address read still returns the **same** address as step 1, and the
     balance is intact — proof the secret is an auth factor, not the wallet.
   - `/admin/credentials` shows `CDP_WALLET_SECRET` set with no warnings.
   - `CUSTODY_LIVE=1 npm test -- tests/custody.live.test.ts` (or a small signed
     movement inside the `CUSTODY_*` limits) proves signing works, not just reading.
6. If you had set the kill switch, clear `MAINNET_EXECUTION_ENABLED` and redeploy, then
   confirm a refusal-free mainnet session.
7. Retire the previous value from any escrow **after** a verified signed movement. An
   unverified cleanup is how a rotation becomes an outage two days later.

## 4. `COINBASE_WEBHOOK_SECRET` (replace the subscription)

Rotating means creating a **new subscription** with a new signing secret, because the
secret belongs to the subscription. Overlap is safe here: verified deliveries are
recorded once and de-duplicated by `eventId` (`WebhookEvent.eventId` is unique,
`src/lib/coinbase/ingest.ts`), so a duplicate delivery of the same event cannot credit
twice.

1. In the CDP Portal, create a new webhook subscription for the same endpoint with a
   new signing secret.
2. Put the new secret in the deployment environment and redeploy.
3. Verify: `/admin/webhooks` shows deliveries with status `PROCESSED` (or `IGNORED` /
   `UNMATCHED`, which are also healthy), and none are rejected for signature.
4. Delete the old subscription in the portal.
5. Remember the fail-closed default: with the variable unset, the receiver at
   `/api/webhooks/coinbase` accepts nothing. If you are mid-rotation and unsure, an
   **unset** secret is safer than a wrong one — it stops accepting rather than
   accepting unverified deliveries.

## 5. `DATABASE_URL` (Postgres role)

1. In the Postgres provider, create a new credential/role with the same grants.
2. Update `DATABASE_URL` in the deployment (use the **pooled** URL for the app).
3. Redeploy and verify the app reads and writes (sign in, load `/dashboard`, post a
   ticket).
4. Apply any pending migrations from an operator machine using the **direct**
   (non-pooled) URL — `prisma migrate deploy` can fail through a pooler. The
   migrations directory must match the provider; see `DEPLOYMENT.md` §Vercel.
5. Revoke the old credential at the provider.

## 6. `CUSTODY_KEY_ID` (wallet migration, not a rotation)

Not a secret — for `coinbase-cdp` it is the provider-side account name. Changing it
changes **which wallet signs**, so treat it as a funds migration:

1. Confirm the new account exists at the provider and note its address.
2. Sweep the balance out of the old account (a custody-signed withdrawal) or confirm
   it is empty. Funds left behind stay in the old account and are only reachable by
   restoring that account name.
3. Point `CUSTODY_KEY_ID` at the new account, deploy, and verify the deposit address
   shown on `/wallet` matches the new account.
4. Retire the old account at the provider only after step 2 is verified on-chain.

## 7. `VERCEL_TOKEN` and public client config

- `VERCEL_TOKEN` lives only in the operator's local `.env.deploy` (git-ignored). Rotate
  it in Vercel account settings, update the local file, and use it via the environment
  variable — never on a command line where it lands in shell history. Prefer
  `--token`-free invocations.
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and `NEXT_PUBLIC_WALLET_RPC_URL_*` are public:
  they ship in the client bundle. If one is abused, rotate it at the provider, set the
  new value, and **rebuild** — these are inlined at build time, so a runtime-only
  change has no effect. An RPC key must be restricted by origin/rate limit at the
  provider; it must never be a write-capable key.

---

## Emergency rotation (suspected leak)

1. **Stop the bleeding first:** set `MAINNET_EXECUTION_ENABLED=0` and redeploy. Every
   mainnet money action is refused at the execution gate, before custody is reached.
   This is a kill switch, not a permissions change — real funds stop moving.
2. Rotate in blast-radius order: `CDP_WALLET_SECRET`, then
   `CDP_API_KEY_ID`/`CDP_API_KEY_SECRET` (revoke the leaked key immediately rather
   than waiting for verification), then `COINBASE_WEBHOOK_SECRET`, then
   `SESSION_SECRET`, then `DATABASE_URL`.
3. Check what the leak could have been used for while the old credential was live:
   `/admin/webhooks` (unexpected events), custody spend entries
   (`custody.spend` audit rows) and the ledger, and the CDP Portal's own activity/
   usage view.
4. Clear `MAINNET_EXECUTION_ENABLED` only after the new credentials are verified with a
   signed movement.
5. Record the incident as a rotation entry (below) with the *reason* recorded and the
   key values omitted.

## Provider key pool (`/admin/credentials`)

Third-party provider keys (AltFins, FreeCryptoAPI, CoinMarketCap, Finnhub, WunderTrading,
Coinbase CDP) can be added from `/admin/credentials` and are stored **AES-256-GCM encrypted**
under `CREDENTIAL_ENCRYPTION_KEY`. The resolver tries the env key first, then each pooled key
by priority, rotating to the next when one is rejected (401/402/403/429). Adding a replacement
key and disabling the old one is a zero-downtime rotation — no redeploy needed.

- **Add/rotate a provider key.** Add the new key at `/admin/credentials` (lower `priority`
tries first), run the smoke test, then disable (or delete) the old key. Because a rejected key
cools down automatically, leaving an old key enabled is safe but noisy — remove it.
- **Rotating `CREDENTIAL_ENCRYPTION_KEY`.** This re-keys the whole store: existing rows become
**undecryptable**, so they must be re-entered. Procedure: generate a new
`openssl rand -base64 32`; with the old key still set, note every pooled provider/label pair;
swap the env var; redeploy; re-add each key at `/admin/credentials`; delete the failed rows
(they show as decrypt errors and are skipped). Do it in a maintenance window — until re-added,
those providers fall back to their env key.
- **Never** paste a pooled key into a ticket or log; the console shows only a fingerprint.

## Verification commands (copy/paste)

```bash
npm run check:coinbase-credentials    # presence/shape audit; never prints a value
CUSTODY_LIVE=1 npm test -- tests/custody.live.test.ts   # real custody signing (needs credentials)
COINBASE_LIVE=1 npm run smoke:coinbase                  # onramp/offramp + webhook smoke
LIVE_URL=https://<deployment> npx playwright test tests/e2e/live.spec.ts  # deployed smoke
npm run typecheck && npm test && npm run build          # release gate
```

`/admin/credentials` is the in-app mirror of the CLI audit, per surface, and states
plainly when a credential is unset — the app never reports a surface as working when
its credentials are missing.

## Recording a rotation

Append one entry to `.progress/DECISIONS.md` (or the operational log you keep) with:

- date and operator, the credential rotated (`name` only), the reason (scheduled /
  suspected leak / provider requirement),
- the verification evidence (which command ran, and its result),
- and what was revoked, and when.

Never record the value itself, and never paste one into a ticket or chat. The
credential-hygiene CLI reports presence and shape **only**, so its output is safe to
attach. If rotation is blocked by the provider (e.g. the portal will not let you
regenerate the wallet secret), escalate with Coinbase support before working around it
— a workaround that moves funds to a different wallet is a bigger incident than the
one you are fixing.
