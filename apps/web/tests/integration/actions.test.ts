import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for the request-handling boundary.
 *
 * This app has no API route handlers — every mutation is a Next.js server
 * action in `src/lib/actions.ts`. These tests call those actions directly,
 * mocking only the framework boundary (`next/headers`, `next/navigation`,
 * `next/cache`) so the real code path runs against a real SQLite database:
 * genuine Prisma reads/writes, genuine business rules, genuine authz.
 *
 * The database is a throwaway file created by tests/integration/global-setup.ts.
 */

/* ------------------------------------------------------------ framework mocks */

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

/* ------------------------------------------------------------------- imports */

import { prisma } from "@/lib/db";
import { SESSION_COOKIE, createToken, verifyToken } from "@/lib/session";
import { MIN_TRADE_CENTS, config } from "@/lib/config";
import { calculateWithdrawal } from "@/lib/domain/withdrawal";
import {
  adminUpdateTicketAction,
  createTicketAction,
  depositAction,
  loginAction,
  logoutAction,
  registerAction,
  sendTicketMessageAction,
  startTradingAction,
  stopTradingAction,
  withdrawAction,
  type FormState,
} from "@/lib/actions";

/* ------------------------------------------------------------------- helpers */

const PASSWORD = "password123";

/** Runs a function, swallowing the NEXT_REDIRECT throw so we can assert on it. */
async function run<T>(fn: () => Promise<T>): Promise<{ value?: T; error?: Error }> {
  try {
    return { value: await fn() };
  } catch (e) {
    return { error: e as Error };
  }
}

function lastRedirect(): string | undefined {
  return h.redirects.at(-1);
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function register(email: string, password = PASSWORD, name = "Test User") {
  const state = await run<FormState>(() => registerAction(undefined, form({ email, password, name })));
  const user = await prisma.user.findUnique({ where: { email } });
  return { state, user };
}

/** Registers a user and leaves the session cookie in the mocked store. */
async function signedInUser(email: string, name = "Test User") {
  const { user } = await register(email, PASSWORD, name);
  if (!user) throw new Error(`failed to register ${email}`);
  return user;
}

async function clearDb() {
  await prisma.auditLog.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.tradeEvent.deleteMany();
  await prisma.tradingSession.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.marketCache.deleteMany();
  await prisma.user.deleteMany();
}

async function balanceOf(userId: string): Promise<number> {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  return wallet?.balanceCents ?? 0;
}

beforeEach(async () => {
  h.store.clear();
  h.redirects.length = 0;
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/* ---------------------------------------------------------------------- auth */

describe("auth", () => {
  it("registers a user and provisions customer + wallet, then signs them in", async () => {
    const { user } = await register("a@example.com", PASSWORD, "Ada Lovelace");

    expect(user).not.toBeNull();
    expect(user!.role).toBe("USER");
    expect(user!.passwordHash).not.toContain(PASSWORD); // never stored in plaintext
    expect(user!.passwordHash.startsWith("scrypt$")).toBe(true);

    // database writes: customer + wallet provisioned
    expect(await prisma.customer.count({ where: { userId: user!.id } })).toBe(1);
    const wallet = await prisma.wallet.findUnique({ where: { userId: user!.id } });
    expect(wallet?.kind).toBe("SIMULATED");
    expect(wallet?.balanceCents).toBe(0);

    // session cookie is set and verifies back to this user
    expect(lastRedirect()).toBe("/dashboard");
    const token = h.store.get(SESSION_COOKIE);
    expect(token).toBeTruthy();
    expect(verifyToken(token)).toBe(user!.id);
  });

  it("rejects a duplicate email without writing a second user", async () => {
    await register("dup@example.com");
    const before = await prisma.user.count();
    const { state } = await register("dup@example.com");

    expect(state.value?.error).toMatch(/already exists/i);
    expect(await prisma.user.count()).toBe(before);
  });

  it("rejects a short password", async () => {
    const { state, user } = await register("short@example.com", "abc");
    expect(state.value?.error).toMatch(/8 characters/i);
    expect(user).toBeNull();
  });

  it("normalises the email to lower case", async () => {
    await register("MiXeD@Example.COM");
    expect(await prisma.user.findUnique({ where: { email: "mixed@example.com" } })).not.toBeNull();
  });

  it("logs in with valid credentials and redirects by role", async () => {
    await register("member@example.com");
    h.store.clear();

    // On success the action does not return an error state — it redirects (throws).
    const res = await run<FormState>(() =>
      loginAction(undefined, form({ email: "member@example.com", password: PASSWORD }))
    );
    expect(res.value).toBeUndefined();
    expect(lastRedirect()).toBe("/dashboard");

    const admin = await prisma.user.create({
      data: { email: "boss@example.com", name: "Boss", passwordHash: (await prisma.user.findUnique({ where: { email: "member@example.com" } }))!.passwordHash, role: "ADMIN" },
    });
    h.redirects.length = 0;
    h.store.clear();
    await run(() => loginAction(undefined, form({ email: admin.email, password: PASSWORD })));
    expect(lastRedirect()).toBe("/admin");
  });

  it("refuses a wrong password and sets no session", async () => {
    await register("wrong@example.com");
    h.store.clear();

    // On failure the action returns an error state and does NOT redirect.
    const res = await run<FormState>(() =>
      loginAction(undefined, form({ email: "wrong@example.com", password: "not-the-password" }))
    );
    expect(res.error).toBeUndefined();
    expect(res.value?.error).toMatch(/invalid/i);
    expect(h.store.has(SESSION_COOKIE)).toBe(false);
  });

  it("logs out by clearing the session cookie", async () => {
    await signedInUser("out@example.com");
    expect(h.store.has(SESSION_COOKIE)).toBe(true);

    await run(() => logoutAction());

    expect(h.store.has(SESSION_COOKIE)).toBe(false);
    expect(lastRedirect()).toBe("/");
  });

  it("rejects tampered session tokens", async () => {
    await signedInUser("tamper@example.com");
    const token = h.store.get(SESSION_COOKIE)!;
    expect(verifyToken(token)).toBeTruthy();
    expect(verifyToken(token.slice(0, -2) + "xx")).toBeNull();
    expect(verifyToken(undefined)).toBeNull();
  });
});

/* -------------------------------------------------------------------- wallet */

describe("wallet", () => {
  it("credits a deposit across wallet, ledger, transaction and notification", async () => {
    const user = await signedInUser("depositor@example.com");

    await run(() => depositAction(form({ amount: "100" })));

    expect(await balanceOf(user.id)).toBe(10_000);
    const ledger = await prisma.ledgerEntry.findMany({ where: { userId: user.id } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ type: "DEPOSIT", amountCents: 10_000 });

    const tx = await prisma.transaction.findMany({ where: { userId: user.id } });
    expect(tx).toHaveLength(1);
    expect(tx[0]).toMatchObject({ kind: "DEPOSIT", amountCents: 10_000, status: "COMPLETED" });

    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(1);
  });

  it("accumulates multiple deposits", async () => {
    const user = await signedInUser("multi@example.com");
    await run(() => depositAction(form({ amount: "20" })));
    await run(() => depositAction(form({ amount: "30" })));
    expect(await balanceOf(user.id)).toBe(5_000);
  });

  it("ignores invalid deposit amounts", async () => {
    const user = await signedInUser("bad-amount@example.com");
    for (const amount of ["0", "-50", "abc", ""]) {
      await run(() => depositAction(form({ amount })));
    }
    expect(await balanceOf(user.id)).toBe(0);
    expect(await prisma.ledgerEntry.count({ where: { userId: user.id } })).toBe(0);
  });

  it("rejects unauthenticated writes", async () => {
    const { error } = await run(() => depositAction(form({ amount: "10" })));
    expect(error?.message).toBe("UNAUTHORIZED");
    expect(await prisma.ledgerEntry.count()).toBe(0);
  });

  it("withdraws with the documented simulated-fee maths", async () => {
    const user = await signedInUser("withdrawer@example.com");
    await run(() => depositAction(form({ amount: "100" })));

    await run(() => withdrawAction());

    const expected = calculateWithdrawal(10_000, 0, config.withdrawFeeBps);
    expect(expected.totalCents).toBe(9_900); // 1% simulated fee

    expect(await balanceOf(user.id)).toBe(0);
    const ledger = await prisma.ledgerEntry.findMany({ where: { userId: user.id } });
    expect(ledger.find((l) => l.type === "WITHDRAWAL")?.amountCents).toBe(-9_900);
    expect(ledger.find((l) => l.type === "FEE")?.amountCents).toBe(-100);

    const tx = await prisma.transaction.findFirst({ where: { userId: user.id, kind: "WITHDRAWAL" } });
    expect(tx?.amountCents).toBe(9_900);
  });

  it("blocks withdrawal while trading is active", async () => {
    const user = await signedInUser("busy@example.com");
    await run(() => depositAction(form({ amount: "100" })));
    await run(() => startTradingAction());

    const ledgerBefore = await prisma.ledgerEntry.count({ where: { userId: user.id } });
    await run(() => withdrawAction());

    expect(await balanceOf(user.id)).toBe(10_000); // untouched
    expect(await prisma.ledgerEntry.count({ where: { userId: user.id } })).toBe(ledgerBefore);
    expect(await prisma.transaction.count({ where: { userId: user.id, kind: "WITHDRAWAL" } })).toBe(0);
  });

  it("does nothing when there are no funds to withdraw", async () => {
    const user = await signedInUser("empty@example.com");
    await run(() => withdrawAction());
    expect(await prisma.ledgerEntry.count({ where: { userId: user.id } })).toBe(0);
  });
});

/* ------------------------------------------------------------------- trading */

describe("trading", () => {
  it("refuses to start below the minimum balance", async () => {
    const user = await signedInUser("poor@example.com");
    await run(() => depositAction(form({ amount: "19" }))); // one dollar short

    await run(() => startTradingAction());

    expect(await prisma.tradingSession.count({ where: { userId: user.id } })).toBe(0);
  });

  it("starts a session exactly at the minimum balance and seeds an activity stream", async () => {
    const user = await signedInUser("min@example.com");
    await run(() => depositAction(form({ amount: String(MIN_TRADE_CENTS / 100) })));

    await run(() => startTradingAction());

    const session = await prisma.tradingSession.findFirst({ where: { userId: user.id } });
    expect(session?.status).toBe("ACTIVE");
    expect(session?.startedAt).toBeInstanceOf(Date);
    expect(await prisma.tradeEvent.count({ where: { sessionId: session!.id } })).toBeGreaterThan(0);
  });

  it("is idempotent when already active", async () => {
    const user = await signedInUser("idempotent@example.com");
    await run(() => depositAction(form({ amount: "100" })));
    await run(() => startTradingAction());
    await run(() => startTradingAction());

    expect(await prisma.tradingSession.count({ where: { userId: user.id } })).toBe(1);
  });

  it("refuses an early stop without the force flag", async () => {
    const user = await signedInUser("early@example.com");
    await run(() => depositAction(form({ amount: "100" })));
    await run(() => startTradingAction());

    await run(() => stopTradingAction()); // no force, well inside the 5-minute guard

    const session = await prisma.tradingSession.findFirst({ where: { userId: user.id } });
    expect(session?.status).toBe("ACTIVE");
    expect(session?.stoppedAt).toBeNull();
  });

  it("force-stops, records simulated P/L and unlocks withdrawal", async () => {
    const user = await signedInUser("force@example.com");
    await run(() => depositAction(form({ amount: "100" })));
    await run(() => startTradingAction());

    await run(() => stopTradingAction(form({ force: "1" })));

    const session = await prisma.tradingSession.findFirst({ where: { userId: user.id } });
    expect(session?.status).toBe("STOPPED");
    expect(session?.stoppedAt).toBeInstanceOf(Date);

    const pnlLedger = await prisma.ledgerEntry.findFirst({ where: { userId: user.id, type: "PAPER_PNL" } });
    expect(pnlLedger).not.toBeNull();
    expect(session?.pnlCents).toBe(pnlLedger!.amountCents);

    // Wallet reflects the simulated result, and a CLOSE event was appended.
    expect(await balanceOf(user.id)).toBe(10_000 + pnlLedger!.amountCents);
    const events = await prisma.tradeEvent.findMany({ where: { sessionId: session!.id } });
    expect(events.some((e) => e.kind === "CLOSE")).toBe(true);
  });

  it("does nothing when stopping an already-stopped session", async () => {
    const user = await signedInUser("double@example.com");
    await run(() => depositAction(form({ amount: "100" })));
    await run(() => startTradingAction());
    await run(() => stopTradingAction(form({ force: "1" })));

    const before = await prisma.ledgerEntry.count({ where: { userId: user.id, type: "PAPER_PNL" } });
    await run(() => stopTradingAction(form({ force: "1" })));

    expect(await prisma.ledgerEntry.count({ where: { userId: user.id, type: "PAPER_PNL" } })).toBe(before);
  });

  it("completes the full money cycle: deposit → start → force stop → withdraw", async () => {
    const user = await signedInUser("cycle@example.com");
    await run(() => depositAction(form({ amount: "100" })));
    await run(() => startTradingAction());
    await run(() => stopTradingAction(form({ force: "1" })));

    const pnl = (await prisma.tradingSession.findFirst({ where: { userId: user.id } }))!.pnlCents;
    await run(() => withdrawAction());

    const expected = calculateWithdrawal(10_000, pnl, config.withdrawFeeBps);
    expect(await balanceOf(user.id)).toBe(0);

    const tx = await prisma.transaction.findFirst({ where: { userId: user.id, kind: "WITHDRAWAL" } });
    expect(tx?.amountCents).toBe(expected.totalCents);

    const fee = await prisma.ledgerEntry.findFirst({ where: { userId: user.id, type: "FEE" } });
    expect(fee?.amountCents).toBe(-expected.feeCents);

    // With no funds left, restarting must be refused even though the session is STOPPED.
    await run(() => startTradingAction());
    expect((await prisma.tradingSession.findFirst({ where: { userId: user.id } }))?.status).toBe("STOPPED");

    // Once funded again, the same session restarts.
    await run(() => depositAction(form({ amount: "50" })));
    await run(() => startTradingAction());
    expect((await prisma.tradingSession.findFirst({ where: { userId: user.id } }))?.status).toBe("ACTIVE");
  });
});

/* ----------------------------------------------------------------------- CRM */

describe("crm", () => {
  it("creates a ticket with its first message and an audit entry", async () => {
    const user = await signedInUser("customer@example.com", "Cass Customer");

    await run(() =>
      createTicketAction(form({ subject: "Where is my withdrawal?", body: "Hi, I stopped trading." }))
    );

    const ticket = await prisma.ticket.findFirst({ where: { ownerId: user.id } });
    expect(ticket).not.toBeNull();
    expect(ticket!.status).toBe("OPEN");
    expect(ticket!.priority).toBe("NORMAL");
    expect(ticket!.number).toMatch(/^TCK-\d{4}$/);
    expect(ticket!.subject).toBe("Where is my withdrawal?");

    const messages = await prisma.ticketMessage.findMany({ where: { ticketId: ticket!.id } });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ authorId: user.id, internal: false });

    expect(await prisma.auditLog.count({ where: { action: "ticket.created" } })).toBe(1);
    expect(lastRedirect()).toBe(`/support?ticket=${ticket!.id}`);
  });

  it("ignores incomplete ticket submissions", async () => {
    await signedInUser("incomplete@example.com");
    await run(() => createTicketAction(form({ subject: "No body" })));
    await run(() => createTicketAction(form({ subject: "", body: "No subject" })));
    expect(await prisma.ticket.count()).toBe(0);
  });

  it("appends customer replies and blocks writing to someone else's ticket", async () => {
    const owner = await signedInUser("owner@example.com");
    await run(() => createTicketAction(form({ subject: "Mine", body: "hello" })));
    const ticket = (await prisma.ticket.findFirst({ where: { ownerId: owner.id } }))!;

    await run(() => sendTicketMessageAction(form({ ticketId: ticket.id, body: "Any update?" })));
    expect(await prisma.ticketMessage.count({ where: { ticketId: ticket.id } })).toBe(2);

    // A different signed-in user must not be able to post into this ticket.
    h.store.clear();
    await signedInUser("intruder@example.com");
    const before = await prisma.ticketMessage.count({ where: { ticketId: ticket.id } });
    await run(() => sendTicketMessageAction(form({ ticketId: ticket.id, body: "I should not be here" })));

    expect(await prisma.ticketMessage.count({ where: { ticketId: ticket.id } })).toBe(before);
  });

  it("blocks non-admins from the admin triage action", async () => {
    const user = await signedInUser("notadmin@example.com");
    await run(() => createTicketAction(form({ subject: "Help", body: "please" })));
    const ticket = (await prisma.ticket.findFirst({ where: { ownerId: user.id } }))!;

    const { error } = await run(() =>
      adminUpdateTicketAction(form({ ticketId: ticket.id, status: "CLOSED", priority: "URGENT" }))
    );

    expect(error?.message).toBe("FORBIDDEN");
    const unchanged = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(unchanged?.status).toBe("OPEN");
    expect(unchanged?.priority).toBe("NORMAL");
  });

  it("lets an admin triage, assign and reply", async () => {
    const customer = await signedInUser("c2@example.com");
    await run(() => createTicketAction(form({ subject: "Need help", body: "question" })));
    const ticket = (await prisma.ticket.findFirst({ where: { ownerId: customer.id } }))!;

    // Switch the active session to an admin.
    const customerHash = (await prisma.user.findUnique({ where: { id: customer.id } }))!.passwordHash;
    const admin = await prisma.user.create({
      data: { email: "agent@example.com", name: "Agent Smith", passwordHash: customerHash, role: "ADMIN" },
    });
    h.store.clear();
    h.store.set(SESSION_COOKIE, createToken(admin.id));

    await run(() =>
      adminUpdateTicketAction(
        form({ ticketId: ticket.id, status: "PENDING", priority: "HIGH", assigneeId: admin.id, body: "On it — please confirm the amount." })
      )
    );

    const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updated?.status).toBe("PENDING");
    expect(updated?.priority).toBe("HIGH");
    expect(updated?.assigneeId).toBe(admin.id);

    const reply = await prisma.ticketMessage.findFirst({ where: { ticketId: ticket.id, authorId: admin.id } });
    expect(reply?.body).toMatch(/On it/);
    expect(reply?.internal).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: "ticket.updated" } })).toBe(1);
  });

  it("keeps internal notes out of the customer-visible conversation", async () => {
    const customer = await signedInUser("c3@example.com");
    await run(() => createTicketAction(form({ subject: "Internal test", body: "hello" })));
    const ticket = (await prisma.ticket.findFirst({ where: { ownerId: customer.id } }))!;

    const hash = (await prisma.user.findUnique({ where: { id: customer.id } }))!.passwordHash;
    const admin = await prisma.user.create({
      data: { email: "agent2@example.com", name: "Agent Two", passwordHash: hash, role: "ADMIN" },
    });
    h.store.clear();
    h.store.set(SESSION_COOKIE, createToken(admin.id));

    await run(() =>
      adminUpdateTicketAction(form({ ticketId: ticket.id, body: "Secret internal note", internal: "on" }))
    );

    const note = await prisma.ticketMessage.findFirst({ where: { ticketId: ticket.id, body: "Secret internal note" } });
    expect(note?.internal).toBe(true);

    // The customer-facing query (as used by /support) must exclude it.
    const visible = await prisma.ticketMessage.findMany({ where: { ticketId: ticket.id, internal: false } });
    expect(visible.map((m) => m.body)).not.toContain("Secret internal note");
  });

  it("keeps each customer's tickets scoped to them", async () => {
    const a = await signedInUser("c4@example.com");
    await run(() => createTicketAction(form({ subject: "A", body: "a" })));

    h.store.clear();
    const b = await signedInUser("c5@example.com");
    await run(() => createTicketAction(form({ subject: "B", body: "b" })));

    expect(await prisma.ticket.count()).toBe(2);
    expect(await prisma.ticket.count({ where: { ownerId: a.id } })).toBe(1);
    expect(await prisma.ticket.count({ where: { ownerId: b.id } })).toBe(1);
  });
});
