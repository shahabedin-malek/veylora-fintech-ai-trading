/**
 * Network classification — the single source of truth for which chain a wallet may
 * sign in on, and what that chain means.
 *
 * Two classes exist:
 *
 *   - **MAINNET** — a real network. A signed-in session on one of these runs real,
 *     custody-signed execution (gated by `src/lib/execution.ts`).
 *   - **SANDBOX** — a practice chain (a real test network). No real funds exist
 *     there. **Only the site owner may sign in on one**; everyone else is refused
 *     the same generic "unsupported network" message at sign-in (see
 *     `verifySiweAction`) and every session read re-checks ownership (see
 *     `getCurrentUser`), so a practice session cannot be forged into existence.
 *
 * Deliberately dependency-free and framework-free: the same mapping is used by the
 * server (session, sign-in validation), the wallet UI and the tests. Nothing here
 * imports wagmi/RainbowKit, so it stays cheap to import anywhere — and a mapping that
 * could drift from the offered chains would defeat the purpose.
 *
 * Note: this classifies. It does **not** enable anything by itself — the execution
 * gate that consumes it still requires configured custody and a clear kill switch
 * before a real money action runs, and a practice class never reaches a real path.
 */

export type NetworkClass = "MAINNET" | "SANDBOX";

export interface SupportedNetwork {
  chainId: number;
  /** Display name; matches the corresponding viem chain definition. */
  name: string;
  class: NetworkClass;
}

/** Chains any wallet may connect and sign in on. Every one is a real mainnet. */
export const SUPPORTED_NETWORKS: readonly SupportedNetwork[] = [
  { chainId: 1, name: "Ethereum", class: "MAINNET" },
  { chainId: 8453, name: "Base", class: "MAINNET" },
  { chainId: 42161, name: "Arbitrum One", class: "MAINNET" },
];

/**
 * Practice chains. They are real test networks — there are no real funds on them —
 * and they are **owner-only**: sign-in validates ownership before a session is
 * issued, and `getCurrentUser` refuses a practice session for a non-owner.
 */
export const PRACTICE_NETWORKS: readonly SupportedNetwork[] = [
  { chainId: 11155111, name: "Sepolia", class: "SANDBOX" },
  { chainId: 84532, name: "Base Sepolia", class: "SANDBOX" },
  { chainId: 421614, name: "Arbitrum Sepolia", class: "SANDBOX" },
];

/** Everything the app knows how to classify. The wallet UI offers all of these. */
export const ALL_NETWORKS: readonly SupportedNetwork[] = [
  ...SUPPORTED_NETWORKS,
  ...PRACTICE_NETWORKS,
];

const BY_CHAIN_ID = new Map<number, SupportedNetwork>(
  ALL_NETWORKS.map((network) => [network.chainId, network])
);

/** The known network for a chain id, or null if it is not offered. */
export function supportedNetwork(chainId: number): SupportedNetwork | null {
  return BY_CHAIN_ID.get(chainId) ?? null;
}

export function isSupportedChainId(chainId: number): boolean {
  return BY_CHAIN_ID.has(chainId);
}

/**
 * The execution class for a chain id.
 *
 * Returns `null` for anything unknown — deliberately *not* a default class, so
 * every caller has to decide explicitly what to do about an unknown chain instead of
 * silently treating it as usable.
 */
export function networkClassForChainId(chainId: number): NetworkClass | null {
  return BY_CHAIN_ID.get(chainId)?.class ?? null;
}

/** Whether a chain is a real mainnet (the only class that can move real funds). */
export function isMainnetChainId(chainId: number): boolean {
  return BY_CHAIN_ID.get(chainId)?.class === "MAINNET";
}

/** Honest, non-promotional wording for a network. */
export function networkModeLabel(chainId: number): string {
  const network = supportedNetwork(chainId);
  if (!network) return "unsupported network";
  return network.class === "MAINNET"
    ? `${network.name} · mainnet — real funds`
    : `${network.name} · practice network — no real funds`;
}
