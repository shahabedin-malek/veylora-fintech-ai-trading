/**
 * Site-owner allowlist.
 *
 * The owner is identified by **wallet address**, from `OWNER_WALLET_ADDRESSES`
 * (comma-separated, case-insensitive) — the same pattern as
 * `ADMIN_WALLET_ADDRESSES` in `src/lib/auth.ts`. An owner gets three things no
 * ordinary user does:
 *
 *   1. the CRM console (`/admin`), like any admin;
 *   2. the ability to **sign in on a practice network** (a non-mainnet chain),
 *      which is refused for everyone else; and
 *   3. an **owner-only practice-funds credit** — value with no real backing,
 *      credited to the owner's own account for testing (`isOwnerWallet` gates it).
 *
 * Nothing is hardcoded here on purpose: with the variable unset there is no owner,
 * and every owner-only path is unreachable. That keeps the default deployment safe
 * and the owner set an explicit operational choice.
 *
 * Framework-free so the server (sign-in validation, session reads, money paths) and
 * the tests share one definition that cannot drift.
 */

/** Lower-cased owner addresses from the environment (empty when unset). */
export function ownerWalletAddresses(): string[] {
  return (process.env.OWNER_WALLET_ADDRESSES ?? "")
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean);
}

/** Whether an address is the configured site owner. Nullish addresses are never owners. */
export function isOwnerWallet(address: string | null | undefined): boolean {
  if (!address) return false;
  return ownerWalletAddresses().includes(address.toLowerCase());
}
