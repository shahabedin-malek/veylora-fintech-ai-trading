/**
 * Custody types — the provider-agnostic contract (PHASE18-004).
 *
 * A custody backend never lets key material cross the boundary. It hands back a
 * **signer**: something that can produce a signature with a key it holds, plus the
 * public address that key controls. There is deliberately no property anywhere here
 * that returns a private key, seed phrase or signing secret — the whole point of a
 * custodial hot wallet is that the key lives in the provider's KMS/HSM/TEE and the
 * app only ever holds a *reference* to it.
 */

import type { SignableMessage, TransactionSerializable } from "viem";

/**
 * A reference to an operational key held by the provider. Carries no key material:
 * the provider resolves `keyId` internally.
 */
export interface CustodyKeyReference {
  /** Backend id, e.g. "coinbase-cdp". */
  provider: string;
  /** Opaque provider-side key/account identifier (not a secret). */
  keyId: string;
}

/** A signer backed by a provider-held key. Structurally matches viem's account shape. */
export interface CustodySigner {
  /** The public address controlled by the provider-held key. */
  readonly address: `0x${string}`;
  /** Signs a 32-byte digest. The core KMS/HSM primitive. */
  sign(parameters: { hash: `0x${string}` }): Promise<`0x${string}`>;
  /** Signs an EIP-191 message. */
  signMessage(parameters: { message: SignableMessage }): Promise<`0x${string}`>;
  /** Signs a viem-serializable transaction, returning the signed raw transaction. */
  signTransaction(transaction: TransactionSerializable): Promise<`0x${string}`>;
  /**
   * Signs **and broadcasts** an on-chain transaction through the provider, which
   * handles nonce, gas estimation and submission. This is the primitive the on-chain
   * withdrawal path uses (`src/lib/custody/transfers.ts`), so the app never needs an
   * RPC endpoint or the raw signed bytes.
   */
  sendTransaction(parameters: {
    network: string;
    to: `0x${string}`;
    value?: bigint;
    data?: `0x${string}`;
  }): Promise<{ transactionHash: `0x${string}` }>;
}

/** A backend adapter: reports whether it is configured and resolves a signer. */
export interface CustodyAdapter {
  /** Whether the credentials this backend needs are present in the environment. */
  isConfigured(): boolean;
  /** Resolve a signer for a key reference. Throws if the provider cannot sign. */
  getSigner(reference: CustodyKeyReference): Promise<CustodySigner>;
}
