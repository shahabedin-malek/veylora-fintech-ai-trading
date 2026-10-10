import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ComplianceRefusedError,
  activeComplianceProvider,
  complianceConfigured,
  complianceStatus,
  registerComplianceProvider,
  requireJurisdictionOrThrow,
  screenTransferOrThrow,
} from "@/lib/compliance";
import type { ComplianceProvider } from "@/lib/compliance";

/**
 * The compliance boundary is a policy gate in front of real money. Its properties are
 * structural: the default performs no screening and says so (never claims compliance it
 * does not have), a registered provider can refuse, and a provider that *fails* is
 * treated as a refusal (fail-closed on failure) rather than an implicit allow.
 */

const transfer = {
  userId: "u1",
  address: `0x${"ab".repeat(20)}`,
  amountCents: 5_000,
  direction: "WITHDRAWAL" as const,
};

afterEach(() => vi.unstubAllEnvs());

describe("the default compliance provider", () => {
  it("is the inert no-op and never claims to screen", async () => {
    vi.stubEnv("COMPLIANCE_PROVIDER", "");
    expect(activeComplianceProvider().name).toBe("none");
    expect(complianceConfigured()).toBe(false);
    await expect(screenTransferOrThrow(transfer)).resolves.toBeUndefined();
    const status = complianceStatus();
    expect(status.screeningEnabled).toBe(false);
    expect(status.note).toMatch(/NOT running/);
  });

  it("falls back to the no-op for an unknown provider rather than crashing", () => {
    vi.stubEnv("COMPLIANCE_PROVIDER", "does-not-exist");
    expect(activeComplianceProvider().name).toBe("none");
    expect(complianceConfigured()).toBe(false);
  });
});

function register(slug: string, overrides: Partial<ComplianceProvider> = {}): void {
  const provider: ComplianceProvider = {
    name: slug,
    isConfigured: () => true,
    screenUser: async () => ({ allowed: true }),
    screenTransfer: async () => ({ allowed: true }),
    allowedJurisdiction: async () => ({ allowed: true }),
    ...overrides,
  };
  registerComplianceProvider(slug, provider);
}

describe("a registered provider", () => {
  it("reports screening as active and can refuse a movement", async () => {
    register("refuser", {
      screenTransfer: async () => ({ allowed: false, reason: "sanctions list hit" }),
    });
    vi.stubEnv("COMPLIANCE_PROVIDER", "refuser");
    expect(complianceConfigured()).toBe(true);
    expect(complianceStatus().screeningEnabled).toBe(true);
    await expect(screenTransferOrThrow(transfer)).rejects.toThrow(ComplianceRefusedError);
    await expect(screenTransferOrThrow(transfer)).rejects.toThrow(/sanctions list hit/);
  });

  it("fails closed when the provider itself throws", async () => {
    register("broken", {
      screenTransfer: async () => {
        throw new Error("vendor unavailable");
      },
    });
    vi.stubEnv("COMPLIANCE_PROVIDER", "broken");
    await expect(screenTransferOrThrow(transfer)).rejects.toThrow(/screening failed/);
  });

  it("gates jurisdictions independently", async () => {
    register("geo", {
      allowedJurisdiction: async () => ({ allowed: false, reason: "not available in your region" }),
    });
    vi.stubEnv("COMPLIANCE_PROVIDER", "geo");
    await expect(requireJurisdictionOrThrow({ userId: "u1", country: "XX" })).rejects.toThrow(
      /not available in your region/
    );
  });

  it("cannot be registered under the reserved no-op slug", () => {
    expect(() => register("none")).toThrow(/reserved/);
  });
});
