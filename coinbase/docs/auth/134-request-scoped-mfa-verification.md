> Coinbase CDP docs — **auth** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Request-scoped MFA Verification

> Bind each MFA approval to one specific sign or send request instead of a time-windowed session.

export const Tags = ({tags, className}) => {
  if (!tags || !Array.isArray(tags)) {
    return null;
  }
  return <div className={`mt-5 mb-5 flex flex-row flex-wrap gap-2 ${className}`}>
      {tags.map((tag, index) => <span key={index} className="text-sm text-[#733E00] dark:text-yellow-500 bg-[#FFFCF1] dark:bg-yellow-500/10 font-semibold px-2 py-1 rounded-lg">{tag}</span>)}
    </div>;
};

<Tags tags={["EVM", "Solana", "User Wallet"]} />

## Overview

By default, one MFA verification begins a session that authorizes every [protected operation](/wallets/authentication/mfa/protected-operations) until the session expires.

Request-scoped verification replaces the window with a challenge binding. Each approval authorizes exactly one request. CDP's API associates a specific request with a challenge, the user approves that specific request, and resubmission of that initial request consumes the approval.

<Note>
  Request-scoped verification is opt-in per project. Projects that do not opt in keep session-based verification with no change.
</Note>

## Project configuration

Enable the `Request` verification scope in the [CDP Portal](https://portal.cdp.coinbase.com/wallets/non-custodial/authentication).

Resetting the scope back to `Session` restores the default behavior.

<Warning>
  Switching from `Session` to `Request` revokes every outstanding verified session immediately. Users with an active session must verify again on their next protected operation. Switching from `Request` to `Session` revokes nothing.
</Warning>

## How it works

Under `Request` scope, a protected operation that lacks an approval is rejected with `403 mfa_required`. The rejection carries an `X-Mfa-Challenge-Id` response header that identifies a pending challenge for that exact request.

<Steps>
  <Step title="Register an MFA listener">
    Register a listener before any protected call. Under `Request` scope the challenge only exists once the server has rejected a call, so the SDK cannot prompt ahead of time. A protected call with no listener registered fails with the `LISTENER_REQUIRED` MFA error instead.
  </Step>

  <Step title="Call the protected operation">
    Call a protected operation such as `sendEvmTransaction`. The request shape is unchanged.
  </Step>

  <Step title="Receive the challenge">
    The server rejects the call with `403 mfa_required` and an `X-Mfa-Challenge-Id` header. The SDK holds that challenge and invokes your listener with it as `challengeId` on the listener context.
  </Step>

  <Step title="Verify">
    For TOTP or SMS, call `initiateMfaVerification` and then `submitMfaVerification` with the user's code. Both accept the `challengeId` from the listener context, and both fall back to the held challenge when you omit it.

    Passkey works differently. `verifyPasskey` runs the full WebAuthn ceremony in one call, and the assertion is cryptographically bound to the approved request. Do not pass a passkey assertion to `submitMfaVerification`.
  </Step>

  <Step title="Let the SDK replay the request">
    A successful verification releases the original call, which the SDK replays unchanged. The CDP API consumes the approval and the call proceeds. Do not retry it yourself.
  </Step>
</Steps>

### TOTP and SMS

<Tabs>
  <Tab title="React hooks">
    `useRegisterMfaListener` receives the challenge, and the protected action's own promise resolves once verification completes. There is no `mfa_required` error to catch and no request to resubmit.

    ```tsx theme={null}
    import { useState } from "react";
    import {
      useCancelMfaVerification,
      useInitiateMfaVerification,
      useRegisterMfaListener,
      useSendEvmTransaction,
      useSubmitMfaVerification,
    } from "@coinbase/cdp-hooks";
    import type { SendEvmTransactionOptions } from "@coinbase/cdp-core";

    function SendWithMfa({ transaction }: { transaction: SendEvmTransactionOptions }) {
      const [challengeId, setChallengeId] = useState<string>();
      const [mfaCode, setMfaCode] = useState("");
      const [error, setError] = useState<string>();
      const { sendEvmTransaction } = useSendEvmTransaction();
      const { initiateMfaVerification } = useInitiateMfaVerification();
      const { submitMfaVerification } = useSubmitMfaVerification();
      const { cancelMfaVerification } = useCancelMfaVerification();

      useRegisterMfaListener(async context => {
        try {
          await initiateMfaVerification({ mfaMethod: "totp", challengeId: context.challengeId });
          setChallengeId(context.challengeId);
        } catch {
          // Nothing awaits the listener, so release the waiting call yourself.
          cancelMfaVerification();
        }
      });

      async function handleSend() {
        setError(undefined);
        try {
          // Resolves once MFA is verified and the SDK has replayed the request.
          const { transactionHash } = await sendEvmTransaction(transaction);
          console.log(transactionHash);
        } catch (sendError) {
          // Also rejects when the user cancels or a wrong code burns the challenge.
          setError(String(sendError));
        }
      }

      async function handleVerify() {
        try {
          await submitMfaVerification({ mfaMethod: "totp", mfaCode, challengeId });
        } catch (submitError) {
          setError(String(submitError));
        } finally {
          // The challenge is spent either way, so drop it and let the user start over.
          setChallengeId(undefined);
          setMfaCode("");
        }
      }

      if (!challengeId) {
        return (
          <>
            {error && <p role="alert">{error}</p>}
            <button onClick={handleSend}>Send</button>
          </>
        );
      }

      return (
        <>
          <input value={mfaCode} onChange={event => setMfaCode(event.target.value)} />
          <button onClick={handleVerify}>Verify</button>
        </>
      );
    }
    ```

    For SMS, pass `mfaMethod: "sms"` to both calls. The initiate call sends the code.

    A wrong code is terminal under `Request` scope. It consumes the challenge server-side, rejects `submitMfaVerification`, and rejects the `sendEvmTransaction` promise that was waiting on it. Handle both rejections, clear your local `challengeId`, and send the user back to a fresh protected call. Resubmitting against the spent challenge fails with `mfa_flow_expired`.
  </Tab>

  <Tab title="Core SDK">
    ```typescript theme={null}
    import {
      cancelMfaVerification,
      initiateMfaVerification,
      registerMfaListener,
      sendEvmTransaction,
      submitMfaVerification,
    } from "@coinbase/cdp-core";

    registerMfaListener(async ({ challengeId }) => {
      try {
        await initiateMfaVerification({ mfaMethod: "totp", challengeId });
        const mfaCode = await promptUserForCode();
        await submitMfaVerification({ mfaMethod: "totp", mfaCode, challengeId });
      } catch {
        // Nothing awaits the listener, so release the waiting call yourself.
        cancelMfaVerification();
      }
    });

    try {
      // Resolves once MFA is verified and the SDK has replayed the request.
      const { transactionHash } = await sendEvmTransaction(request);
      console.log(transactionHash);
    } catch (error) {
      // The user cancelled, or a wrong code burned the challenge. Start over from here.
      console.error(error);
    }
    ```

    `registerMfaListener` returns an unregister function. Call it when the surface that owns the verification UI goes away.
  </Tab>
</Tabs>

### Passkey

Passkey verification needs a user gesture, so the listener records the challenge and renders a button rather than starting the ceremony itself.

<Tabs>
  <Tab title="React hooks">
    Await `verifyPasskeyAsync`, not `verifyPasskey`. The latter resolves even on a cancelled prompt, which would clear your verification UI while the original call is still waiting.

    ```tsx theme={null}
    import { useState } from "react";
    import {
      useRegisterMfaListener,
      useSendEvmTransaction,
      useVerifyPasskey,
    } from "@coinbase/cdp-hooks";
    import type { SendEvmTransactionOptions } from "@coinbase/cdp-core";

    function SendWithPasskeyMfa({ transaction }: { transaction: SendEvmTransactionOptions }) {
      const [challengeId, setChallengeId] = useState<string>();
      const { sendEvmTransaction } = useSendEvmTransaction();
      const { verifyPasskeyAsync, status } = useVerifyPasskey();

      useRegisterMfaListener(context => setChallengeId(context.challengeId));

      async function handleSend() {
        try {
          const { transactionHash } = await sendEvmTransaction(transaction);
          console.log(transactionHash);
        } catch (error) {
          // Rejects when the user cancels verification.
          console.error(error);
        }
      }

      async function handleVerify() {
        try {
          await verifyPasskeyAsync({ challengeId });
          setChallengeId(undefined);
        } catch {
          // The user cancelled or the ceremony failed. Let them try again.
        }
      }

      if (!challengeId) return <button onClick={handleSend}>Send</button>;

      return (
        <button onClick={handleVerify} disabled={status === "pending"}>
          Verify with passkey
        </button>
      );
    }
    ```
  </Tab>

  <Tab title="Core SDK">
    ```typescript theme={null}
    import { registerMfaListener, sendEvmTransaction, verifyPasskey } from "@coinbase/cdp-core";

    registerMfaListener(({ challengeId }) => {
      // The browser blocks the credential prompt outside a user gesture.
      showVerifyButton(() => verifyPasskey({ challengeId }));
    });

    const { transactionHash } = await sendEvmTransaction(request);
    ```
  </Tab>
</Tabs>

<Tip>
  `CDPReactProvider` registers a global MFA listener and renders the `VerifyMfa` modal for you, so the whole flow above runs with no wiring. Reach for a listener of your own when you want custom verification UI, and set `mfa.disableAutoPrompt` on the provider config to suppress the built-in modal.
</Tip>

## Security properties

### One approval, one request

An approval is bound to the digest of the approved request and is consumed on use. There is no window and no reuse:

* Approving a `signEvmTransaction` call does not approve a `sendEvmTransaction` call, even with an identical body.
* Approving a transfer of 25 USDC does not approve a transfer of 25,000 USDC.
* Retrying after a consumed approval starts a new challenge and requires a new verification.

### A failed code burns the challenge

Each challenge accepts one verification attempt. A wrong TOTP or SMS code deletes the challenge, so the next attempt must start over from the 403. Slow online guessing is further limited by the challenge lifetime.

### Passkey binds cryptographically; TOTP and SMS bind server-side

The binding strength depends on the method:

* **Passkey**: the WebAuthn challenge is derived from the approved request digest and the challenge ID. That value travels in `clientDataJSON`, which the credential signature covers, so the assertion is cryptographically bound to one request. A verifier holding the request and the challenge ID can recompute the value and check the signature against it, without trusting CDP's record of the association.
* **TOTP and SMS**: the code proves possession of the factor, and the server ties the verification to the request digest. The binding exists only in server state, so verifying it means trusting that state.

The authenticator signs an opaque digest. It does not parse or display the request, so the description the user approves comes from your UI rather than from the device. Show the user what they are about to authorize before you start the ceremony.

TOTP and SMS are weaker than passkey under `Request` scope. Require passkey when you need evidence, checkable after the fact, that a user authorized one specific request.

### Sessions are revoked when you harden

Setting `verificationScope` from `session` to `request` deletes every outstanding verified session for the project at the moment of the change. A session verified before the change cannot be spent after it.

## Troubleshooting

<AccordionGroup>
  <Accordion title="mfa_flow_expired on submit">
    The challenge is unknown, expired, or already spent. Challenges expire after 5 minutes and are deleted after a failed code. Restart the flow from the original protected call to receive a fresh `X-Mfa-Challenge-Id`.
  </Accordion>

  <Accordion title="403 mfa_required immediately after a successful verification">
    The retried request does not match the approved request. The digest covers the method, path, query string, and body, so any change, including reordered or reformatted fields that change the semantic body, misses the approval. Retry with the identical request.
  </Accordion>

  <Accordion title="initiateMfaVerification rejects with invalid_request">
    Under `Request` scope, initiate and submit must carry the challenge from the 403 response. Confirm the SDK version supports request-scoped verification and that your listener passes its `challengeId` through, or leaves it out so the SDK supplies the held challenge.
  </Accordion>
</AccordionGroup>

## What to read next

<CardGroup cols={2}>
  <Card title="Overview" icon="shield-check" href="/wallets/authentication/mfa/overview">
    How MFA works and how sessions behave by default
  </Card>

  <Card title="MFA Prompts" icon="key" href="/wallets/authentication/mfa/verification">
    Handle verification prompts with components, hooks, or the Core SDK
  </Card>

  <Card title="Passkeys" icon="fingerprint" href="/wallets/authentication/mfa/passkeys">
    Enable passkey MFA for cryptographic per-request binding
  </Card>

  <Card title="Customizing Triggers" icon="sliders" href="/wallets/authentication/mfa/protected-operations">
    Which operations require MFA and how to customize prompts
  </Card>
</CardGroup>
