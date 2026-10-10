> Coinbase CDP docs — **auth** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Handling MFA Prompts

export const Tags = ({tags, className}) => {
  if (!tags || !Array.isArray(tags)) {
    return null;
  }
  return <div className={`mt-5 mb-5 flex flex-row flex-wrap gap-2 ${className}`}>
      {tags.map((tag, index) => <span key={index} className="text-sm text-[#733E00] dark:text-yellow-500 bg-[#FFFCF1] dark:bg-yellow-500/10 font-semibold px-2 py-1 rounded-lg">{tag}</span>)}
    </div>;
};

<Tags tags={["EVM", "Solana", "User Wallet"]} />

After users enroll in MFA, they'll see a prompt to enter their code whenever they perform sensitive operations like signing transactions or exporting keys. This page covers how to handle those prompts.

<Tip>
  **Using `CDPReactProvider`?** Verification is automatic—the SDK shows an MFA modal when needed. You only need this page if you want custom UI or are using the Core SDK directly.
</Tip>

## Choose your approach

<CardGroup cols={3}>
  <Card title="Pre-built components" icon="puzzle-piece" href="#ready-to-use-components-recommended">
    Drop-in React modals and inline UI. **Best for most apps.**
  </Card>

  <Card title="React hooks" icon="code" href="#custom-uis-using-react-hooks">
    Build custom verification UI. **For full control over the verification flow.**
  </Card>

  <Card title="Core SDK" icon="terminal" href="#direct-api-calls-for-non-react">
    Direct API calls. **For non-React apps.**
  </Card>
</CardGroup>

### Ready-to-use components (recommended)

[`@coinbase/cdp-react`](/wallets/client-side-development/react-components) provides ready-to-use components with a polished UI.

<Note>
  Pre-built components support TOTP (authenticator apps), SMS, and passkey verification. When a user has multiple methods enrolled, the component shows a method selector automatically. Passkey appears only in web environments where the browser supports WebAuthn.
</Note>

<Tabs>
  <Tab title="Modal">
    ```tsx theme={null}
    import { VerifyMfaModal } from "@coinbase/cdp-react";

    function App() {
      return (
        <VerifyMfaModal
          onSuccess={() => console.log("Verified!")}
          onCancel={() => console.log("Cancelled")}
        >
          <button>Verify MFA</button>
        </VerifyMfaModal>
      );
    }
    ```
  </Tab>

  <Tab title="Programmatic">
    Use `useVerifyMfaModal` when you need to trigger verification from code. Call `open()` to show the modal; it closes automatically on success.

    ```tsx theme={null}
    import { useVerifyMfaModal } from "@coinbase/cdp-react";

    function ProtectedAction() {
      const { open } = useVerifyMfaModal({
        onSuccess: () => {
          console.log("Verified!");
          performSensitiveAction();
        },
        onCancel: () => console.log("Cancelled"),
      });

      return <button onClick={open}>Perform Sensitive Action</button>;
    }
    ```
  </Tab>

  <Tab title="Inline">
    Use `VerifyMfaInline` for step-by-step flows like wallet export where you want verification embedded in the page rather than a modal.

    ```tsx theme={null}
    import { VerifyMfaInline, VerifyMfaInlineFlow } from "@coinbase/cdp-react";

    function ExportWalletWithMfa() {
      return (
        <VerifyMfaInline
          verifyFirst
          onVerified={() => console.log("MFA complete")}
        >
          <VerifyMfaInlineFlow>
            <MyProtectedContent />
          </VerifyMfaInlineFlow>
        </VerifyMfaInline>
      );
    }
    ```
  </Tab>
</Tabs>

<Note>
  **UI Customization**\
  For controlled modals, check the [VerifyMfaModal component reference](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-react/Components/VerifyMfaModal).\
  For custom layouts or render props, check the [VerifyMfa component reference](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-react/Components/VerifyMfa.README).\
  For inline flows with transitions, check the [VerifyMfaInline component reference](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-react/Components/VerifyMfaInline.README).
</Note>

### Custom UIs using React Hooks

For custom UI or SMS verification, use hooks from [`@coinbase/cdp-hooks`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks).

Verification is a two-step process:

1. **Initiate** — Call `useInitiateMfaVerification` to start verification (for SMS, this sends a new code)
2. **Submit** — Call `useSubmitMfaVerification` with the 6-digit code to complete verification

<Tabs>
  <Tab title="TOTP">
    ```tsx theme={null}
    import { useState } from "react";
    import { useInitiateMfaVerification, useSubmitMfaVerification } from "@coinbase/cdp-hooks";

    function TotpVerification({ onSuccess }: { onSuccess: () => void }) {
      const [showInput, setShowInput] = useState(false);
      const { initiateMfaVerification } = useInitiateMfaVerification();
      const { submitMfaVerification } = useSubmitMfaVerification();

      async function startVerification() {
        // Step 1: Initiate — prepares for TOTP verification
        await initiateMfaVerification({ mfaMethod: "totp" });
        setShowInput(true);
      }

      async function completeVerification(code: string) {
        // Step 2: Submit — user enters code from authenticator app
        await submitMfaVerification({ mfaMethod: "totp", mfaCode: code });
        onSuccess(); // Retry the original operation
      }

      // Render: code input and verify button
    }
    ```
  </Tab>

  <Tab title="SMS">
    ```tsx theme={null}
    import { useState } from "react";
    import { useInitiateMfaVerification, useSubmitMfaVerification } from "@coinbase/cdp-hooks";

    function SmsVerification({ onSuccess }: { onSuccess: () => void }) {
      const [codeSent, setCodeSent] = useState(false);
      const { initiateMfaVerification } = useInitiateMfaVerification();
      const { submitMfaVerification } = useSubmitMfaVerification();

      async function startVerification() {
        // Step 1: Initiate — sends SMS to enrolled phone number
        await initiateMfaVerification({ mfaMethod: "sms" });
        setCodeSent(true);
      }

      async function completeVerification(code: string) {
        // Step 2: Submit — user enters code from SMS
        await submitMfaVerification({ mfaMethod: "sms", mfaCode: code });
        onSuccess(); // Retry the original operation
      }

      // Render: send button, then code input + verify button
    }
    ```
  </Tab>

  <Tab title="Passkey">
    Passkey verification is a single call that runs the browser WebAuthn ceremony end to end. Trigger it from a user gesture (a button click)—browsers require one before showing the credential prompt.

    ```tsx theme={null}
    import { useVerifyPasskey, useIsPasskeySupported } from "@coinbase/cdp-hooks";

    function PasskeyVerification({ onSuccess }: { onSuccess: () => void }) {
      const { verifyPasskeyAsync, status } = useVerifyPasskey();
      const { data: isPasskeySupported } = useIsPasskeySupported();

      async function startVerification() {
        try {
          await verifyPasskeyAsync();
          onSuccess(); // Retry the original operation
        } catch {
          // The user cancelled or the ceremony failed. Let them try again.
        }
      }

      if (!isPasskeySupported) return null;

      // Render: single "Verify with passkey" button that calls startVerification on click
    }
    ```

    Await `verifyPasskeyAsync`, not `verifyPasskey`. The latter never rejects, so `onSuccess` would fire on a cancelled prompt and retry an operation that is still unverified.
  </Tab>

  <Tab title="Multiple methods">
    ```tsx theme={null}
    import { getEnrolledMfaMethods } from "@coinbase/cdp-core";
    import { useCurrentUser } from "@coinbase/cdp-hooks";

    function MfaMethodSelector() {
      const { currentUser } = useCurrentUser();

      // Check which methods user has enrolled
      const enrolledMethods = getEnrolledMfaMethods(currentUser);
      // Returns: any subset of ["totp", "sms", "passkey"]

      // Render: method selector if multiple, then appropriate verification UI
    }
    ```
  </Tab>
</Tabs>

<Note>
  For complete UI implementations with error handling and state management, see the [MFA section in the cdp-hooks reference](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks#multi-factor-authentication-mfa).
</Note>

### Direct API calls for non-React

For non-React applications, use functions from [`@coinbase/cdp-core`](/wallets/quickstart/user-auth).

<Tabs>
  <Tab title="TOTP">
    ```typescript theme={null}
    import { initiateMfaVerification, submitMfaVerification } from "@coinbase/cdp-core";

    // Step 1: Initiate — prepares for TOTP verification
    await initiateMfaVerification({ mfaMethod: "totp" });

    // Step 2: Submit — user enters code from authenticator app
    await submitMfaVerification({ mfaMethod: "totp", mfaCode: "123456" });

    // Retry the original operation
    ```
  </Tab>

  <Tab title="SMS">
    ```typescript theme={null}
    import { initiateMfaVerification, submitMfaVerification } from "@coinbase/cdp-core";

    // Step 1: Initiate — sends SMS to enrolled phone number
    await initiateMfaVerification({ mfaMethod: "sms" });

    // Step 2: Submit — user enters code from SMS
    await submitMfaVerification({ mfaMethod: "sms", mfaCode: "123456" });

    // Retry the original operation
    ```
  </Tab>

  <Tab title="Passkey">
    ```typescript theme={null}
    import { verifyPasskey, isPasskeySupported } from "@coinbase/cdp-core";

    // Passkey is web-only — check support before offering it.
    // Call from a user gesture so the browser shows the credential prompt.
    if (await isPasskeySupported()) {
      // One call runs the full WebAuthn verification ceremony
      await verifyPasskey();

      // Retry the original operation
    }
    ```
  </Tab>
</Tabs>

<Note>
  For full API details, see the [cdp-core reference](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-core).
</Note>

## Handling MFA errors

When a sensitive operation requires MFA, it throws an error with code `MFA_REQUIRED`:

```typescript theme={null}
import { signEvmTransaction } from "@coinbase/cdp-core";

try {
  await signEvmTransaction({ /* ... */ });
} catch (error) {
  if (error.code === "MFA_REQUIRED") {
    // Show MFA verification UI
    // After verification, retry the operation
  }
}
```

With React hooks, you can detect this and show a verification UI:

```tsx theme={null}
const handleOperation = async () => {
  try {
    await signEvmTransaction({ /* ... */ });
  } catch (error) {
    if (error.code === "MFA_REQUIRED") {
      setShowMfaModal(true);
    }
  }
};
```

<Tip>
  If you're using `CDPReactProvider`, MFA is handled automatically—you don't need to catch these errors manually. See [Protected Operations](/wallets/authentication/mfa/protected-operations) for details.
</Tip>

## Troubleshooting

<AccordionGroup>
  <Accordion title="Invalid TOTP code">
    **Common causes:**

    * Time synchronization issues between device and server
    * User entering an expired code (TOTP codes refresh every 30 seconds)
    * Incorrect authenticator app setup

    **Solutions:**

    * Ensure device time is synchronized with network time
    * Ask users to wait for a new code and try again
    * Verify the QR code was scanned correctly during enrollment
  </Accordion>

  <Accordion title="Invalid SMS code">
    **Common causes:**

    * User entering an expired code (SMS codes expire after 5 minutes)
    * User entering enrollment code instead of verification code
    * Wrong phone number entered during enrollment

    **Solutions:**

    * Ensure user is entering the most recent code
    * For verification, remind users they need to initiate verification first to receive a new SMS
    * Provide resend option with rate limiting
    * Allow users to re-enroll with correct phone number
  </Accordion>

  <Accordion title="User has multiple methods enrolled">
    **Solution:**

    * Use `getEnrolledMfaMethods(user)` to get available methods
    * Present UI to let user choose their preferred verification method
    * Store user's preference for future verifications
    * See the "Multiple methods" tab above for implementation
  </Accordion>

  <Accordion title="Lost authenticator app or phone access">
    **Recovery options:**

    * If user has both TOTP and SMS enrolled, they can use the other method
    * Implement account recovery through primary authentication method
    * Allow MFA reset after verifying via email or other auth method
    * Provide customer support flow for account recovery
  </Accordion>
</AccordionGroup>
