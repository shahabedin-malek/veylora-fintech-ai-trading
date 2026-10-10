/**
 * Coinbase Onramp — the "buy crypto with fiat" deposit path (`PHASE19-003`).
 *
 * Onramp is a **hand-off**: the app asks Coinbase for a short-lived session token,
 * builds the Coinbase-hosted buy URL, and sends the user there. Coinbase collects the
 * payment and delivers crypto to the user's **own** wallet — the app never custodies
 * it, and no app balance changes until a verified webhook reconciles the deposit
 * (`src/lib/coinbase/ingest.ts`). That keeps onramp outside the app's real-execution
 * gate, which only guards funds the *app* moves.
 *
 * Grounded in the split docs:
 *   - `coinbase/docs/onramp-offramp/064-api-reference.md` — Session Token API and the
 *     `https://pay.coinbase.com/buy/select-asset` URL format.
 *   - `coinbase/docs/onramp-offramp/049-generating-an-onramp-url.md` — URL parameters.
 *   - `coinbase/docs/platform/006-jwt-authentication.md` + `@coinbase/cdp-sdk/auth` —
 *     the short-lived CDP JWT that authenticates the session-token request.
 *
 * Fail-closed: without `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` nothing is generated
 * and `OnrampUnavailableError` is thrown (the UI hides the entry point instead).
 */

/** The CDP API-key credentials this module needs (a `CDP_*` key, never a wallet key). */
const CDP_API_KEY_ID = "CDP_API_KEY_ID";
const CDP_API_KEY_SECRET = "CDP_API_KEY_SECRET";

/** The Coinbase-hosted buy widget base URL. */
export const ONRAMP_WIDGET_BASE = "https://pay.coinbase.com/buy/select-asset";

/** Session-token endpoint (host + path are signed into the JWT). */
export const ONRAMP_SESSION_HOST = "api.developer.coinbase.com";
export const ONRAMP_SESSION_PATH = "/onramp/v1/token";
export const ONRAMP_SESSION_URL = `https://${ONRAMP_SESSION_HOST}${ONRAMP_SESSION_PATH}`;

/** Blockchains offered for onramp delivery — the documented set this app supports. */
export const ONRAMP_BLOCKCHAINS = ["ethereum", "base"] as const;

/** Default asset the buy widget preselects. */
export const ONRAMP_DEFAULT_ASSET = "USDC";

/** Thrown when an onramp URL cannot be produced. */
export class OnrampUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OnrampUnavailableError";
  }
}

function envValue(name: string): string | null {
  const raw = process.env[name]?.trim();
  return raw ? raw : null;
}

/**
 * Whether Onramp can be offered. Only the two API-key credentials are needed — the
 * wallet secret is for signing, which onramp does not do.
 */
export function coinbaseOnrampConfigured(): boolean {
  return envValue(CDP_API_KEY_ID) !== null && envValue(CDP_API_KEY_SECRET) !== null;
}

export interface OnrampUrlInput {
  /** Single-use token from the Session Token API. */
  sessionToken: string;
  /** Opaque user reference (an address fits the 50-char limit). */
  partnerUserRef?: string;
  /** Where Coinbase redirects after a completed purchase. */
  redirectUrl?: string;
  /** Preselected network, e.g. `base`. */
  defaultNetwork?: string;
  /** Preselected asset, e.g. `USDC`. */
  defaultAsset?: string;
  /** Preset fiat amount (positive number, USD). */
  presetFiatAmount?: number;
}

/** Build the Coinbase-hosted Onramp URL. Pure and deterministic. */
export function buildOnrampUrl(input: OnrampUrlInput): string {
  const token = input.sessionToken?.trim();
  if (!token) throw new OnrampUnavailableError("A Coinbase onramp session token is required.");

  const params = new URLSearchParams();
  params.set("sessionToken", token);
  if (input.partnerUserRef) params.set("partnerUserRef", input.partnerUserRef.slice(0, 50));
  if (input.redirectUrl) params.set("redirectUrl", input.redirectUrl);
  if (input.defaultNetwork) params.set("defaultNetwork", input.defaultNetwork);
  if (input.defaultAsset) params.set("defaultAsset", input.defaultAsset);
  if (input.presetFiatAmount && input.presetFiatAmount > 0) {
    params.set("presetFiatAmount", String(input.presetFiatAmount));
  }
  return `${ONRAMP_WIDGET_BASE}?${params.toString()}`;
}

export interface SessionTokenInput {
  /** Destination wallet address. */
  address: string;
  /** End user's IP — required by Coinbase for security validation. */
  clientIp: string;
  blockchains?: readonly string[];
  assets?: readonly string[];
}

/**
 * Request a single-use session token from Coinbase.
 *
 * Server-only: signs a short-lived CDP JWT (Ed25519/ECDSA) and posts the request.
 * The SDK auth module is imported lazily so it never reaches a client bundle.
 */
export async function fetchOnrampSessionToken(input: SessionTokenInput): Promise<string> {
  if (!coinbaseOnrampConfigured()) {
    throw new OnrampUnavailableError(
      "Coinbase onramp is not configured (CDP_API_KEY_ID / CDP_API_KEY_SECRET)."
    );
  }
  const apiKeyId = envValue(CDP_API_KEY_ID)!;
  const apiKeySecret = envValue(CDP_API_KEY_SECRET)!;
  const address = input.address?.trim();
  if (!address) throw new OnrampUnavailableError("A destination address is required.");
  if (!input.clientIp?.trim()) throw new OnrampUnavailableError("A client IP is required.");

  const { generateJwt } = await import("@coinbase/cdp-sdk/auth");
  const jwt = await generateJwt({
    apiKeyId,
    apiKeySecret,
    requestMethod: "POST",
    requestHost: ONRAMP_SESSION_HOST,
    requestPath: ONRAMP_SESSION_PATH,
  });

  const response = await fetch(ONRAMP_SESSION_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      addresses: [{ address, blockchains: input.blockchains ?? [...ONRAMP_BLOCKCHAINS] }],
      clientIp: input.clientIp,
      ...(input.assets ? { assets: [...input.assets] } : {}),
    }),
  });

  if (!response.ok) {
    // Surface Coinbase's own message — it is what makes a failure diagnosable. A 404
    // with "failed to find app with cloud project id …" means Onramp is not enabled
    // for the project (a CDP Portal/onboarding action, not a code problem). Only the
    // provider's error text is included; no request data or credentials are echoed.
    const raw = await response.text().catch(() => "");
    let detail = "";
    try {
      const parsed = JSON.parse(raw) as { message?: unknown; code?: unknown };
      if (typeof parsed.message === "string" && parsed.message) detail = parsed.message;
      else if (typeof parsed.code === "string" && parsed.code) detail = parsed.code;
    } catch {
      detail = raw.slice(0, 200).trim();
    }
    throw new OnrampUnavailableError(
      `Coinbase onramp session request failed (HTTP ${response.status})${detail ? `: ${detail}` : "."}`
    );
  }
  const body = (await response.json()) as { token?: unknown };
  if (typeof body.token !== "string" || !body.token) {
    throw new OnrampUnavailableError("Coinbase onramp did not return a session token.");
  }
  return body.token;
}

export interface CreateOnrampUrlInput {
  address: string;
  clientIp: string;
  redirectUrl?: string;
  presetFiatAmount?: number;
}

/** Request a session token and assemble the hosted buy URL. */
export async function createOnrampUrl(input: CreateOnrampUrlInput): Promise<string> {
  const sessionToken = await fetchOnrampSessionToken({
    address: input.address,
    clientIp: input.clientIp,
  });
  return buildOnrampUrl({
    sessionToken,
    partnerUserRef: input.address,
    redirectUrl: input.redirectUrl,
    defaultNetwork: "base",
    defaultAsset: ONRAMP_DEFAULT_ASSET,
    presetFiatAmount: input.presetFiatAmount,
  });
}
