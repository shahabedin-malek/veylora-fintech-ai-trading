import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getSessionSecret } from "@/lib/secret";

const COOKIE = "fin_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Throws in production when SESSION_SECRET is missing or too weak.
const secret = (): string => getSessionSecret();

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

/** Create a signed session token `userId.expiry.signature`. */
export function createToken(userId: string, nowMs = Date.now()): string {
  const expiry = nowMs + MAX_AGE * 1000;
  const payload = `${userId}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined, nowMs = Date.now()): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiry, sig] = parts;
  const expected = sign(`${userId}.${expiry}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expiry) < nowMs) return null;
  return userId;
}

export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, createToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  return verifyToken(store.get(COOKIE)?.value);
}

export const SESSION_COOKIE = COOKIE;
