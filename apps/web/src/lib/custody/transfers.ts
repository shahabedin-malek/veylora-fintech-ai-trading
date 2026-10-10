/**
 * On-chain custody transfers — the real deposit/withdrawal path (`PHASE18-005`).
 *
 * This is the fallback the whole Phase 18/19 story pointed at: instead of Coinbase's
 * hosted On/Offramp hand-off, value moves **on-chain through the custody wallet**. The
 * key stays with the provider (never here); this module only resolves a signer and asks
 * it to send, so the app holds no key and no RPC endpoint of its own.
 *
 * - **Mainnet only.** A real movement has no practice-network equivalent; a practice
 *   session must never reach here. `sendCustodyTransfer` refuses a network it does not
 *   recognise.
 * - **Custody-signed + spend-limited.** The over-limit and non-configured checks run
 *   *before* the signer is asked to send, so a refusal never reaches the chain.
 * - **Fail closed.** Missing credentials, an unsupported network, a zero amount or a
 *   self-send all throw; nothing is silently replaced.
 *
 * Deposits are the mirror image: users send to the custody address
 * (`custodyDepositAddress()`), and the credit is applied only after a **verified**
 * webhook reconciles the transfer (`src/lib/coinbase/ingest.ts`) — never on the client's
 * say-so.
 */

import { isAddress } from "viem";

import { authorizeCustodySpend, getCustodySigner } from "@/lib/custody";

/** A 0x-prefixed EVM address. */
export type EvmAddress = `0x${string}`;

/**
 * Chain id → the CDP network name used for a real transfer. Only mainnets this app
 * offers (see `src/lib/network.ts`); a chain outside this set is refused.
 */
const CDP_NETWORK_BY_CHAIN_ID: Readonly<Record<number, string>> = {
  1: "ethereum",
  8453: "base",
  42161: "arbitrum",
};

/** The chain ids on which an on-chain custody transfer is allowed. */
export const TRANSFER_CHAIN_IDS = Object.keys(CDP_NETWORK_BY_CHAIN_ID).map(Number);

/** The CDP network name for a chain id, or null when transfers are not offered there. */
export function transferNetworkForChainId(chainId: number): string | null {
  return CDP_NETWORK_BY_CHAIN_ID[chainId] ?? null;
}

/** Thrown when an on-chain custody transfer cannot be produced. */
export class TransferUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferUnavailableError";
  }
}

/** Basic structural validation of an EVM address (never trusts a caller's string). */
export function isEvmAddress(value: string): value is EvmAddress {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

/** Why a destination address was rejected. */
export type DestinationProblem = "format" | "checksum" | "zero";

/**
 * Verify a **destination** address, which is stricter than checking its shape.
 *
 * A chain transfer is final, so the mistake that actually costs money is a plausible
 * but wrong address — one character that got mangled in transit. Three guards, in
 * order:
 *
 *   1. **Shape.** 0x + 40 hex characters (`isEvmAddress`).
 *   2. **Burn address.** `0x000…0` is a valid-shaped address that destroys whatever is
 *      sent to it. It is always a mistake, never a destination.
 *   3. **EIP-55 checksum.** A *mixed-case* address carries a checksum in its casing; if
 *      that checksum does not match, at least one character is wrong. All-lowercase (or
 *      all-uppercase) input carries no checksum information at all, so it is accepted
 *      as typed — refusing it would reject every address a user copies from an
 *      explorer that lowercases.
 *
 * Only the first and last checks are cheap string work: no network, no custody, nothing
 * signed. `sendCustodyTransfer` re-runs this, so a caller that skips it cannot weaken
 * the boundary.
 */
export function verifyEvmAddress(
  value: string
): { ok: true; address: EvmAddress } | { ok: false; problem: DestinationProblem } {
  const trimmed = value.trim();
  if (!isEvmAddress(trimmed)) return { ok: false, problem: "format" };
  if (/^0x0{40}$/i.test(trimmed)) return { ok: false, problem: "zero" };

  const body = trimmed.slice(2);
  const mixedCase = /[a-f]/.test(body) && /[A-F]/.test(body);
  if (mixedCase && !isAddress(trimmed, { strict: true })) return { ok: false, problem: "checksum" };

  return { ok: true, address: trimmed as EvmAddress };
}

/**
 * The platform custody (hot-wallet) address, resolved from the provider without ever
 * exposing key material. Users deposit to this address; it is also the `from` of every
 * custody-signed withdrawal.
 */
export async function custodyDepositAddress(): Promise<EvmAddress> {
  const signer = await getCustodySigner();
  return signer.address;
}

export interface OnChainTransferInput {
  /** The chain the transfer happens on (must be one this app supports). */
  chainId: number;
  /** Destination address. */
  to: string;
  /** Amount to send, in wei (native asset). */
  valueWei: bigint;
  /** USD notional in integer cents, for the custody spend cap and ledger. */
  notionalCents: number;
  /** Real movement already recorded today, from the persisted ledger. */
  spentTodayCents: number;
  /** Retries reuse this key; the provider uses it to de-duplicate the broadcast. */
  idempotencyKey?: string;
}

export interface OnChainTransferResult {
  transactionHash: EvmAddress;
  /** The custody address that sent it. */
  from: EvmAddress;
  /** The CDP network name used. */
  network: string;
}

/**
 * Send a real on-chain transfer from the custody wallet. The spend cap and custody
 * configuration are checked **before** the signer is used, so an over-limit or
 * unconfigured request is refused without touching the chain.
 */
export async function sendCustodyTransfer(input: OnChainTransferInput): Promise<OnChainTransferResult> {
  const network = transferNetworkForChainId(input.chainId);
  if (!network) {
    throw new TransferUnavailableError(
      `On-chain transfers are not supported on chain ${input.chainId}.`
    );
  }
  if (input.valueWei <= 0n) {
    throw new TransferUnavailableError("A transfer needs a positive amount.");
  }
  const destination = verifyEvmAddress(input.to);
  if (!destination.ok) {
    const detail: Record<DestinationProblem, string> = {
      format: "a 0x-prefixed 40-character hex address",
      checksum: "an address whose EIP-55 checksum matches (the casing does not, so a character is wrong)",
      zero: "a real destination (the zero address would burn the funds)",
    };
    throw new TransferUnavailableError(`A valid destination address is required: ${detail[destination.problem]}.`);
  }

  // Cap + custody, before any signature or broadcast.
  authorizeCustodySpend(input.notionalCents, input.spentTodayCents);

  const signer = await getCustodySigner();
  if (signer.address.toLowerCase() === input.to.trim().toLowerCase()) {
    throw new TransferUnavailableError("Refusing to send to the custody address itself.");
  }

  const { transactionHash } = await signer.sendTransaction({
    network,
    to: destination.address,
    value: input.valueWei,
  });

  return { transactionHash, from: signer.address, network };
}
