> Coinbase CDP docs — **auth** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Social Login

> Use your own Google, Apple, X, or Telegram OAuth app instead of the CDP default for social login.

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

Custom Social Login allows you to use your own OAuth applications for Google, Apple, X (Twitter), and Telegram authentication instead of CDP's default OAuth providers. This gives you complete control over the OAuth experience, including branding, rate limits, and compliance requirements.

By default, user wallets use CDP-managed OAuth applications for social login, allowing users to recognize and trust Coinbase's brand during authentication. Custom Social Login enables you to replace these defaults with your own OAuth applications while maintaining the same seamless authentication experience.

<Tip>
  Already using CDP's default social login? You can switch to custom OAuth applications without disrupting existing users - they'll retain access to their wallets and identities.
</Tip>

## Why use custom OAuth?

<AccordionGroup>
  <Accordion title="Brand consistency">
    When users authenticate, they'll see your application name and branding in the OAuth consent screen instead of Coinbase's. This creates a more cohesive experience for users who identify your application as the primary service they're using.
  </Accordion>

  <Accordion title="Control over OAuth configuration">
    Manage your own OAuth applications and configurations, including:

    * Consent screen branding and messaging
    * OAuth scopes and permissions
    * Application review and approval timelines
    * Access to provider-specific features and settings
  </Accordion>

  <Accordion title="Compliance and audit requirements">
    Some organizations require:

    * Full ownership of authentication infrastructure
    * Direct relationships with OAuth providers
    * Detailed audit logs from OAuth providers
    * Compliance with specific regulatory frameworks
  </Accordion>

  <Accordion title="Rate limit control">
    OAuth providers apply rate limits per application. Using your own OAuth applications allows you to:

    * Scale authentication to your specific needs
    * Request rate limit increases directly from providers
    * Avoid shared rate limits with other CDP users
    * Monitor and optimize usage patterns
  </Accordion>
</AccordionGroup>

## How it works

<AccordionGroup>
  <Accordion title="Default behavior: CDP's OAuth applications">
    By default, when users authenticate with social login:

    1. Users click "Sign in with Google" (or Apple/X)
    2. They're redirected to the provider's OAuth flow
    3. The OAuth consent screen shows "Coinbase" or "CDP" as the requesting application
    4. Upon approval, users are authenticated and their wallet is accessed
    5. All rate limits and quotas are managed by CDP
  </Accordion>

  <Accordion title="Custom behavior: Your OAuth applications">
    When you configure custom OAuth applications:

    1. Users click "Sign in with Google" (or Apple/X)
    2. They're redirected to the provider's OAuth flow
    3. The OAuth consent screen shows **your application name** as the requesting application
    4. Upon approval, users are authenticated using your OAuth credentials
    5. Rate limits and quotas are based on your OAuth application configuration
  </Accordion>

  <Accordion title="Identity continuity during migration">
    If your users are already authenticated with CDP's default social login and you enable custom OAuth:

    * **Existing users retain full access** to their wallets and identities
    * No wallet re-creation or migration required
    * User identities remain consistent across the transition
    * Authentication simply switches from CDP's OAuth app to yours
    * All wallet addresses, assets, and transaction history are preserved

    This seamless migration means you can adopt custom OAuth at any time without disrupting your user base.
  </Accordion>
</AccordionGroup>

## Critical disclaimers

<Warning>
  **Responsibility for OAuth configuration:**

  When you configure custom OAuth applications, **you are responsible for proper setup and maintenance**. CDP is not responsible for issues stemming from:

  * Misconfigured OAuth redirect URLs
  * Invalid or expired OAuth credentials
  * OAuth applications that haven't been approved by the provider
  * Rate limits or quotas imposed by OAuth providers
  * Changes to your OAuth application settings

  Ensure you follow the setup guides carefully and test thoroughly before deploying to production.
</Warning>

<Warning>
  **Redirect URL requirements:**

  Each provider requires an **exact redirect URL** to be configured in your OAuth application. These URLs are **non-negotiable** and must match exactly:

  * Google: `https://api.cdp.coinbase.com/platform/v2/end-users/auth/oauth/google/callback`
  * Apple: `https://api.cdp.coinbase.com/platform/v2/end-users/auth/oauth/apple/callback`
  * X: `https://api.cdp.coinbase.com/platform/v2/end-users/auth/oauth/x/callback`

  Even minor differences (http vs https, trailing slashes, typos) will cause authentication to fail.
</Warning>

<Info>
  **Identity continuity guarantee:**

  Switching from CDP's default social login to custom OAuth preserves user identities. Users who authenticated with CDP's Google OAuth application will seamlessly continue to access the same wallet when you configure your custom Google OAuth application.

  The same applies for Apple and X - user wallets are linked to their social identity (email, user ID), not to the specific OAuth application used for authentication.
</Info>

## Provider comparison

| Provider | Setup Complexity | Verification Time | Redirect URL | Special Requirements |
| - | - | - | - | - |
| **Google** | Moderate | Instant (may require app verification for production) | `https://api.cdp.coinbase.com/platform/v2/end-users/auth/oauth/google/callback` | OAuth consent screen configuration |
| **Apple** | High | Instant | `https://api.cdp.coinbase.com/platform/v2/end-users/auth/oauth/apple/callback` | Apple Developer account (\$99/year), Private key (.p8 file) |
| **X** | Moderate | Instant (may require approval for additional permissions) | `https://api.cdp.coinbase.com/platform/v2/end-users/auth/oauth/x/callback` | Rate limits apply even on free tier |
| **Telegram** | Low | Instant | N/A (uses your app domain) | Telegram account, BotFather bot creation. **React Native not supported.** |

## Prerequisites

Before configuring custom OAuth, ensure you have:

* **CDP Project ID**: Available in the CDP Portal
* **Access to CDP Portal**: Permission to configure user wallet settings
* **Developer accounts**: Accounts with each OAuth provider you plan to use:
  * Google: [Google Cloud Platform account](https://console.cloud.google.com/)
  * Apple: [Apple Developer account](https://developer.apple.com/) (\$99/year required)
  * X: [X Developer account](https://developer.x.com/) (free tier available)
  * Telegram: [Telegram account](https://telegram.org/) with access to [BotFather](https://t.me/BotFather)
* **OAuth 2.0 understanding**: Basic familiarity with OAuth flows and terminology

## Quick start

Choose a provider to get started with custom OAuth configuration:

<CardGroup cols={2}>
  <Card title="Google" icon="google" href="/wallets/authentication/social-login/google">
    Set up Google OAuth with Client ID and Client Secret
  </Card>

  <Card title="Apple" icon="apple" href="/wallets/authentication/social-login/apple">
    Configure Apple Sign In with Services ID and private key
  </Card>

  <Card title="X" icon="x-twitter" href="/wallets/authentication/social-login/x">
    Enable X OAuth for Twitter/X authentication
  </Card>

  <Card title="Telegram" icon="paper-plane" href="/wallets/authentication/social-login/telegram">
    Set up Telegram authentication with BotFather
  </Card>
</CardGroup>

## What to read next

<CardGroup cols={2}>
  <Card title="Authentication Methods" icon="key" href="/wallets/authentication/overview">
    Learn about all available authentication options
  </Card>

  <Card title="Implementation Guide" icon="code" href="/wallets/authentication/implementation-guide">
    Integrate user wallets in your application
  </Card>

  <Card title="Security & Export" icon="shield" href="/wallets/using-wallets/import-and-export">
    Understand security considerations
  </Card>

  <Card title="Session Management" icon="clock" href="/wallets/authentication/session-management">
    Manage user authentication sessions
  </Card>
</CardGroup>
