/**
 * In-process presence cache for the provider key pool.
 *
 * Kept in its own module with **no database import**, so a synchronous gate
 * (`wundertradingConfigured`, `coinbaseCdpConfigured`, `finnhubConfigured`, …) can ask
 * "does this provider have a pooled key?" without pulling Prisma — and its `.env` side
 * effects — into a module that does not otherwise need the database.
 *
 * The pool (`pool.ts`) refreshes this map from the database when a surface heats it
 * (`warmCredentialCache`). It is **fail-closed**: an unwarmed provider reads as absent.
 */

const presence = new Map<string, boolean>();

/** Whether a provider has at least one enabled pool key. Fail-closed when cold. */
export function providerHasPoolKeySync(provider: string): boolean {
  return presence.get(provider) === true;
}

/** Set a provider's presence (used by `pool.warmCredentialCache`). */
export function setPoolPresence(provider: string, present: boolean): void {
  presence.set(provider, present);
}

/** Reset the named providers to absent before a refresh (so a removed key disappears). */
export function resetPoolPresence(providers: string[]): void {
  for (const provider of providers) presence.set(provider, false);
}
