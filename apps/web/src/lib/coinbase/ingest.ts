/**
 * Coinbase webhook ingestion (`PHASE19-006`).
 *
 * Turns a **verified** webhook event into app state. The rules are deliberately
 * conservative, because this is a value-in path:
 *
 * - Every event is recorded once, de-duplicated by `eventID`, so a replayed
 *   delivery (Coinbase retries, concurrent delivery) can never credit twice.
 * - Only `payments.transfers.completed` is treated as value-in.
 * - A credit requires **both** a resolvable app user **and** a stablecoin amount.
 *   The user is resolved from the transfer's target address matching a `Wallet`,
 *   or from a `LedgerEntry.ref` that already carries the transfer id — never
 *   guessed. An event that cannot be matched is stored as `UNMATCHED` and credits
 *   nothing.
 * - The credit itself runs through `runOnce`, the same idempotency guard the
 *   deposit path uses, keyed by the event id.
 *
 * Coinbase's own docs note that `metadata` is not returned in webhook payloads, so
 * reconciliation relies on the on-chain destination / transfer id rather than a
 * client-supplied tag.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DuplicateOperationError, runOnce } from "@/lib/idempotency";
import { usdToCents } from "@/lib/domain/money";
import type { CoinbaseEvent } from "@/lib/coinbase/webhook";

/** The outcome of ingesting one event. `duplicate` is a success (already applied). */
export type CoinbaseIngestResult = "processed" | "duplicate" | "ignored" | "unmatched";

/** Assets treated as 1:1 USD for ledger purposes. Anything else is not credited. */
const STABLE_ASSETS = new Set(["usd", "usdc", "usdt", "dai"]);

const TRANSFER_COMPLETED = "payments.transfers.completed";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * The app user an inbound transfer belongs to, from signals that are actually
 * present in the payload — the on-chain target address, or a stored transfer ref.
 */
async function resolveUserId(data: Record<string, unknown>): Promise<string | null> {
  const target = asRecord(data.target);
  const address = typeof target.address === "string" ? target.address.toLowerCase() : "";
  if (address) {
    const wallet = await prisma.wallet.findFirst({ where: { address }, select: { userId: true } });
    if (wallet) return wallet.userId;
  }

  const transferId = typeof data.transferId === "string" ? data.transferId : "";
  if (transferId) {
    const entry = await prisma.ledgerEntry.findFirst({
      where: { ref: transferId },
      select: { userId: true },
    });
    if (entry) return entry.userId;
  }

  return null;
}

/** Ingest one verified Coinbase webhook event. Never throws on an unmatched event. */
export async function ingestCoinbaseEvent(event: CoinbaseEvent): Promise<CoinbaseIngestResult> {
  const eventId = typeof event.eventID === "string" ? event.eventID.trim() : "";
  const eventType = typeof event.eventType === "string" ? event.eventType.trim() : "";
  if (!eventId || !eventType) return "ignored";

  // Check first so the common (sequential replay) is a clean no-op rather than a
  // database error; the unique constraint below still catches a concurrent race.
  const claimed = await prisma.webhookEvent.findUnique({ where: { eventId }, select: { id: true } });
  if (claimed) return "duplicate";

  let recordId: string;
  try {
    const record = await prisma.webhookEvent.create({
      data: { eventId, eventType, payload: JSON.stringify(event) },
    });
    recordId = record.id;
  } catch (error) {
    if (isUniqueViolation(error)) return "duplicate";
    throw error;
  }

  if (eventType !== TRANSFER_COMPLETED) {
    await prisma.webhookEvent.update({ where: { id: recordId }, data: { status: "IGNORED" } });
    return "ignored";
  }

  const data = asRecord(event.data);
  const targetAsset = typeof data.targetAsset === "string" ? data.targetAsset.toLowerCase() : "";
  const amount = typeof data.targetAmount === "string" ? Number(data.targetAmount) : Number.NaN;
  const userId = await resolveUserId(data);
  const cents = Number.isFinite(amount) ? usdToCents(amount) : 0;

  if (!userId || !STABLE_ASSETS.has(targetAsset) || cents <= 0) {
    await prisma.webhookEvent.update({
      where: { id: recordId },
      data: { status: "UNMATCHED", userId },
    });
    return "unmatched";
  }

  const transferId = typeof data.transferId === "string" ? data.transferId : eventId;
  try {
    await runOnce(userId, "webhook_deposit", eventId, async (tx) => {
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceCents: { increment: cents } },
      });
      await tx.ledgerEntry.create({
        data: {
          userId,
          type: "DEPOSIT",
          amountCents: cents,
          ref: transferId,
          note: "Coinbase deposit (webhook)",
        },
      });
      await tx.transaction.create({
        data: {
          userId,
          kind: "DEPOSIT",
          amountCents: cents,
          status: "COMPLETED",
          detail: `Coinbase transfer ${transferId}`,
        },
      });
      await tx.notification.create({
        data: {
          userId,
          title: "Deposit received",
          body: `Coinbase deposit of $${(cents / 100).toFixed(2)} credited.`,
        },
      });
      await tx.webhookEvent.update({
        where: { id: recordId },
        data: { status: "PROCESSED", userId },
      });
    });
  } catch (error) {
    if (error instanceof DuplicateOperationError) {
      // The movement was already applied by an earlier delivery of this event.
      await prisma.webhookEvent
        .update({ where: { id: recordId }, data: { status: "PROCESSED", userId } })
        .catch(() => undefined);
      return "duplicate";
    }
    throw error;
  }

  return "processed";
}
