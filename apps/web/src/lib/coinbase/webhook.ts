/**
 * Coinbase CDP webhook verification and parsing (`PHASE19-006`).
 *
 * Coinbase signs every delivery with an `X-Hook0-Signature` header of the form
 * `t=<unix-seconds>,h=<space-separated header names>,v1=<hex hmac>`. The signed
 * payload is
 *
 *     `${t}.${h}.${headerValues.join(".")}.${rawBody}`
 *
 * hashed with HMAC-SHA256 and the subscription's secret (see
 * `coinbase/docs/payments/041-payment-acceptance-webhooks.md` and the Verification
 * page `coinbase/docs/payments/030-verification.md`). Verification is **fail-closed**: a missing
 * or malformed header, an unknown header name, a stale timestamp or a mismatched
 * digest all return `false`, and the receiver refuses the request.
 *
 * This module is dependency-free and free of framework imports so the security
 * property is unit-testable in isolation.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** The request header carrying the signature (lower-case; HTTP headers are ci). */
export const COINBASE_SIGNATURE_HEADER = "x-hook0-signature";

/** A delivery older than this is rejected, so a captured request cannot be replayed. */
export const DEFAULT_MAX_AGE_MINUTES = 5;

/**
 * Whether the webhook endpoint is configured. An unset `COINBASE_WEBHOOK_SECRET`
 * means the receiver must refuse every delivery — never accept an unverifiable one.
 */
export function coinbaseWebhookConfigured(): boolean {
  return (process.env.COINBASE_WEBHOOK_SECRET ?? "").trim().length > 0;
}

export interface CoinbaseSignatureInput {
  /** The raw, unmodified request body — exactly the bytes that were signed. */
  rawBody: string;
  /** The `X-Hook0-Signature` header value, or null when absent. */
  signatureHeader: string | null | undefined;
  /** The subscription secret. */
  secret: string;
  /** Request headers, matched case-insensitively against the `h=` field. */
  headers: Record<string, string | undefined>;
  nowMs?: number;
  maxAgeMinutes?: number;
}

/**
 * Verify a Coinbase webhook signature. Returns `true` only when the digest matches
 * in constant time **and** the timestamp is within the allowed age.
 */
export function verifyCoinbaseSignature(input: CoinbaseSignatureInput): boolean {
  const {
    rawBody,
    signatureHeader,
    secret,
    headers,
    nowMs = Date.now(),
    maxAgeMinutes = DEFAULT_MAX_AGE_MINUTES,
  } = input;

  if (!signatureHeader || !secret) return false;

  try {
    const elements = signatureHeader.split(",");
    const timestamp = elements.find((e) => e.startsWith("t="))?.slice(2) ?? "";
    const headerNames = elements.find((e) => e.startsWith("h="))?.slice(2) ?? "";
    const providedSignature = elements.find((e) => e.startsWith("v1="))?.slice(3) ?? "";

    if (!timestamp || !headerNames || !providedSignature) return false;

    // Look up each named header case-insensitively; a missing name signs as "".
    const lower = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v ?? ""]));
    const headerValues = headerNames
      .split(" ")
      .map((name) => lower.get(name.toLowerCase()) ?? "")
      .join(".");

    const signedPayload = `${timestamp}.${headerNames}.${headerValues}.${rawBody}`;
    const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

    const given = Buffer.from(providedSignature, "hex");
    const want = Buffer.from(expected, "hex");
    if (given.length !== want.length || !timingSafeEqual(given, want)) return false;

    const ageMinutes = (nowMs - Number(timestamp) * 1000) / (1000 * 60);
    if (!Number.isFinite(ageMinutes) || ageMinutes > maxAgeMinutes) return false;

    return true;
  } catch {
    return false;
  }
}

/** A parsed Coinbase webhook body. Fields are optional because input is untrusted. */
export interface CoinbaseEvent {
  eventID?: string;
  eventType?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
}

/** Parse a verified webhook body. Returns `null` when it is not a JSON object. */
export function parseCoinbaseEvent(rawBody: string): CoinbaseEvent | null {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as CoinbaseEvent;
  } catch {
    return null;
  }
}
