import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for the withdrawal approval workflow.
 *
 * The properties that matter are about where money ends up after a decision:
 *
 *   - a request **reserves** the amount, so it cannot be spent twice while it waits;
 *   - a **decline returns it** to the requesting user (a decline is not a forfeiture);
 *   - an **approval** pays the destination the user named, and a payout refused *before*
 *     signing returns the amount instead of leaving it stranded;
 *   - a failed payout whose broadcast is unknown keeps the funds **held** until an admin
 *     releases them, so a retry cannot pay twice;
 *   - an **account hold freezes movement without moving a balance**;
 *   - only an admin can decide anything.
 *
 * Only the framework boundary, the CDP SDK and the market quote are mocked; authz, the
 * session, the ledger and the idempotency guard all run for real against the throwaway DB.
 */

const h = vi.hoisted(() => ({
  store: new Map<string, string>(),
  redirects: [] as string[],
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (h.store.has(name) ? { name, value: h.store.get(name)! } : undefined),
    set: (name: string, value: string) => {
      h.store.set(name, value);
    },
    delete: (name: string) => {
      h.store.delete(name);
    },
  }),
  headers: async () => new Headers({ host: "localhost:3210" }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    h.redirects.push(url);
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

vi.mock("@/lib/market", () => ({
  getQuotesSafe: async () => ({ quotes: [{ symbol: "ETH", priceUsd: 2000, offline: false }] }),
}));

const sdk = vi.hoisted(() => ({
  getOrCreateAccount: vi.fn(async () => ({
    address: "0x00000000000000000000000000000000000000bb" as const,
    sign: vi.fn(),
    signMessage: vi.fn(),
    signTransaction: vi.fn(),
  })),
  sendTransaction: vi.fn(async () => ({ transactionHash: "0xapproved123" as const })),
}));

vi.mock("@coinbase/cdp-sdk", () => ({
  CdpClient: class {
    evm = {
      getOrCreateAccount: sdk.getOrCreateAccount,
      sendTransaction: sdk.sendTransaction,
    };
  },
}));

import { privateKeyToAccount } from "viem/accounts";

import {
  decideWithdrawalRequestAction,
  releaseWithdrawalFundsAction,
  requestWithdrawalAction,
  resolveDisputeAction,
  setAccountBanAction,
  setAccountHoldAction,
  verifySiweAction,
} from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildSiweMessage } from "@/lib/eip4361";
import { SESSION_COOKIE, createToken } from "@/lib/session";
import { issueNonce } from "@/lib/siwe";
import { disputeWindowDays } from "@/lib/withdrawals";

const BASE_MAINNET = 8453;
const APPLICANT = `0x${"a1".repeat(20)}`;
const ADMIN = `0x${"a2".repeat(20)}`;
const DEST = `0x${"1a".repeat(20)}`;
const STARTING_BALANCE = 500_000; // $5,000

/** A signing account, so ban enforcement can be tested through a real SIWE sign-in. */
const banTargetAccount = privateKeyToAccount(`0x${"77".repeat(32)}`);
const BAN_TARGET = banTargetAccount.address.toLowerCase();

let applicantId: string;
let adminId: string;
let banTargetId: string;

async function run(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    // A successful server action redirects, which the mock surfaces as a thrown error.
    if (error instanceof Error && (error.message === "NEXT_REDIRECT" || error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN")) {
      return;
    }
    throw error;
  }
}

function signInOn(userId: string, chainId = BASE_MAINNET) {
  h.store.set(SESSION_COOKIE, createToken(userId, chainId));
}

function enableCustody() {
  vi.stubEnv("MAINNET_EXECUTION_ENABLED", ""); // default: enabled
  vi.stubEnv("CUSTODY_PROVIDER", "coinbase-cdp");
  vi.stubEnv("CUSTODY_KEY_ID", "hot-wallet");
  vi.stubEnv("CDP_API_KEY_ID", "key-id");
  vi.stubEnv("CDP_API_KEY_SECRET", "key-secret");
  vi.stubEnv("CDP_WALLET_SECRET", "wallet-secret");
}

function requestForm(fields: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("confirm", "on");
  fd.set("idempotencyKey", crypto.randomUUID());
  fd.set("rail", "CUSTODY_ONCHAIN");
  fd.set("amount", "0.05"); // 0.05 ETH @ $2,000 = $100
  fd.set("to", DEST);
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function decisionForm(requestId: string, decision: "approve" | "decline", reason = ""): FormData {
  const fd = new FormData();
  fd.set("idempotencyKey", crypto.randomUUID());
  fd.set("requestId", requestId);
  fd.set("decision", decision);
  if (reason) fd.set("reason", reason);
  return fd;
}

async function balanceCents(): Promise<number> {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: applicantId } });
  return wallet.balanceCents;
}

async function openRequest(fields: Record<string, string> = {}) {
  signInOn(applicantId);
  await run(() => requestWithdrawalAction(requestForm(fields)));
  const request = await prisma.withdrawalRequest.findFirstOrThrow({
    where: { userId: applicantId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  return request;
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { walletAddress: { in: [APPLICANT, ADMIN] } } });

  const applicant = await prisma.user.create({
    data: {
      walletAddress: APPLICANT,
      chainId: BASE_MAINNET,
      name: "Withdrawal Applicant",
      role: "USER",
      wallet: { create: { address: APPLICANT, kind: "MAINNET", network: "mainnet", balanceCents: STARTING_BALANCE } },
    },
  });
  applicantId = applicant.id;

  const admin = await prisma.user.create({
    data: {
      walletAddress: ADMIN,
      chainId: BASE_MAINNET,
      name: "Withdrawal Admin",
      role: "ADMIN",
      wallet: { create: { address: ADMIN, kind: "MAINNET", network: "mainnet" } },
    },
  });
  adminId = admin.id;

  const banTarget = await prisma.user.create({
    data: {
      walletAddress: BAN_TARGET,
      chainId: BASE_MAINNET,
      name: "Ban Target",
      role: "USER",
      customer: { create: { name: "Ban Target" } },
      wallet: { create: { address: BAN_TARGET, kind: "MAINNET", network: "mainnet", balanceCents: 25_000 } },
    },
  });
  banTargetId = banTarget.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { walletAddress: { in: [APPLICANT, ADMIN, BAN_TARGET] } } });
});

beforeEach(async () => {
  for (const name of [
    "CUSTODY_PROVIDER",
    "CUSTODY_KEY_ID",
    "CDP_API_KEY_ID",
    "CDP_API_KEY_SECRET",
    "CDP_WALLET_SECRET",
    "MAINNET_EXECUTION_ENABLED",
    "COMPLIANCE_PROVIDER",
  ]) {
    vi.stubEnv(name, "");
  }
  await prisma.wallet.update({
    where: { userId: applicantId },
    data: { balanceCents: STARTING_BALANCE, blocked: false, blockedReason: null, blockedAt: null },
  });
  // A confirm-misuse test bans the applicant, so undo that between tests too.
  await prisma.user.update({
    where: { id: applicantId },
    data: { banned: false, bannedReason: null, bannedAt: null },
  });
  await prisma.user.update({
    where: { id: banTargetId },
    data: { banned: false, bannedReason: null, bannedAt: null },
  });
  await prisma.wallet.update({
    where: { userId: banTargetId },
    data: { balanceCents: 25_000, blocked: false, blockedReason: null, blockedAt: null },
  });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  sdk.sendTransaction.mockClear();
  sdk.getOrCreateAccount.mockClear();
  h.redirects.length = 0;
  h.store.clear();
  for (const userId of [applicantId, adminId, banTargetId]) {
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({ where: { actorId: userId } });
    await prisma.ledgerEntry.deleteMany({ where: { userId } });
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.idempotencyKey.deleteMany({ where: { userId } });
    await prisma.custodySpend.deleteMany({ where: { userId } });
  }
  // Requests and dispute threads reference users, so clear them before the parents.
  await prisma.withdrawalRequest.deleteMany({ where: { userId: applicantId } });
  const tickets = await prisma.ticket.findMany({
    where: { ownerId: { in: [banTargetId, applicantId] } },
    select: { id: true },
  });
  await prisma.ticket.deleteMany({ where: { id: { in: tickets.map((t) => t.id) } } });
});

/* ------------------------------------------------------------- requesting */

describe("requesting a withdrawal", () => {
  it("reserves the amount and opens a pending request", async () => {
    signInOn(applicantId);
    await run(() => requestWithdrawalAction(requestForm()));

    const request = await prisma.withdrawalRequest.findFirstOrThrow({ where: { userId: applicantId } });
    expect(request).toMatchObject({ status: "PENDING", amountCents: 10_000, rail: "CUSTODY_ONCHAIN", destination: DEST });
    expect(request.nativeWei).toBe("50000000000000000"); // 0.05 ETH, exactly as requested

    expect(await balanceCents()).toBe(STARTING_BALANCE - 10_000);
    const ledger = await prisma.ledgerEntry.findFirstOrThrow({ where: { userId: applicantId, ref: request.id } });
    expect(ledger).toMatchObject({ type: "WITHDRAWAL", amountCents: -10_000 });
    const movement = await prisma.transaction.findFirstOrThrow({ where: { userId: applicantId, ref: request.id } });
    expect(movement.status).toBe("PENDING");
    expect(await prisma.notification.count({ where: { userId: applicantId } })).toBe(1);
    expect(h.redirects.at(-1)).toBe("/wallet?request=submitted");
  });

  it("refuses more than the available balance and reserves nothing", async () => {
    signInOn(applicantId);
    // $8,000: under the per-request cap, over the $5,000 balance.
    await run(() => requestWithdrawalAction(requestForm({ amount: "4" })));

    expect(h.redirects.at(-1)).toBe("/wallet?request=funds");
    expect(await prisma.withdrawalRequest.count({ where: { userId: applicantId } })).toBe(0);
    expect(await balanceCents()).toBe(STARTING_BALANCE);
  });

  it("refuses a request above the per-request cap", async () => {
    signInOn(applicantId);
    await run(() => requestWithdrawalAction(requestForm({ amount: "100" }))); // $200,000

    expect(h.redirects.at(-1)).toBe("/wallet?request=cap");
    expect(await balanceCents()).toBe(STARTING_BALANCE);
  });

  it("requires the explicit confirmation", async () => {
    signInOn(applicantId);
    const fd = requestForm();
    fd.delete("confirm");
    await run(() => requestWithdrawalAction(fd));

    expect(h.redirects.at(-1)).toBe("/wallet?request=confirm");
    expect(await balanceCents()).toBe(STARTING_BALANCE);
  });

  it("verifies the destination instead of only its shape", async () => {
    signInOn(applicantId);
    await run(() =>
      requestWithdrawalAction(requestForm({ to: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD" })) // flipped checksum
    );

    expect(h.redirects.at(-1)).toBe("/wallet?request=checksum");
    expect(await prisma.withdrawalRequest.count()).toBe(0);
    expect(await balanceCents()).toBe(STARTING_BALANCE);
  });

  it("refuses the burn address", async () => {
    signInOn(applicantId);
    await run(() => requestWithdrawalAction(requestForm({ to: `0x${"0".repeat(40)}` })));

    expect(h.redirects.at(-1)).toBe("/wallet?request=zero");
    expect(await balanceCents()).toBe(STARTING_BALANCE);
  });

  it("reserves once when the same submit is replayed", async () => {
    signInOn(applicantId);
    const fd = requestForm();
    await run(() => requestWithdrawalAction(fd));
    const afterFirst = await balanceCents();

    await run(() => requestWithdrawalAction(fd)); // same idempotency key

    expect(h.redirects.at(-1)).toBe("/wallet?request=duplicate");
    expect(await prisma.withdrawalRequest.count({ where: { userId: applicantId } })).toBe(1);
    expect(await balanceCents()).toBe(afterFirst);
  });
});

/* ------------------------------------------------------------- deciding */

describe("admin decisions", () => {
  it("refuses a decision from a non-admin", async () => {
    const request = await openRequest();

    signInOn(applicantId); // the applicant is a plain USER
    await run(() => decideWithdrawalRequestAction(decisionForm(request.id, "decline", "no")));

    const unchanged = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(unchanged.status).toBe("PENDING");
    expect(await balanceCents()).toBe(STARTING_BALANCE - 10_000);
  });

  it("declining returns the amount to the user and records the reason", async () => {
    const request = await openRequest();

    signInOn(adminId);
    await run(() => decideWithdrawalRequestAction(decisionForm(request.id, "decline", "destination not verified")));

    const declined = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(declined).toMatchObject({ status: "DECLINED", reason: "destination not verified", decidedById: adminId });

    // The whole point: a decline is not a forfeiture — the user has every cent back.
    expect(await balanceCents()).toBe(STARTING_BALANCE);
    const refund = await prisma.ledgerEntry.findFirstOrThrow({ where: { userId: applicantId, type: "DEPOSIT" } });
    expect(refund.amountCents).toBe(10_000);
    expect(await prisma.auditLog.count({ where: { action: "withdrawal.declined" } })).toBe(1);
    expect(h.redirects.at(-1)).toBe("/admin/withdrawals?decision=declined");
  });

  it("requires a reason to decline", async () => {
    const request = await openRequest();

    signInOn(adminId);
    await run(() => decideWithdrawalRequestAction(decisionForm(request.id, "decline")));

    expect(h.redirects.at(-1)).toBe("/admin/withdrawals?decision=reason");
    const unchanged = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(unchanged.status).toBe("PENDING");
  });

  it("approving an app-settled request pays the destination the user named", async () => {
    enableCustody();
    const request = await openRequest();

    signInOn(adminId);
    await run(() => decideWithdrawalRequestAction(decisionForm(request.id, "approve")));

    expect(sdk.sendTransaction).toHaveBeenCalledTimes(1);
    const approved = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(approved).toMatchObject({ status: "APPROVED", txHash: "0xapproved123", decidedById: adminId });

    // The reservation became the payout: the balance is NOT refunded.
    expect(await balanceCents()).toBe(STARTING_BALANCE - 10_000);
    const movement = await prisma.transaction.findFirstOrThrow({ where: { userId: applicantId, ref: request.id } });
    expect(movement.status).toBe("COMPLETED");
    expect(await prisma.custodySpend.count({ where: { userId: applicantId } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "withdrawal.approved" } })).toBe(1);
  });

  it("approving the Coinbase hand-off rail clears it and releases the reservation", async () => {
    const request = await openRequest({ rail: "COINBASE_OFFRAMP", amount: "150", to: "" });

    signInOn(adminId);
    await run(() => decideWithdrawalRequestAction(decisionForm(request.id, "approve")));

    // The app never signs this rail, so no custody call and the hold is released.
    expect(sdk.sendTransaction).not.toHaveBeenCalled();
    const approved = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(approved.status).toBe("APPROVED");
    expect(await balanceCents()).toBe(STARTING_BALANCE);
  });

  it("returns the amount when the payout is refused before anything is signed", async () => {
    enableCustody();
    vi.stubEnv("CUSTODY_MAX_PER_TX_USD", "1000"); // per-tx cap
    // $4,000 request: above the per-transaction cap, so the custody boundary refuses it.
    const request = await openRequest({ amount: "2", to: DEST });
    expect(request.amountCents).toBe(400_000);

    signInOn(adminId);
    await run(() => decideWithdrawalRequestAction(decisionForm(request.id, "approve")));

    expect(sdk.sendTransaction).not.toHaveBeenCalled();
    const released = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(released.status).toBe("RELEASED");
    expect(released.reason).toMatch(/amount returned/i);
    expect(await balanceCents()).toBe(STARTING_BALANCE); // nothing left stranded
    expect(h.redirects.at(-1)).toBe("/admin/withdrawals?decision=refused");
  });

  it("refuses to decide a request twice", async () => {
    const request = await openRequest();

    signInOn(adminId);
    await run(() => decideWithdrawalRequestAction(decisionForm(request.id, "decline", "first")));
    await run(() => decideWithdrawalRequestAction(decisionForm(request.id, "approve")));

    expect(h.redirects.at(-1)).toBe("/admin/withdrawals?decision=stale");
    const final = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(final.status).toBe("DECLINED");
    expect(await balanceCents()).toBe(STARTING_BALANCE);
  });
});

/* -------------------------------------------------------------- releasing */

describe("releasing a failed payout", () => {
  it("returns held funds after an admin confirms nothing landed", async () => {
    const request = await openRequest();
    // A failed payout whose broadcast is unknown: approved, no hash, funds still held.
    await prisma.withdrawalRequest.update({
      where: { id: request.id },
      data: { status: "FAILED", reason: "RPC error — verify before releasing" },
    });

    signInOn(adminId);
    const fd = new FormData();
    fd.set("idempotencyKey", crypto.randomUUID());
    fd.set("requestId", request.id);
    fd.set("reason", "checked the chain: nothing broadcast");
    await run(() => releaseWithdrawalFundsAction(fd));

    const released = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(released.status).toBe("RELEASED");
    expect(await balanceCents()).toBe(STARTING_BALANCE);
    expect(h.redirects.at(-1)).toBe("/admin/withdrawals?release=released");
  });

  it("will not release a request that is not stuck", async () => {
    const request = await openRequest();

    signInOn(adminId);
    const fd = new FormData();
    fd.set("idempotencyKey", crypto.randomUUID());
    fd.set("requestId", request.id);
    fd.set("reason", "attempt");
    await run(() => releaseWithdrawalFundsAction(fd));

    expect(h.redirects.at(-1)).toBe("/admin/withdrawals?release=nothing");
    expect(await balanceCents()).toBe(STARTING_BALANCE - 10_000); // still reserved, still pending
  });
});

/* ------------------------------------------------------------------ holds */

describe("account holds", () => {
  function holdForm(userId: string, hold: boolean, reason = "") {
    const fd = new FormData();
    fd.set("idempotencyKey", crypto.randomUUID());
    fd.set("userId", userId);
    if (hold) fd.set("hold", "on");
    if (reason) fd.set("reason", reason);
    return fd;
  }

  it("freezes movement without touching the balance, and releases cleanly", async () => {
    signInOn(adminId);
    await run(() => setAccountHoldAction(holdForm(applicantId, true, "suspected abuse — under review")));

    const held = await prisma.wallet.findUniqueOrThrow({ where: { userId: applicantId } });
    expect(held).toMatchObject({ blocked: true, blockedReason: "suspected abuse — under review" });
    expect(held.balanceCents).toBe(STARTING_BALANCE); // untouched: a hold is not a seizure
    expect(await prisma.auditLog.count({ where: { action: "account.hold" } })).toBe(1);

    // While held, no withdrawal can be requested at all.
    signInOn(applicantId);
    await run(() => requestWithdrawalAction(requestForm()));
    expect(h.redirects.at(-1)).toBe("/wallet?request=blocked");
    expect(await balanceCents()).toBe(STARTING_BALANCE);

    signInOn(adminId);
    await run(() => setAccountHoldAction(holdForm(applicantId, false)));
    const cleared = await prisma.wallet.findUniqueOrThrow({ where: { userId: applicantId } });
    expect(cleared.blocked).toBe(false);
    expect(cleared.blockedReason).toBeNull();
    expect(cleared.balanceCents).toBe(STARTING_BALANCE);

    signInOn(applicantId);
    await run(() => requestWithdrawalAction(requestForm()));
    expect(h.redirects.at(-1)).toBe("/wallet?request=submitted");
  });

  it("requires a reason to place a hold", async () => {
    signInOn(adminId);
    await run(() => setAccountHoldAction(holdForm(applicantId, true)));

    expect(h.redirects.at(-1)).toBe("/admin/withdrawals?hold=reason");
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: applicantId } });
    expect(wallet.blocked).toBe(false);
  });

  it("refuses a hold from a non-admin", async () => {
    signInOn(applicantId);
    await run(() => setAccountHoldAction(holdForm(applicantId, true, "self-service")));

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: applicantId } });
    expect(wallet.blocked).toBe(false);
  });
});

/* ------------------------------- disputes, bans and access enforcement */

function disputeForm(requestId: string, outcome: "CLEARED" | "MISUSE_CONFIRMED", reason = ""): FormData {
  const fd = new FormData();
  fd.set("idempotencyKey", crypto.randomUUID());
  fd.set("requestId", requestId);
  fd.set("outcome", outcome);
  if (reason) fd.set("reason", reason);
  return fd;
}

function banForm(userId: string, ban: boolean, reason = ""): FormData {
  const fd = new FormData();
  fd.set("idempotencyKey", crypto.randomUUID());
  fd.set("userId", userId);
  if (ban) fd.set("ban", "on");
  if (reason) fd.set("reason", reason);
  return fd;
}

describe("dispute window, bans and access", () => {
  /** Decline a fresh request as the admin, returning it with its dispute window set. */
  async function declinedRequest() {
    const request = await openRequest();
    signInOn(adminId);
    await run(() => decideWithdrawalRequestAction(decisionForm(request.id, "decline", "destination not verified")));
    return prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: request.id } });
  }

  it("opens a bounded dispute window and a support thread when a request is declined", async () => {
    const request = await declinedRequest();

    expect(request.disputeOpensAt).not.toBeNull();
    expect(request.disputeClosesAt).not.toBeNull();
    expect(request.disputeOutcome).toBeNull();

    // The configured default is three business days, and the deadline never lands on a
    // weekend (the arithmetic is Mon–Fri UTC; no holiday calendar — see the unit tests).
    expect(disputeWindowDays()).toBe(3);
    expect([0, 6]).not.toContain(request.disputeClosesAt!.getUTCDay());
    const spanDays = (request.disputeClosesAt!.getTime() - request.disputeOpensAt!.getTime()) / 86_400_000;
    expect(spanDays).toBeGreaterThanOrEqual(3);
    expect(spanDays).toBeLessThanOrEqual(5); // a weekend may intervene

    // The case is argued in a real support thread, assigned to the admin who declined it.
    const ticket = await prisma.ticket.findFirstOrThrow({
      where: { ownerId: applicantId, subject: { contains: "declined" } },
      orderBy: { createdAt: "desc" },
    });
    expect(ticket).toMatchObject({ assigneeId: adminId, status: "OPEN", priority: "HIGH" });
    expect(ticket.subject).toMatch(/declined/i);
    const messages = await prisma.ticketMessage.findMany({ where: { ticketId: ticket.id } });
    expect(messages).toHaveLength(1);

    // The user is told exactly when the window closes.
    const notification = await prisma.notification.findFirstOrThrow({
      where: { userId: applicantId, title: { contains: "declined" } },
    });
    expect(notification.body).toContain(request.disputeClosesAt!.toISOString().slice(0, 10));
    expect(notification.body).toContain(ticket.number);
  });

  it("clearing a dispute takes no further action and moves no money", async () => {
    const request = await declinedRequest();
    const before = {
      ledger: await prisma.ledgerEntry.count({ where: { userId: applicantId } }),
      movements: await prisma.transaction.count({ where: { userId: applicantId } }),
    };

    signInOn(adminId);
    await run(() => resolveDisputeAction(disputeForm(request.id, "CLEARED")));

    const resolved = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(resolved.disputeOutcome).toBe("CLEARED");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: applicantId } });
    expect(user.banned).toBe(false);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: applicantId } });
    expect(wallet).toMatchObject({ blocked: false, balanceCents: STARTING_BALANCE });
    expect(await prisma.ledgerEntry.count({ where: { userId: applicantId } })).toBe(before.ledger);
    expect(await prisma.transaction.count({ where: { userId: applicantId } })).toBe(before.movements);
    expect(h.redirects.at(-1)).toBe("/admin/withdrawals?dispute=resolved");
  });

  it("confirming misuse bans the account and freezes the balance, without moving any money", async () => {
    const request = await declinedRequest();
    const before = {
      ledger: await prisma.ledgerEntry.count({ where: { userId: applicantId } }),
      movements: await prisma.transaction.count({ where: { userId: applicantId } }),
    };

    signInOn(adminId);
    await run(() => resolveDisputeAction(disputeForm(request.id, "MISUSE_CONFIRMED", "exploit used to inflate the balance")));

    const user = await prisma.user.findUniqueOrThrow({ where: { id: applicantId } });
    expect(user).toMatchObject({ banned: true, bannedReason: "exploit used to inflate the balance" });
    expect(user.bannedAt).not.toBeNull();

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: applicantId } });
    expect(wallet.blocked).toBe(true);
    expect(wallet.blockedReason).toBe("exploit used to inflate the balance");

    // The balance is still the account holder's — frozen, not taken. The resolution itself
    // creates no ledger entry and no movement, which is the whole point.
    expect(wallet.balanceCents).toBe(STARTING_BALANCE);
    expect(await prisma.ledgerEntry.count({ where: { userId: applicantId } })).toBe(before.ledger);
    expect(await prisma.transaction.count({ where: { userId: applicantId } })).toBe(before.movements);

    expect(await prisma.auditLog.count({ where: { action: "account.banned" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "withdrawal.disputeMisuseConfirmed" } })).toBe(1);

    const resolved = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(resolved.disputeOutcome).toBe("MISUSE_CONFIRMED");
  });

  it("requires a reason to confirm misuse, and refuses to resolve twice", async () => {
    const request = await declinedRequest();

    signInOn(adminId);
    await run(() => resolveDisputeAction(disputeForm(request.id, "MISUSE_CONFIRMED")));
    expect(h.redirects.at(-1)).toBe("/admin/withdrawals?dispute=reason");

    await run(() => resolveDisputeAction(disputeForm(request.id, "CLEARED")));
    await run(() => resolveDisputeAction(disputeForm(request.id, "MISUSE_CONFIRMED", "second look")));
    expect(h.redirects.at(-1)).toBe("/admin/withdrawals?dispute=stale");

    const resolved = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(resolved.disputeOutcome).toBe("CLEARED");
  });

  it("refuses sign-in for a banned wallet and treats its existing session as signed out", async () => {
    signInOn(adminId);
    await run(() => setAccountBanAction(banForm(banTargetId, true, "confirmed misuse")));

    // An already-issued session stops working immediately...
    signInOn(banTargetId);
    expect(await getCurrentUser()).toBeNull();

    // ...and a fresh, correctly-signed SIWE message is refused at sign-in. The prior
    // session is cleared first so the assertion is about this attempt minting no session.
    h.store.clear();
    const nonce = await issueNonce();
    const message = buildSiweMessage({
      domain: "localhost:3210",
      address: banTargetAccount.address,
      uri: "http://localhost:3210",
      chainId: BASE_MAINNET,
      nonce,
    });
    const signature = await banTargetAccount.signMessage({ message });
    const result = await verifySiweAction({ message, signature });

    expect(result).toMatchObject({ error: expect.stringMatching(/cannot sign in/i) });
    expect(h.store.has(SESSION_COOKIE)).toBe(false);
  });

  it("lifts a ban without ever touching the balance", async () => {
    signInOn(adminId);
    await run(() => setAccountBanAction(banForm(banTargetId, true, "confirmed misuse")));
    await run(() => setAccountBanAction(banForm(banTargetId, false)));

    const user = await prisma.user.findUniqueOrThrow({ where: { id: banTargetId } });
    expect(user).toMatchObject({ banned: false, bannedReason: null });
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: banTargetId } });
    expect(wallet).toMatchObject({ blocked: false, balanceCents: 25_000 });

    // Access works again: a session for the restored account resolves.
    signInOn(banTargetId);
    expect(await getCurrentUser()).not.toBeNull();
  });

  it("refuses to ban an admin account from the console", async () => {
    signInOn(adminId);
    await run(() => setAccountBanAction(banForm(adminId, true, "self-service")));

    expect(h.redirects.at(-1)).toBe("/admin/withdrawals?ban=protected");
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    expect(admin.banned).toBe(false);
  });
});
