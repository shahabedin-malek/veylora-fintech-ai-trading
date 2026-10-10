import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  braveWallet,
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  mainnet,
  sepolia,
} from "wagmi/chains";

/**
 * Wallet connection configuration.
 *
 * The three mainnet chains are open to everyone. The three practice chains are
 * offered too, but **only the site owner may actually sign in on one**: the server
 * refuses a practice chain for any other wallet (`verifySiweAction`), so offering the
 * chain to connect on does not grant a session. Nothing here executes anything; it
 * only declares which chains a wallet may connect on, and which wallets are offered.
 *
 * The wallet list is explicit rather than RainbowKit's `getDefaultConfig`, which
 * bundles connectors the project does not need (its Base Account connector pulls
 * in an optional SDK that is not installed and breaks the build).
 */
export const supportedChains = [
  mainnet,
  base,
  arbitrum,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
] as const;

/**
 * WalletConnect/Reown project IDs are public identifiers, not secrets.
 *
 * The WalletConnect connector is only offered when a real id is configured: with
 * a placeholder, Reown rejects the origin (403) and every page logs a console
 * error, which is worse than simply not offering mobile/QR wallets. Injected
 * browser wallets are always available.
 */
export const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";
export const walletConnectEnabled = walletConnectProjectId.trim().length > 0;

/** Satisfies RainbowKit's format validation when WalletConnect is not offered. */
const UNUSED_PROJECT_ID = "00000000000000000000000000000000";

export const APP_NAME = "Veylora Fintech AI Trading";

/**
 * Per-chain RPC endpoints.
 *
 * These are `NEXT_PUBLIC_*` on purpose: wagmi runs in the browser, so the URL is
 * part of the client bundle and is **public** — a hosted-RPC key used here can be
 * read by anyone. Restrict it at the provider (origin allowlist + rate limits)
 * rather than treating it as a secret. When unset, the chain falls back to
 * viem's default public RPC.
 *
 * Each read is written out longhand: the bundler only inlines a statically named
 * public environment read, never a computed lookup.
 */
const rpcEndpoints: Record<number, string | undefined> = {
  [mainnet.id]: process.env.NEXT_PUBLIC_WALLET_RPC_URL_ETHEREUM,
  [base.id]: process.env.NEXT_PUBLIC_WALLET_RPC_URL_BASE,
  [arbitrum.id]: process.env.NEXT_PUBLIC_WALLET_RPC_URL_ARBITRUM,
  [sepolia.id]: process.env.NEXT_PUBLIC_WALLET_RPC_URL_SEPOLIA,
  [baseSepolia.id]: process.env.NEXT_PUBLIC_WALLET_RPC_URL_BASE_SEPOLIA,
  [arbitrumSepolia.id]: process.env.NEXT_PUBLIC_WALLET_RPC_URL_ARBITRUM_SEPOLIA,
};

/** Configured RPC when present, otherwise viem's default public endpoint. */
function transportFor(chainId: number) {
  const url = rpcEndpoints[chainId];
  return url && url.trim() ? http(url) : http();
}

const injectedWallets = [
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  braveWallet,
  coinbaseWallet,
] as const;

const connectors = connectorsForWallets(
  [
    { groupName: "Recommended", wallets: [...injectedWallets] },
    ...(walletConnectEnabled
      ? [{ groupName: "More", wallets: [rainbowWallet, walletConnectWallet] }]
      : []),
  ],
  { appName: APP_NAME, projectId: walletConnectEnabled ? walletConnectProjectId : UNUSED_PROJECT_ID }
);

export const wagmiConfig = createConfig({
  connectors,
  chains: supportedChains,
  transports: {
    [mainnet.id]: transportFor(mainnet.id),
    [base.id]: transportFor(base.id),
    [arbitrum.id]: transportFor(arbitrum.id),
    [sepolia.id]: transportFor(sepolia.id),
    [baseSepolia.id]: transportFor(baseSepolia.id),
    [arbitrumSepolia.id]: transportFor(arbitrumSepolia.id),
  },
  ssr: true,
});
