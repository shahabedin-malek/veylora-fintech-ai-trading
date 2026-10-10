/**
 * Finnhub webhook ingestion.
 *
 * The receiver records a **verified** delivery once and applies nothing. This is
 * deliberate: none of Finnhub's webhook payloads (trades, news, press releases) is a
 * value-in instruction, and the desk has no consumer for them yet. Writing a
 * pass-through here — rather than a handler that guesses — keeps the surface
 * value-free, so a misconfigured subscription cannot move a balance.
 *
 * De-duplication uses the shared `WebhookEvent` table (the same one the Coinbase
 * receiver uses), keyed by a body-derived id, so a retried delivery is a clean no-op.
 * When a consumer is added, it must run inside `runOnce` and behind the same gates as
 * every other money path (see `docs/signals/IMPLEMENTATION.md`).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  deriveFinnhubEventId,
  finnhubEventType,
  type FinnhubEvent,
} from "@/lib/finnhub/webhook";

/** The outcome of ingesting one delivery. `duplicate` is a success (already recorded). */
export type FinnhubIngestResult = "recorded" | "duplicate";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Record one verified Finnhub delivery. Never throws on a duplicate, and never changes
 * any balance. `status` is `IGNORED` because no handler consumes these event types yet
 * — an honest terminal state rather than a false `PROCESSED`.
 */
export async function ingestFinnhubEvent(input: {
  event: FinnhubEvent;
  rawBody: string;
}): Promise<FinnhubIngestResult> {
  const eventId = deriveFinnhubEventId(input.rawBody);

  // Check first so the common (sequential) replay is a clean no-op rather than a
  // database error; the unique constraint below still catches a concurrent race.
  const existing = await prisma.webhookEvent.findUnique({ where: { eventId }, select: { id: true } });
  if (existing) return "duplicate";

  try {
    await prisma.webhookEvent.create({
      data: {
        provider: "finnhub",
        eventId,
        eventType: finnhubEventType(input.event),
        status: "IGNORED",
        payload: input.rawBody,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return "duplicate";
    throw error;
  }

  return "recorded";
}
