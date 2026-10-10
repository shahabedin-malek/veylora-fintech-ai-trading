> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Example payloads

Use this page to quickly compare transfer `source` and `target` payload examples.

## Supported resource types

| Endpoint | `source` allowed types | `target` allowed types |
| - | - | - |
| [Create transfer request](/api-reference/v2/rest-api/transfers/create-transfer) | - [Account](/api-reference/v2/rest-api/accounts/accounts) | - [Account](/api-reference/v2/rest-api/accounts/accounts)<br />- [Payment Method](/api-reference/v2/rest-api/payment-methods/payment-methods)<br />- Onchain address<br />- Email address |
| [Get transfers](/api-reference/v2/rest-api/transfers/list-transfers) | - [Account](/api-reference/v2/rest-api/accounts/accounts)<br />- Onchain address | - [Account](/api-reference/v2/rest-api/accounts/accounts)<br />- [Payment Method](/api-reference/v2/rest-api/payment-methods/payment-methods)<br />- Onchain address<br />- Email address |
| [Get transfer by ID](/api-reference/v2/rest-api/transfers/get-transfer) | - [Account](/api-reference/v2/rest-api/accounts/accounts)<br />- Onchain address | - [Account](/api-reference/v2/rest-api/accounts/accounts)<br />- [Payment Method](/api-reference/v2/rest-api/payment-methods/payment-methods)<br />- Onchain address<br />- Email address |
| [Transfer webhook event payloads](/webhooks/transfers/example-payloads) | - [Account](/api-reference/v2/rest-api/accounts/accounts)<br />- Onchain address | - [Account](/api-reference/v2/rest-api/accounts/accounts)<br />- [Payment Method](/api-reference/v2/rest-api/payment-methods/payment-methods)<br />- Onchain address<br />- Email address |

## Example payloads

### Source

An example of a `source` payload using an account:

```json theme={null}
{
  "source": {
    "accountId": "account_...",
    "asset": "usd"
  }
}
```

### Target

An example of a `target` payload using an onchain address:

```json theme={null}
{
  "target": {
    "address": "0x...",
    "network": "base",
    "asset": "usdc"
  }
}
```

## Type-specific examples

### Onchain address

An example onchain address object used in transfer payloads:

```json theme={null}
{
  "address": "0x...",
  "network": "base",
  "asset": "usdc"
}
```

### Email address

An example email address object used in transfer target payloads:

```json theme={null}
{
  "email": "recipient@example.com",
  "asset": "usd"
}
```

### Payment method

An example payment method object used in transfer target payloads:

```json theme={null}
{
  "paymentMethodId": "paymentMethod_...",
  "asset": "usd"
}
```

### Account

A `target` payload for account-to-account transfers within your entity. The target can also be an account belonging to another entity in the same organization:

```json theme={null}
{
  "accountId": "account_<target-account-id>",
  "asset": "usdc"
}
```

### Deposit destination in `details`

An example deposit destination reference in transfer or webhook payloads:

```json theme={null}
{
  "details": {
    "depositDestination": {
      "id": "depositDestination_..."
    }
  }
}
```

<Note>
  This page shows examples for `source` and `target` only.

  [Deposit destinations](/payments/deposit-destinations/overview) are returned separately in `details.depositDestination.id` (not inside `source` or `target`).

  See [Webhooks example payloads](/webhooks/transfers/example-payloads) for a full deposit-data example.
</Note>
