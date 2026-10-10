/**
 * Shared auth for the `/api/cron/*` routes.
 *
 * A scheduled route is an inbound surface, so it fails closed: disabled (`503`) until
 * `CRON_SECRET` is set, then authorised only by an exact
 * `Authorization: Bearer <CRON_SECRET>` match (the header Vercel adds to a cron
 * invocation). The comparison is constant-time so the secret cannot be probed by timing.
 */

import { timingSafeEqual } from "node:crypto";

export function cronSecret(): string {
  return (process.env.CRON_SECRET ?? "").trim();
}

export function cronAuthorized(header: string | null): boolean {
  const secret = cronSecret();
  if (!secret || !header) return false;
  const given = Buffer.from(header, "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * `null` when the request may proceed, otherwise the `{ status, error }` to answer with.
 * Callers return it as JSON so the reason is visible in the response.
 */
export function cronDenied(header: string | null): { status: number; error: string } | null {
  if (!cronSecret()) return { status: 503, error: "cron disabled: CRON_SECRET is not set" };
  if (!cronAuthorized(header)) return { status: 401, error: "unauthorized" };
  return null;
}
