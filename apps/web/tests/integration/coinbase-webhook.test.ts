import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { ingestCoinbaseEvent, type CoinbaseIngestResult } from "@/lib/coinbase/ingest";

/**
 * Integration tests for Coinbase webhook ingestion (`PHASE19-006`).
 *
 * These run the real ingest path against the throwaway SQLite database: genuine
 * de-duplication, genuine ledger writes, genuine idempotency. The properties that
 * matter are value-in properties — a replayed delivery must never credit twice, and
 * an event that matches no user must credit nothing.
 */

const ADDRESS = `0x${"c0".repeat(20)}`; // 40 hex chars, reserved for this file
const EVENT_PREFIX = "evt_it_";

function transferCompleted(eventId: string, overrides: Record<string, unknown> = {}) {
  return {
    eventID: eventId,
    eventType: "payments.transfers.completed",
    timestamp: "2026-01-01T00:00:00Z",
    data: {
      transferId: `transfer_${eventId}`,
      status: "completed",
      source: { accountId: "account_1", asset: "usd" },
      sourceAmount: "100.00",
      sourceAsset: "usd",
      target: { address: ADDRESS, network: "base", asset: "usdc" },
      targetAmount: "100.00",
      targetAsset: "usdc",
      ...overrides,
    },
  };
}

async function walletBalanceCents(userId: string): Promise<number> {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
  return wallet.balanceCents;
}

let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      walletAddress: ADDRESS,
      chainId: 8453, // Base mainnet
      name: "Coinbase Webhook IT",
      wallet: {
        create: { address: ADDRESS, kind: "MAINNET", network: "mainnet", balanceCents: 0 },
      },
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.webhookEvent.deleteMany({ where: { eventId: { startsWith: EVENT_PREFIX } } });
  await prisma.idempotencyKey.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
});

describe("ingestCoinbaseEvent", () => {
  it("credits a completed stablecoin transfer to a known address exactly once", async () => {
    const result: CoinbaseIngestResult = await ingestCoinbaseEvent(
      transferCompleted(`${EVENT_PREFIX}processed`)
    );

    expect(result).toBe("processed");
    expect(await walletBalanceCents(userId)).toBe(10_000);

    const event = await prisma.webhookEvent.findUnique({
      where: { eventId: `${EVENT_PREFIX}processed` },
    });
    expect(event?.status).toBe("PROCESSED");
    expect(event?.userId).toBe(userId);

    const deposit = await prisma.ledgerEntry.findFirst({ where: { userId, type: "DEPOSIT" } });
    expect(deposit?.amountCents).toBe(10_000);
  });

  it("treats a replayed delivery as a no-op (no double credit)", async () => {
    const before = await walletBalanceCents(userId);
    const result = await ingestCoinbaseEvent(transferCompleted(`${EVENT_PREFIX}processed`));

    expect(result).toBe("duplicate");
    expect(await walletBalanceCents(userId)).toBe(before);

    const events = await prisma.webhookEvent.count({
      where: { eventId: `${EVENT_PREFIX}processed` },
    });
    expect(events).toBe(1);
  });

  it("stores, but does not credit, a transfer to an unknown address", async () => {
    const before = await walletBalanceCents(userId);
    const result = await ingestCoinbaseEvent(
      transferCompleted(`${EVENT_PREFIX}unmatched`, {
        target: { address: `0x${"dd".repeat(20)}`, network: "base", asset: "usdc" },
      })
    );

    expect(result).toBe("unmatched");
    expect(await walletBalanceCents(userId)).toBe(before);

    const event = await prisma.webhookEvent.findUnique({
      where: { eventId: `${EVENT_PREFIX}unmatched` },
    });
    expect(event?.status).toBe("UNMATCHED");
    expect(event?.userId).toBeNull();
  });

  it("does not credit a non-stablecoin amount", async () => {
    const before = await walletBalanceCents(userId);
    const result = await ingestCoinbaseEvent(
      transferCompleted(`${EVENT_PREFIX}eth`, { targetAsset: "eth" })
    );

    expect(result).toBe("unmatched");
    expect(await walletBalanceCents(userId)).toBe(before);
  });

  it("ignores event types that are not value-in", async () => {
    const result = await ingestCoinbaseEvent({
      eventID: `${EVENT_PREFIX}other`,
      eventType: "payments.transfers.quoted",
      data: {},
    });

    expect(result).toBe("ignored");
    const event = await prisma.webhookEvent.findUnique({
      where: { eventId: `${EVENT_PREFIX}other` },
    });
    expect(event?.status).toBe("IGNORED");
  });

  it("ignores a delivery with no event identity", async () => {
    expect(await ingestCoinbaseEvent({ eventType: "payments.transfers.completed" })).toBe("ignored");
    expect(await ingestCoinbaseEvent({ eventID: `${EVENT_PREFIX}noType` })).toBe("ignored");
  });
});
