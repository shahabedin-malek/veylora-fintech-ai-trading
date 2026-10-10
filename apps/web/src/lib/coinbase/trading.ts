/**
 * Coinbase EVM swaps — the real trading venue adapter (`PHASE19-004`).
 *
 * This is the "real venue" the Phase 18 execution gate was built to wait for. It is
 * deliberately narrow and fail-closed:
 *
 * - **Mainnet only.** Coinbase swaps run on Base, Ethereum, Arbitrum, Optimism and
 *   Polygon — no practice network is supported (see
 *   `coinbase/docs/wallets/115-swaps.md`). A network outside that set is refused, so a
 *   practice session can never reach this module's execution path.
 * - **Custody-signed.** The taker is the custody boundary's provider-held account
 *   (`src/lib/custody/`) — the app never holds a key, and the provider signs the
 *   swap. Spend limits are enforced *before* a quote is executed, so an over-limit
 *   swap is refused rather than trimmed.
 * - **Fail closed.** Missing credentials, an unsupported network, unavailable
 *   liquidity or a failed execution all throw; nothing is silently replaced.
 *
 * The execution gate (`src/lib/execution.ts`) still requires a configured custody
 * backend, with the kill switch clear (`MAINNET_EXECUTION_ENABLED=0` refuses), before
 * a mainnet session is allowed to reach here. A practice network never reaches it.
 *
 * `@coinbase/cdp-sdk` is imported lazily so this module can be imported (and its
 * predicates called) without loading the SDK's Solana/axios tree on every render.
 */

import {
  COINBASE_CDP_PROVIDER,
  authorizeCustodySpend,
  custodyKeyReference,
  getCustodySigner,
} from "@/lib/custody";

/** A 0x-prefixed EVM address (the SDK's `Address`). */
export type EvmAddress = `0x${string}`;

/**
 * Networks Coinbase swaps support. All are **mainnets** — swaps have no practice
 * network, so a practice session must never reach the execution path.
 */
export const SWAP_NETWORKS = ["base", "ethereum", "arbitrum", "optimism", "polygon"] as const;
export type SwapNetwork = (typeof SWAP_NETWORKS)[number];

export function isSwapNetwork(value: string): value is SwapNetwork {
  return (SWAP_NETWORKS as readonly string[]).includes(value);
}

/** Default slippage tolerance for a swap quote (1%). */
export const DEFAULT_SLIPPAGE_BPS = 100;

/** The credentials the swap path needs — the same CDP API key the custody backend uses. */
const CDP_ENV_VARS = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"] as const;

/** Thrown when a swap cannot be priced or executed. */
export class CoinbaseTradeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoinbaseTradeUnavailableError";
  }
}

function envValue(name: string): string | null {
  const raw = process.env[name]?.trim();
  return raw ? raw : null;
}

/**
 * Whether the swap venue can be offered: the CDP API credentials are present **and**
 * custody is selected with the `coinbase-cdp` backend. Without this the UI hides the
 * real-trade entry point; the execution gate refuses the session as well.
 */
export function coinbaseSwapConfigured(): boolean {
  if (!CDP_ENV_VARS.every((name) => envValue(name) !== null)) return false;
  return custodyKeyReference()?.provider === COINBASE_CDP_PROVIDER;
}

/* ------------------------------------------------------------------- presets */

/**
 * A tradable swap pair offered in the UI. Presets exist so the form cannot propose a
 * token/network combination the adapter would then have to reject — and so the USD
 * cap can be computed from a known price source.
 */
export interface SwapPreset {
  id: string;
  /** The wallet must be signed in on this chain (a swap is network-specific). */
  chainId: number;
  network: SwapNetwork;
  label: string;
  fromToken: EvmAddress;
  toToken: EvmAddress;
  fromDecimals: number;
  fromSymbol: string;
  toSymbol: string;
  /** Market symbol used to price the from-token for the spend cap. */
  priceSymbol?: string;
  /** Fixed USD peg for a stablecoin from-token (e.g. USDC = 1). */
  fixedUsd?: number;
}

const WETH_BASE = "0x4200000000000000000000000000000000000006" as const;
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const WETH_ETHEREUM = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
const USDC_ETHEREUM = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

export const SWAP_PRESETS: readonly SwapPreset[] = [
  {
    id: "base-eth-usdc",
    chainId: 8453,
    network: "base",
    label: "Base · ETH → USDC",
    fromToken: WETH_BASE,
    toToken: USDC_BASE,
    fromDecimals: 18,
    fromSymbol: "ETH",
    toSymbol: "USDC",
    priceSymbol: "ETH",
  },
  {
    id: "base-usdc-eth",
    chainId: 8453,
    network: "base",
    label: "Base · USDC → ETH",
    fromToken: USDC_BASE,
    toToken: WETH_BASE,
    fromDecimals: 6,
    fromSymbol: "USDC",
    toSymbol: "ETH",
    fixedUsd: 1,
  },
  {
    id: "ethereum-eth-usdc",
    chainId: 1,
    network: "ethereum",
    label: "Ethereum · ETH → USDC",
    fromToken: WETH_ETHEREUM,
    toToken: USDC_ETHEREUM,
    fromDecimals: 18,
    fromSymbol: "ETH",
    toSymbol: "USDC",
    priceSymbol: "ETH",
  },
  {
    id: "ethereum-usdc-eth",
    chainId: 1,
    network: "ethereum",
    label: "Ethereum · USDC → ETH",
    fromToken: USDC_ETHEREUM,
    toToken: WETH_ETHEREUM,
    fromDecimals: 6,
    fromSymbol: "USDC",
    toSymbol: "ETH",
    fixedUsd: 1,
  },
];

export function swapPreset(id: string | null | undefined): SwapPreset | null {
  if (!id) return null;
  return SWAP_PRESETS.find((p) => p.id === id) ?? null;
}

/** The presets offered on a chain (empty when the chain has no swap pair). */
export function swapPresetsForChain(chainId: number): SwapPreset[] {
  return SWAP_PRESETS.filter((p) => p.chainId === chainId);
}

/* ------------------------------------------------------------------- amounts */

/**
 * Parse a decimal amount string into atomic units, exactly (no float drift). Rejects
 * a non-positive amount, a malformed string, or more fractional digits than the token
 * supports, so a caller cannot silently round a user's input down or up.
 */
export function parseAmountToAtomic(value: string, decimals: number): bigint | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) return null;
  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  const digits = `${whole}${padded}`.replace(/^0+/, "") || "0";
  const atomic = BigInt(digits);
  return atomic > 0n ? atomic : null;
}

/* ------------------------------------------------------------------ gateway */

interface SwapApi {
  evm: {
    getSwapPrice(options: unknown): Promise<{ liquidityAvailable: boolean; toAmount: bigint; minToAmount: bigint; blockNumber: bigint }>;
    createSwapQuote(options: unknown): Promise<{
      liquidityAvailable: boolean;
      execute: (options?: { idempotencyKey?: string }) => Promise<{ transactionHash?: string }>;
    }>;
    getOrCreateAccount(options: { name: string }): Promise<{ address: EvmAddress }>;
  };
}

/** Resolve a CDP client, lazily importing the SDK. Server-only. */
async function getClient(): Promise<SwapApi> {
  const apiKeyId = envValue("CDP_API_KEY_ID");
  const apiKeySecret = envValue("CDP_API_KEY_SECRET");
  const walletSecret = envValue("CDP_WALLET_SECRET");
  if (!apiKeyId || !apiKeySecret || !walletSecret) {
    throw new CoinbaseTradeUnavailableError(
      "Coinbase swaps are not configured (CDP_API_KEY_ID / CDP_API_KEY_SECRET / CDP_WALLET_SECRET)."
    );
  }
  const { CdpClient } = await import("@coinbase/cdp-sdk");
  return new CdpClient({ apiKeyId, apiKeySecret, walletSecret }) as unknown as SwapApi;
}

function requireSwapNetwork(network: string): SwapNetwork {
  if (!isSwapNetwork(network)) {
    throw new CoinbaseTradeUnavailableError(
      `Coinbase swaps do not support "${network}". Swaps are mainnet-only (${SWAP_NETWORKS.join(", ")}).`
    );
  }
  return network;
}

/* ------------------------------------------------------------------- price */

export interface GetSwapPriceInput {
  network: SwapNetwork | string;
  fromToken: EvmAddress;
  toToken: EvmAddress;
  /** Amount to send, in the from-token's atomic units. */
  fromAmount: bigint;
  slippageBps?: number;
}

export interface SwapPrice {
  toAmount: bigint;
  minToAmount: bigint;
  blockNumber: bigint;
}

/** Price a swap without moving funds. The taker is the custody-held account. */
export async function getCoinbaseSwapPrice(input: GetSwapPriceInput): Promise<SwapPrice> {
  const network = requireSwapNetwork(input.network);
  if (!coinbaseSwapConfigured()) {
    throw new CoinbaseTradeUnavailableError("Coinbase swaps are not configured on this deployment.");
  }
  if (input.fromAmount <= 0n) {
    throw new CoinbaseTradeUnavailableError("A swap needs a positive from-amount.");
  }

  const signer = await getCustodySigner();
  const client = await getClient();
  const price = await client.evm.getSwapPrice({
    network,
    fromToken: input.fromToken,
    toToken: input.toToken,
    fromAmount: input.fromAmount,
    taker: signer.address,
    slippageBps: input.slippageBps ?? DEFAULT_SLIPPAGE_BPS,
  });
  if (!price.liquidityAvailable) {
    throw new CoinbaseTradeUnavailableError("No liquidity is available for this swap right now.");
  }
  return {
    toAmount: price.toAmount,
    minToAmount: price.minToAmount,
    blockNumber: price.blockNumber,
  };
}

/* ---------------------------------------------------------------- execution */

export interface ExecuteSwapInput extends GetSwapPriceInput {
  /**
   * USD value of the from-side, in integer cents. The caller computes this from a
   * real price; the adapter only enforces the custody cap on it.
   */
  notionalCents: number;
  /** Real movement already made today, for the rolling daily cap. */
  spentTodayCents: number;
  idempotencyKey?: string;
}

export interface SwapExecution {
  transactionHash: string;
}

/**
 * Execute a swap. Spend limits are checked **first** (deterministic, cheap) and a
 * custody signer is required before the quote is created, so an over-limit or
 * unconfigured request is refused without ever reaching Coinbase.
 */
export async function executeCoinbaseSwap(input: ExecuteSwapInput): Promise<SwapExecution> {
  const network = requireSwapNetwork(input.network);
  if (input.fromAmount <= 0n) {
    throw new CoinbaseTradeUnavailableError("A swap needs a positive from-amount.");
  }

  // Cap + custody, before any quote or signature.
  authorizeCustodySpend(input.notionalCents, input.spentTodayCents);

  const signer = await getCustodySigner();
  const client = await getClient();
  const quote = await client.evm.createSwapQuote({
    network,
    fromToken: input.fromToken,
    toToken: input.toToken,
    fromAmount: input.fromAmount,
    taker: signer.address,
    slippageBps: input.slippageBps ?? DEFAULT_SLIPPAGE_BPS,
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
  if (!quote.liquidityAvailable) {
    throw new CoinbaseTradeUnavailableError("No liquidity is available for this swap right now.");
  }

  const result = await quote.execute(
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
  );
  if (!result.transactionHash) {
    throw new CoinbaseTradeUnavailableError("Coinbase did not return a transaction hash for the swap.");
  }
  return { transactionHash: result.transactionHash };
}
