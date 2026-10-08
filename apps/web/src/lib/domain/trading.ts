import { MIN_TRADE_CENTS, config } from "@/lib/config";

/**
 * Deterministic trading UI/business state machine.
 *
 * STATE 0  NOT LOGGED IN      deposit✗ start✗ stop✗ withdraw✗
 * STATE 1  LOGGED IN, NO FUNDS deposit✓ start✗ stop✗ withdraw✗
 * STATE 2  FUNDS DEPOSITED    deposit✓ start✓ stop✗ withdraw✓   (start requires balance ≥ MIN_TRADE_CENTS)
 * STATE 3  TRADING ACTIVE     deposit✓ start→StopTrade✓ stop✓ forceStop✓ withdraw✗
 * STATE 4  STOPPED            deposit✓ start✓ stop✗ withdraw✓
 *
 * All trading is SIMULATED (paper trading). Nothing here implies real returns.
 */
export const TradingState = {
  NOT_LOGGED_IN: 0,
  LOGGED_IN_NO_FUNDS: 1,
  FUNDS_DEPOSITED: 2,
  TRADING_ACTIVE: 3,
  STOPPED: 4,
} as const;
export type TradingStateValue = (typeof TradingState)[keyof typeof TradingState];

export type SessionStatus = "NONE" | "IDLE" | "ACTIVE" | "STOPPED";

export interface TradingContext {
  loggedIn: boolean;
  balanceCents: number;
  sessionStatus: SessionStatus;
}

export interface TradingControls {
  state: TradingStateValue;
  deposit: boolean;
  start: boolean;
  stop: boolean;
  forceStop: boolean;
  withdraw: boolean;
  /** Human-readable explanation when an action is disabled. */
  reason?: string;
  /** How much more is required to start trading (cents), when below minimum. */
  shortfallCents?: number;
  /** Whether stopping now should show the "trading under 5 minutes" warning. */
  stopNeedsWarning: boolean;
}

export function deriveControls(ctx: TradingContext, now: Date = new Date(), startedAt?: Date | null): TradingControls {
  const noWarning = (base: Omit<TradingControls, "stopNeedsWarning">): TradingControls => ({ ...base, stopNeedsWarning: false });

  if (!ctx.loggedIn) {
    return noWarning({ state: TradingState.NOT_LOGGED_IN, deposit: false, start: false, stop: false, forceStop: false, withdraw: false, reason: "Sign in to use the dashboard." });
  }

  const funded = ctx.balanceCents >= MIN_TRADE_CENTS;
  const active = ctx.sessionStatus === "ACTIVE";

  if (active) {
    const stopNeedsWarning = startedAt ? now.getTime() - startedAt.getTime() < config.stopWarningMs : false;
    return {
      state: TradingState.TRADING_ACTIVE,
      deposit: true,
      start: false, // the Start button becomes Stop Trade in the UI
      stop: true,
      forceStop: true,
      withdraw: false,
      reason: "Trading is active. Stop trading before withdrawing.",
      stopNeedsWarning,
    };
  }

  if (!funded) {
    const shortfall = Math.max(0, MIN_TRADE_CENTS - ctx.balanceCents);
    return noWarning({
      state: TradingState.LOGGED_IN_NO_FUNDS,
      deposit: true,
      start: false,
      stop: false,
      forceStop: false,
      withdraw: false,
      reason: `Add funds to start trading.`,
      shortfallCents: shortfall,
    });
  }

  // funded, not active
  if (ctx.sessionStatus === "STOPPED") {
    return noWarning({ state: TradingState.STOPPED, deposit: true, start: true, stop: false, forceStop: false, withdraw: true });
  }

  return noWarning({ state: TradingState.FUNDS_DEPOSITED, deposit: true, start: true, stop: false, forceStop: false, withdraw: true });
}

export const TRADING_STATE_LABEL: Record<TradingStateValue, string> = {
  0: "Not signed in",
  1: "Signed in — no funds",
  2: "Funded — ready to trade",
  3: "Trading active",
  4: "Trading stopped",
};

/** Simulated terminal event templates. These are always labelled as simulated. */
export const TERMINAL_TEMPLATES = [
  "Looking for opportunities…",
  "Scanning supported markets…",
  "Pairs found: BTC/USD, ETH/USD, SOL/USD (simulated)",
  "Analyzing market conditions…",
  "Checking liquidity…",
  "Checking configured market-data sources…",
  "Evaluating simulated strategy…",
  "Paper trade opened (simulated)…",
  "Paper trade updated (simulated)…",
] as const;
