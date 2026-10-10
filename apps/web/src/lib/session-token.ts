import { createHmac, timingSafeEqual } from "node:crypto";
import { getSessionSecret } from "./secret";

/**
 * Session token primitives.
 *
 * Deliberately free of framework imports (no `next/headers`) so the token format
 * lives in one place. `session.ts` wraps it with cookie access, and the e2e suite
 * mints real tokens from here rather than re-implementing the HMAC — drift
 * between the test helper and the server would otherwise be silent.
 *
 * Format: `userId.chainId.expiry.signature` (HMAC-SHA256, base64url).
 */

export const SESSION_COOKIE = "fin_session";
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

const MS_PER_SECOND = 1000;

export interface SessionPayload {
  userId: string;
  /** Chain the wallet signed in on — the basis of the real-vs-practice split. */
  chainId: number;
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

export function createToken(userId: string, chainId: number, nowMs = Date.now()): string {
  const expiry = nowMs + MAX_AGE_SECONDS * MS_PER_SECOND;
  const payload = `${userId}.${chainId}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined, nowMs = Date.now()): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, chainId, expiry, sig] = parts;

  const expected = sign(`${userId}.${chainId}.${expiry}`);
  const given = Buffer.from(sig);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  if (Number(expiry) < nowMs) return null;

  const chain = Number(chainId);
  if (!userId || !Number.isInteger(chain) || chain <= 0) return null;

  return { userId, chainId: chain };
}
