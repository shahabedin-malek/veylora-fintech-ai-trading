/**
 * WunderTrading order adapter.
 *
 * The venue's `POST /position` can open a **live position on a real exchange account**,
 * so this module is deliberately strict:
 *
 * - **A stop loss is mandatory.** An automated position without a stop is the failure
 *   mode this whole subsystem exists to avoid, so an order that does not carry a
 *   positive `stopLoss` is refused rather than sent.
 * - **Spend caps are checked before anything is sent** (`config.venue.spendLimits`), and
 *   an over-limit order is refused, never trimmed.
 * - **It does not decide *whether* it may run.** That is the execution gate's job
 *   (`src/lib/execution.ts`, executor `wundertrading`), which the caller must consult
 *   first; the risk gate refuses before that. This module assumes it has already been
 *   authorised and simply refuses anything malformed.
 *
 * The vendor's own schema is passed through for the fields it defines; anything the app
 * cannot validate is not invented here.
 */

import { SpendLimitExceededError, assertSpendAllowed, spendUsd } from "@/lib/custody";
import { postPosition, venueSpendLimits } from "@/lib/wundertrading/client";

/** Thrown when an order is malformed, unprotected, or over the desk's limit. */
export class WundertradingRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WundertradingRefusedError";
  }
}

export interface WundertradingOrderInput {
  exchangeCode: string;
  pairCode: string;
  profilesCodes: string[];
  side: "buy" | "sell";
  /** The venue's order type (e.g. MARKET / LIMIT). Passed through. */
  orderType: string;
  amountPerTrade: string;
  amountPerTradeType: string;
  /** Required: exact stop-loss trigger price, greater than zero. */
  stopLoss: string;
  takeProfit?: string;
  /** USD value of the order in integer cents, computed by the caller from a real price. */
  notionalCents: number;
  /** Real venue orders already placed today, for the rolling daily cap. */
  spentTodayCents: number;
}

function positiveNumber(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0;
}

/**
 * Validate an order. Returns a human-readable problem, or `null` when it is well formed.
 * Pure, so the rule is testable without touching the venue.
 */
export function validateWundertradingOrder(input: WundertradingOrderInput): string | null {
  if (!input.exchangeCode.trim()) return "An order needs an exchange.";
  if (!input.pairCode.trim()) return "An order needs a pair.";
  if (!input.profilesCodes.length || input.profilesCodes.some((code) => !code.trim())) {
    return "An order needs at least one exchange API profile.";
  }
  if (input.side !== "buy" && input.side !== "sell") return "An order must be a buy or a sell.";
  if (!input.orderType.trim()) return "An order needs an order type.";
  if (!positiveNumber(input.amountPerTrade)) return "An order needs a positive amount.";
  if (!input.amountPerTradeType.trim()) return "An order needs an amount type.";
  if (!positiveNumber(input.stopLoss)) {
    return "A venue order must carry a stop loss with a price greater than zero.";
  }
  if (input.takeProfit !== undefined && input.takeProfit.trim() && !positiveNumber(input.takeProfit)) {
    return "A take profit must be a price greater than zero.";
  }
  if (!Number.isInteger(input.notionalCents) || input.notionalCents <= 0) {
    return "An order needs a positive USD notional (integer cents).";
  }
  return null;
}

export interface WundertradingExecution {
  /** The venue's raw response, recorded for audit. */
  result: unknown;
}

/**
 * Validate, cap-check, and send one order. Throws `WundertradingRefusedError` for a
 * malformed/unprotected/over-limit order, and `WundertradingUnavailableError` when the
 * request itself fails — never a silent success.
 */
export async function executeWundertradingOrder(
  input: WundertradingOrderInput
): Promise<WundertradingExecution> {
  const problem = validateWundertradingOrder(input);
  if (problem) throw new WundertradingRefusedError(problem);

  const limits = venueSpendLimits();
  try {
    assertSpendAllowed({
      amountCents: input.notionalCents,
      spentTodayCents: input.spentTodayCents,
      limits,
    });
  } catch (error) {
    if (error instanceof SpendLimitExceededError) {
      throw new WundertradingRefusedError(
        `Order refused: it exceeds the desk's real-money limit (max ${spendUsd(
          limits.maxPerTransactionCents
        )} per order, ${spendUsd(limits.maxDailyCents)} per day).`
      );
    }
    throw error;
  }

  const payload: Record<string, unknown> = {
    exchangeCode: input.exchangeCode.trim(),
    pairCode: input.pairCode.trim(),
    profilesCodes: input.profilesCodes.map((code) => code.trim()),
    side: input.side,
    orderType: input.orderType.trim(),
    amountPerTrade: input.amountPerTrade.trim(),
    amountPerTradeType: input.amountPerTradeType.trim(),
    stopLoss: input.stopLoss.trim(),
  };
  if (input.takeProfit?.trim()) payload.takeProfit = input.takeProfit.trim();

  return { result: await postPosition(payload) };
}
