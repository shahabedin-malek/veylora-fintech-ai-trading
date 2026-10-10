/**
 * Coinbase CDP Server Wallets adapter — the concrete custody backend (PHASE18-004).
 *
 * CDP Server Wallets hold an EVM key in Coinbase's secure infrastructure and expose
 * signing as an API call: the wallet key never leaves Coinbase, and this app holds
 * only an API key + wallet secret (credentials, not the wallet key). The SDK exposes
 * exactly the primitive a KMS does — `account.sign({ hash })` — plus viem-compatible
 * `signMessage` / `signTransaction`, which is what a real execution path needs.
 *
 * The SDK is imported **lazily** (`await import`), so the execution gate can ask
 * whether custody is configured without pulling the SDK (and its Solana/axios tree)
 * into every server render. Credentials are read from the environment only; nothing
 * here is written to the repo or a log.
 */

import { providerHasPoolKeySync } from "@/lib/credentials/presence";
import type { CustodyKeyReference, CustodySigner } from "@/lib/custody/types";

/** The `CUSTODY_PROVIDER` value that selects this backend. */
export const COINBASE_CDP_PROVIDER = "coinbase-cdp";

/** Credentials this backend needs. All are `CDP_*` API credentials, not a wallet key. */
export const COINBASE_CDP_ENV_VARS = [
  "CDP_API_KEY_ID",
  "CDP_API_KEY_SECRET",
  "CDP_WALLET_SECRET",
] as const;

function envValue(name: string): string | null {
  const raw = process.env[name]?.trim();
  return raw ? raw : null;
}

/**
 * True when every credential this backend needs is present (`CUSTODY_KEY_ID` aside).
 * The credentials may come from the env vars or the admin key pool (see
 * `src/lib/credentials/`); the pool presence is read from a warmed cache, so this stays
 * a cheap synchronous check for the execution gate.
 */
export function coinbaseCdpConfigured(): boolean {
  return COINBASE_CDP_ENV_VARS.every((name) => envValue(name) !== null) || providerHasPoolKeySync("coinbase-cdp");
}

/**
 * The credentials, resolved through the pool (env first, then managed keys), or throw.
 * Called only after `coinbaseCdpConfigured()`. The values are used here and never
 * returned or logged.
 */
async function requiredCredentials(): Promise<{ apiKeyId: string; apiKeySecret: string; walletSecret: string }> {
  // Dynamic import so the credential pool (and its Prisma import, which loads `.env`)
  // is not pulled into every module that merely checks whether custody is configured.
  const { withCredential } = await import("@/lib/credentials/pool");
  return withCredential("coinbase-cdp", async (values) => {
    const { apiKeyId, apiKeySecret, walletSecret } = values;
    if (!apiKeyId || !apiKeySecret || !walletSecret) {
      throw new Error("CDP credentials are incomplete (apiKeyId / apiKeySecret / walletSecret).");
    }
    return { apiKeyId, apiKeySecret, walletSecret };
  });
}

/**
 * The slice of the SDK client this adapter uses. Written as a minimal interface so a
 * change in the SDK's type surface cannot break the boundary, and so only these
 * methods are reachable from here.
 */
interface CdpEvmApi {
  getOrCreateAccount(options: { name: string }): Promise<{
    address: `0x${string}`;
    sign(parameters: { hash: `0x${string}` }): Promise<`0x${string}`>;
    signMessage(parameters: { message: unknown }): Promise<`0x${string}`>;
    signTransaction(transaction: unknown): Promise<`0x${string}`>;
  }>;
  sendTransaction(options: {
    address: `0x${string}`;
    network: string;
    transaction: { to: `0x${string}`; value: bigint; data?: `0x${string}` };
  }): Promise<{ transactionHash: `0x${string}` }>;
}

/**
 * Resolve the platform hot-wallet signer. `reference.keyId` is the CDP account
 * **name** to get or create, so the same reference resolves to the same wallet
 * across restarts without the app storing an address.
 */
export async function getCoinbaseCdpSigner(reference: CustodyKeyReference): Promise<CustodySigner> {
  const { apiKeyId, apiKeySecret, walletSecret } = await requiredCredentials();
  const { CdpClient } = await import("@coinbase/cdp-sdk");

  const client = new CdpClient({ apiKeyId, apiKeySecret, walletSecret }) as unknown as {
    evm: CdpEvmApi;
  };
  const account = await client.evm.getOrCreateAccount({ name: reference.keyId });

  // Wrap rather than return the SDK account: the boundary should expose only the
  // primitives callers need, and never the SDK surface or an import of it.
  return {
    address: account.address,
    sign: (parameters) => account.sign(parameters),
    signMessage: (parameters) => account.signMessage(parameters),
    signTransaction: (transaction) => account.signTransaction(transaction),
    // Provider-side send: the SDK estimates gas, manages the nonce and broadcasts,
    // so the app never needs a signing key or an RPC endpoint of its own.
    sendTransaction: (parameters) =>
      client.evm.sendTransaction({
        address: account.address,
        network: parameters.network,
        transaction: {
          to: parameters.to,
          value: parameters.value ?? 0n,
          ...(parameters.data ? { data: parameters.data } : {}),
        },
      }),
  };
}

/** The adapter, as the boundary consumes it. */
export const coinbaseCdpAdapter = {
  isConfigured: coinbaseCdpConfigured,
  getSigner: getCoinbaseCdpSigner,
};
