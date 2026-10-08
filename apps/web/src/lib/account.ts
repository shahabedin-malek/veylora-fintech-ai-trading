import { prisma } from "@/lib/db";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { deriveControls, type SessionStatus, type TradingControls } from "@/lib/domain/trading";
import { calculateWithdrawal, type WithdrawalBreakdown } from "@/lib/domain/withdrawal";
import { config } from "@/lib/config";

export interface AccountContext {
  user: SessionUser;
  wallet: { id: string; address: string; kind: string; balanceCents: number };
  session: { id: string; status: string; startedAt: Date | null; stoppedAt: Date | null; pnlCents: number; strategy: string } | null;
  controls: TradingControls;
  withdrawal: WithdrawalBreakdown;
  notifications: { id: string; title: string; body: string; read: boolean; createdAt: Date }[];
}

/** Load everything a signed-in page needs, or null when signed out. */
export async function getAccountContext(): Promise<AccountContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const wallet = (await prisma.wallet.findUnique({ where: { userId: user.id } })) ??
    (await prisma.wallet.create({ data: { userId: user.id, address: `sim_${user.id.slice(-8).toUpperCase()}`, kind: "SIMULATED", balanceCents: 0 } }));

  const session = await prisma.tradingSession.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const status: SessionStatus = session ? (session.status as SessionStatus) : "NONE";

  const controls = deriveControls(
    { loggedIn: true, balanceCents: wallet.balanceCents, sessionStatus: status },
    new Date(),
    session?.startedAt ?? null
  );

  const deposits = await prisma.ledgerEntry.aggregate({ where: { userId: user.id, type: "DEPOSIT" }, _sum: { amountCents: true } });
  const pnl = await prisma.ledgerEntry.aggregate({ where: { userId: user.id, type: "PAPER_PNL" }, _sum: { amountCents: true } });
  const withdrawal = calculateWithdrawal(deposits._sum.amountCents ?? 0, pnl._sum.amountCents ?? 0, config.withdrawFeeBps);

  const notifications = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 });

  return { user, wallet, session, controls, withdrawal, notifications };
}
