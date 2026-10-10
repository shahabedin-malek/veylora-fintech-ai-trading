> Coinbase CDP docs — **auth** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Multi-Factor Authentication (MFA)

> Add a second verification step to user wallets with biometrics, passkeys, or TOTP authenticators.

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

Multi-Factor Authentication (MFA) adds an extra layer of security to user wallets by requiring users to verify their identity through a secondary authentication method.

<CardGroup cols={3}>
  <Card title="TOTP" icon="mobile">
    Time-based codes from authenticator apps like Google Authenticator, Authy, or 1Password
  </Card>

  <Card title="SMS" icon="message-sms">
    Verification codes sent via text message to the user's phone
  </Card>

  <Card title="Passkey" icon="key">
    Biometric or device authentication (Face ID, Touch ID, security keys) via WebAuthn. Web only.
  </Card>
</CardGroup>

<Tip>
  MFA is optional but strongly recommended for production applications handling significant value or sensitive operations. It provides defense against account takeover attacks even if the primary authentication method is compromised.
</Tip>

<Note>
  Passkey MFA is supported in web environments only. TOTP and SMS work across all platforms.
</Note>

These guides will walk you through how to integrate Coinbase Developer Platform's MFA into your application. For more detailed customization options, see the [SDK reference](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks).

## How it works

<Steps>
  <Step title="Enrollment">
    * **Authenticator app**: User scans a QR code and registers the app in their authenticator app
    * **Text message**: User provides their phone number in E.164 format (e.g., `+14155552671`)
    * **Passkey**: User completes a single browser prompt (Face ID, Touch ID, or security key); no code to enter
  </Step>

  <Step title="Verification">
    * **Authenticator app**: User confirms by entering a 6-digit code
    * **Text message**: User confirms by entering a 6-digit code sent via SMS
    * **Passkey**: User confirms with a single browser prompt
  </Step>

  <Step title="Future authentication">
    * **Authenticator app**: User provides a 6-digit code for sensitive operations
    * **Text message**: User receives a new 6-digit code via SMS for sensitive operations
    * **Passkey**: User re-confirms with a browser prompt for sensitive operations
  </Step>
</Steps>

<Note>
  Users must be authenticated (signed in) before they can enroll in MFA. Users can enroll in multiple methods (TOTP, SMS, and passkey) for maximum flexibility, and can register more than one passkey.
</Note>

## Configuration

Configure which MFA methods (TOTP, SMS, or passkey) are available for your project in the [CDP Portal](https://portal.cdp.coinbase.com/wallets/non-custodial/authentication).

You can update these settings at any time; changes apply to new enrollments only and don't affect users who are already enrolled.

<Note>
  Passkey has one prerequisite: the origin your app runs on must be one of the project's configured CORS origins, and each passkey is scoped to that exact host. See [Passkeys](/wallets/authentication/mfa/passkeys#allowed-origins) for details.
</Note>

<Note>
  For TOTP and SMS, portal settings only control what the pre-built components display. If you're using [hooks](/wallets/authentication/mfa/enrollment#custom-uis-using-react-hooks) or the [Core SDK](/wallets/authentication/mfa/enrollment#direct-api-calls-for-non-react) directly, you can initiate enrollment for either method regardless of portal configuration. Passkey is the exception: enrollment is rejected while passkey is off for the project.
</Note>

## MFA-protected operations

The following actions automatically trigger MFA verification when the user is enrolled:

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

## MFA verification scope

Each project verifies MFA in one of two scopes. `Session` is the default.

<Tabs>
  <Tab title="Session">
    After a user successfully verifies MFA, their verified session is cached so they are not re-prompted for every protected operation. How this session is scoped depends on your authentication method:

    <AccordionGroup>
      <Accordion title="CDP authentication (email, SMS, social login)">
        MFA sessions are scoped to the user's current access token. This means:

        * Each client (browser tab, device) maintains its own independent MFA session
        * Verifying MFA in one tab does not satisfy MFA in another
        * When an access token is refreshed, the MFA session automatically carries over to the new token

        This per-token scoping prevents one client from piggybacking on another client's MFA verification.
      </Accordion>

      <Accordion title="Custom authentication">
        MFA sessions are scoped to the user identity. This means:

        * A single MFA verification satisfies all active sessions for that user
        * Verifying in one client satisfies MFA for all clients using the same user identity
        * This matches the custom authentication model where you control your own token lifecycle
      </Accordion>
    </AccordionGroup>

    For more details on how sessions work, see [Session Management](/wallets/authentication/session-management).
  </Tab>

  <Tab title="Request">
    Each verification authorizes exactly one request instead of opening a time window. A protected operation with no approval is rejected with `403 mfa_required` and a challenge handle, the user approves that specific request, and resubmitting the request consumes the approval. There is no reuse, so a user who approves a 1 USDC transfer has approved nothing else.

    For more details on how request-scoped verification works, see [Request-scoped Verification](/wallets/authentication/mfa/per-request-verification).
  </Tab>
</Tabs>

## Supported authenticator apps

Any TOTP-compatible authenticator app works. These are commonly used:

* [Google Authenticator](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2)
* [Microsoft Authenticator](https://play.google.com/store/apps/details?id=com.azure.authenticator)
* [Authy](https://authy.com/)
* [1Password](https://1password.com/)
* [Duo Mobile](https://duo.com/product/multi-factor-authentication-mfa/duo-mobile-app)

## Quickstart

If you're using `@coinbase/cdp-react`, use the pre-built enrollment component to let users enable MFA:

```tsx theme={null}
import { EnrollMfaModal } from "@coinbase/cdp-react";

function Settings() {
  return (
    <EnrollMfaModal onEnrollSuccess={() => console.log("MFA enabled!")}>
      <button>Enable Two-Factor Authentication</button>
    </EnrollMfaModal>
  );
}
```

Once enrolled in MFA, users see a verification modal whenever they attempt a [protected operation](/wallets/authentication/mfa/protected-operations):

```tsx theme={null}
import { CDPReactProvider } from "@coinbase/cdp-react";
import { useSendEvmTransaction } from "@coinbase/cdp-hooks";

function App() {
  return (
    <CDPReactProvider config={{ projectId: "your-project-id" }}>
      <SendButton />
    </CDPReactProvider>
  );
}

function SendButton() {
  const { sendEvmTransaction, isPending } = useSendEvmTransaction();

  const handleSend = async () => {
    // If user is enrolled in MFA, modal appears automatically
    const hash = await sendEvmTransaction({
      to: "0x...",
      value: "1000000000000000000",
    });
  };

  return <button onClick={handleSend} disabled={isPending}>Send</button>;
}
```

That's it! The SDK handles:

1. Detecting when MFA verification is needed
2. Showing the verification modal
3. Completing the operation after successful verification

## What to read next

<CardGroup cols={2}>
  <Card title="Enrollment" icon="user-plus" href="/wallets/authentication/mfa/enrollment">
    Set up MFA for your users with pre-built components or custom UI
  </Card>

  <Card title="MFA Prompts" icon="shield-check" href="/wallets/authentication/mfa/verification">
    Handle MFA prompts for sensitive operations
  </Card>

  <Card title="Passkeys" icon="key" href="/wallets/authentication/mfa/passkeys">
    Enable passkey MFA and use the passkey SDK surface
  </Card>

  <Card title="Customizing Triggers" icon="sliders" href="/wallets/authentication/mfa/protected-operations">
    Learn what triggers MFA and how to customize behavior
  </Card>

  <Card title="Request-scoped Verification" icon="file-shield" href="/wallets/authentication/mfa/per-request-verification">
    Bind each MFA approval to a single sign or send request
  </Card>

  <Card title="Best Practices" icon="lightbulb" href="/wallets/authentication/best-practices">
    Security recommendations and UX considerations
  </Card>
</CardGroup>
