import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * On-chain custody transfers move real funds, so the tests assert the *refusals*:
 * an unsupported network, a non-positive amount, a bad address and a self-send all
 * throw before anything is broadcast; a value over the spend cap is refused before the
 * signer is even requested; and a configured transfer sends through the provider (never
 * a local key). The CDP SDK is mocked — CI has no live Coinbase account.
 */

const cdp = vi.hoisted(() => {
  const account = {
    address: "0x00000000000000000000000000000000000000aa" as const,
    sign: vi.fn(),
    signMessage: vi.fn(),
    signTransaction: vi.fn(),
  };
  return {
    account,
    getOrCreateAccount: vi.fn(async () => account),
    sendTransaction: vi.fn(async () => ({ transactionHash: "0xfeed" as const })),
  };
});

vi.mock("@coinbase/cdp-sdk", () => ({
  CdpClient: class {
    evm = {
      getOrCreateAccount: cdp.getOrCreateAccount,
      sendTransaction: cdp.sendTransaction,
    };
  },
}));

import {
  CustodyUnavailableError,
  SpendLimitExceededError,
} from "@/lib/custody";
import {
  TransferUnavailableError,
  custodyDepositAddress,
  isEvmAddress,
  sendCustodyTransfer,
  transferNetworkForChainId,
  verifyEvmAddress,
} from "@/lib/custody/transfers";

const BASE = 8453;
const BASE_SEPOLIA = 84532;
const DEST = `0x${"12".repeat(20)}`;

function configureCustody() {
  vi.stubEnv("CUSTODY_PROVIDER", "coinbase-cdp");
  vi.stubEnv("CUSTODY_KEY_ID", "hot-wallet");
  vi.stubEnv("CDP_API_KEY_ID", "key-id");
  vi.stubEnv("CDP_API_KEY_SECRET", "key-secret");
  vi.stubEnv("CDP_WALLET_SECRET", "wallet-secret");
}

function transfer(overrides: Partial<Parameters<typeof sendCustodyTransfer>[0]> = {}) {
  return sendCustodyTransfer({
    chainId: BASE,
    to: DEST,
    valueWei: 1_000_000_000_000_000n,
    notionalCents: 1_000,
    spentTodayCents: 0,
    ...overrides,
  });
}

beforeEach(() => {
  for (const name of ["CUSTODY_PROVIDER", "CUSTODY_KEY_ID", "CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"]) {
    vi.stubEnv(name, "");
  }
  cdp.sendTransaction.mockClear();
  cdp.getOrCreateAccount.mockClear();
});

afterEach(() => vi.unstubAllEnvs());

describe("network + address helpers", () => {
  it("maps only the supported mainnets and refuses the rest", () => {
    expect(transferNetworkForChainId(1)).toBe("ethereum");
    expect(transferNetworkForChainId(BASE)).toBe("base");
    expect(transferNetworkForChainId(42161)).toBe("arbitrum");
    expect(transferNetworkForChainId(BASE_SEPOLIA)).toBeNull();
    expect(transferNetworkForChainId(999)).toBeNull();
  });

  it("validates EVM addresses structurally", () => {
    expect(isEvmAddress(DEST)).toBe(true);
    expect(isEvmAddress("0x1234")).toBe(false);
    expect(isEvmAddress("not-an-address")).toBe(false);
  });
});

/** EIP-55 test vector: valid as written, and invalid the moment a letter's case flips. */
const CHECKSUMMED = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const FLIPPED_CASE = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD";

/**
 * A chain transfer is final, so address *verification* is stricter than a shape check:
 * a typo that still looks like an address is the mistake that actually loses money.
 */
describe("verifyEvmAddress", () => {
  it("accepts a checksummed address", () => {
    expect(verifyEvmAddress(CHECKSUMMED)).toEqual({ ok: true, address: CHECKSUMMED });
  });

  it("refuses an address whose EIP-55 checksum does not match", () => {
    expect(verifyEvmAddress(FLIPPED_CASE)).toEqual({ ok: false, problem: "checksum" });
  });

  it("accepts uniform casing, which carries no checksum to verify", () => {
    expect(verifyEvmAddress(CHECKSUMMED.toLowerCase()).ok).toBe(true);
    // All-uppercase hex is a valid — if unusual — way to write the address; refusing it
    // would reject legitimate input from tools that upper-case addresses.
    expect(verifyEvmAddress(`0x${CHECKSUMMED.slice(2).toUpperCase()}`).ok).toBe(true);
  });

  it("refuses the zero address, which would destroy the funds", () => {
    expect(verifyEvmAddress(`0x${"0".repeat(40)}`)).toEqual({ ok: false, problem: "zero" });
  });

  it("refuses a malformed address", () => {
    expect(verifyEvmAddress("0x1234")).toEqual({ ok: false, problem: "format" });
    expect(verifyEvmAddress("not-an-address")).toEqual({ ok: false, problem: "format" });
  });

  it("is enforced at the custody boundary, before anything is signed", async () => {
    configureCustody();

    await expect(transfer({ to: FLIPPED_CASE })).rejects.toThrow(/checksum/);
    await expect(transfer({ to: `0x${"0".repeat(40)}` })).rejects.toThrow(/zero address/);
    expect(cdp.sendTransaction).not.toHaveBeenCalled();
  });
});

describe("sendCustodyTransfer fails closed", () => {
  it("refuses an unsupported network before touching custody", async () => {
    configureCustody();
    await expect(transfer({ chainId: BASE_SEPOLIA })).rejects.toThrow(TransferUnavailableError);
    expect(cdp.sendTransaction).not.toHaveBeenCalled();
  });

  it("refuses a non-positive amount and a bad destination", async () => {
    configureCustody();
    await expect(transfer({ valueWei: 0n })).rejects.toThrow(/positive amount/);
    await expect(transfer({ to: "0xnope" })).rejects.toThrow(/valid destination/);
    expect(cdp.sendTransaction).not.toHaveBeenCalled();
  });

  it("refuses when custody is not configured", async () => {
    await expect(transfer()).rejects.toThrow(CustodyUnavailableError);
    expect(cdp.sendTransaction).not.toHaveBeenCalled();
  });

  it("checks the spend cap before requesting a signer", async () => {
    configureCustody();
    await expect(transfer({ notionalCents: 100_000_000 })).rejects.toThrow(SpendLimitExceededError);
    expect(cdp.getOrCreateAccount).not.toHaveBeenCalled();
    expect(cdp.sendTransaction).not.toHaveBeenCalled();
  });

  it("refuses to send to the custody address itself", async () => {
    configureCustody();
    await expect(transfer({ to: cdp.account.address })).rejects.toThrow(/itself/);
    expect(cdp.sendTransaction).not.toHaveBeenCalled();
  });
});

describe("sendCustodyTransfer succeeds through the provider", () => {
  it("broadcasts via the custody signer and returns the hash and sender", async () => {
    configureCustody();
    const result = await transfer();
    expect(result.transactionHash).toBe("0xfeed");
    expect(result.from).toBe(cdp.account.address);
    expect(result.network).toBe("base");
    expect(cdp.sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        address: cdp.account.address,
        network: "base",
        transaction: expect.objectContaining({ to: DEST, value: 1_000_000_000_000_000n }),
      })
    );
  });

  it("resolves the platform deposit address from the custody signer", async () => {
    configureCustody();
    await expect(custodyDepositAddress()).resolves.toBe(cdp.account.address);
  });
});
