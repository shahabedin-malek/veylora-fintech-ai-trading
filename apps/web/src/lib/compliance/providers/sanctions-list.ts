/**
 * Sanctions-list screening provider (`COMPLIANCE_PROVIDER=sanctions-list`).
 *
 * The only real screening backend that needs **no vendor and no credentials**: it
 * screens wallet addresses against the **OFAC SDN list**, which the US Treasury
 * publishes for exactly this purpose, in machine-readable form, at a stable URL.
 *
 * What it is:
 *
 *   - A real control. Every entry of the form
 *     `Digital Currency Address - <ASSET> <ADDRESS>` in the published list is loaded
 *     into an index, and a wallet address that appears there is refused. This is the
 *     address-level sanctions screening a wallet-based product can actually do, and it
 *     is what the money paths need before signing.
 *   - Fail-closed on failure. If the list cannot be fetched, is unparsable, or looks
 *     truncated, `screenTransfer`/`screenUser` **throw**, and the boundary turns a
 *     throw into a refusal (`src/lib/compliance/index.ts`) — so a broken list blocks
 *     real movements instead of silently allowing them. There is no "assume clean"
 *     path.
 *
 * What it is not (so nobody mistakes it for a compliance program):
 *
 *   - **US/OFAC lists only.** EU, UK, UN and other jurisdictions publish their own
 *     lists; multi-jurisdiction coverage needs an aggregator.
 *   - **No identity, PEP or adverse-media screening**, and no name matching. Sign-in
 *     is wallet-based and the app stores no legal name, so there is nothing to match
 *     against `SDN_Name` — fabricating a match from a generated display name would be
 *     worse than not screening. Full KYC remains a vendor integration.
 *   - **No jurisdiction determination.** The app has no country source, so
 *     `allowedJurisdiction` can only refuse a country the caller actually supplies.
 *
 * Selecting it changes behaviour: real movements begin to be refused on a sanctions
 * hit (and while the list is unavailable). That is the point — but it is an operator's
 * decision, so the default stays the inert no-op (`providers/noop.ts`).
 */

import type { ComplianceProvider, ComplianceVerdict, JurisdictionSubject } from "@/lib/compliance/types";

/** The `COMPLIANCE_PROVIDER` value that selects this backend. */
export const SANCTIONS_LIST_PROVIDER_NAME = "sanctions-list";

/**
 * OFAC's Sanctions List Service export of the SDN list (CSV, ~6 MB). Verified
 * reachable and updated in place (the `Last-Modified` header tracks OFAC's
 * publication). The legacy `treasury.gov/ofac/downloads/sdn.csv` path redirects here,
 * so the service URL is used directly.
 */
const DEFAULT_LIST_URL = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV";

/** A slow list fetch must not hang a money action. */
const FETCH_TIMEOUT_MS = 5_000;

/** The list changes a few times a week at most; re-fetching per request is waste. */
const DEFAULT_CACHE_MS = 6 * 60 * 60 * 1000;

/**
 * A published list always contains many digital-currency listings (106 at the time of
 * writing). Accepting a suspiciously short parse would turn a truncated response into
 * "nothing is sanctioned" — the failure mode that matters most — so a small count is
 * treated as a broken list and refused.
 */
const MIN_PLAUSIBLE_ADDRESSES = 20;

/**
 * OFAC's comprehensively sanctioned countries, by ISO 3166-1 alpha-2 code, mapped to
 * the program name OFAC uses. Only used when a caller supplies a country; the app has
 * no country source of its own (see the module note).
 */
const COMPREHENSIVE_SANCTIONS: Record<string, string> = {
  CU: "CUBA",
  IR: "IRAN",
  KP: "NORTH KOREA",
  SY: "SYRIA",
};

interface SanctionsIndex {
  /** EVM (`0x…`) listings, lower-cased — EVM addresses are case-insensitive. */
  evm: Set<string>;
  /** Every listing exactly as published — base58 addresses are case-sensitive. */
  exact: Set<string>;
  source: string;
  fetchedAt: number;
}

/** Module-level cache so a warm process pays for the list at most once per window. */
let cached: SanctionsIndex | null = null;
let inflight: Promise<SanctionsIndex> | null = null;

/** The list URL, overridable for a mirror or a pinned snapshot. */
export function sanctionsListUrl(): string {
  return process.env.COMPLIANCE_SANCTIONS_LIST_URL?.trim() || DEFAULT_LIST_URL;
}

/** Cache window in ms, overridable; an unset/garbage value falls back to the default. */
export function sanctionsCacheMs(): number {
  const raw = process.env.COMPLIANCE_SANCTIONS_CACHE_MS?.trim();
  if (!raw) return DEFAULT_CACHE_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_CACHE_MS;
}

/**
 * Drop the cached list. Exposed for tests and for an operator who has just learned the
 * list was refreshed and does not want to wait out the window.
 */
export function clearSanctionsCache(): void {
  cached = null;
  inflight = null;
}

/**
 * Extract the digital-currency addresses from an OFAC SDN CSV export.
 *
 * The addresses live inside the free-text `Remarks` column, as
 * `Digital Currency Address - <ASSET> <ADDRESS>`, sometimes preceded by `alt.` and
 * followed by `;`. Remarks are semicolon-separated prose, so the fields are *not*
 * parsed as CSV: the tokens are matched directly, which avoids having to model the
 * many quoting variations in the file and cannot be confused by a comma inside a name.
 */
export function parseSanctionedAddresses(csv: string): string[] {
  const found = new Set<string>();
  const pattern = /Digital Currency Address\s*-\s*[A-Za-z0-9+]{2,12}\s+([A-Za-z0-9]{20,150})/gi;
  for (const match of csv.matchAll(pattern)) found.add(match[1]);
  return [...found];
}

/** Build the lookup index from a list body; throws when the parse looks broken. */
function buildIndex(csv: string, source: string): SanctionsIndex {
  const addresses = parseSanctionedAddresses(csv);
  if (addresses.length < MIN_PLAUSIBLE_ADDRESSES) {
    throw new Error(
      `Sanctions list from ${source} yielded ${addresses.length} address(es) (expected at least ${MIN_PLAUSIBLE_ADDRESSES}); treating it as a broken list.`
    );
  }
  const evm = new Set<string>();
  const exact = new Set<string>();
  for (const address of addresses) {
    exact.add(address);
    if (address.startsWith("0x")) evm.add(address.toLowerCase());
  }
  return { evm, exact, source, fetchedAt: Date.now() };
}

/** Load (or reuse) the list. Concurrent callers share one fetch; failures propagate. */
async function loadIndex(): Promise<SanctionsIndex> {
  const fresh = cached && Date.now() - cached.fetchedAt < sanctionsCacheMs();
  if (fresh) return cached!;
  if (inflight) return inflight;

  inflight = (async () => {
    const source = sanctionsListUrl();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(source, {
        signal: controller.signal,
        headers: { accept: "text/csv, text/plain, */*" },
        // Sanctions screening must see today's list, never a build-time copy.
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Sanctions list fetch failed: HTTP ${res.status} from ${source}`);
      const index = buildIndex(await res.text(), source);
      cached = index;
      return index;
    } finally {
      clearTimeout(timer);
      inflight = null;
    }
  })();

  return inflight;
}

/** Whether an address appears on the list. EVM listings match case-insensitively. */
function isSanctioned(index: SanctionsIndex, address: string): boolean {
  return address.startsWith("0x") ? index.evm.has(address.toLowerCase()) : index.exact.has(address);
}

/** Screen one address, with a label for the refusal reason. */
async function screenOne(
  address: string,
  label: string
): Promise<{ verdict: ComplianceVerdict; index: SanctionsIndex }> {
  const index = await loadIndex();
  if (isSanctioned(index, address)) {
    return {
      verdict: {
        allowed: false,
        reason: `Sanctions screening refused ${label}: it appears on the OFAC SDN list as a blocked digital currency address (${SANCTIONS_LIST_PROVIDER_NAME}).`,
      },
      index,
    };
  }
  return { verdict: { allowed: true }, index };
}

export const sanctionsListProvider: ComplianceProvider = {
  name: SANCTIONS_LIST_PROVIDER_NAME,

  /**
   * True by virtue of being selected: the screening mechanism is the published list,
   * and no credential gates it. Whether the list can actually be *read* is decided per
   * call — a fetch failure throws and becomes a refusal, which is stricter than an
   * unconfigured provider, not looser.
   */
  isConfigured: () => true,

  /** Screen the account's own wallet address (identity here *is* the address). */
  async screenUser(subject) {
    const { verdict } = await screenOne(subject.address, "the account's wallet address");
    return verdict;
  },

  /**
   * Screen the account's address and, when the caller supplies one, the counterparty —
   * for an on-chain withdrawal the destination is the address that actually receives
   * the value, so screening only the sender would miss the case that matters.
   */
  async screenTransfer(subject) {
    const own = await screenOne(subject.address, "the account's wallet address");
    if (!own.verdict.allowed) return own.verdict;
    if (subject.counterparty) {
      const counterparty = await screenOne(subject.counterparty, "the destination address");
      if (!counterparty.verdict.allowed) return counterparty.verdict;
    }
    return { allowed: true };
  },

  /**
   * Refuse a country that is under comprehensive OFAC sanctions. A `null` country is
   * allowed with the honest caveat that the app cannot determine it — refusing an
   * unknown country would refuse every movement, since no country source exists here.
   * That policy choice belongs to whoever wires a country signal, not to this adapter.
   */
  allowedJurisdiction(subject: JurisdictionSubject) {
    const country = subject.country?.trim().toUpperCase() || null;
    if (country && COMPREHENSIVE_SANCTIONS[country]) {
      return Promise.resolve({
        allowed: false,
        reason: `Jurisdiction screening refused: ${country} is subject to comprehensive OFAC sanctions (${COMPREHENSIVE_SANCTIONS[country]}).`,
      });
    }
    return Promise.resolve({ allowed: true });
  },
};
