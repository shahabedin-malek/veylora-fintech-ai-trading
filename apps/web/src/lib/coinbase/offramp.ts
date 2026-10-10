/**
 * Coinbase Offramp — the "sell crypto for fiat" withdrawal path (`PHASE19-005`).
 *
 * Like Onramp, Offramp is a **hand-off**: the app mints a short-lived session token
 * and sends the user to Coinbase's One-Click-Sell flow, where they send crypto from
 * their own wallet and Coinbase pays out to their bank. The app never custodies the
 * funds and never signs a movement, so this is outside the app's real-execution gate
 * (which guards funds the *app* moves). The app's own balance is untouched until a
 * verified webhook reconciles the sale.
 *
 * Grounded in the split docs:
 *   - `coinbase/docs/onramp-offramp/059-reference.md` — the
 *     `https://pay.coinbase.com/v3/sell/input` URL and its parameters (`redirectUrl`
 *     is **required** for Offramp).
 *   - `coinbase/docs/onramp-offramp/064-api-reference.md` — the shared Session Token
 *     API, reused from `onramp.ts`.
 *
 * Fail-closed: without the CDP API-key credentials nothing is generated and
 * `OfframpUnavailableError` is thrown (the UI hides the entry point instead).
 */

import {
  OnrampUnavailableError,
  coinbaseOnrampConfigured,
  fetchOnrampSessionToken,
} from "@/lib/coinbase/onramp";

/** The Coinbase-hosted One-Click-Sell widget base URL. */
export const OFFRAMP_WIDGET_BASE = "https://pay.coinbase.com/v3/sell/input";

/** Fiat payout methods Coinbase documents for `defaultCashoutMethod`. */
export const OFFRAMP_CASHOUT_METHODS = [
  "FIAT_WALLET",
  "CRYPTO_ACCOUNT",
  "ACH_BANK_ACCOUNT",
  "PAYPAL",
] as const;

export type OfframpCashoutMethod = (typeof OFFRAMP_CASHOUT_METHODS)[number];

/** Thrown when an offramp URL cannot be produced. */
export class OfframpUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfframpUnavailableError";
  }
}

export interface OfframpUrlInput {
  /** Single-use token from the Session Token API. */
  sessionToken: string;
  /** Opaque user reference (an address fits the 50-char limit). */
  partnerUserRef: string;
  /** Where Coinbase redirects after the user sends crypto — **required** for Offramp. */
  redirectUrl: string;
  defaultNetwork?: string;
  defaultAsset?: string;
  /** Preset crypto amount to sell. */
  presetCryptoAmount?: number;
  /** Preset fiat amount (USD/CAD/GBP/EUR). Ignored when a crypto amount is set. */
  presetFiatAmount?: number;
  defaultCashoutMethod?: OfframpCashoutMethod;
  fiatCurrency?: string;
}

/** Build the Coinbase-hosted Offramp URL. Pure and deterministic. */
export function buildOfframpUrl(input: OfframpUrlInput): string {
  const token = input.sessionToken?.trim();
  if (!token) throw new OfframpUnavailableError("A Coinbase offramp session token is required.");
  if (!input.redirectUrl?.trim()) {
    throw new OfframpUnavailableError("Coinbase offramp requires a redirectUrl.");
  }

  const params = new URLSearchParams();
  params.set("sessionToken", token);
  params.set("partnerUserRef", (input.partnerUserRef ?? "").slice(0, 50));
  params.set("redirectUrl", input.redirectUrl);
  if (input.defaultNetwork) params.set("defaultNetwork", input.defaultNetwork);
  if (input.defaultAsset) params.set("defaultAsset", input.defaultAsset);
  if (input.presetCryptoAmount && input.presetCryptoAmount > 0) {
    params.set("presetCryptoAmount", String(input.presetCryptoAmount));
  } else if (input.presetFiatAmount && input.presetFiatAmount > 0) {
    params.set("presetFiatAmount", String(input.presetFiatAmount));
  }
  if (input.defaultCashoutMethod) params.set("defaultCashoutMethod", input.defaultCashoutMethod);
  if (input.fiatCurrency) params.set("fiatCurrency", input.fiatCurrency);
  return `${OFFRAMP_WIDGET_BASE}?${params.toString()}`;
}

export interface CreateOfframpUrlInput {
  address: string;
  clientIp: string;
  redirectUrl: string;
  presetCryptoAmount?: number;
  presetFiatAmount?: number;
  defaultCashoutMethod?: OfframpCashoutMethod;
}

/** Request a session token and assemble the hosted sell URL. */
export async function createOfframpUrl(input: CreateOfframpUrlInput): Promise<string> {
  if (!coinbaseOnrampConfigured()) {
    throw new OfframpUnavailableError(
      "Coinbase offramp is not configured (CDP_API_KEY_ID / CDP_API_KEY_SECRET)."
    );
  }
  if (!input.redirectUrl?.trim()) {
    throw new OfframpUnavailableError("Coinbase offramp requires a redirectUrl.");
  }

  let sessionToken: string;
  try {
    sessionToken = await fetchOnrampSessionToken({ address: input.address, clientIp: input.clientIp });
  } catch (error) {
    if (error instanceof OnrampUnavailableError) throw new OfframpUnavailableError(error.message);
    throw error;
  }

  return buildOfframpUrl({
    sessionToken,
    partnerUserRef: input.address,
    redirectUrl: input.redirectUrl,
    defaultNetwork: "base",
    defaultAsset: "USDC",
    presetCryptoAmount: input.presetCryptoAmount,
    presetFiatAmount: input.presetFiatAmount,
    defaultCashoutMethod: input.defaultCashoutMethod,
  });
}
