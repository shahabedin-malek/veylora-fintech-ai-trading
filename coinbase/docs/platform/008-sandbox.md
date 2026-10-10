> Coinbase CDP docs — **platform** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Sandbox

> Test your integration in a safe, isolated environment.

Sandbox is a fully isolated testing environment for custodial features without connecting real funds. It uses the same endpoints, authentication, and response formats as Live, so there's nothing new to learn when you're ready to ship. Transactions are simulated with no real funds moving, no mainnet or testnet activity, and no compliance checks, so you can test your integration thoroughly before going to production.

## Key concepts

| Resource | Direction | Description |
| - | - | - |
| **Account** | — | Your asset balance within Coinbase that you fund with test amounts (e.g., \$1000 USD) |
| **Customer** | — | Your end-user's KYC and compliance record. Create via the [Customers API](/customers-kyc/quickstart); test verification outcomes with [magic SSN values](/customers-kyc/requirements#testing-in-sandbox) |
| **Deposit destination** | Incoming crypto | Placeholder addresses for receiving crypto. Simulate deposits via the Portal UI |
| **Payment method** | Outgoing fiat | External bank accounts for fiat withdrawals. Pre-configured test banks shared across all accounts |
| **Transfer** | Both | Move funds to crypto addresses, emails, or payment methods. All simulated |

## Sandbox vs. Live

Sandbox and Live share the same endpoints and functionality, but with different data and behavior.

| | Sandbox | Live |
| - | - | - |
| **Base URL** | `sandbox.cdp.coinbase.com` | `api.cdp.coinbase.com` |
| **API keys** | Sandbox-specific credentials | Live credentials |
| **Accounts** | Create via Sandbox UI; fund via UI only | Link existing Prime portfolio or Coinbase Business account |
| **Customers** | Available to all developers; deterministic outcomes via magic SSN values | Partner onboarding required for Live access |
| **Deposit destinations** | Placeholder addresses; simulate deposits via UI | Real blockchain addresses |
| **Payment methods** | Pre-configured test methods | Automatically linked from Prime/Business |
| **Transfers** | Simulated (webhooks fire, no blockchain activity) | Real blockchain transactions |
| **Compliance checks** | Simplified (no real KYC/AML) | Full compliance flows |

## Best practices

* **Isolate configuration**: Keep Sandbox API keys and base URLs completely separate from Live. Use environment variables to switch between them.
* **Test error handling**: Use Sandbox to cover failure scenarios — invalid auth, malformed requests, rate limits, insufficient funds.
* **Automate**: Build integration tests against Sandbox before cutting over to Live.

## Get started

<CardGroup cols={2}>
  <Card title="Quickstart" icon="bolt" href="/get-started/sandbox/quickstart">
    Set up your API keys and make your first Sandbox request.
  </Card>

  <Card title="API Reference" icon="code" href="/api-reference/v2/introduction">
    Explore the full Payment APIs reference.
  </Card>
</CardGroup>
