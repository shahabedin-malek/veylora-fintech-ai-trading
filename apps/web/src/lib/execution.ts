/**
 * Server-side execution gate — the single decision point for whether a real,
 * value-bearing action may run.
 *
 * The app is **real-funds-only**: there is no paper fallback path. The
 * gate therefore decides only *whether* real execution is allowed, never whether to
 * fall back to a paper flow. A session whose chain is unsupported never reaches here
 * (it cannot sign in), so this consumes a class the client cannot forge.
 *
 * Fail closed, in layers: real execution is the norm, but a mainnet session still runs
 * only when a real executor exists (`REAL_EXECUTOR_IMPLEMENTED` — the Coinbase swap
 * adapter) *and* custody is configured and available. Any missing layer refuses the
 * action, and an operator can refuse **all** of them with the kill switch
 * (`MAINNET_EXECUTION_ENABLED=0`) without a code change.
 */

import type { NetworkClass } from "@/lib/network";
import { custodyAvailable } from "@/lib/custody";
import { wundertradingConfigured } from "@/lib/wundertrading/client";

/** Thrown by `requireExecution` when real execution is unavailable. */
export class ExecutionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionUnavailableError";
  }
}

/**
 * Whether real execution is permitted on this deployment. **On by default** — real
 * funds are the point. Set `MAINNET_EXECUTION_ENABLED=0` as a kill switch to refuse
 * every real money action without a code change.
 *
 * This is a *gate*, not the whole decision: a real path also needs an implemented
 * executor and configured custody (see `executionGate`), so a deployment without those
 * still refuses rather than signing anything. Any value other than `0` (including
 * unset) leaves it enabled.
 */
export function mainnetExecutionEnabled(): boolean {
  return process.env.MAINNET_EXECUTION_ENABLED?.trim() !== "0";
}

/**
 * Whether a real executor exists in this build. It does: the Coinbase EVM swap venue
 * adapter (`src/lib/coinbase/trading.ts`) is implemented, custody-signed and
 * spend-limited.
 */
export const REAL_EXECUTOR_IMPLEMENTED = true;

/**
 * The real executors this build ships. Each has its own preconditions, but they share
 * the same network check and the same kill switch, so the decision stays in one place.
 */
export type Executor = "coinbase-swap" | "wundertrading";

export interface ExecutionGate {
  /** The session's network class (derived server-side, never from the client). */
  network: NetworkClass;
  /** Which real executor the decision is for. */
  executor: Executor;
  /** Whether a value-bearing action may proceed. */
  allowed: boolean;
  /** Why it may not, when `allowed` is false. */
  reason?: string;
}

/**
 * Resolve the gate for a network class and executor. The only place the decision is
 * made — callers must not re-derive it themselves.
 *
 * `coinbase-swap` (the default, so existing callers are unchanged) needs an implemented
 * executor **and** configured custody, because custody signs the swap. `wundertrading`
 * is signed by the venue's own API rather than by custody, so it needs its own
 * credentials instead — but it is still mainnet-only and still obeys the kill switch.
 */
export function executionGate(network: NetworkClass, executor: Executor = "coinbase-swap"): ExecutionGate {
  // A practice network has no real executor to reach: value there has no real
  // backing, so a value-bearing real path is refused outright rather than
  // considered. Owner practice flows do not consult this gate at all.
  if (network !== "MAINNET") {
    return {
      network,
      executor,
      allowed: false,
      reason: "This network is a practice network — no real funds move on it.",
    };
  }
  if (!mainnetExecutionEnabled()) {
    return {
      network,
      executor,
      allowed: false,
      reason:
        "Real execution is disabled on this deployment (MAINNET_EXECUTION_ENABLED=0).",
    };
  }

  if (executor === "wundertrading") {
    if (!wundertradingConfigured()) {
      return {
        network,
        executor,
        allowed: false,
        reason:
          "WunderTrading is not configured on this deployment (WUNDERTRADING_API_KEY / WUNDERTRADING_SECRET_KEY).",
      };
    }
    return { network, executor, allowed: true };
  }

  if (!REAL_EXECUTOR_IMPLEMENTED) {
    return {
      network,
      executor,
      allowed: false,
      reason: "Real execution is not implemented on this deployment.",
    };
  }
  if (!custodyAvailable()) {
    return {
      network,
      executor,
      allowed: false,
      reason:
        "Real execution requires configured custody, which this deployment does not have.",
    };
  }

  return { network, executor, allowed: true };
}

/**
 * Fail-closed helper for money paths (deposit, withdraw, trading). Throws — rather than
 * returning a falsy value a caller could forget to check — so a value movement never
 * runs when the gate is closed.
 */
export function requireExecution(network: NetworkClass, executor: Executor = "coinbase-swap"): ExecutionGate {
  const gate = executionGate(network, executor);
  if (!gate.allowed) {
    throw new ExecutionUnavailableError(gate.reason ?? "Execution is unavailable.");
  }
  return gate;
}
