> Coinbase CDP docs — **auth** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Passkey MFA

> Enable passkeys (WebAuthn) as a multi-factor authentication method for embedded wallets.

export const Tags = ({tags, className}) => {
  if (!tags || !Array.isArray(tags)) {
    return null;
  }
  return <div className={`mt-5 mb-5 flex flex-row flex-wrap gap-2 ${className}`}>
      {tags.map((tag, index) => <span key={index} className="text-sm text-[#733E00] dark:text-yellow-500 bg-[#FFFCF1] dark:bg-yellow-500/10 font-semibold px-2 py-1 rounded-lg">{tag}</span>)}
    </div>;
};

<Tags tags={["EVM", "Solana", "User Wallet"]} />

Passkeys let users complete MFA with a biometric or device authenticator (Face ID, Touch ID, Windows Hello, or a hardware security key) instead of typing a code. Passkeys build on the [WebAuthn](https://www.w3.org/TR/webauthn-2/) standard, so the private key never leaves the user's device.

<Note>
  Passkey MFA is supported in **web environments only**. TOTP and SMS remain available on all platforms. Enrollment and verification each run a single browser prompt—there is no code to enter.
</Note>

## How passkeys differ from TOTP and SMS

* **No code entry**: enrollment and verification are single WebAuthn ceremonies driven by `navigator.credentials`, not a 6-digit code.
* **Single-call SDK surface**: `enrollPasskey` and `verifyPasskey` run initiate → browser prompt → submit in one call, so they don't use the shared `initiate`/`submit` MFA hooks.
* **Multiple credentials**: a user can register more than one passkey (for example, one per device). Enrolled passkeys are a list, unlike the single TOTP or SMS registration.
* **User gesture required**: `verifyPasskey` must be called from a user gesture (a click). Browsers block the credential prompt otherwise.

## Project configuration

Enable passkey for your project in the [CDP Portal](https://portal.cdp.coinbase.com/wallets/non-custodial/authentication). Passkey has two settings: the method toggle itself, and **User verification**.

Unlike TOTP and SMS, the passkey toggle is enforced server-side. Enrollment fails while passkey is off for the project, even from the hooks or the Core SDK. Users who already enrolled can still verify with their passkeys if you later turn the method off.

### Allowed origins

Every passkey ceremony is scoped to the origin it runs on:

* Passkey requests must carry an `Origin` header, and that origin must be one of your project's configured CORS origins. A request from an unlisted origin is rejected with `Origin is not an allowed origin for this project.`
* The WebAuthn **relying party ID** is that origin's exact host, not its registrable domain. An origin of `https://app.example.com` produces credentials scoped to `app.example.com`.
* There is nothing to configure and nothing to prove by DNS. The relying party ID is derived per ceremony and recorded on each credential, where you can read it back as `PasskeySummary.rpId`.

<Warning>
  Because the relying party ID is the exact host, a passkey enrolled on `app.example.com` cannot verify on `wallet.example.com`. A user who signs in on both hosts needs a passkey on each. Verification from a host with no matching credential fails the same way it would for a user with no passkey at all.
</Warning>

### User verification

The optional `userVerification` setting controls whether the authenticator must verify the user (for example, with biometrics or a PIN). It appears in the Portal as a **User verification** select once passkey is on:

* `preferred` (default): request user verification, but allow the ceremony to proceed without it.
* `required`: fail the ceremony if the authenticator cannot verify the user.
* `discouraged`: skip user verification where possible.

## Enrollment

Passkey enrollment runs the full WebAuthn registration ceremony in a single call. Gate the UI on passkey support so it only appears where the browser supports WebAuthn.

<Tabs>
  <Tab title="React hooks">
    `useIsPasskeySupported` is a query hook: it runs the check on mount and exposes the answer on `data`, which is `undefined` until the check resolves. `enrollPasskey` never rejects, so an event handler needs no `catch`; read the outcome from `status` and `error`.

    ```tsx theme={null}
    import { useEnrollPasskey, useIsPasskeySupported } from "@coinbase/cdp-hooks";

    function EnrollPasskeyButton() {
      const { enrollPasskey, status, error } = useEnrollPasskey();
      const { data: isPasskeySupported } = useIsPasskeySupported();

      if (!isPasskeySupported) return null;

      return (
        <>
          <button
            onClick={() => enrollPasskey({ name: "MacBook Pro" })}
            disabled={status === "pending"}
          >
            Set up passkey
          </button>
          {error && <p>{error.message}</p>}
        </>
      );
    }
    ```

    Use `enrollPasskeyAsync` instead when you need the enrolled user inline. It resolves with `{ user }` and rejects on failure.
  </Tab>

  <Tab title="Core SDK">
    ```typescript theme={null}
    import { enrollPasskey, isPasskeySupported } from "@coinbase/cdp-core";

    if (await isPasskeySupported()) {
      const { user } = await enrollPasskey({ name: "MacBook Pro" });
      // user is the updated end user with the passkey enrolled
    }
    ```
  </Tab>
</Tabs>

The optional `name` is a human-friendly label (for example, the device or browser) surfaced when listing enrolled passkeys.

## Verification

Passkey verification also runs in a single call. Call it from a user gesture.

<Tabs>
  <Tab title="React hooks">
    Use `verifyPasskeyAsync` when the next step depends on the result. The non-throwing `verifyPasskey` resolves even when the ceremony fails, so retrying the original operation after it would retry on a cancelled prompt too.

    ```tsx theme={null}
    import { useVerifyPasskey, useIsPasskeySupported } from "@coinbase/cdp-hooks";

    function VerifyPasskeyButton({ onSuccess }: { onSuccess: () => void }) {
      const { verifyPasskeyAsync, status, error } = useVerifyPasskey();
      const { data: isPasskeySupported } = useIsPasskeySupported();

      async function handleVerify() {
        try {
          await verifyPasskeyAsync();
          onSuccess(); // Retry the original operation
        } catch {
          // The user cancelled or the ceremony failed. Let them try again.
        }
      }

      if (!isPasskeySupported) return null;

      return (
        <>
          <button onClick={handleVerify} disabled={status === "pending"}>
            Verify with passkey
          </button>
          {error && <p>{error.message}</p>}
        </>
      );
    }
    ```
  </Tab>

  <Tab title="Core SDK">
    ```typescript theme={null}
    import { verifyPasskey, isPasskeySupported } from "@coinbase/cdp-core";

    if (await isPasskeySupported()) {
      await verifyPasskey();
      // Retry the original operation
    }
    ```
  </Tab>
</Tabs>

## Managing enrolled passkeys

A user may enroll up to 20 passkeys, so list and delete them by credential ID.

<Tabs>
  <Tab title="React hooks">
    `useListPasskeys` fetches on mount and keys the query on the signed-in user, so enrolling or deleting a passkey does not refresh it. Call `refetch` after a mutation you want reflected on screen.

    ```tsx theme={null}
    import { useListPasskeys, useDeletePasskey } from "@coinbase/cdp-hooks";

    function PasskeyManager() {
      const { data: passkeys, refetch } = useListPasskeys();
      const { deletePasskeyAsync } = useDeletePasskey();

      async function remove(credentialId: string) {
        await deletePasskeyAsync(credentialId);
        await refetch();
      }

      return (
        <ul>
          {passkeys?.map(passkey => (
            <li key={passkey.credentialId}>
              {passkey.name ?? passkey.rpId} enrolled {passkey.enrolledAt}
              <button onClick={() => remove(passkey.credentialId)}>Delete</button>
            </li>
          ))}
        </ul>
      );
    }
    ```
  </Tab>

  <Tab title="Core SDK">
    ```typescript theme={null}
    import { listPasskeys, deletePasskey } from "@coinbase/cdp-core";

    const passkeys = await listPasskeys();
    // passkeys: PasskeySummary[]

    // Delete a passkey by its credential ID
    if (passkeys.length > 0) {
      await deletePasskey(passkeys[0].credentialId);
    }
    ```
  </Tab>
</Tabs>

<Note>
  Deleting one of several passkeys always succeeds. Deleting the user's only passkey is rejected when passkey is their last enrolled MFA method and your project requires MFA verification on login. Enroll another method first.
</Note>

Enrollment past the 20-credential limit is rejected with `A maximum of 20 passkeys may be enrolled. Delete one before enrolling another.`

Each `PasskeySummary` describes an enrolled passkey:

| Field | Type | Description |
| - | - | - |
| `credentialId` | `string` | Base64url-encoded WebAuthn credential ID. Use it as the `deletePasskey` argument. |
| `name` | `string?` | Human-friendly name assigned at enrollment, if any. |
| `aaguid` | `string?` | Authenticator model identifier. May be all-zero when not reported. |
| `transports` | `string[]?` | Transports the authenticator reported (for example, `internal`, `usb`). |
| `backedUp` | `boolean?` | Whether the credential is synced to a cloud keychain (multi-device passkey). |
| `enrolledAt` | `string` | ISO 8601 timestamp of enrollment. |
| `lastUsedAt` | `string?` | ISO 8601 timestamp of last verification. Absent if never used since enrollment. |
| `rpId` | `string` | Host the credential is scoped to. It can only verify on this host. |

## Checking passkey enrollment

Passkey is included in the standard MFA enrollment helpers.

<Tabs>
  <Tab title="React Hooks">
    ```tsx theme={null}
    import { useCurrentUser } from "@coinbase/cdp-hooks";
    import { getEnrolledMfaMethods, isEnrolledInMfa } from "@coinbase/cdp-core";

    function MfaStatus() {
      const { currentUser } = useCurrentUser();
      if (!currentUser) return null;

      const methods = getEnrolledMfaMethods(currentUser);
      // methods may include "passkey"

      const hasPasskey = isEnrolledInMfa(currentUser, "passkey");
      // Use hasPasskey to drive your UI
    }
    ```
  </Tab>

  <Tab title="Vanilla JS">
    ```typescript theme={null}
    import { getCurrentUser, getEnrolledMfaMethods, isEnrolledInMfa } from "@coinbase/cdp-core";

    const user = await getCurrentUser();

    if (user) {
      const methods = getEnrolledMfaMethods(user);
      // methods may include "passkey"

      isEnrolledInMfa(user, "passkey"); // true or false
    }
    ```
  </Tab>
</Tabs>

## Pre-built UI

The [`@coinbase/cdp-react`](/wallets/client-side-development/react-components) `EnrollMfa` and `VerifyMfa` components render passkey alongside TOTP and SMS when the project has passkey enabled and the browser supports it. Passkey shows a single button (no code input); TOTP and SMS are unchanged. No extra wiring is required beyond the standard components:

```tsx theme={null}
import { EnrollMfaModal } from "@coinbase/cdp-react";

function Settings() {
  return (
    <EnrollMfaModal onEnrollSuccess={() => console.log("MFA enabled")}>
      <button>Set up MFA</button>
    </EnrollMfaModal>
  );
}
```

## SDK reference

Passkey adds a web-only surface to the CDP frontend SDKs.

### Hooks (`@coinbase/cdp-hooks`)

Action hooks expose a non-throwing action for event handlers, an `*Async` variant that resolves with the result and rejects on failure, and the tracked `data`, `error`, `status`, and `reset`. Query hooks run on mount and expose `data`, `error`, `status`, `refetch`, and `reset`.

| Hook | Kind | Action or data |
| - | - | - |
| `useEnrollPasskey()` | action | `enrollPasskey(options?)`, `enrollPasskeyAsync(options?)` → `{ user }` |
| `useVerifyPasskey()` | action | `verifyPasskey(options?)`, `verifyPasskeyAsync(options?)` |
| `useDeletePasskey()` | action | `deletePasskey(credentialId)`, `deletePasskeyAsync(credentialId)` |
| `useListPasskeys()` | query | `data: PasskeySummary[] \| undefined` |
| `useIsPasskeySupported()` | query | `data: boolean \| undefined` |

### Core functions (`@coinbase/cdp-core`)

| Function | Signature |
| - | - |
| `enrollPasskey(options?)` | `Promise<{ user }>` |
| `verifyPasskey(options?)` | `Promise<void>` |
| `listPasskeys()` | `Promise<PasskeySummary[]>` |
| `deletePasskey(credentialId)` | `Promise<void>` |
| `isPasskeySupported()` | `Promise<boolean>` |

`enrollPasskey` accepts an optional `name` and `idempotencyKey`; `verifyPasskey` accepts an optional `idempotencyKey`.

<Note>
  For full API details, see the [cdp-hooks reference](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks), [cdp-core reference](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-core), and [cdp-react reference](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-react).
</Note>

## Browser and platform support

* Passkeys work in web browsers that implement WebAuthn (`navigator.credentials`). Use `isPasskeySupported()` to detect availability at runtime; it resolves to `false` when the browser has no usable authenticator.
* The passkey surface ships only in the web build of `@coinbase/cdp-core`. React Native builds resolve the native entry point, which exports none of these functions, so offer TOTP or SMS there.
* Authenticator support (Face ID, Touch ID, Windows Hello, security keys) depends on the user's device and browser.

## Error handling

The Core SDK passkey functions throw an `MfaError` carrying a `code`. Three codes matter for passkey:

| Code | Meaning |
| - | - |
| `PASSKEY_NOT_SUPPORTED` | The environment has no usable WebAuthn authenticator. Offer TOTP or SMS. |
| `CANCELLED` | The user dismissed the browser prompt. Let them try again. |
| `PASSKEY_ALREADY_ENROLLED` | This authenticator already holds a passkey for the user. |

```typescript theme={null}
import { MfaError, verifyPasskey } from "@coinbase/cdp-core";

try {
  await verifyPasskey();
} catch (error) {
  if (error instanceof MfaError && error.code === "PASSKEY_NOT_SUPPORTED") {
    // Fall back to TOTP or SMS
  }
  // Otherwise the user likely cancelled, so let them retry
}
```

The hooks report the same errors on `error` rather than throwing, except through the `*Async` variants.

## What to read next

<CardGroup cols={2}>
  <Card title="Enrollment" icon="user-plus" href="/wallets/authentication/mfa/enrollment">
    Enroll users across TOTP, SMS, and passkey
  </Card>

  <Card title="Prompt Handling" icon="shield-check" href="/wallets/authentication/mfa/verification">
    Handle MFA prompts for sensitive operations
  </Card>

  <Card title="Protected Operations" icon="sliders" href="/wallets/authentication/mfa/protected-operations">
    Learn what triggers MFA verification
  </Card>

  <Card title="Best Practices" icon="lightbulb" href="/wallets/authentication/best-practices">
    Security recommendations and UX considerations
  </Card>
</CardGroup>
