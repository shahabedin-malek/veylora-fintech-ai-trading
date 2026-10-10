> Coinbase CDP docs — **auth** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Wallet Authentication

> Authentication options for user wallets, including email OTP, SMS, social login, and custom OAuth providers.

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

User wallets provide secure, user-friendly authentication methods that eliminate the complexity of traditional crypto wallets. Users can access their wallets through familiar authentication patterns like email one-time passwords (OTP), SMS, and social logins, without ever dealing with seed phrases or browser extensions.

<Tip>
  Ready to implement authentication? Check out the [Implementation Guide](/wallets/authentication/implementation-guide) for step-by-step integration instructions.
</Tip>

## Email OTP

Email OTP is the primary authentication method for user wallets, providing a secure and familiar experience for users.

<AccordionGroup>
  <Accordion title="How email OTP works">
    1. **User enters email**: The user provides their email address in your application
    2. **OTP sent**: A 6-digit one-time password is sent to their email
    3. **User verifies**: The user enters the OTP in your application
    4. **Wallet access**: Upon successful verification, the wallet is created or accessed
  </Accordion>

  <Accordion title="Security features">
    * **Time-limited codes**: OTPs expire after 10 minutes for security
    * **Rate limiting**: Protection against brute force attempts
    * **Secure delivery**: Emails sent through Coinbase's trusted infrastructure
    * **Device binding**: Wallets are cryptographically bound to the user's device
  </Accordion>

  <Accordion title="User experience benefits">
    * **No passwords to remember**: Users don't need to create or manage passwords
    * **Instant onboarding**: New users can create a wallet in seconds
    * **Familiar process**: Similar to authentication flows users already know
    * **Cross-device support**: Users can access their wallet from up to 5 devices
  </Accordion>
</AccordionGroup>

### Email Customization

By default, OTP emails are sent without customization. To brand them with your app's name and logo, open the [Branding](https://portal.cdp.coinbase.com/wallets/non-custodial/branding) tab in CDP Portal (**Wallets** → **Non-custodial Wallet** → **Branding**).

From there you can:

* Set your app name
* Upload a PNG or JPEG logo (maximum 512 KB, at least 80×80 pixels)
* Preview the OTP email in light and dark mode

Logos are screened before they appear in emails. If you replace an existing logo, the currently approved logo stays in emails until the new one is approved. Custom OTP branding goes live once the project has both an app name and an approved logo.

Emails are sent from "no-reply \<[no-reply@info.coinbase.com](mailto:no-reply@info.coinbase.com)>"; this field is not currently customizable.

## SMS OTP

SMS-based one-time passwords are available as an additional authentication method, providing users with more flexibility in how they access their wallets.

<AccordionGroup>
  <Accordion title="How SMS OTP works">
    1. **User enters phone number**: The user provides their phone number in your application
    2. **OTP sent**: A 6-digit one-time password is sent to their phone number
    3. **User verifies**: The user enters the OTP in your application
    4. **Wallet access**: Upon successful verification, the wallet is created or accessed
  </Accordion>

  <Accordion title="Security features">
    * **Time-limited codes**: OTPs expire after 5 minutes for security
    * **Rate limiting**: Protection against brute force attempts
    * **Secure delivery**: Text messages sent through Coinbase's trusted infrastructure
    * **Device binding**: Wallets are cryptographically bound to the user's device
  </Accordion>

  <Accordion title="User experience benefits">
    * **No passwords to remember**: Users don't need to create or manage passwords
    * **Instant onboarding**: New users can create a wallet in seconds
    * **Familiar process**: Similar to authentication flows users already know
    * **Cross-device support**: Users can access their wallet from up to 5 devices
  </Accordion>
</AccordionGroup>

This feature is currently supported for phone numbers from the following countries - Antigua and Barbuda, Australia, Austria, Bahamas, Belgium, Brazil, Bulgaria, Canada, Colombia, Croatia, Cyprus, Czech Republic, Denmark, Dominican Republic, Estonia, Finland, France, Germany, Greece, Grenada, Guyana, Hungary, India, Indonesia, Ireland, Italy, Japan, Kenya, Latvia, Lithuania, Luxembourg, Malta, Mexico, Netherlands, Philippines, Poland, Portugal, Romania, Saint Vincent and the Grenadines, Singapore, Slovakia, Slovenia, South Korea, Spain, Suriname, Sweden, Switzerland, Turkey, United Arab Emirates, United Kingdom, United States.

If you'd like to enable the feature in additional regions, reach out to us on [Discord](https://discord.com/invite/cdp).

<Warning>
  **SMS security considerations:**

  * SMS authentication is inherently vulnerable to SIM swapping attacks, where attackers can take over a user's phone number.
  * You should weigh the convenience of logging in with SMS with the potential for a user's wallet to be taken control of.
</Warning>

## Social login providers

Social login through Google, Apple, X, and Telegram are supported via our SDK using OAuth 2.0.
We offer Coinbase-owned OAuth login, allowing users to recognize and trust Coinbase's brand during the login process.

<AccordionGroup>
  <Accordion title="How Social login works">
    1. **User initiates social login**: The user clicks on a familiar button like "Sign in with Google" or "Sign in with X"
    2. **User logs in**: The user is redirected to the login flow from the OAuth provider
    3. **User verifies**: The user completes login
    4. **Wallet access**: Upon successful verification, the wallet is created or accessed
  </Accordion>

  <Accordion title="Security features">
    * **Time-limited codes**: Social login sessions are managed using a refresh and access token model with configurable expiration
    * **Rate limiting**: Protection against brute force attempts
    * **Secure delivery**: Login is facilitated by Coinbase's trusted brand.
  </Accordion>

  <Accordion title="User experience benefits">
    * **No passwords to remember**: Users don't need to create or manage passwords
    * **Instant onboarding**: New users can create a wallet in seconds
    * **Familiar process**: Similar to authentication flows users already know
    * **Cross-device support**: Users can access their wallet from up to 5 devices
  </Accordion>
</AccordionGroup>

<Warning>
  **React Native OAuth setup:**
  OAuth authentication is fully supported in React Native, but requires deep link configuration to handle authentication callbacks. See our complete [React Native Social Login Configuration guide](/wallets/authentication/implementation-guide#react-native-social-login-configuration) for step-by-step instructions.
  **Note:** Email and SMS authentication work out-of-the-box in React Native with no additional configuration needed.
</Warning>

### Examples

Sign in with social providers using the OAuth flow. Note that the page from which the `signInWithOAuth` call occurs will be redirected back to after the user authenticates with their provider. The user will be automatically logged-in when `@coinbase/cdp-core` re-initializes.

<CodeGroup>
  ```typescript Google OAuth theme={null}
  import { initialize, signInWithOAuth } from '@coinbase/cdp-core';

  // Initialize the CDP SDK
  await initialize({
    projectId: 'your-project-id'
  });

  // Initiate Google OAuth sign-in
  // User will be redirected to Google to complete their login
  // After login, they will be redirected back to your app, and the login
  // process will be completed automatically by the SDK
  try {
    void signInWithOAuth("google");
  } catch (error) {
    console.error("Failed to sign in with Google:", error);
  }
  ```

  ```typescript Apple OAuth theme={null}
  import { initialize, signInWithOAuth } from '@coinbase/cdp-core';

  // Initialize the CDP SDK
  await initialize({
    projectId: 'your-project-id'
  });

  // Initiate Apple OAuth sign-in
  // User will be redirected to Apple to complete their login
  // After login, they will be redirected back to your app, and the login
  // process will be completed automatically by the SDK
  try {
    void signInWithOAuth("apple");
  } catch (error) {
    console.error("Failed to sign in with Apple:", error);
  }
  ```

  ```typescript X OAuth theme={null}
  import { initialize, signInWithOAuth } from '@coinbase/cdp-core';

  // Initialize the CDP SDK
  await initialize({
    projectId: 'your-project-id'
  });

  // Initiate X OAuth sign-in
  // User will be redirected to X to complete their login
  // After login, they will be redirected back to your app, and the login
  // process will be completed automatically by the SDK
  try {
    void signInWithOAuth("x");
  } catch (error) {
    console.error("Failed to sign in with X:", error);
  }
  ```

  ```typescript Telegram OAuth theme={null}
  import { initialize, signInWithOAuth } from '@coinbase/cdp-core';

  // Initialize the CDP SDK
  await initialize({
    projectId: 'your-project-id'
  });

  // Initiate Telegram OAuth sign-in
  // User will be redirected to Telegram to complete their login
  // After login, they will be redirected back to your app, and the login
  // process will be completed automatically by the SDK
  try {
    void signInWithOAuth("telegram");
  } catch (error) {
    console.error("Failed to sign in with Telegram:", error);
  }
  ```
</CodeGroup>

## Sign In With Ethereum (SIWE)

Sign In With Ethereum ([EIP-4361](https://eips.ethereum.org/EIPS/eip-4361)) lets users authenticate by signing a structured message with an Ethereum wallet they already own — no email, phone number, or social account required. On first sign-in, a new user wallet is automatically created and associated with the user's Ethereum address.

For Base ecosystem apps, CDP React provides a pre-built **Sign in with Base** option via `authMethods: ["siwe:base"]` — a one-line integration that connects the user's Base wallet and runs the SIWE flow automatically. See the [Sign In With Ethereum guide](/wallets/authentication/siwe#sign-in-with-base) for setup details.

<Note>
  Automatic wallet creation is controlled by the `ethereum.createOnLogin` config option (`"eoa"` or `"smart"`). To disable automatic creation and provision wallets manually, omit `createOnLogin` from your config.
</Note>

<AccordionGroup>
  <Accordion title="How SIWE works">
    1. **User provides their address**: Your app passes the user's Ethereum address to `signInWithSiwe`
    2. **Challenge issued**: CDP returns a standards-compliant EIP-4361 message with a cryptographic nonce and expiration time
    3. **User signs the message**: The user signs the message with their Ethereum wallet (MetaMask, Coinbase Wallet, hardware wallet, etc.)
    4. **Signature verified**: Your app submits the signature via `verifySiweSignature`, and CDP verifies it on-chain
    5. **Wallet access**: Upon successful verification, the user wallet is created or accessed
  </Accordion>

  <Accordion title="Security features">
    * **Cryptographic proof**: Authentication requires a valid signature from the private key — no credential sharing
    * **Replay protection**: Each challenge contains a unique nonce and expiration time
    * **Domain binding**: The `domain` field ties the signed message to your application, preventing cross-site replay attacks
    * **Rate limiting**: Protection against brute force attempts
  </Accordion>

  <Accordion title="User experience benefits">
    * **Wallet-native sign-in**: Ideal for users who already have Ethereum wallets
    * **No passwords or OTPs**: Authentication is purely signature-based
    * **Transparent intent**: The signed message makes the user's action explicit and auditable
  </Accordion>
</AccordionGroup>

### Getting started

See the complete [Sign In With Ethereum guide](/wallets/authentication/siwe) for implementation details and code examples.

## Auth method linking

Once a user is authenticated, you can enable them to link additional authentication methods to their account. This allows users to sign in using multiple methods (email, SMS, OAuth providers) while maintaining access to the same user wallet.

<AccordionGroup>
  <Accordion title="Why link authentication methods?">
    * **Meet 2FA requirements**: Coinbase Onramp requires both email and phone verification for seamless integration
    * **Improve account security**: Add additional authentication factors as users accumulate more funds
    * **Enhance account recovery**: Multiple methods provide backup options if one method becomes unavailable
    * **Flexible access**: Users can sign in with any linked method and access the same wallet
  </Accordion>

  <Accordion title="How it works">
    1. **User must be authenticated**: The user signs in using any supported method
    2. **Initiate linking**: User requests to link an additional authentication method
    3. **Verify the method**: Complete verification (OTP or OAuth flow)
    4. **Linked**: The new method is now associated with the same user account and wallet
  </Accordion>
</AccordionGroup>

For detailed implementation examples and code snippets, see the [Auth Method Linking guide](/wallets/authentication/auth-method-linking).

## Custom authentication

Custom authentication enables applications with existing authentication systems to integrate user wallets seamlessly. Instead of using CDP's built-in authentication (email OTP, SMS, OAuth), you can use JWTs from your own identity provider.

<AccordionGroup>
  <Accordion title="How custom authentication works">
    1. **Pre-configuration**: Configure your JWKS endpoint and optionally specify which JWT claim to use for user identification in CDP Portal
    2. **User logs in**: User authenticates with your existing auth system
    3. **JWT generation**: Your identity provider generates a JWT for the user
    4. **CDP validation**: CDP retrieves your JWKS, validates the JWT and required claims
    5. **Wallet access**: CDP uses the configured user identifier claim (default: `sub`, or custom like `email`, `user_id`) to get or create a user wallet
  </Accordion>

  <Accordion title="Use cases">
    * **Existing user base**: You already have users authenticated via Auth0, Firebase, Cognito, or custom solution
    * **Single sign-on (SSO)**: Users sign in once across your entire platform
    * **Enterprise requirements**: Need to integrate with corporate identity systems
    * **Regulatory compliance**: Must use specific authentication providers
  </Accordion>
</AccordionGroup>

### Requirements

Your identity provider must:

* Support JWKS (JSON Web Key Sets) with RS256 or ES256 signing
* Provide required JWT claims: `iss`, `exp`, `iat`, and a user identifier claim (default: `sub`, or a custom claim you configure)

### Getting started

See the complete [Custom Authentication guide](/wallets/authentication/custom-authentication) for setup instructions and code examples.

## API Key Authentication

API key authentication is for server-side applications that manage wallets programmatically. It covers two scenarios:

* **API key wallets**: Your server owns and controls the wallets entirely, with no end-user involvement
* **Delegated signing**: An end user authenticates on your frontend and grants your backend a time-bound permission to sign on their behalf — no active user session required after the grant

<AccordionGroup>
  <Accordion title="How API key authentication works">
    **API key wallets**

    1. **Create an API key**: Generate an API key in the [CDP Portal](https://portal.cdp.coinbase.com/api-keys/secret)
    2. **Download your wallet secret**: A wallet secret is generated alongside your API key — store it securely
    3. **Initialize the SDK**: Pass your credentials to `CdpClient` in your server-side code
    4. **Sign operations**: The SDK uses the wallet secret to authenticate with the TEE and sign transactions on your behalf

    **Delegated signing**

    1. **End user authenticates**: The user signs in on your frontend using any supported method
    2. **User grants delegation**: The user calls `createDelegation` on the frontend, specifying an expiry time
    3. **Backend signs**: Your server uses your CDP API key, wallet secret, and the active delegation to sign transactions for the user via `cdp.endUser.*` — no user session required
    4. **Revoke**: The delegation can be revoked before expiry by the user or your backend
  </Accordion>

  <Accordion title="Use cases">
    * **Backend services**: Automate onchain operations from your server
    * **Agentic applications**: Give AI agents controlled access to wallets with defined spending limits
    * **Automated transactions**: Execute transactions triggered by webhooks or onchain events when the user is offline
    * **Background operations**: Process user-initiated flows that complete asynchronously after the user has left your app
    * **Wallet pre-generation**: Create wallets for users before they sign in
  </Accordion>

  <Accordion title="Security considerations">
    * Store your API key and wallet secret as environment variables — never hardcode them
    * Rotate your wallet secret immediately if it is compromised
    * Use API key scopes to restrict what operations your key can perform
    * Delegations are time-bound — set the shortest expiry that meets your use case
  </Accordion>
</AccordionGroup>

### Setup

```typescript theme={null}
import { CdpClient } from "@coinbase/cdp-sdk";

const cdp = new CdpClient({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
  walletSecret: process.env.CDP_WALLET_SECRET,
});
```

### Rotate your wallet secret

If your wallet secret is lost or compromised, rotate it immediately from the [CDP Portal](https://portal.cdp.coinbase.com/wallets/non-custodial/security) under **Configuration > Generate new secret**.

<Warning>
  Once rotated, your old wallet secret is immediately invalidated.
</Warning>

## Multi-Factor Authentication (MFA)

Add an extra layer of security to your user wallets with Time-based One-Time Password (TOTP) multi-factor authentication. Users can enroll using popular authenticator apps like Google Authenticator, Authy, or 1Password.

<AccordionGroup>
  <Accordion title="Key features">
    * **Industry-standard TOTP**: Compatible with all major authenticator apps
    * **Optional enrollment**: Let users choose when to enable MFA
    * **Flexible verification**: Require MFA for specific operations or all sensitive actions
    * **Easy integration**: Simple SDK methods for enrollment and verification
  </Accordion>

  <Accordion title="When to use MFA">
    * **High-value operations**: Require MFA for large transactions or withdrawals
    * **Account security changes**: Mandate MFA when changing authentication settings
    * **Compliance requirements**: Meet regulatory requirements for additional authentication
    * **User preference**: Allow security-conscious users to opt-in to enhanced protection
  </Accordion>
</AccordionGroup>

### Getting started with MFA

See the complete [Multi-Factor Authentication guide](/wallets/authentication/mfa/overview) for implementation details and code examples.

## What to read next

* **[Implementation Guide](/wallets/authentication/implementation-guide)**: Step-by-step guide to implementing these authentication methods
* **[Auth Method Linking](/wallets/authentication/auth-method-linking)**: Link multiple authentication methods to a single wallet
* **[Session Management](/wallets/authentication/session-management)**: Understand session lifecycle and token management
* **[Best Practices](/wallets/authentication/best-practices)**: Security recommendations and production readiness
* **[Server-side validation](/wallets/authentication/implementation-guide#server-side-validation)**: Validate user sessions on your backend
