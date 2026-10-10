> Coinbase CDP docs — **wallets** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Non-Custodial Wallets

> Non-custodial wallets for users (with social login, no seed phrases) and systems (via API key, keys in a TEE).

export const Tags = ({tags, className}) => {
  if (!tags || !Array.isArray(tags)) {
    return null;
  }
  return <div className={`mt-5 mb-5 flex flex-row flex-wrap gap-2 ${className}`}>
      {tags.map((tag, index) => <span key={index} className="text-sm text-[#733E00] dark:text-yellow-500 bg-[#FFFCF1] dark:bg-yellow-500/10 font-semibold px-2 py-1 rounded-lg">{tag}</span>)}
    </div>;
};

<Tags tags={["EVM", "Solana"]} />

## Overview

CDP non-custodial wallets are built for both users and systems.

**For users**, wallets are embedded directly in your app. Users can sign in with email, SMS, social login, or a JWT from your own authentication system. No seed phrases, browser extensions, or pop-ups required. Users control the wallet and can export their keys; a time-bound delegation can optionally let your backend sign and send transactions until it expires.

**For systems**, wallets are accessed via the same secure API key authentication battle-tested across all CDP APIs. Your server creates and manages accounts programmatically while CDP handles all private key security inside a Trusted Execution Environment.

<Frame>
  <div className="wallet-comparison-wrapper">
    <img src="https://mintcdn.com/coinbase-prod/5svNnr4eY4oah0oo/images/wallet-experience-comparison.svg?fit=max&auto=format&n=5svNnr4eY4oah0oo&q=85&s=bfd304d86167aeb98ce0136df75d3a3d" alt="Comparison showing traditional wallets require 6 steps including seed phrase management, while user wallets only need 3 simple steps" width="2600" height="2080" data-path="images/wallet-experience-comparison.svg" />
  </div>
</Frame>

## Authentication models

CDP non-custodial wallets support two authentication models depending on who controls the wallet:

<CardGroup cols={2}>
  <Card title="User authentication" icon="user">
    Wallets controlled by your end users. Use CDP's email, SMS, or social login, or [connect your existing authentication system with JWTs](/wallets/authentication/custom-authentication). Best for consumer apps, games, and social platforms.

    Supported in TypeScript, React, and React Native.
  </Card>

  <Card title="API key authentication" icon="key">
    Wallets controlled by your server with a CDP API key and Wallet Secret. Best for automated workflows, agentic applications, and backend services.

    Accessible via the [CDP SDK](https://github.com/coinbase/cdp-sdk) or [REST endpoints](/api-reference/v2/introduction).
  </Card>
</CardGroup>

## Wallet ownership and control

Choose the authentication model that matches who should control funds and signing. Both models use CDP's secure wallet infrastructure, but custody and credential control differ.

| | User wallets | API key wallets |
| - | - | - |
| Who controls the wallet | Your end user | Your server or backend service |
| Authentication | CDP-managed login (email, SMS, or social login) or [your own JWT-based authentication](/wallets/authentication/custom-authentication) | CDP API key and Wallet Secret |
| Ownership | User-controlled. Only users can export their keys. | Developer-controlled. Your service controls the API credentials and can operate the wallet. |
| Common use cases | Consumer apps, games, social platforms, and payments | Agents, automated workflows, and backend services |

## Build the wallet experience you want

You control how prominently wallets appear in your product. You can build a visible wallet experience, keep wallet creation and access in the background behind your existing login, or use a mix of both.

* **Flexible authentication:** Use CDP-managed authentication with [email, SMS, or social login](/wallets/authentication/overview), or [bring your own authentication system](/wallets/authentication/custom-authentication) and pass its JWTs to CDP.
* **Full control over the user experience:** Wallet and signing complexity can be abstracted away from users with [Delegated Signing](/wallets/using-wallets/delegated-signing). After a user grants a time-bound delegation, your backend can sign within that delegation while the user is offline.

## Key capabilities

CDP non-custodial wallets provide:

* **Easy onboarding**: Familiar login methods (email OTP and social logins) replace complex seed phrases
* **Lightning-fast wallets**: Wallet creation and signing under 500ms, enabling instant user onboarding
* **Complete customization**: Full control over UI/UX to match your brand and user experience
* **Enterprise-grade security**: Advanced cryptographic operations and transaction signing powered by secure infrastructure
* **Everything Wallet**: Access onramp/offramp, balances, transfers, swaps, and staking without additional integrations
* **USDC Rewards**: US-based developers earn 3.60% rewards on balances held across CDP non-custodial wallets

## Try the interactive demo

Experience user wallets firsthand at [demo.cdp.coinbase.com](https://demo.cdp.coinbase.com). The demo lets you:

* **Explore the user experience**: See how smooth onboarding can be with web2-friendly authentication
* **Test customization**: Preview how user wallets can match your app's look and feel
* **Try core features**: Wallet creation, transactions, and key management in action

Perfect for developers who want to understand the product before diving into implementation.

## Use cases

**User wallets**

* **Consumer apps**: Payments, gaming, and social platforms where users sign in with email or social login and transact without managing keys
* **Marketplaces**: Streamlined checkout with built-in crypto payments and NFT trading
* **DeFi applications**: Lending, borrowing, and yield farming with a familiar web2-style UX

**API key wallets**

* **Agentic applications**: Give AI agents controlled wallet access with policy-enforced spending limits
* **Automated workflows**: Execute transactions triggered by webhooks or onchain events without user involvement
* **Backend treasury management**: Programmatically manage funds across EVM and Solana from your server

## Supported networks

<CardGroup cols={3}>
  <Card title="EVM Networks" icon="ethereum">
    All EVM-compatible networks including Base, Ethereum, Arbitrum, Polygon, Optimism, and more
  </Card>

  <Card title="Solana" icon={<img src="https://mintcdn.com/coinbase-prod/cCGVQ8zMGF76EFDn/icons/solana-blue.svg?fit=max&auto=format&n=cCGVQ8zMGF76EFDn&q=85&s=a06e8b9f0a9c686cf815de662b85b691" alt="Solana" className="w-6 h-6" />}>
    Full support for Solana mainnet and devnet
  </Card>

  <Card title="Testnets" icon="flask">
    Base Sepolia, Ethereum Sepolia, Solana Devnet, and other test networks for development
  </Card>
</CardGroup>

## Get started

<Note>
  You can build with non-custodial wallets using a free CDP Portal account and project; business verification is not required. When you're ready to use a Coinbase Business account with your CDP integration, [verify your business and go live](/get-started/initial-setup#verify-your-business-and-go-live).
</Note>

<CardGroup cols={2}>
  <Card title="Quickstart: User Auth Wallets" icon="bolt" href="/wallets/quickstart/user-auth">
    Add user wallets to your React app in under 10 minutes
  </Card>

  <Card title="Quickstart: API Key Wallets" icon="server" href="/wallets/quickstart/api-key-auth">
    Create and manage wallets programmatically from your backend
  </Card>

  <Card title="Webhooks" icon="webhook" href="/webhooks/wallets">
    Subscribe to real-time transaction, signing, and delegation events.
  </Card>
</CardGroup>
