/**
 * Coinbase sign-in — an additional provider on top of the existing wallet
 * (SIWE) identity, not a replacement for it (`PHASE19-002`).
 *
 * The product's identity model is deliberately strict: a user **is** their wallet
 * address, and the address is only trusted after a SIWE signature over a
 * server-issued nonce (`src/lib/siwe.ts`). Coinbase therefore enters as a *wallet
 * provider* — the same one-click "Sign in with Coinbase" experience, resolved to a
 * `0x…` address and fed through the existing SIWE flow — rather than as a separate
 * email account, which would require a schema change and break the model.
 *
 * An account-based "Sign in with Coinbase" (OAuth2) is a documented follow-up
 * (`coinbase/INTEGRATION.md`, `coinbase/docs/auth/123-wallet-authentication.md`); it
 * needs a Coinbase OAuth client and a linked-account model, and is intentionally not
 * wired here so no half-configured OAuth path can exist.
 *
 * This module is framework-free so the connector matching is unit-testable and
 * shared by the login UI.
 */

/** The `Coinbase` provider label used in the UI and audit trails. */
export const COINBASE_PROVIDER = "coinbase";

/** Minimal shape of a wagmi/RainbowKit connector, for provider matching. */
export interface ConnectorLike {
  id: string;
  name: string;
}

/**
 * Whether a connector is the Coinbase Wallet connector.
 *
 * Matched on id **or** name, case-insensitively, so it survives RainbowKit
 * renaming the connector (`coinbaseWalletSDK`) while the display name stays stable.
 */
export function isCoinbaseConnector(connector: ConnectorLike): boolean {
  const id = connector.id.toLowerCase();
  const name = connector.name.toLowerCase();
  return id.includes(COINBASE_PROVIDER) || name.includes(COINBASE_PROVIDER);
}

/**
 * Whether "Sign in with Coinbase" can be offered.
 *
 * The Coinbase Wallet connector ships in every build (`src/lib/wagmi.ts`), so this
 * is true. It exists as a named gate — like `custodyAvailable()` — so the UI has a
 * single place to ask, and a future build that drops the connector fails closed
 * (button hidden) instead of throwing at click time.
 */
export function coinbaseLoginEnabled(): boolean {
  return true;
}

/** Copy kept in one place so the button and its help text cannot drift. */
export const COINBASE_LOGIN_COPY = {
  button: "Sign in with Coinbase",
  connecting: "Opening Coinbase…",
  help: "Connect and sign a message with your Coinbase Wallet — no email or password, and no funds move.",
} as const;
