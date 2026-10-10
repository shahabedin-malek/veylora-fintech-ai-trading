/**
 * Compliance boundary — provider selection and fail-closed helpers
 * (`PHASE18-007` / `PHASE19-010`).
 *
 * The money paths call this module, never a vendor directly. A provider is selected
 * with `COMPLIANCE_PROVIDER`; the default (`none`) is the inert no-op, so a deployment
 * with no provider behaves exactly as before but the app can state truthfully that
 * screening is **off**. `sanctions-list` selects the real, credential-free OFAC SDN
 * address screening backend (`providers/sanctions-list.ts`).
 *
 * Fail-closed on *failure*: a provider that throws (`screenTransferOrThrow`) is treated
 * as a refusal. The unconfigured default returns an explicit allow, because "no
 * provider" is a known, honest state — not a failure — and the alternative (refusing
 * every real movement by default) would silently break existing behaviour. What keeps
 * the default safe is that `complianceConfigured()` is false, so it is visible, not
 * hidden.
 *
 * To add a real provider: implement `ComplianceProvider` and register it in
 * `PROVIDERS` below, keyed by its slug.
 */

import {
  ComplianceRefusedError,
  type ComplianceProvider,
  type ComplianceSubject,
  type ComplianceVerdict,
  type JurisdictionSubject,
  type TransferSubject,
} from "@/lib/compliance/types";
import { NOOP_PROVIDER_NAME, noopProvider } from "@/lib/compliance/providers/noop";
import { SANCTIONS_LIST_PROVIDER_NAME, sanctionsListProvider } from "@/lib/compliance/providers/sanctions-list";

export {
  ComplianceRefusedError,
  type ComplianceProvider,
  type ComplianceSubject,
  type ComplianceVerdict,
  type JurisdictionSubject,
  type TransferSubject,
} from "@/lib/compliance/types";
export { NOOP_PROVIDER_NAME } from "@/lib/compliance/providers/noop";
export { SANCTIONS_LIST_PROVIDER_NAME } from "@/lib/compliance/providers/sanctions-list";

/**
 * Registered providers, keyed by the `COMPLIANCE_PROVIDER` value that selects them.
 *
 * `none` is the inert default; `sanctions-list` is a real, credential-free backend that
 * screens wallet addresses against the published OFAC SDN list
 * (`providers/sanctions-list.ts`). It is opt-in because selecting it starts refusing
 * real movements — an operator's decision, not a default.
 */
const PROVIDERS = new Map<string, ComplianceProvider>([
  [NOOP_PROVIDER_NAME, noopProvider],
  [SANCTIONS_LIST_PROVIDER_NAME, sanctionsListProvider],
]);

/**
 * Register a compliance backend under a slug. This is the extension point for adding a
 * real provider (see the module docstring): implement `ComplianceProvider`, register it
 * here, then select it with `COMPLIANCE_PROVIDER=<slug>`. The inert default cannot be
 * overridden, so the honest "no screening" state is always reachable.
 */
export function registerComplianceProvider(slug: string, provider: ComplianceProvider): void {
  const key = slug.trim();
  if (!key || key === NOOP_PROVIDER_NAME) {
    throw new Error(`Refusing to register compliance provider under reserved slug "${slug}".`);
  }
  PROVIDERS.set(key, provider);
}

/** The configured provider name, defaulting to the no-op provider. */
export function complianceProviderName(): string {
  const raw = process.env.COMPLIANCE_PROVIDER?.trim();
  return raw || NOOP_PROVIDER_NAME;
}

/** The active provider. An unknown name falls back to the no-op provider (never a crash). */
export function activeComplianceProvider(): ComplianceProvider {
  return PROVIDERS.get(complianceProviderName()) ?? noopProvider;
}

/**
 * Whether real compliance screening is active. False for the default no-op provider
 * and for any unknown provider; true only when a registered provider reports itself
 * configured. Surface this in admin/UI — do not assume screening is happening.
 */
export function complianceConfigured(): boolean {
  return activeComplianceProvider().isConfigured();
}

/** Run a check, turning a provider throw into a refusal (fail-closed on failure). */
async function verdictOrRefuse(fn: () => Promise<ComplianceVerdict>): Promise<ComplianceVerdict> {
  const provider = activeComplianceProvider();
  try {
    return await fn();
  } catch {
    return {
      allowed: false,
      reason: `Compliance screening failed (provider "${provider.name}"); the movement was refused.`,
    };
  }
}

/** Screen an identity. Throws `ComplianceRefusedError` on refusal or provider failure. */
export async function screenUserOrThrow(subject: ComplianceSubject): Promise<void> {
  const provider = activeComplianceProvider();
  const verdict = await verdictOrRefuse(() => provider.screenUser(subject));
  if (!verdict.allowed) throw new ComplianceRefusedError(provider.name, verdict.reason);
}

/** Screen a value movement. Throws `ComplianceRefusedError` on refusal or failure. */
export async function screenTransferOrThrow(subject: TransferSubject): Promise<void> {
  const provider = activeComplianceProvider();
  const verdict = await verdictOrRefuse(() => provider.screenTransfer(subject));
  if (!verdict.allowed) throw new ComplianceRefusedError(provider.name, verdict.reason);
}

/** Gate a jurisdiction. Throws `ComplianceRefusedError` on refusal or failure. */
export async function requireJurisdictionOrThrow(subject: JurisdictionSubject): Promise<void> {
  const provider = activeComplianceProvider();
  const verdict = await verdictOrRefuse(() => provider.allowedJurisdiction(subject));
  if (!verdict.allowed) throw new ComplianceRefusedError(provider.name, verdict.reason);
}

/**
 * A short, honest status for operators. Never says "screening active" unless a real
 * provider is configured.
 */
export function complianceStatus(): { provider: string; screeningEnabled: boolean; note: string } {
  const provider = activeComplianceProvider();
  const screeningEnabled = provider.isConfigured();
  return {
    provider: provider.name,
    screeningEnabled,
    note: screeningEnabled
      ? `Compliance screening is active (provider "${provider.name}").`
      : "No compliance provider is configured — KYC/AML, sanctions and jurisdiction screening are NOT running.",
  };
}
