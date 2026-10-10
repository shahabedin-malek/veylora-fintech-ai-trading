/**
 * Persisted rolling spend ledger + custody audit trail (`PHASE18-004`).
 *
 * The custody boundary's spend cap used to take `spentTodayCents` from the caller, so
 * the daily total was whatever the caller believed it was. This module derives it from
 * a **persisted ledger** (`CustodySpend`): every real movement writes a row in the same
 * transaction as the movement it funds, and the daily cap is read back from those rows.
 * A movement that is retried cannot double-count, because the ledger write shares the
 * idempotency transaction of the money action (`runOnce`).
 *
 * The audit trail reuses the existing `AuditLog` table: every real movement records
 * `custody.spend` with the key **reference** (provider + opaque key id), never key
 * material. Rotation is an account-side action; recording the reference here is what
 * makes "which key moved this" answerable after the fact.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** A transaction client — the ledger moves inside the money action's transaction. */
type Db = Prisma.TransactionClient;

/** Start of the current UTC day. The cap window is deliberately UTC, not local. */
export function startOfUtcDay(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Real custody spend recorded for a user today (UTC), read from the persisted ledger.
 * This is the value the daily cap must be checked against.
 */
export async function custodySpentTodayCents(
  userId: string,
  db: Db = prisma,
  now: Date = new Date()
): Promise<number> {
  const aggregate = await db.custodySpend.aggregate({
    where: { userId, createdAt: { gte: startOfUtcDay(now) } },
    _sum: { amountCents: true },
  });
  return aggregate._sum.amountCents ?? 0;
}

export interface RecordCustodySpendInput {
  userId: string;
  /** The custody signer's public address (never key material). */
  address: string;
  amountCents: number;
  /** On-chain tx hash or idempotency key, for audit. */
  ref?: string;
}

/**
 * Record a real custody movement. Must be called inside the same transaction as the
 * movement it funds, so the ledger and the money move atomically.
 */
export async function recordCustodySpend(input: RecordCustodySpendInput, db: Db): Promise<void> {
  await db.custodySpend.create({
    data: {
      userId: input.userId,
      address: input.address,
      amountCents: input.amountCents,
      ref: input.ref ?? null,
    },
  });
}

export interface RecordCustodyAuditInput extends RecordCustodySpendInput {
  /** The provider/key reference that signed, e.g. `coinbase-cdp:veylora-hot-wallet`. */
  keyReference?: string;
  /** What moved, for the human-readable trail (e.g. "on-chain withdrawal"). */
  action?: string;
}

/**
 * Append a `custody.spend` audit entry. Only the key **reference** is recorded — never
 * a secret, key id, or signature. Reuses the existing `AuditLog` table so the trail
 * appears alongside ticket/admin events.
 */
export async function recordCustodyAudit(input: RecordCustodyAuditInput, db: Db): Promise<void> {
  const detail = [
    input.action ?? "custody movement",
    `amount=${input.amountCents}c`,
    input.keyReference ? `key=${input.keyReference}` : null,
    input.ref ? `ref=${input.ref}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  await db.auditLog.create({
    data: {
      actorId: input.userId,
      action: "custody.spend",
      subject: input.address,
      detail,
    },
  });
}
