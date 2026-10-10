> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Deposit Destinations

> Generate addresses to receive funds into your accounts.

<Note>
  Deposit Destinations require a business account. If you're interested in using this product, [get in touch](https://www.coinbase.com/developer-platform/developer-interest) and our team will follow up to discuss fit.
</Note>

Deposit destinations are crypto addresses that your customers or external parties can use to send funds directly. When a deposit arrives, the corresponding account's balance is credited automatically. A destination can also act as a liquidation address, automatically converting incoming funds into a different asset before crediting the account.

This is the primary mechanism for receiving inbound crypto payments into your custodial accounts.

## How deposit destinations fit your integration

1. Create a deposit destination for a specific account and network.
2. **Optional:** Set a target to liquidate incoming funds into a different asset.
3. The API returns a blockchain address for that network and account.
4. Share that address with the sender (customer, invoice payer, counterparty).
5. When funds arrive on-chain, the account's balance is credited automatically.
6. A `payments.transfers.completed` webhook fires when the deposit settles.

<Note>
  In the API, the resource is called a "deposit destination." The CDP Portal UI displays the same concept as a "deposit address."
</Note>

## Deposit destination types

| Type | Behavior |
| - | - |
| Deposit (no `target`) | Receives the asset on the specified network and credits the account balance in the same asset |
| Liquidation (`target` set) | Receives the asset, then liquidates it into the target asset on the target account |

## Supported assets and networks

Your entity configuration and environment determine which assets, networks, and settlement behavior are available. Before moving funds, verify your account's available deposit address options in the [CDP Portal](https://portal.cdp.coinbase.com/) and consult the request body's `crypto.network` documentation in the [Create deposit destination API reference](/api-reference/v2/rest-api/deposit-destinations/create-deposit-destination) for available networks.

<Warning>
  Only send supported assets to your deposit destinations. Sending unsupported assets or using unsupported networks may result in permanent loss of funds.

  If you accidentally send unsupported crypto, you may be able to recover it using Coinbase's [asset recovery service](https://help.coinbase.com/en/coinbase/trading-and-funding/sending-or-receiving-cryptocurrency/recover-unsupported-crypto).
</Warning>

## Core API operations

| Operation | What it does |
| - | - |
| Create deposit destination | `POST /v2/deposit-destinations` — provision a new crypto address tied to an account (optional `target`, optional `metadata`) |
| Get deposit destination | `GET /v2/deposit-destinations/{depositDestinationId}` — fetch a single deposit destination by ID |
| List deposit destinations | `GET /v2/deposit-destinations` — paginated destinations for your entity (filter by account, network, or address) |

## Metadata

You can attach [metadata](/payments/metadata) to any deposit destination to track the purpose or source of deposits. Metadata is returned with the deposit destination object, transfer records, and webhook notifications.

<Warning>
  **Temporary restriction on deposit destinations:** Metadata values must currently be in UUID format or integer string format. Free-form metadata values will be supported in a future release. This restriction is specific to deposit destinations — transfers and webhook subscriptions accept free-form string values.
</Warning>

## What to read next

<CardGroup cols={2}>
  <Card title="Quickstart" icon="rocket" href="/payments/crypto-deposit-destinations/quickstart">
    Create a deposit destination and simulate an inbound deposit
  </Card>

  <Card title="REST API reference" icon="code" href="/api-reference/v2/rest-api/deposit-destinations/deposit-destinations">
    Full API reference for deposit destination operations
  </Card>

  <Card title="Transfers" icon="arrow-right-arrow-left" href="/payments/transfers/overview">
    Move funds from an account to an external address or payment method
  </Card>

  <Card title="Webhooks" icon="webhook" href="/webhooks/transfers/overview">
    Subscribe to deposit events in real time
  </Card>
</CardGroup>
