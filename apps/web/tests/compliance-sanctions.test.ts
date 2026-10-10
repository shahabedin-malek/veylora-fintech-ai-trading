import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ComplianceRefusedError,
  complianceConfigured,
  complianceProviderName,
  complianceStatus,
  screenTransferOrThrow,
  screenUserOrThrow,
} from "@/lib/compliance";
import {
  SANCTIONS_LIST_PROVIDER_NAME,
  clearSanctionsCache,
  parseSanctionedAddresses,
  sanctionsCacheMs,
  sanctionsListProvider,
  sanctionsListUrl,
} from "@/lib/compliance/providers/sanctions-list";

/**
 * The sanctions-list provider is the one compliance backend that runs with no vendor
 * and no credentials, so its properties have to be pinned down hard:
 *
 *   - it refuses a **listed** address, for both the account and the counterparty;
 *   - it **fails closed** on a broken list (network error, bad status, truncated parse)
 *     rather than degrading to "allow everything";
 *   - EVM addresses match case-insensitively while base58 addresses stay
 *     case-sensitive (a case difference is a *different* address there);
 *   - the list is fetched at most once per cache window;
 *   - selecting it is explicit — the default stays the inert no-op.
 *
 * No network is touched: `fetch` is stubbed with a fixture shaped like OFAC's export.
 */

const LISTED_EVM = "0x1234567890abcdef1234567890abcdEF12345678";
const CLEAN_EVM = "0x000000000000000000000000000000000000dead";
const LISTED_BASE58 = "TNiq9AXBp9EjUqhDhrwrfvAA8U3GUQZH81";

/** A synthetic EVM address, so the fixture passes the "plausible list" size check. */
function syntheticEvm(i: number): string {
  return `0x${i.toString(16).padStart(40, "0")}`;
}

/** An OFAC-SDN-shaped CSV body. `extra` addresses are listed alongside the filler. */
function csvBody(extra: string[] = []): string {
  const addresses = [LISTED_EVM, ...extra, ...Array.from({ length: 22 }, (_, i) => syntheticEvm(i + 100))];
  return addresses
    .map(
      (address, i) =>
        `${i + 1},"SAMPLE ENTITY ${i}",-0- ,"IRAN] [SDGT",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"Additional Sanctions Information - Subject to Secondary Sanctions; Digital Currency Address - ETH ${address};"`
    )
    .join("\n");
}

/** Stub `fetch` with a successful list response. */
function stubList(body = csvBody([LISTED_BASE58])) {
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => body }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const transfer = (address: string, counterparty?: string) => ({
  userId: "u1",
  address,
  amountCents: 50_000,
  direction: "WITHDRAWAL" as const,
  network: "base",
  counterparty,
});

beforeEach(() => clearSanctionsCache());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  clearSanctionsCache();
});

/* --------------------------------------------------------------- parsing */

describe("parseSanctionedAddresses", () => {
  it("extracts listed addresses from the remarks field", () => {
    const csv = [
      `1001,"ENTITY A",-0- ,"IRAN",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"Digital Currency Address - ETH ${LISTED_EVM};"`,
      `1002,"ENTITY B",-0- ,"CYBER2",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"Digital Currency Address - TRX TNiq9AXBp9EjUqhDhrwrfvAA8U3GUQZH81; alt. Digital Currency Address - XBT 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa;"`,
      `1003,"ENTITY C",-0- ,"CUBA",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"No addresses here."`,
    ].join("\n");

    const addresses = parseSanctionedAddresses(csv);

    expect(addresses).toContain(LISTED_EVM);
    expect(addresses).toContain(LISTED_BASE58);
    expect(addresses).toContain("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"); // the `alt.` listing
    expect(addresses).toHaveLength(3);
  });

  it("deduplicates repeated listings and does not invent matches from prose", () => {
    const csv = `1,"E",-0- ,"IRAN",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"Digital Currency Address - ETH ${LISTED_EVM}; alt. Digital Currency Address - ETH ${LISTED_EVM}; Prose without an address."`;

    expect(parseSanctionedAddresses(csv)).toEqual([LISTED_EVM]);
  });
});

/* -------------------------------------------------------------- screening */

describe("sanctions-list screening", () => {
  beforeEach(() => vi.stubEnv("COMPLIANCE_PROVIDER", SANCTIONS_LIST_PROVIDER_NAME));

  it("refuses a listed EVM address, case-insensitively", async () => {
    stubList();

    await expect(screenTransferOrThrow(transfer(LISTED_EVM.toUpperCase().replace("0X", "0x")))).rejects.toThrow(
      /OFAC SDN/
    );
  });

  it("allows an unlisted address", async () => {
    stubList();

    await expect(screenTransferOrThrow(transfer(CLEAN_EVM))).resolves.toBeUndefined();
  });

  it("refuses a listed counterparty even when the account's own address is clean", async () => {
    stubList();

    await expect(screenTransferOrThrow(transfer(CLEAN_EVM, LISTED_EVM))).rejects.toThrow(/destination address/);
  });

  it("screens the account address on the identity path too", async () => {
    stubList();

    await expect(
      screenUserOrThrow({ userId: "u1", address: LISTED_EVM })
    ).rejects.toBeInstanceOf(ComplianceRefusedError);
  });

  it("keeps base58 matching case-sensitive", async () => {
    stubList();

    // A different case is a different base58 address, so it must not match.
    await expect(screenTransferOrThrow(transfer(LISTED_BASE58.toLowerCase()))).resolves.toBeUndefined();
    // The published casing does match.
    await expect(screenTransferOrThrow(transfer(LISTED_BASE58))).rejects.toThrow(/OFAC SDN/);
  });

  it("fetches the list at most once per cache window", async () => {
    const fetchMock = stubList();

    await screenTransferOrThrow(transfer(CLEAN_EVM));
    await expect(screenTransferOrThrow(transfer(LISTED_EVM))).rejects.toThrow(/OFAC SDN/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refetches once the cache window has passed", async () => {
    vi.stubEnv("COMPLIANCE_SANCTIONS_CACHE_MS", "0");
    const fetchMock = stubList();

    await screenTransferOrThrow(transfer(CLEAN_EVM));
    await screenTransferOrThrow(transfer(CLEAN_EVM));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

/* ------------------------------------------------------------ fail closed */

describe("sanctions-list failure handling", () => {
  beforeEach(() => vi.stubEnv("COMPLIANCE_PROVIDER", SANCTIONS_LIST_PROVIDER_NAME));

  it("refuses the movement when the list cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("network down"))));

    await expect(screenTransferOrThrow(transfer(CLEAN_EVM))).rejects.toThrow(/screening failed/);
  });

  it("refuses the movement on a bad status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, text: async () => "" })));

    await expect(screenTransferOrThrow(transfer(CLEAN_EVM))).rejects.toThrow(/screening failed/);
  });

  it("refuses the movement when the list parses as truncated", async () => {
    // A partially-downloaded list must never read as "nothing is sanctioned".
    stubList(`1,"E",-0- ,"IRAN",-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,-0- ,"Digital Currency Address - ETH ${LISTED_EVM};"`);

    await expect(screenTransferOrThrow(transfer(CLEAN_EVM, CLEAN_EVM))).rejects.toThrow(/screening failed/);
  });
});

/* ------------------------------------------------------------ jurisdiction */

describe("sanctions-list jurisdiction gating", () => {
  it("refuses a comprehensively sanctioned country and allows others", async () => {
    await expect(sanctionsListProvider.allowedJurisdiction({ userId: "u1", country: "cu" })).resolves.toMatchObject({
      allowed: false,
    });
    await expect(sanctionsListProvider.allowedJurisdiction({ userId: "u1", country: "DE" })).resolves.toEqual({
      allowed: true,
    });
  });

  it("allows an undetermined country, since the app has no country source", async () => {
    await expect(sanctionsListProvider.allowedJurisdiction({ userId: "u1", country: null })).resolves.toEqual({
      allowed: true,
    });
  });
});

/* ------------------------------------------------------------- selection */

describe("provider selection", () => {
  it("keeps the inert no-op as the default", () => {
    vi.stubEnv("COMPLIANCE_PROVIDER", "");

    expect(complianceProviderName()).toBe("none");
    expect(complianceConfigured()).toBe(false);
    expect(complianceStatus().screeningEnabled).toBe(false);
  });

  it("reports screening as active once the sanctions list is selected", () => {
    vi.stubEnv("COMPLIANCE_PROVIDER", SANCTIONS_LIST_PROVIDER_NAME);

    expect(complianceConfigured()).toBe(true);
    expect(complianceStatus()).toMatchObject({ provider: SANCTIONS_LIST_PROVIDER_NAME, screeningEnabled: true });
    expect(complianceStatus().note).toMatch(/active/i);
  });

  it("defaults the list URL to OFAC and honours an override", () => {
    vi.stubEnv("COMPLIANCE_SANCTIONS_LIST_URL", "");
    expect(sanctionsListUrl()).toMatch(/sanctionslistservice\.ofac\.treas\.gov/);

    vi.stubEnv("COMPLIANCE_SANCTIONS_LIST_URL", "https://mirror.example/sdn.csv");
    expect(sanctionsListUrl()).toBe("https://mirror.example/sdn.csv");
  });

  it("falls back to the default cache window on a garbage value", () => {
    vi.stubEnv("COMPLIANCE_SANCTIONS_CACHE_MS", "not-a-number");
    expect(sanctionsCacheMs()).toBe(6 * 60 * 60 * 1000);
  });
});
