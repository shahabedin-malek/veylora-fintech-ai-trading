> Coinbase CDP docs — **platform** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Authentication

> Choose the right authentication method for CDP APIs based on whether you are building server-side or client-side applications.

This guide helps you choose the right authentication approach for the **Coinbase Developer Platform (CDP) APIs** — the APIs you use to build apps on CDP, including wallets, onramp, paymaster, x402, staking, and data.

If you're integrating with one of Coinbase's [Product APIs](#product-apis) (Coinbase App, Coinbase Business, Exchange, Prime, or International Exchange), the same CDP API key concepts generally apply, but each product has its own nuances around authentication. Skip to [Product APIs](#product-apis) for direct links to each product's authentication guide.

## CDP API authentication

<CardGroup cols={2}>
  <Card title="Building a server-side application?">
    Use **Secret API Keys** with JWT authentication for maximum security and control.

    * ✓ Backend servers
    * ✓ Automated trading systems
    * ✓ Data processing pipelines
  </Card>

  <Card title="Building a client-side application?">
    Use **Client API Keys** for public-facing apps or **OAuth** for user account access.

    * ✓ Web applications
    * ✓ Mobile apps
    * ✓ Browser extensions
  </Card>
</CardGroup>

### 1. Where will you use it?

CDP offers three types of keys based on **where** you'll use them:

| Key Type | When to Use | Example |
| - | - | - |
| **Secret API Key** | Server-side code only (never exposed) | Backend API, automated trading bot |
| **Client API Key** | Client-side code (can be exposed) | React app, mobile app |
| **OAuth Client** | When users need to login with their Coinbase account | "Sign in with Coinbase" feature |

### 2. Choose your key algorithm

When creating a **Secret API Key**, you'll also choose between two cryptographic algorithms:

* **Ed25519** (default, recommended): Newer, faster algorithm
* **ECDSA**: Older algorithm, required for some SDKs. See [product compatibility](#product-compatibility) for more details.

<Tip>
  Use **Ed25519** unless you're using the Coinbase App SDK or Advanced Trade SDK, which only support ECDSA.
</Tip>

<Accordion title="More on key algorithms">
  Both Ed25519 and ECDSA are cryptographic algorithms used to create digital signatures - think of them as ultra-secure ways to prove your identity when making API calls.

  **Ed25519**

  * Based on cutting-edge cryptography
  * Faster signature generation and verification
  * Smaller key size (more efficient)
  * Better resistance to certain types of attacks
  * Default for new CDP API keys as of February 2025

  **ECDSA (Elliptic Curve Digital Signature Algorithm)**

  * Older standard, widely used since early 2000s
  * Well-established and battle-tested
  * Required by some legacy SDKs that haven't updated yet
  * Still secure and fully supported

  **Why do some SDKs only support ECDSA?**

  Some SDKs were built before Ed25519 became available or haven't been updated to support it yet. We're working on adding Ed25519 support across all SDKs.
</Accordion>

### Product compatibility

The following describes which products work with default CDP API keys and which algorithm is supported:

| Product | Ed25519 Keys | ECDSA Keys | Documentation | Notes |
| - | - | - | - | - |
| **CDP APIs** | ✅ | ✅ | [CDP API Authentication](/api-reference/v2/authentication) | |
| **CDP SDK** | ✅ | ✅ | [TypeScript](https://github.com/coinbase/cdp-sdk/blob/main/typescript/packages/cdp-sdk/src/auth/README.md) / [Python](https://github.com/coinbase/cdp-sdk/tree/main/python/cdp/auth) | |
| **Advanced Trade API** | ✅ | ✅ | [Coinbase App API Key Authentication](/coinbase-app/authentication-authorization/api-key-authentication) | Direct API calls work with both |
| **Advanced Trade SDK** | ❌ | ✅ | [Coinbase App API Key Authentication](/coinbase-app/authentication-authorization/api-key-authentication) | Use ECDSA keys only |
| **Coinbase App API** | ✅ | ✅ | [Coinbase App API Key Authentication](/coinbase-app/authentication-authorization/api-key-authentication) | Direct API calls work with both |
| **Coinbase App SDK** | ❌ | ✅ | [Coinbase App API Key Authentication](/coinbase-app/authentication-authorization/api-key-authentication) | Use ECDSA keys only |
| **Exchange API** | ✅ | ✅ | [Exchange Authentication](/exchange/rest-api/authentication) | Separate key system with passphrase |
| **International Exchange** | ✅ | ✅ | [Intl Exchange Authentication](/international-exchange/websocket-feed/authentication) | Separate key system with passphrase |
| **Prime API** | ✅ | ✅ | [Prime Authentication](/prime/rest-api/authentication) | Separate key system with passphrase |
| **Sign in with Coinbase** | ✅ | ✅ | [OAuth Documentation](/api-reference/v2/authentication) | OAuth flow |

### Choosing a key type

* **New projects (default):** Ed25519 keys offer better performance and security
* **Using Advanced Trade SDK or Coinbase App SDK:** Request ECDSA keys during creation
* **Direct API integration:** Either algorithm works perfectly

<Warning>
  **Security reminder**: Never commit API keys to version control. Use environment variables for key storage, implement regular key rotation, and monitor usage for anomalies. Read our full [security best practices](/get-started/authentication/security-best-practices) guide.
</Warning>

## Product APIs

The guidance above applies to the **CDP APIs**. Coinbase also offers a set of **Product APIs** for programmatic access to your existing Coinbase accounts — your retail Coinbase account, a Coinbase Business account, an Exchange or International Exchange trading account, or a Prime institutional account. The core CDP API key concepts still apply, but each product has its own nuances — for example, a different key format, a slightly different signing scheme, or an additional passphrase.

If you're integrating with one of these surfaces, use the corresponding guide below:

<CardGroup cols={2}>
  <Card title="Coinbase App" icon="mobile" href="/coinbase-app/authentication-authorization/api-key-authentication">
    Programmatic access to your retail Coinbase account, including Advanced Trade.
  </Card>

  <Card title="Coinbase Business" icon="briefcase" href="/coinbase-business/authentication-authorization/api-key-authentication">
    Programmatic access to your Coinbase Business account.
  </Card>

  <Card title="Exchange" icon="chart-line" href="/exchange/rest-api/authentication">
    Authenticated REST and WebSocket access to Coinbase Exchange.
  </Card>

  <Card title="Prime" icon="building-columns" href="/prime/rest-api/authentication">
    Authenticated access to your Coinbase Prime institutional account.
  </Card>

  <Card title="International Exchange" icon="globe" href="/international-exchange/websocket-feed/authentication">
    Authenticated REST and WebSocket access to Coinbase International Exchange.
  </Card>

  <Card title="Coinbase OAuth2" icon="user-lock" href="/coinbase-app/oauth2-integration/overview">
    Let your users sign in with their Coinbase account so your app can act on their behalf.
  </Card>
</CardGroup>

## What to read next

* [JWT authentication](/get-started/authentication/jwt-authentication) - Generate secure authentication tokens for the CDP APIs
* [CDP API authentication](/api-reference/v2/authentication) - Complete implementation guide with code examples
* [Security best practices](/get-started/authentication/security-best-practices) - Keep your keys and applications secure
* [CDP CLI](/ai-agents/cdp-for-agents/cdp-mcp) - Test API calls and run AI-agent workflows from the command line
