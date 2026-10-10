/**
 * Idempotency for the money paths — groundwork for irreversibility UX
 * (`PHASE18-006`, see `docs/NETWORK_BOUNDARY.md`).
 *
 * A value-bearing action carries a key. The key is claimed **in the same
 * transaction** as the mutation it guards, so the two are atomic: either both the
 * claim and the movement commit, or neither does. A retried submit (double click,
 * page refresh, network replay) re-uses the key, the claim fails on the unique
 * constraint, and the movement is skipped instead of applied twice.
 *
 * This is deliberately process-local to the database — no in-memory set — because
 * a real desk is multi-instance: the guarantee has to live where the money does.
 */

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

/** The money paths that carry an idempotency key. */
export type MoneyScope =
  | "deposit"
  | "withdraw"
  | "start_trading"
  | "stop_trading"
  | "webhook_deposit"
  | "coinbase_swap"
  | "custody_withdraw"
  | "owner_practice_funds"
  // Withdrawal approval workflow: a request, the admin decision on it, and an
  // account hold are all replay-sensitive (a double submit must not reserve, refund
  // or release twice).
  | "withdraw_request"
  | "withdraw_decision"
  | "withdraw_release"
  | "account_hold"
  | "dispute_resolution"
  | "account_ban"
  // A venue (WunderTrading) order is a real money action, so a retry must not place a
  // second order.
  | "venue_order";

/** Raised when a key has already been used — the caller treats it as a no-op. */
export class DuplicateOperationError extends Error {
  constructor(
    readonly scope: MoneyScope,
    readonly key: string
  ) {
    super(`Duplicate ${scope}: this idempotency key has already been used.`);
    this.name = "DuplicateOperationError";
  }
}

/**
 * The key for this submit, or a fresh one when the form did not carry one.
 *
 * Generating a fallback keeps a caller that bypasses the form (a server-to-server
 * call, an older client) working — it simply does not get replay protection for
 * that call. The forms always send an explicit key.
 */
export function idempotencyKeyFrom(formData: FormData | undefined, field = "idempotencyKey"): string {
  const raw = formData?.get(field);
  const key = typeof raw === "string" ? raw.trim() : "";
  return key || crypto.randomUUID();
}

/**
 * A stable key for a client-rendered form. Used by the client components
 * (`StopWithWarning`) that cannot receive a server-rendered key.
 */
export function freshIdempotencyKey(): string {
  return crypto.randomUUID();
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/**
 * Run `fn` at most once for `(userId, scope, key)`.
 *
 * The claim and the mutation share one interactive transaction, so a failure
 * inside `fn` rolls the claim back too and the operation can be retried with the
 * same key. A replay throws `DuplicateOperationError` **before** `fn` runs.
 */
export async function runOnce<T>(
  userId: string,
  scope: MoneyScope,
  key: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        // Check first so the common (sequential) replay is a clean no-op rather
        // than a database error; the unique constraint below is still the
        // guarantee if two requests race each other here.
        const claimed = await tx.idempotencyKey.findUnique({
          where: { userId_scope_key: { userId, scope, key } },
          select: { id: true },
        });
        if (claimed) throw new DuplicateOperationError(scope, key);

        await tx.idempotencyKey.create({ data: { userId, scope, key } });
        return fn(tx);
      },
      { timeout: 15_000 }
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateOperationError(scope, key);
    throw error;
  }
}
