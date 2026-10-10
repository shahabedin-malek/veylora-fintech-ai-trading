> Coinbase CDP docs — **onramp-offramp** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Overview

Coinbase [Onramp](/onramp/onramp-overview) and [Offramp](/onramp/offramp/offramp-overview) enable seamless movement of value between fiat and crypto in both directions. Whether your users want to fund their wallets with crypto or cash out their holdings to fiat, these products provide fast, compliant, and user-friendly experiences that work globally.

See the [Web demo](https://github.com/coinbase/onramp-demo-application) and the [Mobile demo](https://github.com/coinbase/onramp-v2-mobile-demo) to try them out. New integrations start in trial mode — [apply for full access](https://support.cdp.coinbase.com/onramp-onboarding) to remove limits.

## Use cases

<CardGroup cols={2}>
  <Card title="Onboard new users" icon="user-plus">
    Purchase first crypto with familiar payment methods.
  </Card>

  <Card title="Fund wallets" icon="wallet">
    Add funds to self-custody wallets directly from your app.
  </Card>

  <Card title="Enable cash out" icon="money-bill-transfer">
    Convert crypto earnings to fiat and deposit to bank accounts.
  </Card>

  <Card title="DeFi onboarding" icon="arrows-rotate">
    Acquire crypto for DeFi applications and protocols.
  </Card>
</CardGroup>

## Key features

| Feature | Onramp (Fiat → Crypto) | Offramp (Crypto → Fiat) |
| - | - | - |
| **What it does** | Converts fiat currency into crypto and sends to any wallet address | Converts crypto into fiat currency and deposits to bank accounts |
| **Payment methods** | • Debit cards<br />• Credit cards (non-US)<br />• Apple Pay<br />• Google Pay<br />• ACH bank transfers (US)<br />• Coinbase balances | • ACH bank transfers (US)<br />• PayPal (select countries)<br />• Coinbase balances |
| **Integration options** | • Coinbase-hosted<br />• Headless (Embedded Apple Pay / Google Pay) | • Coinbase-hosted |
| **Shared infrastructure** | Same API authentication, session tokens, webhooks, security requirements, and transaction APIs | Same API authentication, session tokens, webhooks, security requirements, and transaction APIs |

## Supported assets & networks

Both products support all crypto assets and networks available on Coinbase, including:

* **Layer 1 networks:** Bitcoin, Ethereum, Solana, Polygon, Avalanche, and more
* **Layer 2 networks:** Base, Optimism, Arbitrum
* **Popular assets:** ETH, BTC, USDC, SOL, MATIC, and 200+ other cryptocurrencies

Use the [Config and Options APIs](/onramp/coinbase-hosted-onramp/countries-&-currencies) to retrieve the complete, up-to-date list of supported assets, networks, and payment methods available for your users' location.

## What to read next

<CardGroup cols={3}>
  <Card title="Quickstart" icon="rocket" href="/onramp/introduction/quickstart">
    Set up your CDP account, create a Secret API Key, and make your first API calls.
  </Card>

  <Card title="Onramp overview" icon="arrow-right-to-arc" href="/onramp/onramp-overview">
    Compare Coinbase-hosted and Headless integration options for Onramp.
  </Card>

  <Card title="Offramp overview" icon="arrow-left-from-arc" href="/onramp/offramp/offramp-overview">
    Learn how to integrate Offramp to enable cash out functionality.
  </Card>

  <Card title="Webhooks" icon="webhook" href="/webhooks/onramp">
    Get real-time notifications for onramp and offramp transaction events.
  </Card>
</CardGroup>

<Card title="Apply for Onramp Access" icon="file-pen" href="https://support.cdp.coinbase.com/onramp-onboarding">
  To get full access to Coinbase Onramp & Offramp beyond trial mode limits, complete the onboarding form.
</Card>

<Tip>
  **Need help?** Join our [Discord community](https://discord.com/invite/cdp) to connect with our team and other developers.
</Tip>
