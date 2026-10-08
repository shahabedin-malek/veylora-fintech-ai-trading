import { describe, expect, it } from "vitest";
import { TradingState, deriveControls } from "@/lib/domain/trading";
import { calculateWithdrawal } from "@/lib/domain/withdrawal";
import { formatUsd, usdToCents } from "@/lib/domain/money";
import { MIN_TRADE_CENTS } from "@/lib/config";

describe("trading state machine", () => {
  it("STATE 0: not logged in disables everything", () => {
    const c = deriveControls({ loggedIn: false, balanceCents: 0, sessionStatus: "NONE" });
    expect(c.state).toBe(TradingState.NOT_LOGGED_IN);
    expect([c.deposit, c.start, c.stop, c.withdraw]).toEqual([false, false, false, false]);
  });

  it("STATE 1: logged in with no funds allows deposit only", () => {
    const c = deriveControls({ loggedIn: true, balanceCents: 0, sessionStatus: "NONE" });
    expect(c.state).toBe(TradingState.LOGGED_IN_NO_FUNDS);
    expect(c.deposit).toBe(true);
    expect(c.start).toBe(false);
    expect(c.withdraw).toBe(false);
    expect(c.shortfallCents).toBe(MIN_TRADE_CENTS);
  });

  it("STATE 2: funded allows deposit/start/withdraw", () => {
    const c = deriveControls({ loggedIn: true, balanceCents: MIN_TRADE_CENTS, sessionStatus: "IDLE" });
    expect(c.state).toBe(TradingState.FUNDS_DEPOSITED);
    expect([c.deposit, c.start, c.withdraw]).toEqual([true, true, true]);
    expect(c.stop).toBe(false);
  });

  it("STATE 3: active disables start and withdraw, enables stop and force stop", () => {
    const c = deriveControls({ loggedIn: true, balanceCents: 100_00, sessionStatus: "ACTIVE" }, new Date());
    expect(c.state).toBe(TradingState.TRADING_ACTIVE);
    expect(c.start).toBe(false);
    expect(c.withdraw).toBe(false);
    expect(c.stop).toBe(true);
    expect(c.forceStop).toBe(true);
  });

  it("STATE 3: flags the 5-minute warning for a fresh session", () => {
    const now = new Date("2026-01-01T00:01:00Z");
    const started = new Date("2026-01-01T00:00:00Z");
    const c = deriveControls({ loggedIn: true, balanceCents: 100_00, sessionStatus: "ACTIVE" }, now, started);
    expect(c.stopNeedsWarning).toBe(true);
  });

  it("STATE 3: no warning after 5 minutes", () => {
    const now = new Date("2026-01-01T00:06:00Z");
    const started = new Date("2026-01-01T00:00:00Z");
    const c = deriveControls({ loggedIn: true, balanceCents: 100_00, sessionStatus: "ACTIVE" }, now, started);
    expect(c.stopNeedsWarning).toBe(false);
  });

  it("STATE 4: stopped allows restart and withdrawal", () => {
    const c = deriveControls({ loggedIn: true, balanceCents: 100_00, sessionStatus: "STOPPED" });
    expect(c.state).toBe(TradingState.STOPPED);
    expect(c.start).toBe(true);
    expect(c.withdraw).toBe(true);
    expect(c.stop).toBe(false);
  });

  it("minimum balance boundary: just below minimum cannot start", () => {
    const c = deriveControls({ loggedIn: true, balanceCents: MIN_TRADE_CENTS - 1, sessionStatus: "NONE" });
    expect(c.start).toBe(false);
    expect(c.shortfallCents).toBe(1);
  });
});

describe("withdrawal calculation", () => {
  it("applies the simulated fee to the gross amount", () => {
    const b = calculateWithdrawal(usdToCents(100), usdToCents(10), 100); // 1%
    expect(b.feeCents).toBe(usdToCents(1.1));
    expect(b.totalCents).toBe(usdToCents(108.9));
  });

  it("never returns a negative total", () => {
    const b = calculateWithdrawal(usdToCents(10), usdToCents(-50), 100);
    expect(b.totalCents).toBe(0);
  });

  it("zero fee leaves total equal to gross", () => {
    const b = calculateWithdrawal(usdToCents(100), usdToCents(5), 0);
    expect(b.totalCents).toBe(usdToCents(105));
  });
});

describe("money formatting", () => {
  it("formats signed values", () => {
    expect(formatUsd(usdToCents(12.5), { sign: true })).toBe("+$12.50");
    expect(formatUsd(usdToCents(-3), { sign: true })).toBe("-$3.00");
  });
});
