> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Payment Methods

> External bank accounts to send fiat transfers to from your custodial accounts.

<Note>
  Payment Methods require a business account. If you're interested in using this product, [get in touch](https://www.coinbase.com/developer-platform/developer-interest) and our team will follow up to discuss fit.
</Note>

Payment methods are external bank accounts where you can send fiat from a custodial account. Set them up by logging into the Coinbase Prime UI. Since they're tied to your entity, any account in your organization can use them.

This is the primary mechanism for sending outbound fiat payments from your custodial accounts.

## How payment methods fit your integration

1. List the payment methods linked to your entity to see which bank accounts are available.
2. Create a transfer with the payment method's `paymentMethodId` as the target.
3. The funds settle to the external bank over the corresponding rail (Fedwire, Swift, or SEPA).

<Note>
  Payment methods are currently supported only as transfer targets (outbound). They cannot be used as a source for inbound funding.
</Note>

## Payment method types

| Type | Behavior |
| - | - |
| Fedwire (`fedwire`) | Sends USD over the Fedwire domestic wire network to a US bank |
| Swift (`swift`) | Sends fiat over the Swift international wire network to a foreign bank |
| SEPA (`sepa`) | Sends EUR over the SEPA network to a bank in the EU |

## Key fields

Each payment method includes:

| Field | Description |
| - | - |
| `paymentMethodId` | Unique identifier, used as `target.paymentMethodId` in transfers |
| `active` | Whether the payment method is currently usable. Only `active: true` methods will succeed in a transfer |
| `paymentRail` | The rail the payment method uses (`fedwire`, `swift`, or `sepa`) |
| Rail-specific object | Bank details for the selected rail. Fedwire returns `bankName`, `accountLast4`, `routingNumber`. Swift returns `bankName`, `accountLast4`, `bic`. SEPA returns `bankName`, `ibanLast4`, `bic`. Each also includes the `asset` |

## Core API operations

| Operation | What it does |
| - | - |
| List payment methods | `GET /v2/payment-methods` — paginated payment methods linked to your entity |
| Get payment method | `GET /v2/payment-methods/{paymentMethodId}` — fetch a single payment method by ID |

## What to read next

<CardGroup cols={2}>
  <Card title="Quickstart" icon="rocket" href="/payments/payment-methods/quickstart">
    List payment methods and use one as a transfer target
  </Card>

  <Card title="REST API reference" icon="code" href="/api-reference/v2/rest-api/payment-methods/payment-methods">
    Full API reference for payment method operations
  </Card>

  <Card title="Transfers" icon="arrow-right-arrow-left" href="/payments/transfers/overview">
    Create a transfer that sends funds to a payment method
  </Card>

  <Card title="Custodial wallets" icon="wallet" href="/wallets/custodial-wallets/overview">
    Use accounts, balances, and transfers with your custodial funds
  </Card>
</CardGroup>
