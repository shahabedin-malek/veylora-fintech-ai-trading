import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ExecutionUnavailableError,
  REAL_EXECUTOR_IMPLEMENTED,
  executionGate,
  mainnetExecutionEnabled,
  requireExecution,
} from "@/lib/execution";

/**
 * The execution gate is the server-side decision for real money paths. It is tested
 * directly (not through the UI) because the safety property is structural: a session
 * must be refused unless **every** layer allows it — an implemented executor and
 * available custody, with the kill switch clear. There is no practice fallback.
 */

/** Satisfy the custody layer: a `coinbase-cdp` reference plus its credentials. */
function configureCustody() {
  vi.stubEnv("CUSTODY_PROVIDER", "coinbase-cdp");
  vi.stubEnv("CUSTODY_KEY_ID", "hot-wallet");
  vi.stubEnv("CDP_API_KEY_ID", "key-id");
  vi.stubEnv("CDP_API_KEY_SECRET", "key-secret");
  vi.stubEnv("CDP_WALLET_SECRET", "wallet-secret");
}

/** Force the custody layer unconfigured, whatever the ambient environment holds. */
function clearCustody() {
  for (const name of [
    "CUSTODY_PROVIDER",
    "CUSTODY_KEY_ID",
    "CDP_API_KEY_ID",
    "CDP_API_KEY_SECRET",
    "CDP_WALLET_SECRET",
  ]) {
    vi.stubEnv(name, "");
  }
}

afterEach(() => vi.unstubAllEnvs());

describe("the gate is fail-closed", () => {
  it("enables real execution by default", () => {
    // Real funds are the point, so the flag is a kill switch, not an opt-in: the
    // default state (unset) and any non-"0" value stay enabled.
    expect(mainnetExecutionEnabled()).toBe(true);
    for (const value of ["", "1", "true"]) {
      vi.stubEnv("MAINNET_EXECUTION_ENABLED", value);
      expect(mainnetExecutionEnabled(), `value=${value}`).toBe(true);
    }
  });

  it("refuses when custody is not configured", () => {
    clearCustody();
    expect(mainnetExecutionEnabled()).toBe(true);
    expect(REAL_EXECUTOR_IMPLEMENTED).toBe(true);

    const gate = executionGate("MAINNET");
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/custody/i);
  });

  it("allows a session once custody is configured", () => {
    configureCustody();
    const gate = executionGate("MAINNET");
    expect(gate.allowed).toBe(true);
    expect(gate.reason).toBeUndefined();
  });

  it("refuses every action when the kill switch is set, even with custody", () => {
    vi.stubEnv("MAINNET_EXECUTION_ENABLED", "0");
    configureCustody();

    expect(mainnetExecutionEnabled()).toBe(false);
    const gate = executionGate("MAINNET");
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/disabled/i);
  });
});

describe("requireExecution throws rather than returning a value a caller can ignore", () => {
  it("throws ExecutionUnavailableError without custody", () => {
    clearCustody();
    expect(() => requireExecution("MAINNET")).toThrow(ExecutionUnavailableError);
  });

  it("passes once custody is in place", () => {
    configureCustody();
    expect(requireExecution("MAINNET").allowed).toBe(true);
  });

  it("throws when the kill switch is set", () => {
    vi.stubEnv("MAINNET_EXECUTION_ENABLED", "0");
    configureCustody();
    expect(() => requireExecution("MAINNET")).toThrow(ExecutionUnavailableError);
  });
});
