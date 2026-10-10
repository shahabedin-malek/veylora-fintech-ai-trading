"use client";

import { useAccount, useConnect } from "wagmi";
import { COINBASE_LOGIN_COPY, isCoinbaseConnector } from "@/lib/coinbase/login";
import { useSiweSignIn } from "@/components/useSiweSignIn";

/**
 * One-click "Sign in with Coinbase" (`PHASE19-002`).
 *
 * Connects the Coinbase Wallet connector (browser extension, mobile or embedded)
 * and then runs the **same** SIWE verification every other wallet uses — so
 * Coinbase sign-in produces an ordinary wallet session and the chain it signed on
 * still decides real-vs-practice. No separate account, no schema change.
 *
 * If the connector is unavailable the component renders nothing, matching the
 * fail-closed pattern used elsewhere (an entry point that cannot work is absent,
 * not throwing).
 */
export function CoinbaseSignIn() {
  const { connectors, connectAsync } = useConnect();
  const { address, chainId, connector } = useAccount();
  const { signInWith, busy, error, setError } = useSiweSignIn();

  const coinbase = connectors.find(isCoinbaseConnector);
  if (!coinbase) return null;

  async function handleClick() {
    if (busy) return;
    setError(null);
    try {
      // Already on Coinbase — just sign. Re-connecting an active connector throws.
      if (connector && isCoinbaseConnector(connector) && address && chainId !== undefined) {
        await signInWith(address, chainId);
        return;
      }
      const result = await connectAsync({ connector: coinbase! });
      const account = result.accounts[0];
      const connectedChainId = result.chainId ?? chainId;
      if (!account || connectedChainId === undefined) {
        setError("Coinbase did not return an account. Please try again.");
        return;
      }
      await signInWith(account, connectedChainId);
    } catch {
      setError("Could not connect to Coinbase. Please try again.");
    }
  }

  return (
    <div className="grid" style={{ gap: 8 }}>
      <button className="btn" type="button" onClick={handleClick} disabled={busy}>
        {busy ? COINBASE_LOGIN_COPY.connecting : COINBASE_LOGIN_COPY.button}
      </button>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        {COINBASE_LOGIN_COPY.help}
      </p>
      {error && (
        <p role="alert" className="neg" style={{ margin: 0, fontSize: 13 }}>
          {error}
        </p>
      )}
    </div>
  );
}
