/**
 * Custody spend limits — the caps enforced at the custody boundary before any real
 * key is used (PHASE18-004; see docs/NETWORK_BOUNDARY.md).
 *
 * Deliberately pure and dependency-free so the rule can be reasoned about and
 * tested without a KMS/HSM: the caller supplies the amount and the rolling total
 * already spent today, this module decides. A value that would breach a cap is
 * **refused**, never trimmed down to the cap — a user who asked to move $10,000
 * must not silently get $1,000 instead.
 */

export interface SpendLimits {
  /** Largest amount a single real movement may move. */
  maxPerTransactionCents: number;
  /** Largest total a single real key may move within one rolling day. */
  maxDailyCents: number;
}

export type SpendDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/** Thrown when a real movement would breach a custody spend limit. */
export class SpendLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpendLimitExceededError";
  }
}

/** Human-readable USD from integer cents, for refusals only. */
export function spendUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Decide whether a real movement may proceed. Ordering matters: the amount itself
 * is validated first, then the per-transaction cap, then the daily cap.
 */
export function evaluateSpend(args: {
  amountCents: number;
  spentTodayCents: number;
  limits: SpendLimits;
}): SpendDecision {
  const { amountCents, spentTodayCents, limits } = args;

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { allowed: false, reason: "Amount must be a positive whole number of cents." };
  }
  if (amountCents > limits.maxPerTransactionCents) {
    return {
      allowed: false,
      reason: `Amount ${spendUsd(amountCents)} exceeds the per-transaction custody limit of ${spendUsd(
        limits.maxPerTransactionCents
      )}.`,
    };
  }
  if (spentTodayCents + amountCents > limits.maxDailyCents) {
    return {
      allowed: false,
      reason: `Amount ${spendUsd(amountCents)} would exceed the daily custody limit of ${spendUsd(
        limits.maxDailyCents
      )} (already spent ${spendUsd(spentTodayCents)} today).`,
    };
  }
  return { allowed: true };
}

/** Fail-closed form of `evaluateSpend` — throws rather than returning a decision. */
export function assertSpendAllowed(args: {
  amountCents: number;
  spentTodayCents: number;
  limits: SpendLimits;
}): void {
  const decision = evaluateSpend(args);
  if (!decision.allowed) throw new SpendLimitExceededError(decision.reason);
}
