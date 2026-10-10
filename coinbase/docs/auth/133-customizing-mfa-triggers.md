> Coinbase CDP docs — **auth** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Customizing MFA Triggers

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

Some operations, like signing transactions or exporting keys, are **protected** by MFA. Knowing which operations trigger MFA helps you design better UX (like showing lock icons) and handle edge cases.

<Note>
  **You might need this guide to:**

  * Show lock icons on buttons that trigger MFA
  * Build a custom MFA modal instead of the default
  * Handle MFA differently in different parts of your app
  * Disable automatic MFA prompts entirely

  If you're using `CDPReactProvider` with default settings, MFA verification is handled automatically for enrolled users. Note that MFA is not enforced until users enroll (add the [EnrollMfaModal](/wallets/authentication/mfa/enrollment) component so users can set up MFA).
</Note>

## MFA-protected operations

These operations trigger MFA verification when the user is enrolled:

<AccordionGroup>
  <Accordion title="EVM">
    * `signEvmHash`
    * `signEvmTypedData`
    * `signEvmMessage`
    * `signEvmTransaction`
    * `sendEvmTransaction`
    * `sendUserOperation`
    * `createEvmKeyExportIframe`
  </Accordion>

  <Accordion title="Solana">
    * `signSolanaMessage`
    * `signSolanaTransaction`
    * `sendSolanaTransaction`
    * `createSolanaKeyExportIframe`
  </Accordion>
</AccordionGroup>

## Checking MFA status

Use `isMfaRequired()` to check if the user needs to verify before protected operations:

```typescript theme={null}
import { isMfaRequired } from "@coinbase/cdp-core";

if (isMfaRequired()) {
  console.log("MFA verification required");
}
```

Use `isMfaProtectedAction()` to check if a specific action triggers MFA (useful for showing lock icons):

```typescript theme={null}
import { isMfaProtectedAction } from "@coinbase/cdp-core";

if (isMfaProtectedAction("signEvmTransaction")) {
  // Show a lock icon on the button
}
```

## Custom handling

For applications using the SDK directly (without `CDPReactProvider`), or if you want a custom MFA UI, register a listener to intercept MFA requirements.

<Tabs>
  <Tab title="React hooks">
    ```tsx theme={null}
    import { useRegisterMfaListener, useCancelMfaVerification } from "@coinbase/cdp-hooks";

    function App() {
      const { cancelMfaVerification } = useCancelMfaVerification();

      // Register a global listener for MFA requirements
      useRegisterMfaListener(({ methods }) => {
        // methods: available MFA methods (e.g., ["totp", "sms"])
        // Show your custom MFA UI here
      });

      // To cancel (user closes modal without verifying):
      // cancelMfaVerification();
    }
    ```

    For scoped handling (different MFA UX in different parts of your app):

    ```tsx theme={null}
    import { useRegisterMfaListener } from "@coinbase/cdp-hooks";
    import { useRef } from "react";

    function ExportSection() {
      const containerRef = useRef(null);

      // Only responds to MFA triggers from within this container
      useRegisterMfaListener(
        ({ methods }) => {
          // Show inline MFA UI for this section
        },
        { scope: containerRef }
      );

      return <div ref={containerRef}>{/* Export UI */}</div>;
    }
    ```
  </Tab>

  <Tab title="Core SDK">
    ```typescript theme={null}
    import { registerMfaListener, cancelMfaVerification } from "@coinbase/cdp-core";

    // Register a global MFA handler
    const unregister = registerMfaListener(({ methods }) => {
      // methods: available MFA methods (e.g., ["totp", "sms"])
      // Show your custom MFA UI here
    });

    // To cancel (user closes modal without verifying):
    cancelMfaVerification();

    // Clean up when done:
    unregister();
    ```
  </Tab>
</Tabs>

<Note>
  For complete UI implementations with verification flow, error handling, and state management, see the [MFA section in the cdp-hooks reference](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks#multi-factor-authentication-mfa).
</Note>

## Disabling defaults

To handle MFA entirely yourself, disable the automatic modal at the provider level:

```tsx theme={null}
<CDPReactProvider
  config={{
    projectId: "your-project-id",
    mfa: {
      disableAutoPrompt: true,
    },
  }}
>
  <App />
</CDPReactProvider>
```

Some components like `ExportWalletModal` have built-in MFA flows. To handle MFA separately, use `skipMfa`:

```tsx theme={null}
<ExportWalletModal
  address={evmAccount}
  skipMfa={true}
/>
```

<Warning>
  When `skipMfa` and `disableAutoPrompt` are both true, you must complete MFA verification before the protected action or it will fail.
</Warning>

## Troubleshooting

<AccordionGroup>
  <Accordion title="MFA not triggering automatically">
    **Check:**

    * You're using `CDPReactProvider` from `@coinbase/cdp-react`
    * `mfa.disableAutoPrompt` is not set to `true`
    * The user is enrolled in MFA (`isEnrolledInMfa(user)` returns `true`)
    * If using custom handling, verify you've registered a listener
  </Accordion>

  <Accordion title="Operation fails after verification">
    * Ensure the verification completed successfully before retrying
    * Check that the user hasn't been signed out
    * Verify the operation parameters are still valid
  </Accordion>

  <Accordion title="Scoped handler not responding">
    * Ensure the `ref` is attached to a DOM element that contains the triggering action
    * Verify the component with `useRegisterMfaListener` is mounted when the action occurs
  </Accordion>
</AccordionGroup>
