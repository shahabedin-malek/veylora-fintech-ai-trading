"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { supportedChains } from "@/lib/wagmi";
import { useSiweSignIn } from "@/components/useSiweSignIn";

/**
 * Wallet sign-in.
 *
 * There is no email or password: connect a wallet and sign a one-time message.
 * The server issues the nonce, verifies the signature and opens the session. The
 * SIWE flow itself lives in `useSiweSignIn`, shared with `CoinbaseSignIn`.
 */
export function WalletSignIn() {
  const { isConnected, chainId } = useAccount();
  const { signIn, busy, error } = useSiweSignIn();

  const knownChain = supportedChains.some((c) => c.id === chainId);
  const network = supportedChains.find((c) => c.id === chainId);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <ConnectButton />

      {isConnected && !knownChain && (
        <p role="alert" className="neg" style={{ margin: 0, fontSize: 13 }}>
          This network is not supported. Switch to Ethereum, Base or Arbitrum.
        </p>
      )}

      {isConnected && knownChain && (
        <div className="grid" style={{ gap: 10 }}>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Connected on <strong>{network?.name}</strong>. Sign a message to finish signing in —
            it costs no gas and moves no funds.
          </p>
          <button
            className="btn primary"
            type="button"
            onClick={signIn}
            disabled={busy}
            style={{ opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Waiting for your wallet…" : "Sign in with wallet"}
          </button>
        </div>
      )}

      {!isConnected && (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Connect a browser wallet (MetaMask, Rabby, Coinbase, Brave…) or scan with WalletConnect.
        </p>
      )}

      {error && (
        <p role="alert" className="neg" style={{ margin: 0, fontSize: 13 }}>
          {error}
        </p>
      )}
    </div>
  );
}
