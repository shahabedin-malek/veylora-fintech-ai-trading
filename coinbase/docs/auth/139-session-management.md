> Coinbase CDP docs — **auth** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Session Management

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

Understanding how user sessions work with CDP wallets is crucial for building secure applications with proper authentication flows. Sessions are managed through a dual-token system designed to balance security and user experience.

## Session duration

User sessions are managed through a dual-token system:

* **Maximum session length**: 7 days
* **Access token expiry**: 15 minutes
* **Refresh token expiry**: 7 days

## How session tokens work

When a user successfully authenticates, they receive:

1. **Access token**: Short-lived (15 minutes) token used for API requests
2. **Refresh token**: Long-lived (7 days) token used to obtain new access tokens

The refresh token automatically generates new access tokens as needed, providing seamless authentication for up to 7 days. After 7 days, users must re-authenticate.

<Tip>
  To keep the refresh token in a first-party `HttpOnly` cookie across Safari, Firefox, and Brave instead of `localStorage`, see [First-party cookies](/wallets/security-and-policies/first-party-cookies).
</Tip>

## Session lifecycle

<AccordionGroup>
  <Accordion title="Initial authentication">
    1. User completes email/SMS OTP verification or other authentication method
    2. System issues both access and refresh tokens
    3. User gains immediate access to their wallet
    4. Session remains active for up to 7 days with automatic token refresh
  </Accordion>

  <Accordion title="Automatic token refresh">
    * Access tokens are automatically refreshed using the refresh token
    * Applications continue working without interruption
  </Accordion>

  <Accordion title="Session expiration">
    * After 7 days, the refresh token expires
    * User must complete authentication again
  </Accordion>
</AccordionGroup>

## MFA sessions

When a user enrolled in [MFA](/wallets/authentication/mfa/overview) successfully verifies, a verified session is cached so subsequent [protected operations](/wallets/authentication/mfa/protected-operations) do not re-prompt for verification. How MFA sessions are scoped depends on your authentication method:

### CDP authentication

The MFA session is tied to the user's access token:

* Each client (browser tab, device) has its own MFA session
* Verifying MFA in one tab does not satisfy MFA in another tab
* When an access token is refreshed, the MFA session automatically carries over to the new token
* If the MFA session expires, the user is prompted again on the next protected operation

### Custom authentication

The MFA session is tied to the user identity rather than individual tokens:

* MFA verification is shared across all active sessions for that user
* Verifying in one client satisfies MFA for all clients using the same user identity
* This behavior matches custom authentication's user-scoped session model

<Note>
  MFA sessions expire independently of access tokens. If an MFA session expires, the user will be prompted to verify again on the next protected operation regardless of authentication method.
</Note>

## Implementation considerations

* Monitor authentication state using `onAuthStateChange()` to handle session expiration
* Implement graceful fallback when tokens expire
* Consider showing session timeout warnings to users approaching the 7-day limit
* Test your application's behavior when refresh tokens expire

## Sign out functionality

Always provide a clear way for users to sign out using the `signOut()` method from `@coinbase/cdp-core` or the `AuthButton` component which handles sign out automatically.

For React applications, you can also use the `useSignOut` hook:

```tsx theme={null}
import { useSignOut } from '@coinbase/cdp-hooks';

function SignOutButton() {
  const { signOut } = useSignOut();
  return <button onClick={signOut}>Sign Out</button>;
}
```

## Custom authentication sessions

If you're using [custom authentication](/wallets/authentication/custom-authentication) with your own identity provider, session management works differently:

* **Token lifecycle**: Managed by your identity provider (Auth0, Firebase, etc.)
* **No CDP token refresh**: CDP always requests a fresh JWT via the `getJwt` callback
* **Session duration**: Controlled by your IDP's configuration
* **Sign out**: Only need to sign out from your IDP

For more details on custom authentication, see the [Custom Authentication guide](/wallets/authentication/custom-authentication).

## What to read next

* **[Authentication Methods](/wallets/authentication/overview)**: Learn about available authentication options
* **[Implementation Guide](/wallets/authentication/implementation-guide)**: Step-by-step authentication integration
* **[Server-side validation](/wallets/authentication/implementation-guide#server-side-validation)**: Validate user sessions on your backend
* **[Best Practices](/wallets/authentication/best-practices)**: Security recommendations and production readiness
