"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireAdmin, requireUser, hashPassword, verifyPassword } from "@/lib/auth";
import { setSessionCookie, clearSessionCookie } from "@/lib/session";
import { usdToCents } from "@/lib/domain/money";
import { MIN_TRADE_CENTS, config } from "@/lib/config";
import { calculateWithdrawal } from "@/lib/domain/withdrawal";
import { deriveControls, type SessionStatus } from "@/lib/domain/trading";

export type FormState = { error?: string; ok?: string } | undefined;

// ---------------------------------------------------------------- helpers

async function getOrCreateWallet(userId: string) {
  const existing = await prisma.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  const suffix = userId.slice(-8).toUpperCase();
  return prisma.wallet.create({
    data: { userId, address: `sim_${suffix}`, kind: "SIMULATED", network: "simulated", balanceCents: 0 },
  });
}

async function currentTradingContext(userId: string) {
  const wallet = await getOrCreateWallet(userId);
  const session = await prisma.tradingSession.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const status: SessionStatus = session ? (session.status as SessionStatus) : "NONE";
  return { wallet, session, status };
}

function simulatedPnlCents(userId: string, elapsedMs: number): number {
  // Deterministic pseudo-P/L for illustrative purposes. Clearly simulated.
  const minutes = Math.max(1, elapsedMs / 60_000);
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  const bias = ((h % 200) - 100) / 100; // -1 .. 1
  const magnitude = Math.min(1.0, minutes / 30);
  return Math.round(bias * magnitude * 800); // up to ±$8
}

// ---------------------------------------------------------------- auth

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim() || "New user";
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  const user = await prisma.user.create({
    data: { email, name, passwordHash: hashPassword(password), role: "USER" },
  });
  await prisma.customer.create({ data: { userId: user.id, name, email } });
  await getOrCreateWallet(user.id);
  await setSessionCookie(user.id);
  redirect("/dashboard");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Email and password are required." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Invalid email or password." };
  }
  await setSessionCookie(user.id);
  redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/");
}

// ---------------------------------------------------------------- funds

export async function depositAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const usd = Number(formData.get("amount"));
  if (!Number.isFinite(usd) || usd <= 0) return;
  const cents = usdToCents(usd);
  const wallet = await getOrCreateWallet(user.id);
  await prisma.$transaction([
    prisma.wallet.update({ where: { id: wallet.id }, data: { balanceCents: { increment: cents } } }),
    prisma.ledgerEntry.create({ data: { userId: user.id, type: "DEPOSIT", amountCents: cents, note: "Simulated deposit" } }),
    prisma.transaction.create({ data: { userId: user.id, kind: "DEPOSIT", amountCents: cents, status: "COMPLETED", detail: "Simulated deposit" } }),
    prisma.notification.create({ data: { userId: user.id, title: "Deposit received", body: `Simulated deposit of $${usd.toFixed(2)} credited.` } }),
  ]);
  revalidatePath("/wallet");
  revalidatePath("/dashboard");
}

export async function withdrawAction(): Promise<void> {
  const user = await requireUser();
  const { wallet, session } = await currentTradingContext(user.id);
  const controls = deriveControls({ loggedIn: true, balanceCents: wallet.balanceCents, sessionStatus: session ? (session.status as SessionStatus) : "NONE" });
  if (!controls.withdraw) return;

  const deposits = await prisma.ledgerEntry.aggregate({ where: { userId: user.id, type: "DEPOSIT" }, _sum: { amountCents: true } });
  const pnl = await prisma.ledgerEntry.aggregate({ where: { userId: user.id, type: "PAPER_PNL" }, _sum: { amountCents: true } });
  const initial = deposits._sum.amountCents ?? 0;
  const pnlCents = pnl._sum.amountCents ?? 0;
  const b = calculateWithdrawal(initial, pnlCents, config.withdrawFeeBps);
  if (b.totalCents <= 0) return;

  await prisma.$transaction([
    prisma.wallet.update({ where: { id: wallet.id }, data: { balanceCents: 0 } }),
    prisma.ledgerEntry.create({ data: { userId: user.id, type: "WITHDRAWAL", amountCents: -b.totalCents, note: "Simulated withdrawal" } }),
    prisma.ledgerEntry.create({ data: { userId: user.id, type: "FEE", amountCents: -b.feeCents, note: `Simulated platform fee (${b.feeBps / 100}%)` } }),
    prisma.transaction.create({ data: { userId: user.id, kind: "WITHDRAWAL", amountCents: b.totalCents, status: "COMPLETED", detail: `Simulated withdrawal (fee $${(b.feeCents / 100).toFixed(2)})` } }),
    prisma.notification.create({ data: { userId: user.id, title: "Withdrawal processed", body: `Simulated withdrawal of $${(b.totalCents / 100).toFixed(2)}.` } }),
  ]);
  revalidatePath("/wallet");
  revalidatePath("/history");
}

// ---------------------------------------------------------------- trading

export async function startTradingAction(): Promise<void> {
  const user = await requireUser();
  const { wallet, session } = await currentTradingContext(user.id);
  if (wallet.balanceCents < MIN_TRADE_CENTS) return;
  if (session?.status === "ACTIVE") return;

  const target = session ?? (await prisma.tradingSession.create({ data: { userId: user.id, status: "IDLE" } }));
  await prisma.$transaction([
    prisma.tradingSession.update({ where: { id: target.id }, data: { status: "ACTIVE", startedAt: new Date(), stoppedAt: null } }),
    prisma.tradeEvent.create({ data: { sessionId: target.id, kind: "SCAN", message: "Looking for opportunities… (simulated)" } }),
    prisma.tradeEvent.create({ data: { sessionId: target.id, kind: "ANALYZE", message: "Scanning supported markets… (simulated)" } }),
    prisma.tradeEvent.create({ data: { sessionId: target.id, kind: "INFO", message: "Paper trading started — no real funds at risk." } }),
  ]);
  revalidatePath("/trade");
  revalidatePath("/dashboard");
}

export async function stopTradingAction(formData?: FormData): Promise<void> {
  const user = await requireUser();
  const { wallet, session } = await currentTradingContext(user.id);
  if (!session || session.status !== "ACTIVE") return;

  const now = new Date();
  const started = session.startedAt ?? now;
  const elapsed = now.getTime() - started.getTime();
  const force = formData ? formData.get("force") === "1" : false;
  if (elapsed < config.stopWarningMs && !force) return; // UI requires the warning/force step

  const pnl = simulatedPnlCents(user.id, elapsed);
  await prisma.$transaction([
    prisma.tradingSession.update({ where: { id: session.id }, data: { status: "STOPPED", stoppedAt: now, pnlCents: { increment: pnl } } }),
    prisma.tradeEvent.create({ data: { sessionId: session.id, kind: "CLOSE", message: `Paper trading stopped after ${Math.round(elapsed / 1000)}s (simulated P/L $${(pnl / 100).toFixed(2)}).` } }),
    prisma.ledgerEntry.create({ data: { userId: user.id, type: "PAPER_PNL", amountCents: pnl, note: "Simulated paper trading result" } }),
    prisma.wallet.update({ where: { id: wallet.id }, data: { balanceCents: { increment: pnl } } }),
    prisma.notification.create({ data: { userId: user.id, title: "Trading stopped", body: "Trading session stopped. Withdrawal is now available." } }),
  ]);
  revalidatePath("/trade");
  revalidatePath("/wallet");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------- CRM

export async function createTicketAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!subject || !body) return;

  const customer = (await prisma.customer.findUnique({ where: { userId: user.id } })) ??
    (await prisma.customer.create({ data: { userId: user.id, name: user.name, email: user.email } }));

  const count = await prisma.ticket.count();
  const ticket = await prisma.ticket.create({
    data: {
      number: `TCK-${1001 + count}`,
      customerId: customer.id,
      ownerId: user.id,
      subject,
      status: "OPEN",
      priority: "NORMAL",
      messages: { create: { authorId: user.id, body } },
    },
  });
  await prisma.auditLog.create({ data: { actorId: user.id, action: "ticket.created", subject: ticket.number, detail: subject } });
  revalidatePath("/support");
  revalidatePath("/admin");
  redirect(`/support?ticket=${ticket.id}`);
}

export async function sendTicketMessageAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!ticketId || !body) return;
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.ownerId !== user.id) return;
  await prisma.ticketMessage.create({ data: { ticketId, authorId: user.id, body, internal: false } });
  await prisma.ticket.update({ where: { id: ticketId }, data: { status: "OPEN", updatedAt: new Date() } });
  revalidatePath("/support");
}

export async function adminUpdateTicketAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const ticketId = String(formData.get("ticketId") || "");
  const status = String(formData.get("status") || "");
  const priority = String(formData.get("priority") || "");
  const assigneeId = String(formData.get("assigneeId") || "");
  const body = String(formData.get("body") || "").trim();
  const internal = formData.get("internal") === "on";

  const data: Record<string, unknown> = {};
  if (status) data.status = status;
  if (priority) data.priority = priority;
  if (assigneeId) data.assigneeId = assigneeId === "none" ? null : assigneeId;

  if (body) {
    await prisma.ticketMessage.create({ data: { ticketId, authorId: admin.id, body, internal } });
    if (!internal) data.status = status || "PENDING";
  }
  await prisma.ticket.update({ where: { id: ticketId }, data: { ...data, updatedAt: new Date() } });
  await prisma.auditLog.create({ data: { actorId: admin.id, action: "ticket.updated", subject: ticketId, detail: JSON.stringify(data) } });
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin");
}
