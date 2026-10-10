import { describe, expect, it } from "vitest";

import {
  auditCoinbaseCredentials,
  credentialWarnings,
  COINBASE_CREDENTIALS,
  formatCredentialAudit,
} from "@/lib/coinbase/credentials";

/**
 * The credential audit reads **presence and shape only** — never a value — so it is
 * safe to render and print. These tests pin that contract plus the hygiene rules.
 */

const FULL: Record<string, string> = {
  CUSTODY_PROVIDER: "coinbase-cdp",
  CUSTODY_KEY_ID: "hot-wallet",
  CDP_API_KEY_ID: "8f0f5d0c1a2b3c4d5e6f708192a3b4c5",
  CDP_API_KEY_SECRET: "a-very-long-secret-value-1234",
  CDP_WALLET_SECRET: "another-long-secret-value-5678",
  COINBASE_WEBHOOK_SECRET: "whsec_0123456789abcdef",
};

describe("auditCoinbaseCredentials", () => {
  it("with nothing configured, reports surfaces off and no warnings", () => {
    const audit = auditCoinbaseCredentials({});
    expect(audit.healthy).toBe(true);
    expect(audit.warnings).toEqual([]);
    for (const surface of audit.surfaces) {
      expect(surface.ready).toBe(false);
      expect(surface.missing.length).toBeGreaterThan(0);
    }
  });

  it("with everything configured, every surface is ready and healthy", () => {
    const audit = auditCoinbaseCredentials(FULL);
    expect(audit.healthy).toBe(true);
    expect(audit.surfaces.every((s) => s.ready)).toBe(true);
    expect(audit.warnings).toEqual([]);
  });

  it("flags a placeholder left in place", () => {
    const audit = auditCoinbaseCredentials({ ...FULL, CDP_API_KEY_ID: "your-cdp-api-key-id" });
    expect(audit.healthy).toBe(false);
    expect(audit.warnings.join(" ")).toMatch(/CDP_API_KEY_ID.*placeholder/i);
  });

  it("flags a secret that is obviously too short", () => {
    const audit = auditCoinbaseCredentials({ ...FULL, CDP_WALLET_SECRET: "short" });
    expect(audit.healthy).toBe(false);
    expect(audit.warnings.join(" ")).toMatch(/CDP_WALLET_SECRET.*shorter than/i);
  });

  it("flags stray whitespace from a copy-paste", () => {
    const audit = auditCoinbaseCredentials({ ...FULL, CDP_API_KEY_SECRET: ` ${FULL.CDP_API_KEY_SECRET} ` });
    expect(audit.warnings.join(" ")).toMatch(/whitespace/i);
  });

  it("flags a partially configured surface", () => {
    const audit = auditCoinbaseCredentials({ CDP_API_KEY_ID: FULL.CDP_API_KEY_ID });
    expect(audit.warnings.join(" ")).toMatch(/onramp\/offramp.*partially configured/i);
  });
});

describe("credentialWarnings", () => {
  const spec = COINBASE_CREDENTIALS.find((c) => c.name === "CDP_API_KEY_SECRET")!;

  it("returns nothing for a clean value", () => {
    expect(credentialWarnings("a-very-long-secret-value-1234", spec)).toEqual([]);
  });

  it("never returns the value itself", () => {
    const warnings = credentialWarnings("placeholder-value", spec);
    expect(warnings.join(" ")).not.toContain("placeholder-value");
  });
});

describe("formatCredentialAudit", () => {
  it("renders a report that never contains a credential value", () => {
    const report = formatCredentialAudit(auditCoinbaseCredentials(FULL));
    expect(report).toContain("Coinbase credential hygiene");
    expect(report).toContain("CDP_API_KEY_SECRET");
    expect(report).not.toContain(FULL.CDP_API_KEY_SECRET);
    expect(report).toContain("healthy");
  });
});
