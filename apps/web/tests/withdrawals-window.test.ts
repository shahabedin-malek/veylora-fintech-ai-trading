import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addBusinessDays,
  businessDaysUntil,
  disputeState,
  disputeWindow,
  disputeWindowDays,
} from "@/lib/withdrawals";

/**
 * The dispute window is the only clock in the product, and it exists so a declined user has
 * a bounded, stated chance to argue their case. Its arithmetic is deliberately simple —
 * Mon–Fri in UTC, **no public-holiday calendar** — so what matters here is that the simple
 * rule is the rule that actually runs, weekend edges included, and that the window is never
 * mistaken for a decision.
 */

/** Noon UTC on the given date, so a DST shift can never move the weekday under us. */
function at(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

afterEach(() => vi.unstubAllEnvs());

describe("business-day arithmetic", () => {
  it("counts only weekdays (Monday + 3 lands on Thursday)", () => {
    expect(iso(addBusinessDays(at("2026-10-05"), 3))).toBe("2026-10-08"); // Mon → Thu
  });

  it("skips the weekend (Friday + 3 lands on Wednesday)", () => {
    expect(iso(addBusinessDays(at("2026-10-09"), 3))).toBe("2026-10-14"); // Fri → Wed
  });

  it("never lands on a weekend, whatever the start day", () => {
    const start = at("2026-10-05");
    for (let day = 0; day < 14; day++) {
      const shifted = new Date(start.getTime() + day * 86_400_000);
      const result = addBusinessDays(shifted, 3);
      expect([0, 6], `${iso(shifted)} + 3 business days = ${iso(result)}`).not.toContain(result.getUTCDay());
    }
  });

  it("treats a holiday as an ordinary working day, by design", () => {
    // 2026-12-25 (Christmas) is a Friday; with no holiday calendar it still counts.
    expect(iso(addBusinessDays(at("2026-12-24"), 1))).toBe("2026-12-25");
    // ... and the window that runs over it is shorter in practice, which is why the UI
    // shows the exact closing date instead of relying on the reader's arithmetic.
    expect(iso(addBusinessDays(at("2026-12-24"), 3))).toBe("2026-12-29");
  });

  it("is a no-op for zero days and never goes backwards", () => {
    expect(iso(addBusinessDays(at("2026-10-09"), 0))).toBe("2026-10-09");
    expect(iso(addBusinessDays(at("2026-10-09"), -5))).toBe("2026-10-09");
  });

  it("counts remaining business days to the deadline", () => {
    expect(businessDaysUntil(at("2026-10-14"), at("2026-10-09"))).toBe(3); // Fri → Wed
    expect(businessDaysUntil(at("2026-10-09"), at("2026-10-09"))).toBe(0); // already closed
    expect(businessDaysUntil(at("2026-10-01"), at("2026-10-09"))).toBe(0); // in the past
  });
});

describe("the configured window", () => {
  /**
   * Configuration is read when the module loads (`src/lib/config.ts`), so an override is
   * exercised the way an operator experiences it: set the variable, restart, and the window
   * changes. `vi.resetModules()` gives this test that fresh boot.
   */
  async function bootedWith(value: string): Promise<number> {
    vi.stubEnv("DISPUTE_WINDOW_BUSINESS_DAYS", value);
    vi.resetModules();
    const fresh = await import("@/lib/withdrawals");
    return fresh.disputeWindowDays();
  }

  it("defaults to three business days", async () => {
    await expect(bootedWith("")).resolves.toBe(3);
  });

  it("follows the configured value", async () => {
    await expect(bootedWith("5")).resolves.toBe(5);
  });

  it("falls back to the default on a garbage value", async () => {
    await expect(bootedWith("not-a-number")).resolves.toBe(3);
  });

  it("uses the configured value when opening a window", () => {
    const decidedAt = at("2026-10-09"); // Friday
    expect(disputeWindowDays()).toBe(3); // the default in this process

    const window = disputeWindow(decidedAt);
    expect(iso(window.opensAt)).toBe("2026-10-09");
    expect(iso(window.closesAt)).toBe("2026-10-14");
  });

  it("opens at the decision and closes the given number of business days later", () => {
    const window = disputeWindow(at("2026-10-09"), 5);
    expect(iso(window.closesAt)).toBe("2026-10-16"); // Fri → the following Friday
  });
});

describe("dispute state", () => {
  const declined = {
    status: "DECLINED",
    disputeOpensAt: at("2026-10-09"),
    disputeClosesAt: at("2026-10-14"),
    disputeOutcome: null as string | null,
  };

  it("reports an open window with the business days left", () => {
    expect(disputeState(declined, at("2026-10-12"))).toMatchObject({
      open: true,
      expired: false,
      daysLeft: 2,
      outcome: null,
    });
  });

  it("reports an expired window as unresolved, not as settled", () => {
    // The window running out is not a decision: `open` stays true so it still needs an admin.
    expect(disputeState(declined, at("2026-10-20"))).toMatchObject({
      open: true,
      expired: true,
      daysLeft: 0,
      outcome: null,
    });
  });

  it("is closed once an admin resolves it", () => {
    expect(disputeState({ ...declined, disputeOutcome: "CLEARED" }, at("2026-10-12"))).toMatchObject({
      open: false,
      outcome: "CLEARED",
    });
  });

  it("only applies to a declined request", () => {
    expect(disputeState({ ...declined, status: "APPROVED" }, at("2026-10-12")).open).toBe(false);
    expect(disputeState({ status: "PENDING", disputeOpensAt: null, disputeClosesAt: null, disputeOutcome: null }).open).toBe(
      false
    );
  });
});
