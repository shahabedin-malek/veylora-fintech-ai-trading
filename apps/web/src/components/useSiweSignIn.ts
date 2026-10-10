"use client";

import { useCallback, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { SIWE_STATEMENT, buildSiweMessage } from "@/lib/eip4361";
import { requestNonceAction, verifySiweAction } from "@/lib/actions";

/**
 * The browser half of SIWE sign-in, shared by every wallet entry point.
 *
 * Connect-a-wallet and Sign-in-with-Coinbase both end in the same three steps —
 * request a nonce, sign the EIP-4361 message, verify it server-side — so the flow
 * lives here once. A caller that already knows the signer (e.g. just returned from
 * `connectAsync`) passes it explicitly via `signInWith`, which avoids racing the
 * `useAccount` re-render.
 */
export function useSiweSignIn() {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWith = useCallback(
    async (signerAddress: `0x${string}`, signerChainId: number) => {
      setBusy(true);
      setError(null);
      try {
        const nonce = await requestNonceAction();
        if ("error" in nonce) {
          setError(nonce.error);
          return;
        }

        const message = buildSiweMessage({
          domain: window.location.host,
          address: signerAddress,
          statement: SIWE_STATEMENT,
          uri: window.location.origin,
          chainId: signerChainId,
          nonce: nonce.nonce,
        });

        const signature = await signMessageAsync({ message });
        const result = await verifySiweAction({ message, signature });
        // On success the action redirects; a returned error state means it did not.
        if (result?.error) setError(result.error);
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        // A successful server action redirect surfaces as NEXT_REDIRECT — not an error.
        if (!text.includes("NEXT_REDIRECT")) {
          setError("Sign-in did not complete. Please try again.");
        }
      } finally {
        setBusy(false);
      }
    },
    [signMessageAsync]
  );

  /** Sign in with the currently connected account. */
  const signIn = useCallback(async () => {
    if (!address || chainId === undefined) return;
    await signInWith(address, chainId);
  }, [address, chainId, signInWith]);

  return { signIn, signInWith, busy, error, setError, address, chainId };
}
