/**
 * WunderTrading REST client — HMAC-signed, server-only.
 *
 * WunderTrading signs every private request with HMAC-SHA256 over a payload built from
 * the method, path (including query), timestamp, receive window and body
 * (`docs/signals/wundertrading.md`). The signature is Base64 and travels in
 * `X-Signature`, alongside `X-API-Key`, `X-Timestamp` and `X-Recv-Window`.
 *
 * Two properties this module is responsible for:
 *
 * 1. **The payload must match the request exactly** — the same method casing, the same
 *    path with query, and the same serialized body. The serialized string is what is
 *    signed *and* what is sent, so the two cannot drift.
 * 2. **The secret never leaves this process** — it is read from the environment at call
 *    time, used to sign, and never logged, returned, or placed in a URL.
 *
 * This module can move money; it does not decide *whether* to. That is the execution
 * gate's job (`src/lib/execution.ts`, executor `wundertrading`).
 */

import { createHmac } from "node:crypto";

import { config } from "@/lib/config";
import { ProviderRequestError, withCredential } from "@/lib/credentials/pool";
import { providerHasPoolKeySync } from "@/lib/credentials/presence";

export const WUNDERTRADING_BASE_URL = "https://wundertrading.com/open_api";
export const WUNDERTRADING_TIMEOUT_MS = 8000;
/** How long a signed request stays valid, in milliseconds. */
export const WUNDERTRADING_RECV_WINDOW_MS = 60_000;

/** Thrown when a venue request cannot be made (unconfigured, refused, or failed). */
export class WundertradingUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WundertradingUnavailableError";
  }
}

/**
 * Whether the venue client can run. Both halves of the key pair are required, and they
 * may come from the env vars **or** the admin key pool (`src/lib/credentials/`). The pool
 * presence is read from a warmed cache so this stays a cheap synchronous check for the
 * execution gate.
 */
export function wundertradingConfigured(): boolean {
  const envReady =
    (process.env.WUNDERTRADING_API_KEY ?? "").trim().length > 0 &&
    (process.env.WUNDERTRADING_SECRET_KEY ?? "").trim().length > 0;
  return envReady || providerHasPoolKeySync("wundertrading");
}

/** The spend limits a venue order is held to. */
export function venueSpendLimits() {
  return config.venue.spendLimits;
}

/**
 * The exact string WunderTrading signs:
 *
 *     METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + RECV_WINDOW + "\n" + BODY
 *
 * An empty body is the empty string (GET requests).
 */
export function buildSignaturePayload(input: {
  method: string;
  path: string;
  timestamp: number;
  recvWindow: number;
  body: string;
}): string {
  return [input.method.toUpperCase(), input.path, String(input.timestamp), String(input.recvWindow), input.body].join(
    "\n"
  );
}

/** Base64(HMAC_SHA256(secret, payload)). */
export function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64");
}

/**
 * Sign and send one request. `body` is serialized once and both signed and sent, so the
 * signature always covers the bytes on the wire.
 */
async function request(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
  // Resolve through the key pool: env key pair first, then managed backups, rotating on
  // a rejected key (401/403/429) without ever logging a key.
  return withCredential("wundertrading", async (values) => {
    const serialized = body === undefined ? "" : JSON.stringify(body);
    const timestamp = Date.now();
    const payload = buildSignaturePayload({
      method,
      path,
      timestamp,
      recvWindow: WUNDERTRADING_RECV_WINDOW_MS,
      body: serialized,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WUNDERTRADING_TIMEOUT_MS);
    try {
      const res = await fetch(`${WUNDERTRADING_BASE_URL}${path}`, {
        method,
        cache: "no-store",
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "X-API-Key": values.apiKey,
          "X-Signature": signPayload(values.secretKey, payload),
          "X-Timestamp": String(timestamp),
          "X-Recv-Window": String(WUNDERTRADING_RECV_WINDOW_MS),
        },
        ...(serialized ? { body: serialized } : {}),
      });
      if (!res.ok) {
        throw new ProviderRequestError(`WunderTrading ${method} ${path} returned ${res.status}.`, res.status);
      }
      return await res.json();
    } catch (error) {
      if (error instanceof ProviderRequestError) throw error;
      throw new WundertradingUnavailableError(
        `WunderTrading ${method} ${path} failed: ${error instanceof Error ? error.message : "unknown error"}.`
      );
    } finally {
      clearTimeout(timer);
    }
  });
}

/** The exchange API profiles (linked accounts) available to the desk. */
export async function listApiProfiles(exchanges?: string[]): Promise<unknown> {
  const query = exchanges?.length ? `?exchanges=${encodeURIComponent(exchanges.join(","))}` : "";
  return request("GET", `/api_profiles${query}`);
}

/** The markets/pairs the venue offers. */
export async function listMarkets(): Promise<unknown> {
  return request("GET", "/markets");
}

/**
 * Open (or manage) a position. The payload is passed through verbatim because the venue
 * defines the schema; validation lives in `orders.ts`, which is the only intended caller.
 */
export async function postPosition(payload: Record<string, unknown>): Promise<unknown> {
  return request("POST", "/position", payload);
}
