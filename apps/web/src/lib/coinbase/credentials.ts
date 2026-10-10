/**
 * Coinbase credential hygiene (`PHASE19-007`).
 *
 * A single, framework-free audit of the credentials the Coinbase surfaces depend on:
 * which are present, which surface each one unlocks, and whether a *present* value
 * looks unsafe (a placeholder left in place, a secret that is obviously too short, or
 * a value with accidental leading/trailing whitespace from a copy-paste).
 *
 * It is the honest counterpart to the fail-closed gates elsewhere: a deployment can
 * always answer "what is configured, and is anything misconfigured?" without ever
 * reading a secret's value into a response. **No value is ever returned** — only a
 * boolean and a reason — so this is safe to render on the admin page and print from
 * `npm run check:coinbase-credentials`.
 *
 * Grounded in the split docs: `coinbase/docs/platform/004-getting-started.md`,
 * `006-jwt-authentication.md`, `007-*-api-keys.md`, `008-*-sandbox.md` and
 * `coinbase/docs/security/*` (see `coinbase/INTEGRATION.md` §5).
 */

/** A product surface that a credential unlocks. */
export type CredentialSurface = "onramp/offramp" | "custody" | "trading" | "webhooks";

export const CREDENTIAL_SURFACES: readonly CredentialSurface[] = [
  "onramp/offramp",
  "custody",
  "trading",
  "webhooks",
];

export interface CredentialSpec {
  name: string;
  /** A secret — its value must never be logged, echoed, committed or rendered. */
  secret: boolean;
  /** What the credential is for (shown in the console). */
  purpose: string;
  /** Surfaces that stop working when it is missing. */
  surfaces: readonly CredentialSurface[];
  /** Minimum sensible length for a secret, for the hygiene check. */
  minSecretLength: number;
  /** Where the operator rotates it. */
  rotateUrl: string;
}

/**
 * The Coinbase-related credentials, in the order they should be shown. Names are
 * configuration/env references (a `CUSTODY_*` value is a *reference* to a provider-held
 * key, never key material).
 */
export const COINBASE_CREDENTIALS: readonly CredentialSpec[] = [
  {
    name: "CUSTODY_PROVIDER",
    secret: false,
    purpose: "Selects the custody backend (a provider name, not a key).",
    surfaces: ["custody", "trading"],
    minSecretLength: 1,
    rotateUrl: "https://docs.cdp.coinbase.com/",
  },
  {
    name: "CUSTODY_KEY_ID",
    secret: false,
    purpose: "Provider-side key/account name the custody signer resolves.",
    surfaces: ["custody", "trading"],
    minSecretLength: 1,
    rotateUrl: "https://docs.cdp.coinbase.com/",
  },
  {
    name: "CDP_API_KEY_ID",
    secret: true,
    purpose: "Coinbase CDP API key id (identifies the key, not the wallet key).",
    surfaces: ["onramp/offramp", "custody", "trading"],
    minSecretLength: 16,
    rotateUrl: "https://portal.cdp.coinbase.com/access/api",
  },
  {
    name: "CDP_API_KEY_SECRET",
    secret: true,
    purpose: "Coinbase CDP API key secret (signs API requests).",
    surfaces: ["onramp/offramp", "custody", "trading"],
    minSecretLength: 16,
    rotateUrl: "https://portal.cdp.coinbase.com/access/api",
  },
  {
    name: "CDP_WALLET_SECRET",
    secret: true,
    purpose: "Authorises CDP wallet signing operations (not the wallet key itself).",
    surfaces: ["custody", "trading"],
    minSecretLength: 16,
    rotateUrl: "https://portal.cdp.coinbase.com/access/api",
  },
  {
    name: "COINBASE_WEBHOOK_SECRET",
    secret: true,
    purpose: "Verifies X-Hook0-Signature on webhook deliveries.",
    surfaces: ["webhooks"],
    minSecretLength: 16,
    rotateUrl: "https://portal.cdp.coinbase.com/",
  },
];

/** Which credentials each surface needs before it can work at all. */
export const SURFACE_REQUIREMENTS: Readonly<Record<CredentialSurface, readonly string[]>> = {
  "onramp/offramp": ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET"],
  custody: ["CUSTODY_PROVIDER", "CUSTODY_KEY_ID", "CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"],
  trading: ["CUSTODY_PROVIDER", "CUSTODY_KEY_ID", "CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"],
  webhooks: ["COINBASE_WEBHOOK_SECRET"],
};

/** Matches a value that was left as a placeholder rather than replaced. */
const PLACEHOLDER = /placeholder|changeme|change[-_ ]?me|your[-_ ]|example|dummy|sample|tbd|todo|xxx|replace[-_ ]?with|<[^>]+>/i;

export type EnvLike = Record<string, string | undefined>;

export interface CredentialStatus {
  name: string;
  secret: boolean;
  purpose: string;
  surfaces: readonly CredentialSurface[];
  present: boolean;
  /** Non-fatal hygiene problems — a present value that looks unsafe. */
  warnings: string[];
  rotateUrl: string;
}

export interface SurfaceStatus {
  surface: CredentialSurface;
  ready: boolean;
  /** Credentials this surface needs that are absent. */
  missing: string[];
  /** Credentials that are present but flagged (the surface is up but unsafe). */
  flagged: string[];
}

export interface CredentialAudit {
  statuses: CredentialStatus[];
  surfaces: SurfaceStatus[];
  /** Audit-level problems (per-credential and partially-configured surfaces). */
  warnings: string[];
  /** True when every present credential is clean and no surface is half-configured. */
  healthy: boolean;
}

function readValue(env: EnvLike, name: string): string | null {
  const raw = env[name];
  if (raw === undefined) return null;
  return raw.length > 0 ? raw : null;
}

/** Hygiene checks for a present value. Returns reasons, never the value. */
export function credentialWarnings(value: string, spec: CredentialSpec): string[] {
  const warnings: string[] = [];
  if (value !== value.trim()) {
    warnings.push("has leading or trailing whitespace");
  }
  const trimmed = value.trim();
  if (PLACEHOLDER.test(trimmed)) {
    warnings.push("still looks like a placeholder");
  }
  if (spec.secret && trimmed.length < spec.minSecretLength) {
    warnings.push(`shorter than ${spec.minSecretLength} characters`);
  }
  return warnings;
}

/**
 * Audit the Coinbase credentials in `env` (defaults to `process.env`). Pure: it reads
 * only presence and shape, and returns no credential value.
 */
export function auditCoinbaseCredentials(env: EnvLike = process.env): CredentialAudit {
  const statuses: CredentialStatus[] = COINBASE_CREDENTIALS.map((spec) => {
    const value = readValue(env, spec.name);
    return {
      name: spec.name,
      secret: spec.secret,
      purpose: spec.purpose,
      surfaces: spec.surfaces,
      present: value !== null,
      warnings: value !== null ? credentialWarnings(value, spec) : [],
      rotateUrl: spec.rotateUrl,
    };
  });

  const byName = new Map(statuses.map((s) => [s.name, s]));

  const surfaces: SurfaceStatus[] = CREDENTIAL_SURFACES.map((surface) => {
    const required = SURFACE_REQUIREMENTS[surface];
    const missing = required.filter((name) => !byName.get(name)?.present);
    const flagged = required.filter((name) => (byName.get(name)?.warnings.length ?? 0) > 0);
    return { surface, ready: missing.length === 0, missing, flagged };
  });

  const warnings: string[] = [];
  for (const status of statuses) {
    for (const warning of status.warnings) warnings.push(`${status.name} ${warning}.`);
  }
  for (const surface of surfaces) {
    // A surface with some but not all of its credentials is a real misconfiguration:
    // it will fail closed at runtime, so flag it loudly rather than silently.
    const required = SURFACE_REQUIREMENTS[surface.surface];
    const presentCount = required.filter((name) => byName.get(name)?.present).length;
    if (presentCount > 0 && presentCount < required.length) {
      warnings.push(
        `surface "${surface.surface}" is partially configured (missing: ${surface.missing.join(", ")}).`
      );
    }
  }

  const healthy = warnings.length === 0;

  return { statuses, surfaces, warnings, healthy };
}

/** A plain-text report for the CLI. Never contains a credential value. */
export function formatCredentialAudit(audit: CredentialAudit): string {
  const lines: string[] = [];
  lines.push("Coinbase credential hygiene");
  lines.push("");
  for (const status of audit.statuses) {
    const mark = status.present ? (status.warnings.length ? "WARN" : "ok  ") : "----";
    lines.push(`  [${mark}] ${status.name}${status.secret ? " (secret)" : ""}`);
  }
  lines.push("");
  lines.push("Surfaces");
  for (const surface of audit.surfaces) {
    const mark = surface.ready ? (surface.flagged.length ? "WARN" : "ok  ") : "off ";
    const detail = surface.ready
      ? surface.flagged.length
        ? `flagged: ${surface.flagged.join(", ")}`
        : "ready"
      : `missing: ${surface.missing.join(", ")}`;
    lines.push(`  [${mark}] ${surface.surface} — ${detail}`);
  }
  if (audit.warnings.length) {
    lines.push("");
    lines.push("Warnings");
    for (const warning of audit.warnings) lines.push(`  - ${warning}`);
  }
  lines.push("");
  lines.push(audit.healthy ? "Result: healthy." : "Result: needs attention (see warnings).");
  return lines.join("\n");
}
