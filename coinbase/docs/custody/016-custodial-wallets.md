> Coinbase CDP docs — **custody** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Custodial Wallets

> Programmatic accounts for custody, balances, and money movement on CDP.

<Note>
  Custodial Wallets require a business account. If you're interested in using this product, [get in touch](https://www.coinbase.com/developer-platform/developer-interest) and our team will follow up to discuss fit.
</Note>

Custodial Wallets hold balances in one or more assets (for example USD, USDC, or other supported crypto) and act as the source or target for deposits, transfers, and payouts you orchestrate from your backend.

Coinbase provides **custody** for assets in these accounts on behalf of your CDP entity. You can create **entity-owned** accounts for treasury, settlement, and operational balances, and **customer-owned** accounts for balances attributed to your KYC-verified end users via [Customers & KYC](/customers-kyc/overview). If your organization already uses Coinbase Prime or Coinbase Business, you can also link an existing account and operate it through the same CDP APIs.

## How accounts fit your integration

Typical flows build on three ideas:

1. **Create and name accounts** to segment funds (for example per merchant, product line, or settlement bucket), or link an existing Coinbase Prime portfolio or Coinbase Business account.
2. **Receive value** using [deposit destinations](/payments/deposit-destinations/overview). **Crypto** deposit addresses are the supported path for inbound funds today. **Fiat** deposit destinations are in active development.
3. **Move value** using [transfers](/payments/transfers/overview) between accounts, to external onchain addresses, to linked Coinbase balances where supported, or through other supported rails.

## Account ownership models

Custodial balances can be held in **Custodial Wallet accounts** you create with the Accounts API (`type: cdp`) or in accounts linked from Coinbase Prime (`type: prime`) or Coinbase Business (`type: business`).

| Model | Account type | Who owns the balance | Typical use |
| - | - | - | - |
| Entity account | `cdp` | Your CDP organization | Company treasury, settlement pools, operational hot balances |
| Customer account | `cdp` | Your end customer under an approved program | Per-user balances, payouts, and disclosures where you need customer-level ledgering |
| Linked Prime account | `prime` | Your Coinbase Prime portfolio | Existing Prime balances you want to operate through CDP APIs |
| Linked Business account | `business` | Your Coinbase Business account | Existing Coinbase Business balances you want to operate through CDP APIs |

To create a customer-owned account, pass the customer ID as `owner` on [`POST /v2/accounts`](/api-reference/v2/rest-api/accounts/create-account). The customer must hold all three custody capabilities (`custodyCrypto`, `custodyFiat`, and `custodyStablecoin`). See the [Customers quickstart](/customers-kyc/quickstart) for an end-to-end example.

### Custodial Wallet accounts vs. linked accounts

In Live, Custodial Wallet accounts (`type: cdp`) are created and operated through the CDP APIs. They run on the same infrastructure that powers Coinbase Prime portfolios and integrate more seamlessly with CDP webhooks and data APIs, including webhook notifications as new features become available. There is no Live UI for manually operating these accounts. In Sandbox, use the CDP Portal to create test accounts and add simulated balances. See [Sandbox overview](/get-started/sandbox/overview) for details.

Linked Prime accounts (`type: prime`) let you connect an existing Coinbase Prime portfolio instead of moving funds into a Custodial Wallet account you create. After linking, you can use supported CDP data, transfer, and payment APIs to interact with the portfolio programmatically, and you can still sign in to Coinbase Prime to view and manually operate the same portfolio in the Prime UI.

Coinbase Business accounts (`type: business`) can be linked in the same way. Linking requires the **CDP Admin** role. In the CDP Portal, open **Accounts**, select **Link account**, and choose the Prime portfolio or Coinbase Business account you want to make available. See [Initial Setup](/get-started/initial-setup#verify-your-business-and-go-live) for the complete linking steps.

## Supported assets and networks

Your entity configuration and environment determine which assets, networks, and settlement behavior are available. Verify your account setup before moving funds.

## Core API operations

| Operation | What it does |
| - | - |
| Create account | [`POST /v2/accounts`](/api-reference/v2/rest-api/accounts/create-account) — provision a new Custodial Wallet account (optional display `name`, optional idempotency header) |
| Get account | [`GET /v2/accounts/{accountId}`](/api-reference/v2/rest-api/accounts/get-account) — metadata such as type, owner, and timestamps |
| List accounts | [`GET /v2/accounts`](/api-reference/v2/rest-api/accounts/list-accounts) — paginated accounts for your entity |
| List balances | [`GET /v2/accounts/{accountId}/balances`](/api-reference/v2/rest-api/accounts/list-balances-for-account) — balances per asset |
| Get balance for asset | [`GET /v2/accounts/{accountId}/balances/{asset}`](/api-reference/v2/rest-api/accounts/get-balance-for-account) — single-asset balance detail |

Authentication follows the same CDP API key and JWT model as the rest of the platform. See [Authentication](/api-reference/v2/authentication) and [Idempotency](/api-reference/v2/idempotency) for request signing and safe retries.

## What to read next

<CardGroup cols={2}>
  <Card title="Custodial wallets quickstart" icon="rocket" href="/wallets/custodial-wallets/quickstart">
    Create an account in Sandbox and confirm balances with the API
  </Card>

  <Card title="Accounts API reference" icon="code" href="/api-reference/v2/rest-api/accounts/accounts">
    OpenAPI-backed reference for account and balance endpoints
  </Card>

  <Card title="Custodial wallets quickstart" icon="flask" href="/wallets/custodial-wallets/quickstart">
    Create and fund Sandbox accounts
  </Card>

  <Card title="Payments overview" icon="credit-card" href="/payments/overview">
    How payment acceptance, transfers, and deposit destinations relate to accounts
  </Card>

  <Card title="Customers & KYC" icon="shield-check" href="/customers-kyc/overview">
    Onboard end users and unlock customer-owned accounts
  </Card>
</CardGroup>
