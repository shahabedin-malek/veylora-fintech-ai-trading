/**
 * Deterministic seeded accounts.
 *
 * Sign-in is wallet-based, so accounts are addresses rather than emails. The ids
 * and addresses are fixed so a session cookie can be minted for a known account
 * (e2e / live smoke tests) without first querying the database, and so the CRM
 * sample data is reproducible.
 *
 * These are throwaway addresses for local/CI data — never use them on mainnet.
 */
export const SEEDED_CHAIN_ID = 8453; // Base mainnet — public sign-in is mainnet-only

export interface SeededAccount {
  id: string;
  address: string;
  name: string;
  role: "USER" | "ADMIN";
}

export const SEEDED_ACCOUNTS: Record<"trader" | "admin", SeededAccount> = {
  trader: {
    id: "usr_veylora_trader",
    address: "0x1111111111111111111111111111111111111111",
    name: "Veylora Trader",
    role: "USER",
  },
  admin: {
    id: "usr_veylora_admin",
    address: "0x2222222222222222222222222222222222222222",
    name: "Support Admin",
    role: "ADMIN",
  },
};
