/**
 * The default, inert compliance provider (`PHASE18-007` / `PHASE19-010`).
 *
 * This is what runs when no real provider is configured. It **allows everything** and
 * reports `isConfigured() === false`, so the app records the honest fact that no
 * screening is happening rather than pretending otherwise. It exists so the money
 * paths can call the compliance boundary unconditionally; making the *absence* of
 * screening explicit and inspectable is the whole point.
 *
 * Do not mistake this for a compliance control. It is a placeholder whose only
 * measurable property is that it never blocks — and never claims to.
 */

import type { ComplianceProvider, ComplianceVerdict } from "@/lib/compliance/types";

/** The `COMPLIANCE_PROVIDER` value that selects this default. */
export const NOOP_PROVIDER_NAME = "none";

const ALLOW: ComplianceVerdict = { allowed: true };

export const noopProvider: ComplianceProvider = {
  name: NOOP_PROVIDER_NAME,
  isConfigured: () => false,
  screenUser: async () => ALLOW,
  screenTransfer: async () => ALLOW,
  allowedJurisdiction: async () => ALLOW,
};
