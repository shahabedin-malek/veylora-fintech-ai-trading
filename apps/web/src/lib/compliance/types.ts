/**
 * Compliance boundary — the provider-agnostic contract (`PHASE18-007` /
 * `PHASE19-010`).
 *
 * Compliance is a **policy decision, not a library choice**: which jurisdictions are
 * served, which KYC/AML thresholds apply and who screens sanctions lists are
 * business/legal decisions. So this module defines only the *interface* the money
 * paths call, plus a deliberately inert default. No vendor is wired in — a real
 * provider is added by registering an adapter (see `index.ts`) once those decisions
 * are made.
 *
 * The default is the **no-op** provider (`providers/noop.ts`). It allows everything
 * and reports `isConfigured() === false`, so the app never claims to be screening
 * when it is not: `complianceConfigured()` stays false and the UI must say so. This is
 * the honest state — a "compliance" module that silently allowed real transfers while
 * claiming to screen them would be worse than no module at all.
 *
 * Fail-closed applies to *failures*, not to the unconfigured default: a provider that
 * throws is treated as a refusal (`screenTransferOrThrow`), while the no-op default
 * returns an explicit allow so a deployment without a provider behaves exactly as it
 * did before this module existed.
 */

/** The result of any compliance check. A refusal always carries a reason. */
export type ComplianceVerdict = { allowed: true } | { allowed: false; reason: string };

/** The subject of an identity/KYC check. */
export interface ComplianceSubject {
  /** The app user the check applies to. */
  userId: string;
  /** The user's wallet address (identity is wallet-based; there is no email). */
  address: string;
}

/** A value movement to screen (AML / sanctions). */
export interface TransferSubject extends ComplianceSubject {
  /** USD notional of the movement, in integer cents. */
  amountCents: number;
  /** The direction of value movement. */
  direction: "DEPOSIT" | "WITHDRAWAL" | "TRADE";
  /** The chain/network, when the movement is on-chain. */
  network?: string;
  /**
   * The address on the other side of the movement, when there is one (an on-chain
   * withdrawal's destination). The value actually arrives there, so a provider should
   * screen it as well as the account's own address — screening only the sender would
   * miss the case screening exists for. Omitted for movements with no counterparty
   * (a venue swap, a deposit credited to the account).
   */
  counterparty?: string;
}

/** A jurisdiction check. */
export interface JurisdictionSubject {
  userId: string;
  /** ISO 3166-1 alpha-2 country code, or null when it cannot be determined. */
  country: string | null;
}

/**
 * A compliance backend. Implementations must not throw for an ordinary refusal —
 * return `{ allowed: false, reason }`; throwing is reserved for provider failure and
 * is treated as a refusal by the callers.
 */
export interface ComplianceProvider {
  /** Stable identifier, e.g. "none" or a vendor slug. */
  readonly name: string;
  /**
   * Whether this provider is configured with real credentials/capability. The no-op
   * default returns false; a real provider returns true once configured.
   */
  isConfigured(): boolean;
  /** KYC / identity screening. */
  screenUser(subject: ComplianceSubject): Promise<ComplianceVerdict>;
  /** AML / sanctions screening of a value movement. */
  screenTransfer(subject: TransferSubject): Promise<ComplianceVerdict>;
  /** Jurisdiction gating. */
  allowedJurisdiction(subject: JurisdictionSubject): Promise<ComplianceVerdict>;
}

/** Thrown when a compliance check refuses a movement. */
export class ComplianceRefusedError extends Error {
  constructor(
    readonly provider: string,
    reason: string
  ) {
    super(reason);
    this.name = "ComplianceRefusedError";
  }
}
