> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Payment Sessions

> Targets, expiries, balances, auto-capture, and metadata for Payment Acceptance payment sessions.

A payment session is the central object in Payment Acceptance. It tracks the full lifecycle of a payment from creation through settlement, including authorization, capture, void, and refund.

## Creating a session

Create a payment session by specifying the amount, asset, and target:

```json theme={null}
{
  "amount": "100.00",
  "asset": "usdc",
  "target": {
    "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
    "asset": "usd"
  }
}
```

The response includes a `url` field — a hosted payment page where the buyer can complete the payment.

### Target types

The target determines where captured funds settle.

| Target | Fields | Settlement |
| - | - | - |
| **CDP Account** | `accountId`, `asset` | Funds settle to your CDP account. Supports USD and USDC. Automated bank sweeps available. |
| **Wallet address** | `address`, `network` | USDC settled directly to your onchain address on Base. |

**Account target** (most common for PSPs):

```json theme={null}
{
  "target": {
    "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
    "asset": "usd"
  }
}
```

**Wallet target:**

```json theme={null}
{
  "target": {
    "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "network": "base"
  }
}
```

Payment sessions created with a wallet target also include an `x402Url` in the response — a CDP-hosted URL that you can give to an x402-enabled agent. The agent makes a `POST` request to this URL, and CDP returns the x402 payment requirements in the `PAYMENT-REQUIRED` header, including the supported USDC payment options. After the agent completes the x402 payment flow, the session follows the normal lifecycle — you can capture, void, or refund it using the same APIs as other wallet-authorized sessions. See [Authorization](/payments/payment-acceptance/authorization) for the full x402 flow.

## Expiries

Every session has three deadlines controlling when each action can be performed. If omitted, sensible defaults are applied:

| Deadline | Default | What happens when it passes |
| - | - | - |
| `authorizationExpiresAt` | Now + 1 day | Authorization attempts are rejected |
| `captureExpiresAt` | Now + 7 days | Capture attempts are rejected |
| `refundExpiresAt` | Now + 30 days | Refund attempts are rejected |

Expiries must satisfy: `authorizationExpiresAt <= captureExpiresAt <= refundExpiresAt`.

<Note>
  Expiry deadlines are guards, not automatic state transitions. When a deadline passes, the corresponding action is blocked, but the session stays in its current status. You must explicitly cancel (pre-auth) or void (post-auth) to move the session to a terminal state.
</Note>

To set custom expiries:

```json theme={null}
{
  "amount": "100.00",
  "asset": "usdc",
  "target": { "accountId": "account_...", "asset": "usd" },
  "expiries": {
    "authorizationExpiresAt": "2026-06-01T00:00:00Z",
    "captureExpiresAt": "2026-06-15T00:00:00Z",
    "refundExpiresAt": "2026-07-15T00:00:00Z"
  }
}
```

## Balances

The `balances` object tracks running totals as funds move through the session:

```json theme={null}
{
  "balances": {
    "capturable": "100.00",
    "captured": "0",
    "refundable": "0",
    "refunded": "0"
  }
}
```

| Balance | Description | Changes when |
| - | - | - |
| `capturable` | Authorized funds not yet captured or voided | Decreases with each capture or void |
| `captured` | Total funds captured across all captures | Increases with each successful capture |
| `refundable` | Captured funds not yet refunded | Equals `captured` minus `refunded` |
| `refunded` | Total funds refunded across all refunds | Increases with each successful refund |

### Example: partial capture flow

1. Authorization succeeds for \$100 — `capturable: 100, captured: 0`
2. Capture \$60 — `capturable: 40, captured: 60, refundable: 60`
3. Capture \$30 — `capturable: 10, captured: 90, refundable: 90`
4. Void remaining — `capturable: 0, captured: 90, refundable: 90`
5. Refund \$20 — `capturable: 0, captured: 90, refundable: 70, refunded: 20`

## Auto-capture

Set `autoCapture: true` to automatically capture the full authorized amount after a successful authorization:

```json theme={null}
{
  "amount": "50.00",
  "asset": "usdc",
  "target": { "accountId": "account_...", "asset": "usd" },
  "autoCapture": true
}
```

When auto-capture is enabled, you don't need to call the captures endpoint — a capture is created automatically after `authorization_succeeded`. This is useful when you don't need to delay capture for fulfillment.

When `autoCapture` is `false` (default), you must create captures manually via the captures endpoint.

## Final capture

When capturing partially, set `finalCapture: true` on the last capture to release remaining funds to the buyer:

```json theme={null}
{
  "amount": "60.00",
  "finalCapture": true
}
```

After `finalCapture: true` settles, any remaining capturable balance is released back to the buyer. If `finalCapture` is `false`, the remaining hold stays open for subsequent partial captures (subject to `captureExpiresAt`).

Has no effect when capturing the full capturable balance, since no remaining balance exists.

## Customer display

Use `customerDisplay` to show merchant branding and local-currency amounts to the buyer during checkout:

```json theme={null}
{
  "amount": "1.00",
  "asset": "usdc",
  "target": { "accountId": "account_...", "asset": "usd" },
  "customerDisplay": {
    "merchantName": "Acme Store",
    "displayAmount": {
      "amount": "1.37",
      "currency": "cad"
    }
  }
}
```

| Field | Description |
| - | - |
| `merchantName` | Overrides the default entity name on the payment UI |
| `displayAmount` | Amount and currency shown to the buyer — informational only, does not affect settlement |

`customerDisplay` is purely presentational. The authoritative settlement amount is always the session's `amount` and `asset`.

## Redirect URLs

For web-based payment flows, configure redirect URLs to send the buyer back to your site after payment:

```json theme={null}
{
  "redirect": {
    "successUrl": "https://merchant.example.com/payment/success",
    "failureUrl": "https://merchant.example.com/payment/failed"
  }
}
```

## External reference ID

Attach your own identifier (order ID, invoice number) to the session for reconciliation:

```json theme={null}
{
  "externalReferenceId": "order-2026-05-12345"
}
```

Stored and returned as-is. Not interpreted by Coinbase — use it to match sessions with your internal records. Maximum 256 characters.

## Metadata

Attach up to 10 key-value pairs to a session, capture, void, refund, or authorization:

```json theme={null}
{
  "metadata": {
    "customer_id": "cust_12345",
    "order_reference": "order-67890"
  }
}
```

| Constraint | Limit |
| - | - |
| Maximum key-value pairs | 10 |
| Maximum key length | 40 characters |
| Maximum value length | 500 characters |

<Warning>
  Never store sensitive data like passwords, account numbers, or PII in metadata.
</Warning>

### Reserved keys for settlement reporting

A few metadata keys are reserved — settlement reports read them out of the generic `metadata` object and surface them as dedicated report columns. Pass these exact key names if you want the corresponding column populated. They don't require any request field beyond the standard `metadata` object shown above.

| Metadata key | Pass in on | Report column |
| - | - | - |
| `captureReference` | capture | `captureReference` |
| `refundReference` | refund | `refundReference` |
| `merchantId` | capture or refund | `merchantId` |
| `merchantReference` | capture or refund | `merchantReference` |
| `captureShortCode` | capture | `captureShortCode` |
| `refundShortCode` | refund | `refundShortCode` |
| `paymentShortCode` | payment session | `paymentShortCode` |

`merchantId` and `merchantReference` are set per capture or refund, not once at session creation — unlike `externalReferenceId`, which applies to the whole session.

## Cancellation

Cancel a session before any funds are authorized:

```json theme={null}
{
  "cancellationReason": "Customer abandoned checkout"
}
```

Cancel only works when the session is in `created` status and no authorization is pending. Once canceled, no further actions can be performed. This is the only way to terminate a pre-authorization session — expiry deadlines block actions but don't automatically move the session to a terminal state.

## Related

<CardGroup cols={2}>
  <Card title="Authorization" icon="shield-check" href="/payments/payment-acceptance/authorization">
    Wallet, Coinbase, and x402 authorization flows
  </Card>

  <Card title="Hosted Checkout" icon="credit-card" href="/payments/payment-acceptance/hosted-checkout">
    Redirect flow and the embeddable web component
  </Card>

  <Card title="Disbursements" icon="money-bill-transfer" href="/payments/payment-acceptance/disbursements">
    Send funds independent of a payment session
  </Card>

  <Card title="Webhooks" icon="webhook" href="/webhooks/payment-acceptance/overview">
    Get notified on every status change
  </Card>

  <Card title="API Reference" icon="code" href="/api-reference/v2/rest-api/payment-sessions/payment-sessions">
    Full API specification
  </Card>
</CardGroup>
