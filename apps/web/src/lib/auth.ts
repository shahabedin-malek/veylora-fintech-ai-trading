import { prisma } from "@/lib/db";
import { getSessionMode } from "@/lib/session";
import { isOwnerWallet } from "@/lib/owner";
import type { NetworkClass } from "@/lib/network";

/**
 * Wallet authentication.
 *
 * There is no email or password: a user *is* their wallet address. The address is
 * only ever trusted after `verifySiwe` has verified a signature over a nonce this
 * server issued — see `src/lib/siwe.ts`.
 *
 * The app is mainnet-only: a wallet signs in on a real chain and the account's balance
 * is a real ledger, credited by reconciled deposits and debited by real withdrawals and
 * trades. See `docs/NETWORK_BOUNDARY.md`.
 */

export interface SessionUser {
  id: string;
  walletAddress: string;
  name: string;
  role: string;
  /** Chain the current session signed in on. */
  chainId: number;
  /**
   * Execution class for that chain, derived server-side on every request.
   * `MAINNET` means real execution, gated by custody + the kill switch — see
   * docs/NETWORK_BOUNDARY.md.
   */
  network: NetworkClass;
  /**
   * Whether this wallet is the configured site owner (`OWNER_WALLET_ADDRESSES`).
   * Owners are always ADMIN and are the only accounts allowed a practice session.
   */
  isOwner: boolean;
}

/** Addresses granted ADMIN by configuration (comma-separated, case-insensitive). */
export function adminWalletAddresses(): string[] {
  return (process.env.ADMIN_WALLET_ADDRESSES ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
}

/** Env allowlist wins (owner or admin); otherwise an existing ADMIN role is preserved. */
export function roleForWallet(address: string, currentRole?: string): string {
  if (isOwnerWallet(address)) return "ADMIN";
  if (adminWalletAddresses().includes(address.toLowerCase())) return "ADMIN";
  return currentRole === "ADMIN" ? "ADMIN" : "USER";
}

/**
 * Whether a wallet address belongs to a **banned** account.
 *
 * A ban stops access: the address is refused at sign-in and every request it holds a
 * session for is treated as signed out. It is deliberately *only* an access control — a
 * ban does not move, take or forfeit the balance. Funds are frozen separately (`Wallet.blocked`)
 * and an admin can lift either, which is what keeps "we stopped them" and "we took their
 * money" from being the same action.
 */
export async function isWalletBanned(address: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { walletAddress: address.toLowerCase() },
    select: { banned: true },
  });
  return Boolean(user?.banned);
}

/** A readable fallback name until the user has one of their own. */
export function walletDisplayName(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Finds or creates the account for a verified wallet address and records the
 * chain it signed in on. A brand-new address gets a customer record (so the CRM
 * works) and a wallet.
 */
export async function signInWithWallet(address: string, chainId: number) {
  const wallet = address.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { walletAddress: wallet } });
  const role = roleForWallet(wallet, existing?.role);

  if (existing) {
    return prisma.user.update({ where: { id: existing.id }, data: { chainId, role } });
  }

  const name = walletDisplayName(wallet);
  return prisma.user.create({
    data: {
      walletAddress: wallet,
      chainId,
      name,
      role,
      customer: { create: { name } },
      // A real account balance, credited by reconciled deposits and debited by real
      // withdrawals and trades.
      wallet: {
        create: { address: wallet, kind: "MAINNET", network: "mainnet", balanceCents: 0 },
      },
    },
  });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  // getSessionMode fails closed for an unsupported chain, so a stale or forged
  // chain id cannot yield a session with an ambiguous class.
  const mode = await getSessionMode();
  if (!mode) return null;

  const user = await prisma.user.findUnique({
    where: { id: mode.userId },
    select: { id: true, walletAddress: true, name: true, role: true, banned: true },
  });
  if (!user) return null;
  // A banned account is *signed out*, everywhere, immediately — a ban that only blocked
  // sign-in would leave every already-issued session working until it expired.
  if (user.banned) return null;

  const isOwner = isOwnerWallet(user.walletAddress);
  // Defense in depth: a practice class is owner-only. Sign-in already refuses it for
  // a non-owner, so this only matters for a session that was minted by some other
  // path — and it fails closed (the caller sees "signed out") rather than granting a
  // practice session to an ordinary account.
  if (mode.network === "SANDBOX" && !isOwner) return null;

  return { ...user, chainId: mode.chainId, network: mode.network, isOwner };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}
