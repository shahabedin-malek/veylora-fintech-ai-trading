#!/usr/bin/env tsx
/**
 * `npm run check:provider-keys` — live provider smoke test (operator CLI).
 *
 * Loads `apps/web/.env` (the app's Next.js runtime does, a bare `tsx` script does not),
 * probes each provider's cheapest endpoint with its resolved key(s) — exercising the same
 * key-pool failover the adapters use — and prints a key-free report. It never prints a
 * credential.
 *
 * Exit code 0 = every configured provider answered (a gated `upgrade-required` or an
 * absent provider is not a failure); 1 = a configured key was rejected or errored.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { smokeProviders } from "../src/lib/credentials/smoke";

/** Minimal `.env` reader: `KEY=value` lines, `#` comments, optional quotes. */
function loadDotEnv(): void {
  const file = join(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "").trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const results = await smokeProviders();

const label: Record<string, string> = {
  ok: "ok",
  "upgrade-required": "upgrade required",
  rejected: "REJECTED",
  error: "ERROR",
  unconfigured: "not configured",
  "presence-only": "presence only",
};

for (const r of results) {
  const latency = r.latencyMs != null ? ` (${r.latencyMs}ms)` : "";
  console.log(`${r.provider.padEnd(16)} ${label[r.status] ?? r.status}${latency}${r.error ? ` — ${r.error}` : ""}`);
}

const failing = results.filter((r) => r.status === "rejected" || r.status === "error");
if (failing.length) {
  console.error(`\n${failing.length} provider(s) need attention.`);
  process.exit(1);
}
console.log("\nAll configured providers answered.");
