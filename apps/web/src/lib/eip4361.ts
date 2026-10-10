/**
 * EIP-4361 ("Sign-In with Ethereum") message construction.
 *
 * Isomorphic and dependency-free so the exact same string is built in the
 * browser (to be signed) and could be rebuilt on the server (to be compared).
 * Signature verification itself lives in `src/lib/siwe.ts` — server only.
 */

export const SIWE_VERSION = "1";

/** Shown to the user in the wallet before they sign; also part of the message. */
export const SIWE_STATEMENT = "Sign in to Veylora Fintech AI Trading.";

export interface SiweMessageParams {
  /** Host that is asking, e.g. `example.com` — must match the served origin. */
  domain: string;
  /** EIP-55 or all-lowercase 0x address of the signer. */
  address: string;
  /** Full origin the request came from, e.g. `https://example.com`. */
  uri: string;
  /** EIP-155 chain id of the network the wallet is connected to. */
  chainId: number;
  /** Single-use nonce issued by the server. */
  nonce: string;
  statement?: string;
  version?: string;
  issuedAt?: string;
  expirationTime?: string;
}

/** Renders the canonical EIP-4361 message for the given parameters. */
export function buildSiweMessage(params: SiweMessageParams): string {
  const {
    domain,
    address,
    uri,
    chainId,
    nonce,
    statement = SIWE_STATEMENT,
    version = SIWE_VERSION,
    issuedAt = new Date().toISOString(),
    expirationTime,
  } = params;

  const lines = [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
  ];

  // The statement block is optional in EIP-4361; when present it is followed by
  // a blank line before the key/value fields.
  if (statement) lines.push(statement, "");

  lines.push(
    `URI: ${uri}`,
    `Version: ${version}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`
  );

  if (expirationTime) lines.push(`Expiration Time: ${expirationTime}`);

  return lines.join("\n");
}
