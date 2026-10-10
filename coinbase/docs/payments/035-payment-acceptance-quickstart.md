> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Payment Acceptance Quickstart

> Create a payment session, authorize it, and capture funds in Sandbox.

This guide walks through the core payment lifecycle in Sandbox: create a session, authorize it, capture the funds, and check status. The Sandbox environment uses mock data and does not move real funds.

**Base URL:** `https://sandbox.cdp.coinbase.com/platform`

## Prerequisites

Before you begin, you'll need:

<AccordionGroup>
  <Accordion title="CDP CLI">
    Install the CDP CLI (requires Node.js 22+):

    ```bash theme={null}
    npm install -g @coinbase/cdp-cli
    ```

    Configure a Sandbox environment using your CDP Secret API Key JSON file from the [CDP Portal](https://portal.cdp.coinbase.com):

    ```bash theme={null}
    cdp env sandbox --key-file ./cdp-api-key.json --url https://sandbox.cdp.coinbase.com
    ```

    <Warning>
      Keep the API key secret. Never commit it to source control.
    </Warning>
  </Accordion>

  <Accordion title="Onboarding">
    Payment Acceptance requires onboarding before you can use the APIs. [Contact our team](mailto:coinbase.payments@coinbase.com) to get started. Once onboarded, you'll receive Sandbox credentials and an account ID for testing.

    Set your account ID:

    ```bash theme={null}
    export ACCOUNT_ID="account_6f55e44d-..."
    ```
  </Accordion>
</AccordionGroup>

<Warning>
  Sandbox does not move real funds. Testing real payments or bank settlement requires CDP Live Mode, your own CDP Portal, and a funded account.
</Warning>

## 1. Create a payment session

Create a payment session with an amount, asset, and target. The target is the account where captured funds will settle.

```bash theme={null}
cdp api -X POST /payment-sessions -e sandbox \
  amount=25.00 \
  asset=usdc \
  target.accountId=$ACCOUNT_ID \
  target.asset=usd \
  'autoCapture:=false' \
  externalReferenceId=order-12345
```

<Accordion title="Example response">
  ```json theme={null}
  {
    "paymentSessionId": "paymentSession_82c879c1-84e1-44ed-a8c2-1ac239cf09ad",
    "entityId": "entity_af2937b0-9846-4fe7-bfe9-ccc22d935114",
    "status": "created",
    "amount": "25.00",
    "asset": "usdc",
    "target": {
      "accountId": "account_6f55e44d-10f3-5655-a756-e9db3d357315",
      "asset": "usd"
    },
    "autoCapture": false,
    "expiries": {
      "authorizationExpiresAt": "2026-05-17T12:00:00.000Z",
      "captureExpiresAt": "2026-05-23T12:00:00.000Z",
      "refundExpiresAt": "2026-06-15T12:00:00.000Z"
    },
    "balances": {
      "capturable": "0",
      "captured": "0",
      "refundable": "0",
      "refunded": "0"
    },
    "url": "https://pay.coinbase.com/payment-sessions/paymentSession_82c879c1-84e1-44ed-a8c2-1ac239cf09ad",
    "externalReferenceId": "order-12345",
    "createdAt": "2026-05-16T12:00:00.000Z",
    "updatedAt": "2026-05-16T12:00:00.000Z"
  }
  ```
</Accordion>

Save the payment session ID:

```bash theme={null}
export SESSION_ID="paymentSession_82c879c1-84e1-44ed-a8c2-1ac239cf09ad"
```

Key fields in the response:

* `url` — A hosted payment page URL you can redirect buyers to
* `expiries` — Deadlines for authorization (1 day), capture (7 days), and refund (30 days)
* `balances` — Running totals that update as funds move through the lifecycle
* `status` — Starts as `created`, waiting for buyer authorization

## 2. Authorize the payment

Authorization places a hold on the buyer's funds. Payment Acceptance supports wallet, Coinbase, and x402 authorization — see [Authorization](/payments/payment-acceptance/authorization) for all three flows in full.

**Wallet authorization is the flow to use in Sandbox.** It runs against real signature verification and real EVM RPC nodes — only the onchain settlement step is mocked, so no real funds move. Coinbase (OAuth) authorization is not available in Sandbox; test that flow against production once you've completed onboarding.

Start by fetching the available wallet authorization options for the buyer's address — this is a stateless read, no signing required yet:

```bash theme={null}
cdp api /payment-sessions/$SESSION_ID/authorizations/wallet/options \
  -e sandbox \
  addresses==0xAbC1234567890aBcDeF1234567890AbCdEf123456
```

<Accordion title="Example response">
  ```json theme={null}
  {
    "options": [
      {
        "optionId": "opt_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "source": {
          "address": "0xAbC1234567890aBcDeF1234567890AbCdEf123456",
          "network": "base",
          "asset": "usdc"
        },
        "amount": "25.00",
        "asset": "usdc",
        "network": "base",
        "payloads": [
          {
            "payloadId": "payload_af2937b0-...",
            "type": "eip3009",
            "data": { ... }
          }
        ]
      }
    ]
  }
  ```
</Accordion>

Signing the returned payloads requires a wallet SDK or library — see [Authorization](/payments/payment-acceptance/authorization) for the full sign-and-submit flow, including payload types and the request to submit the signed payloads. The authorization starts in `pending` and transitions asynchronously to `succeeded` or `failed`. In production, subscribe to [webhooks](/webhooks/payment-acceptance/overview) to get notified.

## 3. Check the session status

Poll the session to confirm authorization succeeded:

```bash theme={null}
cdp api /payment-sessions/$SESSION_ID -e sandbox --jq=.status
```

Once the status shows `authorization_succeeded`, the session's `balances.capturable` will equal the authorized amount.

## 4. Capture the funds

After fulfillment, capture the authorized funds. You can capture the full amount or a partial amount.

**Full capture:**

```bash theme={null}
cdp api -X POST /platform/v2/payment-sessions/$SESSION_ID/captures -e sandbox \
  'finalCapture:=true'
```

**Partial capture** (e.g., ship part of an order):

```bash theme={null}
cdp api -X POST /platform/v2/payment-sessions/$SESSION_ID/captures -e sandbox \
  amount=15.00 \
  'finalCapture:=false'
```

<Accordion title="Example response">
  ```json theme={null}
  {
    "captureId": "capture_a4eaa1f3-c6a4-77f9-d1f5-4df562df32df",
    "paymentSessionId": "paymentSession_82c879c1-84e1-44ed-a8c2-1ac239cf09ad",
    "status": "pending",
    "amount": "25.00",
    "finalCapture": true,
    "createdAt": "2026-05-16T12:05:00.000Z",
    "updatedAt": "2026-05-16T12:05:00.000Z"
  }
  ```
</Accordion>

Setting `finalCapture: true` releases any remaining capturable balance back to the buyer after the capture settles. If omitted or `false`, the remaining hold stays open for subsequent partial captures.

## Other lifecycle paths

The full capture in step 4 above moves the session to a terminal state — the steps below are alternative paths, not steps that follow it on the same session. Each applies to a session in a different state.

### Void uncaptured funds

If you need to release authorized funds without capturing (e.g., order canceled before shipment):

```bash theme={null}
cdp api -X POST /platform/v2/payment-sessions/$SESSION_ID/voids -e sandbox
```

Voids release all remaining capturable funds in a single operation. After voiding, no further captures can be made.

### Refund captured funds

To return funds to the buyer after capture:

```bash theme={null}
cdp api -X POST /platform/v2/payment-sessions/$SESSION_ID/refunds -e sandbox \
  source.accountId=$ACCOUNT_ID \
  source.asset=usdc \
  amount=10.00 \
  reason="Partial refund - item returned"
```

If `amount` is omitted, the full refundable balance is refunded. Multiple partial refunds are supported up to the total captured amount.

### Cancel an unused session

If a session was never authorized, cancel it to move it to a terminal state:

```bash theme={null}
cdp api -X POST /platform/v2/payment-sessions/$SESSION_ID/cancel -e sandbox \
  cancellationReason="Customer abandoned checkout"
```

Cancel only works on sessions in `created` status — before any authorization.

## 5. List payment sessions

View all payment sessions for your entity:

```bash theme={null}
cdp api /platform/v2/payment-sessions -e sandbox
```

## 6. Handle webhooks

In production, subscribe to `acceptance.payment_session.*` events to receive real-time status updates rather than polling. See [Webhooks](/webhooks/payment-acceptance/overview) for setup.

**Events fired for a successful payment:**

1. `acceptance.payment_session.authorization_pending` — buyer is authorizing
2. `acceptance.payment_session.authorization_succeeded` — funds held
3. `acceptance.payment_session.capture_pending` — capture initiated
4. `acceptance.payment_session.capture_succeeded` — funds settled

## Move to production

To run this flow with real funds:

1. Complete onboarding with our team ([get in touch](mailto:coinbase.payments@coinbase.com))
2. Set up your CDP account and Prime account for settlement
3. Switch from the Sandbox base URL to the production base URL
4. Use a production API key

Production payments settle real USDC from buyer wallets, with automated conversion and bank sweeps based on your settlement configuration.

## What to read next

<CardGroup cols={2}>
  <Card title="Payment Sessions" icon="rectangle-history" href="/payments/payment-acceptance/payment-sessions">
    Expiries, balances, auto-capture, and target types
  </Card>

  <Card title="Authorization" icon="shield-check" href="/payments/payment-acceptance/authorization">
    Wallet, Coinbase, and x402 authorization flows
  </Card>

  <Card title="Webhooks" icon="webhook" href="/webhooks/payment-acceptance/overview">
    Subscribe to real-time payment lifecycle events
  </Card>

  <Card title="API Reference" icon="code" href="/api-reference/v2/rest-api/payment-sessions/payment-sessions">
    Full Payment Acceptance API
  </Card>
</CardGroup>
