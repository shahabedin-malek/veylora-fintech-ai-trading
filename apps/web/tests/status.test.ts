import { describe, expect, it } from "vitest";

import { integrationStatuses, statusSummary } from "@/lib/status";

/**
 * The status helper is public-facing, so the properties that matter are: it decides purely
 * on presence/shape, it reports a missing required item honestly, it never returns a value,
 * and every item carries a human label and a note.
 */

const CORE = { DATABASE_URL: "file:./x.db", SESSION_SECRET: "x".repeat(32) };

describe("integrationStatuses", () => {
  it("flags a missing datastore and weak session secret as required-but-absent", () => {
    const items = integrationStatuses({});
    const db = items.find((i) => i.id === "database")!;
    const session = items.find((i) => i.id === "session")!;
    expect(db).toMatchObject({ required: true, configured: false });
    expect(session).toMatchObject({ required: true, configured: false });
  });

  it("treats a too-short session secret as not configured", () => {
    const items = integrationStatuses({ DATABASE_URL: "file:./x.db", SESSION_SECRET: "short" });
    expect(items.find((i) => i.id === "session")!.configured).toBe(false);
  });

  it("reports capabilities on when their variables are present", () => {
    const items = integrationStatuses({
      ...CORE,
      CDP_API_KEY_ID: "id",
      CDP_API_KEY_SECRET: "secret",
      CRON_SECRET: "cron",
      CREDENTIAL_ENCRYPTION_KEY: "enc",
    });
    const byId = Object.fromEntries(items.map((i) => [i.id, i.configured]));
    expect(byId.onramp).toBe(true);
    expect(byId.cron).toBe(true);
    expect(byId["key-pool"]).toBe(true);
    // Custody needs more than the API key pair.
    expect(byId.custody).toBe(false);
  });

  it("counts the keyless market feed as always available", () => {
    const items = integrationStatuses({});
    expect(items.find((i) => i.id === "market-keyless")!.configured).toBe(true);
  });

  it("never returns a configuration value", () => {
    const secret = "super-secret-value-1234567890";
    const items = integrationStatuses({ ...CORE, ALTFINS_API_KEY: secret });
    const serialised = JSON.stringify(items);
    expect(serialised).not.toContain(secret);
    for (const item of items) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.note.length).toBeGreaterThan(0);
    }
  });

  it("has unique ids", () => {
    const ids = integrationStatuses({}).map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("statusSummary", () => {
  it("is core-ready only when every required item is configured", () => {
    expect(statusSummary({}).coreReady).toBe(false);
    expect(statusSummary(CORE).coreReady).toBe(true);
    expect(statusSummary({ DATABASE_URL: "file:./x.db" }).missingRequired).toContain("Session signing");
  });
});
