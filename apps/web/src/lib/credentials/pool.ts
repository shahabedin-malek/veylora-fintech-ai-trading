/**
 * The key pool — resolve a provider's credentials and fail over across backups.
 *
 * A provider's candidates are, in order: the **environment** key(s) for that provider,
 * then every enabled pool row by priority. `withCredential` tries each in turn, rotating
 * to the next when one is **rejected by the provider** (401/402/403/429 — expired key,
 * no entitlement, exhausted credits/rate limit). A network or parse error is *not* a
 * credential problem, so it is rethrown rather than burning through the pool.
 *
 * Two safety rules:
 *  - A key is only read back in server memory, only at the moment it is used.
 *  - An encrypted row that cannot be decrypted (e.g. after `CREDENTIAL_ENCRYPTION_KEY`
 *    changed) is skipped, never guessed at; it stays visible in the admin console.
 *
 * A short-lived in-process `presence` cache lets synchronous gates
 * (`wundertradingConfigured`, `coinbaseCdpConfigured`) know a provider has a pool key
 * without awaiting a query; it is warmed by the admin surfaces and the sync/cron paths,
 * and is fail-closed when cold.
 */

import { prisma } from "@/lib/db";
import { credentialEncryptionAvailable, decryptSecret, fingerprintOf } from "@/lib/credentials/crypto";
import { resetPoolPresence, setPoolPresence, providerHasPoolKeySync } from "@/lib/credentials/presence";
import { providerDef, type ProviderDef } from "@/lib/credentials/providers";

export { providerHasPoolKeySync };

/** Thrown by a provider call so the pool can decide whether to rotate. */
export class ProviderRequestError extends Error {
  constructor(
    message: string,
    /** HTTP status when the provider answered; `undefined` for a transport failure. */
    public readonly status?: number
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

/** Statuses that mean "this key is the problem" — rotate to the next candidate. */
const ROTATE_STATUSES = new Set([401, 402, 403, 429]);

/** Cooldown bounds after a rejection. */
const COOLDOWN_BASE_MS = 60_000;
const COOLDOWN_MAX_MS = 60 * 60 * 1000;

export interface CredentialCandidate {
  /** `"env"` or the pool row id. */
  id: string;
  source: "env" | "pool";
  label: string;
  /** Safe to render: a non-reversible hash, not the key. */
  fingerprint: string;
  values: Record<string, string>;
}

/** The env candidate for a provider, or `null` when its env vars are incomplete. */
function envCandidate(def: ProviderDef): CredentialCandidate | null {
  const values: Record<string, string> = {};
  for (const field of def.fields) {
    const raw = (process.env[field.env] ?? "").trim();
    if (!raw) {
      if (field.optional) continue;
      return null;
    }
    values[field.key] = raw;
  }
  if (!Object.keys(values).length) return null;
  return { id: "env", source: "env", label: "environment", fingerprint: fingerprintOf(values), values };
}

/* --------------------------------------------------------- presence cache (sync gate) */

/**
 * Refresh the presence cache from the database. Best-effort; never throws. The map
 * itself lives in `presence.ts` so a synchronous gate can read it without importing
 * Prisma.
 */
export async function warmCredentialCache(providers?: string[]): Promise<void> {
  try {
    const rows = await prisma.providerCredential.groupBy({
      by: ["provider"],
      where: { enabled: true },
      _count: { _all: true },
    });
    resetPoolPresence(providers ?? []);
    for (const row of rows) setPoolPresence(row.provider, row._count._all > 0);
  } catch {
    // A DB problem must not break a page render; the cache stays as it was.
  }
}

/* ------------------------------------------------------------------------ candidates */

/** Every usable candidate for a provider: env first, then pool rows by priority. */
export async function credentialCandidates(provider: string): Promise<CredentialCandidate[]> {
  const def = providerDef(provider);
  if (!def) return [];

  const out: CredentialCandidate[] = [];
  const env = envCandidate(def);
  if (env) out.push(env);

  if (credentialEncryptionAvailable()) {
    try {
      const rows = await prisma.providerCredential.findMany({
        where: { provider, enabled: true },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      });
      const now = Date.now();
      for (const row of rows) {
        if (row.cooldownUntil && row.cooldownUntil.getTime() > now) continue;
        try {
          const values = decryptSecret(row.secret);
          out.push({ id: row.id, source: "pool", label: row.label, fingerprint: row.fingerprint, values });
        } catch {
          // Undecryptable (key rotated?) — skip; it stays visible in the admin console.
        }
      }
    } catch {
      // DB unavailable: env-only is still a valid candidate set.
    }
  }

  return out;
}

/** Whether a provider can be used at all (env key or a pool key), asynchronously. */
export async function providerConfigured(provider: string): Promise<boolean> {
  return (await credentialCandidates(provider)).length > 0;
}

/* --------------------------------------------------------------------------- failover */

async function markSuccess(candidate: CredentialCandidate): Promise<void> {
  if (candidate.source !== "pool") return;
  await prisma.providerCredential.updateMany({
    where: { id: candidate.id },
    data: {
      status: "ACTIVE",
      failureCount: 0,
      cooldownUntil: null,
      lastError: null,
      lastUsedAt: new Date(),
      successCount: { increment: 1 },
    },
  });
}

async function markFailure(candidate: CredentialCandidate, message: string): Promise<void> {
  if (candidate.source !== "pool") return;
  const row = await prisma.providerCredential.findUnique({ where: { id: candidate.id } });
  if (!row) return;
  const failureCount = row.failureCount + 1;
  const cooldownMs = Math.min(COOLDOWN_BASE_MS * failureCount, COOLDOWN_MAX_MS);
  await prisma.providerCredential.update({
    where: { id: candidate.id },
    data: {
      status: "COOLDOWN",
      failureCount,
      cooldownUntil: new Date(Date.now() + cooldownMs),
      lastError: message.slice(0, 300),
    },
  });
}

/**
 * Run `fn` with a provider's credentials, rotating to the next candidate when one is
 * rejected. Throws the last rejection when every candidate fails, or the original error
 * when it is not a credential problem. Never logs a key.
 */
export async function withCredential<T>(
  provider: string,
  fn: (values: Record<string, string>, candidate: CredentialCandidate) => Promise<T>
): Promise<T> {
  const candidates = await credentialCandidates(provider);
  if (!candidates.length) {
    throw new ProviderRequestError(`${provider} is not configured (no env key and no pool key).`);
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const result = await fn(candidate.values, candidate);
      await markSuccess(candidate).catch(() => {});
      return result;
    } catch (error) {
      if (error instanceof ProviderRequestError && error.status !== undefined && ROTATE_STATUSES.has(error.status)) {
        await markFailure(candidate, error.message).catch(() => {});
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ProviderRequestError(`${provider}: every key was rejected.`);
}

/* ------------------------------------------------------------------- pool status */

export type ProviderPoolState = "ok" | "all-cooling" | "unconfigured";

export interface ProviderPoolStatus {
  provider: string;
  /** At least one credential (env or pool) is usable right now. */
  usable: boolean;
  envConfigured: boolean;
  /** Enabled pool keys. */
  poolEnabled: number;
  /** Enabled pool keys inside their cooldown window. */
  cooling: number;
  /** Usable credentials: env (0/1) plus non-cooling pool keys. */
  usableCount: number;
  state: ProviderPoolState;
}

/**
 * Summarise a provider's key pool. `all-cooling` means keys exist but every one is inside
 * its cooldown (e.g. a shared upstream limit), so calls will fail until one recovers —
 * exactly the case an operator needs to be warned about before a feed goes dark.
 */
export async function providerPoolStatus(provider: string): Promise<ProviderPoolStatus> {
  const def = providerDef(provider);
  const envConfigured = def ? envCandidate(def) !== null : false;
  let rows: { cooldownUntil: Date | null }[] = [];
  try {
    rows = await prisma.providerCredential.findMany({
      where: { provider, enabled: true },
      select: { cooldownUntil: true },
    });
  } catch {
    rows = [];
  }
  const now = Date.now();
  const cooling = rows.filter((r) => r.cooldownUntil && r.cooldownUntil.getTime() > now).length;
  const usableCount = (envConfigured ? 1 : 0) + (rows.length - cooling);
  const state: ProviderPoolState =
    usableCount > 0 ? "ok" : envConfigured || rows.length > 0 ? "all-cooling" : "unconfigured";
  return {
    provider,
    usable: usableCount > 0,
    envConfigured,
    poolEnabled: rows.length,
    cooling,
    usableCount,
    state,
  };
}

/**
 * Providers that need attention: unconfigured, or with every key cooling down. Used by the
 * admin console to raise an alert before a feed silently stops producing input.
 */
export async function providerPoolAlerts(): Promise<ProviderPoolStatus[]> {
  const { PROVIDER_DEFS } = await import("@/lib/credentials/providers");
  const statuses = await Promise.all(PROVIDER_DEFS.map((def) => providerPoolStatus(def.id)));
  return statuses.filter((status) => status.state !== "ok");
}

/* ------------------------------------------------------------------------ pool admin */

export { credentialEncryptionAvailable };
