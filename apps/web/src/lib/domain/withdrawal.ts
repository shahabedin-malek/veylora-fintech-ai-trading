import { clampNonNegativeCents } from "@/lib/domain/money";

export interface WithdrawalBreakdown {
  initialCents: number;
  pnlCents: number;
  feeCents: number;
  totalCents: number;
  feeBps: number;
}

/**
 * Transparent, fully-simulated withdrawal calculation:
 *
 *   Initial balance
 * + simulated P/L
 * - simulated platform fee (feeBps of gross)
 * = withdrawal total
 *
 * The platform fee is SIMULATED. This function never touches real funds.
 */
export function calculateWithdrawal(
  initialCents: number,
  pnlCents: number,
  feeBps: number
): WithdrawalBreakdown {
  const gross = initialCents + pnlCents;
  const feeCents = gross > 0 ? Math.round((gross * feeBps) / 10_000) : 0;
  const totalCents = clampNonNegativeCents(gross - feeCents);
  return { initialCents, pnlCents, feeCents, totalCents, feeBps };
}
