import { afterEach, describe, expect, it, vi } from "vitest";

import { isOwnerWallet, ownerWalletAddresses } from "@/lib/owner";

/**
 * The owner allowlist gates the only non-mainnet and practice-fund paths in the app,
 * so the safety property is structural: identity is an exact address match from the
 * environment, and with nothing configured nobody is an owner.
 */

const OWNER = "0x5a407Ff50d55142c36144B390972c51A768eBf8c";
const SECOND = "0x4ba94f5D72adCCA2d5427D91a74758b2c1B16aD4";

afterEach(() => vi.unstubAllEnvs());

describe("owner allowlist", () => {
  it("has no owner when the variable is unset", () => {
    vi.stubEnv("OWNER_WALLET_ADDRESSES", "");
    expect(ownerWalletAddresses()).toEqual([]);
    expect(isOwnerWallet(OWNER)).toBe(false);
  });

  it("matches an owner case-insensitively and ignores surrounding whitespace", () => {
    vi.stubEnv("OWNER_WALLET_ADDRESSES", `  ${OWNER.toUpperCase()} , ${SECOND.toLowerCase()} `);
    expect(isOwnerWallet(OWNER)).toBe(true);
    expect(isOwnerWallet(SECOND)).toBe(true);
    expect(isOwnerWallet("0x0000000000000000000000000000000000000001")).toBe(false);
  });

  it("treats a nullish or empty address as not an owner", () => {
    vi.stubEnv("OWNER_WALLET_ADDRESSES", OWNER);
    expect(isOwnerWallet(null)).toBe(false);
    expect(isOwnerWallet(undefined)).toBe(false);
    expect(isOwnerWallet("")).toBe(false);
  });
});
