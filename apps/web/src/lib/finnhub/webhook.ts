/**
 * Finnhub webhook verification and parsing.
 *
 * Finnhub does not sign each delivery with a per-request HMAC. Instead, every request
 * its servers make carries a static shared secret in the `X-Finnhub-Secret` header
 * (see the console export in `signals/signals.txt`). Verification is therefore a
 * **constant-time comparison** of that header against `FINNHUB_WEBHOOK_SECRET`, and it
 * is fail-closed: an unset secret disables the receiver, and a missing or mismatched
 * header is refused.
 *
 * Finnhub also asks that an event be **acknowledged before any logic runs**, so a
 * non-2xx (or a slow response) is treated as a delivery failure and the subscription
 * can be disabled after repeated failures. The route therefore verifies, records, and
 * returns promptly.
 *
 * Framework-free apart from `node:crypto`, so the security property is unit-testable
 * in isolation.
 */

import { createHash, timingSafeEqual } from "node:crypto";

/** The request header carrying the shared secret (lower-case; HTTP headers are ci). */
export const FINNHUB_SECRET_HEADER = "x-finnhub-secret";

/**
 * Whether the receiver is configured. An unset-secret deployment must refuse every
 * delivery — never accept one it cannot verify.
 */
export function finnhubWebhookConfigured(): boolean {
  return (process.env.FINNHUB_WEBHOOK_SECRET ?? "").trim().length > 0;
}

export interface FinnhubSecretInput {
  /** The `X-Finnhub-Secret` header value, or null/undefined when absent. */
  provided: string | null | undefined;
  /** The configured secret. */
  secret: string;
}

/**
 * Verify a delivery in constant time. Returns `false` when either side is empty, so an
 * empty configured secret can never authenticate a request.
 */
export function verifyFinnhubSecret({ provided, secret }: FinnhubSecretInput): boolean {
  if (!provided || !secret) return false;
  const given = Buffer.from(provided, "utf8");
  const want = Buffer.from(secret, "utf8");
  if (given.length !== want.length) return false;
  return timingSafeEqual(given, want);
}

/** A parsed Finnhub webhook body. Fields are optional because input is untrusted. */
export interface FinnhubEvent {
  type?: string;
  data?: unknown;
}

/** Parse a verified webhook body. Returns `null` when it is not a JSON object. */
export function parseFinnhubEvent(rawBody: string): FinnhubEvent | null {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as FinnhubEvent;
  } catch {
    return null;
  }
}

/** The event's `type`, or `"unknown"` when absent. */
export function finnhubEventType(event: FinnhubEvent): string {
  return typeof event.type === "string" && event.type.trim() ? event.type.trim() : "unknown";
}

/**
 * A stable id for a delivery.
 *
 * Finnhub payloads do not guarantee a unique event id, so the id is derived from the
 * **raw body**: an identical retry hashes identically (and de-duplicates), while any
 * different payload hashes differently. Prefixed so it can never collide with another
 * provider's id in the shared `WebhookEvent` table.
 */
export function deriveFinnhubEventId(rawBody: string): string {
  const digest = createHash("sha256").update(rawBody, "utf8").digest("hex");
  return `finnhub:${digest}`;
}
