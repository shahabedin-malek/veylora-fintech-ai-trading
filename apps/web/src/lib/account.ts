import { prisma } from "@/lib/db";
import { getCurrentUser, type SessionUser } from "@/lib/auth";

export interface AccountContext {
  user: SessionUser;
  wallet: {
    id: string;
    address: string;
    kind: string;
    balanceCents: number;
    /** An admin hold: movement out is frozen. The balance itself is untouched. */
    blocked: boolean;
    blockedReason: string | null;
  };
  notifications: { id: string; title: string; body: string; read: boolean; createdAt: Date }[];
  /** Coinbase webhook deliveries reconciled to this account (PHASE19-006). */
  coinbaseEvents: { id: string; eventType: string; status: string; receivedAt: Date }[];
}

/** Load everything a signed-in page needs, or null when signed out. */
export async function getAccountContext(): Promise<AccountContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const wallet = (await prisma.wallet.findUnique({ where: { userId: user.id } })) ??
    (await prisma.wallet.create({
      data: { userId: user.id, address: user.walletAddress, kind: "MAINNET", network: "mainnet", balanceCents: 0 },
    }));

  const [notifications, coinbaseEvents] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.webhookEvent.findMany({ where: { userId: user.id }, orderBy: { receivedAt: "desc" }, take: 6 }),
  ]);

  return { user, wallet, notifications, coinbaseEvents };
}
