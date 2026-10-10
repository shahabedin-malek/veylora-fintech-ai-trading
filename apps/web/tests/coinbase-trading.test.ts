import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The real swap venue adapter is the one path that can move real funds, so its
 * properties are structural: mainnet-only, custody-signed, spend-limited before any
 * quote, and fail-closed when anything is missing. The CDP SDK is mocked so no live
 * account is needed.
 */

const sdk = vi.hoisted(() => ({
  getSwapPrice: vi.fn(),
  createSwapQuote: vi.fn(),
  getOrCreateAccount: vi.fn(async () => ({
    address: "0x00000000000000000000000000000000000000aa" as const,
    sign: vi.fn(),
    signMessage: vi.fn(),
    signTransaction: vi.fn(),
  })),
}));

vi.mock("@coinbase/cdp-sdk", () => ({
  CdpClient: class {
    evm = {
      getOrCreateAccount: sdk.getOrCreateAccount,
      getSwapPrice: sdk.getSwapPrice,
      createSwapQuote: sdk.createSwapQuote,
    };
  },
}));

import {
  DEFAULT_SLIPPAGE_BPS,
  CoinbaseTradeUnavailableError,
  executeCoinbaseSwap,
  getCoinbaseSwapPrice,
  isSwapNetwork,
  parseAmountToAtomic,
  swapPreset,
  swapPresetsForChain,
  coinbaseSwapConfigured,
} from "@/lib/coinbase/trading";

const TAKER = "0x00000000000000000000000000000000000000aa";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const BASE_WETH = "0x4200000000000000000000000000000000000006" as const;

/** Configured custody + CDP credentials, so the adapter's own gates are open. */
function configureCustody() {
  vi.stubEnv("CUSTODY_PROVIDER", "coinbase-cdp");
  vi.stubEnv("CUSTODY_KEY_ID", "hot-wallet");
  vi.stubEnv("CDP_API_KEY_ID", "key-id");
  vi.stubEnv("CDP_API_KEY_SECRET", "key-secret");
  vi.stubEnv("CDP_WALLET_SECRET", "wallet-secret");
}

afterEach(() => {
  vi.unstubAllEnvs();
  sdk.getSwapPrice.mockReset();
  sdk.createSwapQuote.mockReset();
  sdk.getOrCreateAccount.mockClear();
});

describe("parseAmountToAtomic", () => {
  it("parses a decimal exactly, at the token's precision", () => {
    expect(parseAmountToAtomic("0.05", 18)).toBe(50_000_000_000_000_000n);
    expect(parseAmountToAtomic("10", 6)).toBe(10_000_000n);
    expect(parseAmountToAtomic("10.00", 6)).toBe(10_000_000n);
    expect(parseAmountToAtomic("1.5", 6)).toBe(1_500_000n);
  });

  it("rejects a malformed, zero/negative or over-precise amount", () => {
    expect(parseAmountToAtomic("1.2345678", 6)).toBeNull(); // more decimals than the token has
    expect(parseAmountToAtomic("0", 18)).toBeNull();
    expect(parseAmountToAtomic("0.000", 18)).toBeNull();
    expect(parseAmountToAtomic("-1", 18)).toBeNull();
    expect(parseAmountToAtomic("abc", 18)).toBeNull();
    expect(parseAmountToAtomic("1.", 18)).toBeNull();
    expect(parseAmountToAtomic("", 18)).toBeNull();
  });
});

describe("swap presets", () => {
  it("only proposes supported mainnet pairs", () => {
    for (const preset of swapPresetsForChain(8453)) {
      expect(isSwapNetwork(preset.network)).toBe(true);
      expect(preset.chainId).toBe(8453);
    }
    expect(swapPreset("base-eth-usdc")?.fromToken).toBe(BASE_WETH);
    expect(swapPreset("base-eth-usdc")?.toToken).toBe(BASE_USDC);
    expect(swapPreset("nope")).toBeNull();
  });
});

describe("coinbaseSwapConfigured", () => {
  it("is false without credentials, and false with a non-Coinbase custody provider", () => {
    expect(coinbaseSwapConfigured()).toBe(false);
    configureCustody();
    expect(coinbaseSwapConfigured()).toBe(true);
    vi.stubEnv("CUSTODY_PROVIDER", "some-other-kms");
    expect(coinbaseSwapConfigured()).toBe(false);
  });
});

describe("mainnet-only enforcement", () => {
  it("refuses a practice (or unknown) network before touching the SDK", async () => {
    configureCustody();
    await expect(
      getCoinbaseSwapPrice({ network: "base-sepolia", fromToken: BASE_WETH, toToken: BASE_USDC, fromAmount: 1n })
    ).rejects.toThrow(CoinbaseTradeUnavailableError);
    expect(sdk.getSwapPrice).not.toHaveBeenCalled();
  });
});

describe("getCoinbaseSwapPrice", () => {
  it("fails closed when unconfigured", async () => {
    await expect(
      getCoinbaseSwapPrice({ network: "base", fromToken: BASE_WETH, toToken: BASE_USDC, fromAmount: 1n })
    ).rejects.toThrow(CoinbaseTradeUnavailableError);
  });

  it("returns the price with the custody account as taker", async () => {
    configureCustody();
    sdk.getSwapPrice.mockResolvedValue({
      liquidityAvailable: true,
      toAmount: 3_000_000n,
      minToAmount: 2_970_000n,
      blockNumber: 42n,
    });

    const price = await getCoinbaseSwapPrice({
      network: "base",
      fromToken: BASE_WETH,
      toToken: BASE_USDC,
      fromAmount: 1_000_000_000_000_000n,
    });

    expect(price).toEqual({ toAmount: 3_000_000n, minToAmount: 2_970_000n, blockNumber: 42n });
    const options = sdk.getSwapPrice.mock.calls[0][0];
    expect(options.taker).toBe(TAKER);
    expect(options.network).toBe("base");
    expect(options.slippageBps).toBe(DEFAULT_SLIPPAGE_BPS);
  });

  it("refuses when liquidity is unavailable", async () => {
    configureCustody();
    sdk.getSwapPrice.mockResolvedValue({ liquidityAvailable: false });
    await expect(
      getCoinbaseSwapPrice({ network: "base", fromToken: BASE_WETH, toToken: BASE_USDC, fromAmount: 1n })
    ).rejects.toThrow(CoinbaseTradeUnavailableError);
  });
});

describe("executeCoinbaseSwap", () => {
  const base = {
    network: "base" as const,
    fromToken: BASE_WETH,
    toToken: BASE_USDC,
    fromAmount: 1_000_000_000_000_000n,
    spentTodayCents: 0,
  };

  it("enforces the custody spend cap before creating a quote", async () => {
    configureCustody();
    await expect(
      executeCoinbaseSwap({ ...base, notionalCents: 200_000 }) // > $1,000 default per-tx cap
    ).rejects.toThrow(/per-transaction/i);
    expect(sdk.createSwapQuote).not.toHaveBeenCalled();
  });

  it("refuses to execute without custody, even within the cap", async () => {
    await expect(executeCoinbaseSwap({ ...base, notionalCents: 100 })).rejects.toThrow();
    expect(sdk.createSwapQuote).not.toHaveBeenCalled();
  });

  it("executes a quote and returns the transaction hash", async () => {
    configureCustody();
    const execute = vi.fn(async () => ({ transactionHash: "0xdeadbeef" }));
    sdk.createSwapQuote.mockResolvedValue({ liquidityAvailable: true, execute });

    const result = await executeCoinbaseSwap({
      ...base,
      notionalCents: 500,
      idempotencyKey: "idem-1",
    });

    expect(result).toEqual({ transactionHash: "0xdeadbeef" });
    expect(sdk.createSwapQuote.mock.calls[0][0].taker).toBe(TAKER);
    expect(execute).toHaveBeenCalledWith({ idempotencyKey: "idem-1" });
  });

  it("refuses when liquidity is unavailable", async () => {
    configureCustody();
    sdk.createSwapQuote.mockResolvedValue({ liquidityAvailable: false });
    await expect(executeCoinbaseSwap({ ...base, notionalCents: 100 })).rejects.toThrow(
      CoinbaseTradeUnavailableError
    );
  });
});
