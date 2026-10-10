import { cookies } from "next/headers";
import { networkClassForChainId, type NetworkClass } from "@/lib/network";
import {
  MAX_AGE_SECONDS,
  SESSION_COOKIE,
  createToken,
  verifyToken,
  type SessionPayload,
} from "@/lib/session-token";

export { MAX_AGE_SECONDS, SESSION_COOKIE, createToken, verifyToken };
export type { SessionPayload };

/** Writes the signed session cookie for a wallet-authenticated user. */
export async function setSessionCookie(userId: string, chainId: number): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createToken(userId, chainId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** The signed-in session, including the chain the wallet authenticated on. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifyToken(store.get(SESSION_COOKIE)?.value);
}

export interface SessionMode extends SessionPayload {
  /** Execution class derived from the session's chain — never from the client. */
  network: NetworkClass;
}

/**
 * The session **and** its execution class.
 *
 * The class is derived from the signed `chainId` on every read rather than stored
 * alongside it, so it cannot drift from the signed value. A chain that is no longer
 * supported fails closed — the caller sees "signed out" rather than an ambiguous
 * session.
 */
export async function getSessionMode(): Promise<SessionMode | null> {
  const session = await getSession();
  if (!session) return null;

  const network = networkClassForChainId(session.chainId);
  if (!network) return null;

  return { ...session, network };
}

export async function getCurrentUserId(): Promise<string | null> {
  return (await getSession())?.userId ?? null;
}
