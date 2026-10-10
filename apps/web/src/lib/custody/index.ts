/**
 * Custody boundary — the only place a real key is ever used.
 *
 * Decision (docs/NETWORK_BOUNDARY.md): a **custodial hot wallet** whose operational
 * keys live in a **KMS/HSM** (or, concretely, a provider-hosted wallet such as
 * Coinbase CDP Server Wallets) with spend limits. No private key, seed phrase or
 * signing secret may ever be an env var, in the repo, or in a log — so this module
 * deals only in **key references** (`CUSTODY_PROVIDER`/`CUSTODY_KEY_ID`, an opaque
 * provider-side id) and hands back a `CustodySigner` whose key stays with the
 * provider. Nothing here can read, return or log key material.
 *
 * **Fail closed.** A backend must be both configured *and* selected to sign; any
 * other state throws `CustodyUnavailableError`. The spend limits
 * (`src/lib/custody/policy.ts`) are checked *before* a signer is requested, so an
 * over-limit movement is refused even when custody is configured.
 *
 * Wired backends: `coinbase-cdp` (`providers/coinbase-cdp.ts`). The execution gate
 * (`src/lib/execution.ts`) additionally requires a real venue (`PHASE18-005`), so
 * making custody available here does not, by itself, let mainnet move funds.
 */

import { config } from "@/lib/config";
import {
  assertSpendAllowed,
  evaluateSpend,
  type SpendDecision,
  type SpendLimits,
} from "@/lib/custody/policy";
import type { CustodyAdapter, CustodyKeyReference, CustodySigner } from "@/lib/custody/types";
import { COINBASE_CDP_PROVIDER, coinbaseCdpAdapter } from "@/lib/custody/providers/coinbase-cdp";

export {
  SpendLimitExceededError,
  assertSpendAllowed,
  evaluateSpend,
  spendUsd,
  type SpendDecision,
  type SpendLimits,
} from "@/lib/custody/policy";
export type { CustodyAdapter, CustodyKeyReference, CustodySigner } from "@/lib/custody/types";
export { COINBASE_CDP_PROVIDER, COINBASE_CDP_ENV_VARS } from "@/lib/custody/providers/coinbase-cdp";

/**
 * Whether a real custody signer exists in this build. True now: the `coinbase-cdp`
 * backend is implemented. It still requires the backend to be *selected and
 * configured* — see `custodyAvailable()` — and a real venue (`PHASE18-005`) before
 * any mainnet money path is reachable.
 */
export const REAL_CUSTODY_IMPLEMENTED = true;

/** Registered backends, keyed by the `CUSTODY_PROVIDER` value that selects them. */
const ADAPTERS: Readonly<Record<string, CustodyAdapter>> = {
  [COINBASE_CDP_PROVIDER]: coinbaseCdpAdapter,
};

/** Thrown when a real movement was requested but no custody signer is available. */
export class CustodyUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustodyUnavailableError";
  }
}

/** The configured key reference, or null when custody is not configured at all. */
export function custodyKeyReference(): CustodyKeyReference | null {
  const provider = process.env.CUSTODY_PROVIDER?.trim();
  const keyId = process.env.CUSTODY_KEY_ID?.trim();
  if (!provider || !keyId) return null;
  return { provider, keyId };
}

/** The spend limits enforced at this boundary. */
export function custodySpendLimits(): SpendLimits {
  return config.custody.spendLimits;
}

/**
 * Whether the selected backend has the credentials it needs. A selected-but-unknown
 * provider, a missing reference, or missing credentials all yield false.
 */
export function custodyConfigured(): boolean {
  const reference = custodyKeyReference();
  if (!reference) return false;
  const adapter = ADAPTERS[reference.provider];
  return adapter ? adapter.isConfigured() : false;
}

/** Whether a real movement could be signed right now. */
export function custodyAvailable(): boolean {
  return REAL_CUSTODY_IMPLEMENTED && custodyConfigured();
}

/**
 * Resolve the operational key reference, or throw. Never returns or logs key
 * material — there is none here to return.
 */
export function requireCustody(): CustodyKeyReference {
  if (!REAL_CUSTODY_IMPLEMENTED) {
    throw new CustodyUnavailableError(
      "Custodial key signing is not implemented on this deployment, so no real funds can move."
    );
  }
  const reference = custodyKeyReference();
  if (!reference) {
    throw new CustodyUnavailableError(
      "Custody is not configured (CUSTODY_PROVIDER / CUSTODY_KEY_ID), so no real funds can move."
    );
  }
  if (!ADAPTERS[reference.provider]) {
    throw new CustodyUnavailableError(
      `Custody provider "${reference.provider}" is not a supported backend, so no real funds can move.`
    );
  }
  if (!custodyConfigured()) {
    throw new CustodyUnavailableError(
      `Custody provider "${reference.provider}" is missing its credentials, so no real funds can move.`
    );
  }
  return reference;
}

/**
 * Resolve a signer whose key stays with the provider. Throws when custody is not
 * available — fail closed, never a local fallback.
 */
export async function getCustodySigner(): Promise<CustodySigner> {
  const reference = requireCustody();
  return ADAPTERS[reference.provider].getSigner(reference);
}

/**
 * Authorize a real movement against the custody spend limits before any signature
 * is requested. The caps are checked first (deterministic, cheap), then a signer is
 * required — so an over-limit request is refused even with custody configured.
 */
export function authorizeCustodySpend(amountCents: number, spentTodayCents: number): void {
  assertSpendAllowed({ amountCents, spentTodayCents, limits: custodySpendLimits() });
  requireCustody();
}
