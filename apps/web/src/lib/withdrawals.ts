/**
 * Withdrawal approval workflow (`PHASE18-006` addendum).
 *
 * A user **requests** a withdrawal; an admin **decides** it. Nothing about the shape of
 * the request decides the outcome — an admin does, from the CRM, with the reason recorded.
 *
 * The invariant that matters, and the only one this module enforces end to end:
 *
 *   **A reservation always returns to the user unless it was actually paid out to the
 *   destination the user named.** A declined request is refunded automatically. A
 *   request whose payout failed keeps its funds reserved (a broadcast may or may not have
 *   landed, so refunding blind could pay twice) until an admin explicitly releases them
 *   after checking the chain. No code path sends a user's balance anywhere else.
 *
 * Money is reserved when the request is created (not when it is decided), so a pending
 * request cannot be spent twice while an admin thinks about it, and the amount the admin
 * approves is exactly the amount the user asked for — not a re-priced one.
 *
 * Rails differ in who settles them:
 *
 *   - `CUSTODY_ONCHAIN` — the app signs and broadcasts on approval (the reservation
 *     becomes the payout).
 *   - `COINBASE_OFFRAMP` — the app never signs; approval is a **clearance** for the user
 *     to sell through Coinbase's hosted flow, so the reservation is released on either
 *     decision and the real debit arrives later as a reconciled webhook. The hold matters
 *     only while the request is pending.
 *
 * A request is also replay-guarded (`runOnce`) so a double submit cannot reserve twice,
 * and an **account hold** (`Wallet.blocked`) freezes movement without touching the
 * balance: blocked accounts can still receive funds, and an admin can release the hold.
 */

import type { Prisma } from "@prisma/client";

import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

/* ------------------------------------------------------------ dispute window */

/**
 * How long the user has to argue a decline, in business days, from configuration.
 */
export function disputeWindowDays(): number {
  const days = config.disputeWindowBusinessDays;
  return Number.isFinite(days) && days >= 0 ? Math.floor(days) : 3;
}

/**
 * Advance `days` **business days** (Mon–Fri) in UTC.
 *
 * Deliberately simple and stated plainly: weekends are skipped and there is **no public
 * holiday calendar**, so a bank holiday inside the window shortens the effective time
 * rather than extending it. Making holidays correct needs a per-jurisdiction calendar,
 * which is a configuration the operator would have to own — so the window is a business
 * convention, not a legal deadline, and the UI shows the exact closing date instead of
 * relying on the reader's arithmetic.
 */
export function addBusinessDays(from: Date, days: number): Date {
  const out = new Date(from.getTime());
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    out.setUTCDate(out.getUTCDate() + 1);
    const weekday = out.getUTCDay(); // 0 = Sunday, 6 = Saturday
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return out;
}

/** Business days between two instants (used for "N days left" in the UI). */
export function businessDaysUntil(until: Date, now: Date = new Date()): number {
  if (until <= now) return 0;
  let count = 0;
  const cursor = new Date(now.getTime());
  while (cursor < until) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
    if (count > 400) break; // defensive: never spin on pathological input
  }
  return count;
}

/** The window opened by a decline: when it starts and when it closes. */
export function disputeWindow(decidedAt: Date, days = disputeWindowDays()): { opensAt: Date; closesAt: Date } {
  return { opensAt: decidedAt, closesAt: addBusinessDays(decidedAt, days) };
}

/** How a dispute ended. */
export const DISPUTE_OUTCOMES = ["CLEARED", "MISUSE_CONFIRMED"] as const;
export type DisputeOutcome = (typeof DISPUTE_OUTCOMES)[number];

export const DISPUTE_OUTCOME_LABEL: Record<DisputeOutcome, string> = {
  CLEARED: "Reviewed — no action taken",
  MISUSE_CONFIRMED: "Misuse confirmed — account banned, balance frozen",
};

export function isDisputeOutcome(value: string): value is DisputeOutcome {
  return (DISPUTE_OUTCOMES as readonly string[]).includes(value);
}

export function disputeOutcomeLabel(outcome: string | null): string {
  return (DISPUTE_OUTCOME_LABEL as Record<string, string>)[outcome ?? ""] ?? "Under review";
}

/**
 * The dispute state of a request, derived — never stored — so it cannot drift.
 * An expired window is not a decision: an admin still has to resolve it.
 */
export function disputeState(
  request: { status: string; disputeOpensAt: Date | null; disputeClosesAt: Date | null; disputeOutcome: string | null },
  now: Date = new Date()
): { open: boolean; expired: boolean; closesAt: Date | null; daysLeft: number; outcome: string | null } {
  const closesAt = request.disputeClosesAt;
  if (request.status !== "DECLINED" || !closesAt) {
    return { open: false, expired: false, closesAt: null, daysLeft: 0, outcome: request.disputeOutcome };
  }
  return {
    open: !request.disputeOutcome,
    expired: now > closesAt,
    closesAt,
    daysLeft: businessDaysUntil(closesAt, now),
    outcome: request.disputeOutcome,
  };
}

/**
 * Open the support conversation a dispute is argued in.
 *
 * The dispute lives in the existing CRM ticket flow — the same place a user would raise any
 * other issue — so the conversation, the admin replies and the audit trail are all one
 * system rather than a parallel inbox nobody reads.
 */
export async function openDisputeTicket(
  db: Prisma.TransactionClient,
  input: {
    userId: string;
    userName: string;
    adminId: string;
    subject: string;
    body: string;
  }
): Promise<{ id: string; number: string }> {
  const customer =
    (await db.customer.findUnique({ where: { userId: input.userId } })) ??
    (await db.customer.create({ data: { userId: input.userId, name: input.userName } }));

  const count = await db.ticket.count();
  const ticket = await db.ticket.create({
    data: {
      number: `TCK-${1001 + count}`,
      customerId: customer.id,
      ownerId: input.userId,
      assigneeId: input.adminId,
      subject: input.subject,
      status: "OPEN",
      priority: "HIGH",
      messages: { create: { authorId: input.adminId, body: input.body } },
    },
  });
  return { id: ticket.id, number: ticket.number };
}

/** The rails a withdrawal request can use. */
export const WITHDRAWAL_RAILS = ["CUSTODY_ONCHAIN", "COINBASE_OFFRAMP"] as const;
export type WithdrawalRail = (typeof WITHDRAWAL_RAILS)[number];

/**
 * Request lifecycle. `PENDING` is the only state an admin can decide.
 *
 * `FAILED` means a payout was attempted and did not complete, so the reservation is
 * still held: a broadcast may or may not have landed, and releasing blind could pay
 * twice. `RELEASED` is the terminal state after an admin has confirmed nothing landed and
 * returned the funds to the user.
 */
export const REQUEST_STATUSES = ["PENDING", "APPROVED", "DECLINED", "FAILED", "RELEASED"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export function isWithdrawalRail(value: string): value is WithdrawalRail {
  return (WITHDRAWAL_RAILS as readonly string[]).includes(value);
}

/** Whether the app itself settles this rail (signs and broadcasts) on approval. */
export function railIsAppSettled(rail: string): boolean {
  return rail === "CUSTODY_ONCHAIN";
}

/** Human labels, used by both the user's list and the admin queue. */
export const RAIL_LABEL: Record<WithdrawalRail, string> = {
  CUSTODY_ONCHAIN: "On-chain (custody wallet)",
  COINBASE_OFFRAMP: "Coinbase (sell to bank)",
};

export const STATUS_LABEL: Record<RequestStatus, string> = {
  PENDING: "Awaiting review",
  APPROVED: "Approved",
  DECLINED: "Declined",
  FAILED: "Payout failed",
  RELEASED: "Funds returned",
};

/** How a request's funds ended up, for the user-facing list. */
export const STATUS_DETAIL: Record<RequestStatus, string> = {
  PENDING: "The amount is held from your balance while an admin reviews the request.",
  APPROVED: "The amount has left your balance for the destination you named.",
  DECLINED: "Declined — the amount was returned to your balance. No funds moved.",
  FAILED: "The payout could not be completed. The amount stays held until an admin resolves it.",
  RELEASED: "The payout failed and an admin confirmed nothing left the wallet — the amount is back in your balance.",
};

/** Why a request could not be created or decided. */
export type RefusalCode =
  | "INVALID_AMOUNT"
  | "INVALID_RAIL"
  | "INVALID_DESTINATION"
  | "INSUFFICIENT_FUNDS"
  | "ACCOUNT_BLOCKED"
  | "NOT_PENDING"
  | "REASON_REQUIRED"
  | "NOTHING_TO_RELEASE";

/** A request or decision the app refused, with a code the UI can map to a notice. */
export class WithdrawalRefusedError extends Error {
  constructor(
    readonly code: RefusalCode,
    message: string
  ) {
    super(message);
    this.name = "WithdrawalRefusedError";
  }
}

/** The hold state of a wallet, or "not held" when there is no wallet row yet. */
export function holdState(wallet: { blocked: boolean; blockedReason: string | null } | null): {
  blocked: boolean;
  reason: string | null;
} {
  return { blocked: Boolean(wallet?.blocked), reason: wallet?.blockedReason ?? null };
}

/**
 * Reserve `amountCents` and open a request.
 *
 * The balance is decremented with a **conditional** update (`balanceCents >= amount`,
 * not blocked) so two concurrent requests cannot overdraw the account: the losing update
 * matches no row and is refused. Everything else is written in the same transaction.
 */
export async function reserveWithdrawal(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    amountCents: number;
    rail: WithdrawalRail;
    chainId: number;
    destination?: string | null;
    nativeWei?: string | null;
    label: string;
  }
) {
  const reserved = await tx.wallet.updateMany({
    where: { userId: input.userId, blocked: false, balanceCents: { gte: input.amountCents } },
    data: { balanceCents: { decrement: input.amountCents } },
  });

  if (reserved.count === 0) {
    const wallet = await tx.wallet.findUnique({
      where: { userId: input.userId },
      select: { blocked: true, blockedReason: true, balanceCents: true },
    });
    const hold = holdState(wallet);
    if (hold.blocked) {
      throw new WithdrawalRefusedError(
        "ACCOUNT_BLOCKED",
        `This account is on hold${hold.reason ? `: ${hold.reason}` : ""}, so no funds can move out.`
      );
    }
    throw new WithdrawalRefusedError("INSUFFICIENT_FUNDS", "That amount is more than your available balance.");
  }

  const request = await tx.withdrawalRequest.create({
    data: {
      userId: input.userId,
      amountCents: input.amountCents,
      rail: input.rail,
      chainId: input.chainId,
      destination: input.destination ?? null,
      nativeWei: input.nativeWei ?? null,
      status: "PENDING",
    },
  });

  await tx.ledgerEntry.create({
    data: { userId: input.userId, type: "WITHDRAWAL", amountCents: -input.amountCents, note: `${input.label} (held for approval)`, ref: request.id },
  });
  await tx.transaction.create({
    data: {
      userId: input.userId,
      kind: "WITHDRAWAL",
      amountCents: -input.amountCents,
      status: "PENDING",
      detail: `${input.label} requested — awaiting admin review`,
      ref: request.id,
    },
  });
  await tx.notification.create({
    data: {
      userId: input.userId,
      title: "Withdrawal requested",
      body: `Your ${input.label.toLowerCase()} request is awaiting review. The amount is held until an admin decides.`,
    },
  });

  return request;
}

/**
 * Return a reserved amount to the user's balance.
 *
 * This is the **only** way a reservation leaves the workflow, and it always credits the
 * requesting user — there is no destination parameter, deliberately: a reservation can
 * end up paid out or back with its owner, and nowhere else.
 */
export async function refundReservation(
  tx: Prisma.TransactionClient,
  input: { requestId: string; userId: string; amountCents: number; note: string }
) {
  await tx.wallet.update({
    where: { userId: input.userId },
    data: { balanceCents: { increment: input.amountCents } },
  });
  await tx.ledgerEntry.create({
    data: { userId: input.userId, type: "DEPOSIT", amountCents: input.amountCents, note: input.note, ref: input.requestId },
  });
  await tx.transaction.updateMany({
    where: { userId: input.userId, ref: input.requestId },
    data: { status: "FAILED", detail: input.note },
  });
}

/** Label lookups that tolerate the raw string coming back from the database. */
export function railLabel(rail: string): string {
  return isWithdrawalRail(rail) ? RAIL_LABEL[rail] : rail;
}

export function statusLabel(status: string): string {
  return (STATUS_LABEL as Record<string, string>)[status] ?? status;
}

export function statusDetail(status: string): string {
  return (STATUS_DETAIL as Record<string, string>)[status] ?? "";
}

/** Requests an admin can still act on, newest first. */
export function pendingRequests(limit = 50) {
  return prisma.withdrawalRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { user: { select: { id: true, name: true, walletAddress: true } } },
  });
}

/** A user's own request history, newest first. */
export function myRequests(userId: string, limit = 20) {
  return prisma.withdrawalRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** Declined requests with a dispute window, newest first — the admin's dispute list. */
export function disputedRequests(limit = 50) {
  return prisma.withdrawalRequest.findMany({
    where: { status: "DECLINED", disputeOpensAt: { not: null } },
    orderBy: { decidedAt: "desc" },
    take: limit,
    include: { user: { select: { id: true, name: true, walletAddress: true, banned: true } } },
  });
}

/** Requests that need an admin to resolve a failed payout (funds still held). */
export function unresolvedFailures(limit = 50) {
  return prisma.withdrawalRequest.findMany({
    where: { status: "FAILED" },
    orderBy: { decidedAt: "desc" },
    take: limit,
    include: { user: { select: { id: true, name: true } } },
  });
}
