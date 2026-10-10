> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Webhook Subscriptions

> Create and manage webhook subscriptions for Payment Acceptance events.

Create and manage webhook subscriptions for Payment Acceptance events. Payment Acceptance uses the same CDP webhook infrastructure as other CDP products.

## Prerequisites

You will need:

* Your CDP API Key ID and secret
* A webhook notification HTTPS URL
* Install the [CDP CLI](/ai-agents/cdp-for-agents/cdp-mcp) and run `cdp env live --key-file ./cdp_api_key.json` once to configure credentials.

## 1. Review the configuration

Decide which Payment Acceptance events to receive. You can subscribe to all events or only the ones you need.

### Payment session events

| Event type | Description |
| :- | :- |
| `acceptance.payment_session.created` | Session created |
| `acceptance.payment_session.canceled` | Session canceled |
| `acceptance.payment_session.authorization_pending` | Authorization in progress |
| `acceptance.payment_session.authorization_succeeded` | Funds held |
| `acceptance.payment_session.authorization_failed` | Authorization failed |
| `acceptance.payment_session.capture_pending` | Capture in progress |
| `acceptance.payment_session.capture_succeeded` | Funds captured |
| `acceptance.payment_session.capture_failed` | Capture failed |
| `acceptance.payment_session.void_pending` | Void in progress |
| `acceptance.payment_session.void_succeeded` | Void completed |
| `acceptance.payment_session.void_failed` | Void failed |
| `acceptance.payment_session.refund_pending` | Refund in progress |
| `acceptance.payment_session.refund_succeeded` | Refund completed |
| `acceptance.payment_session.refund_failed` | Refund failed |

### Disbursement events

| Event type | Description |
| :- | :- |
| `acceptance.disbursement.pending` | Disbursement accepted |
| `acceptance.disbursement.succeeded` | Disbursement settled |
| `acceptance.disbursement.failed` | Disbursement failed |

### Mandate events

| Event type | Description |
| :- | :- |
| `acceptance.mandate.created` | Mandate created |
| `acceptance.mandate.approval_initiated` | Approval confirming |
| `acceptance.mandate.approval_succeeded` | Mandate ready to use |
| `acceptance.mandate.approval_failed` | Approval failed |
| `acceptance.mandate.canceled` | Mandate canceled |
| `acceptance.mandate.revocation_initiated` | Revocation confirming |
| `acceptance.mandate.revocation_succeeded` | Approval removed |
| `acceptance.mandate.revocation_failed` | Revocation failed |

## 2. Subscribe

Create the subscription with the CDP CLI. Store the returned `subscriptionId` and `secret` - you'll need the secret for [signature verification](/webhooks/payment-acceptance/verification).

**Subscribe to all Payment Acceptance events:**

```bash theme={null}
cdp data webhooks subscriptions create \
  description="Payment Acceptance webhook" \
  'eventTypes:=["acceptance.payment_session.created","acceptance.payment_session.canceled","acceptance.payment_session.authorization_pending","acceptance.payment_session.authorization_succeeded","acceptance.payment_session.authorization_failed","acceptance.payment_session.capture_pending","acceptance.payment_session.capture_succeeded","acceptance.payment_session.capture_failed","acceptance.payment_session.void_pending","acceptance.payment_session.void_succeeded","acceptance.payment_session.void_failed","acceptance.payment_session.refund_pending","acceptance.payment_session.refund_succeeded","acceptance.payment_session.refund_failed","acceptance.disbursement.pending","acceptance.disbursement.succeeded","acceptance.disbursement.failed","acceptance.mandate.created","acceptance.mandate.approval_initiated","acceptance.mandate.approval_succeeded","acceptance.mandate.approval_failed","acceptance.mandate.canceled","acceptance.mandate.revocation_initiated","acceptance.mandate.revocation_succeeded","acceptance.mandate.revocation_failed"]' \
  target.url=https://your-webhook-url.com \
  'labels:={}' \
  isEnabled:=true
```

**Subscribe to only the events that matter most** (authorization and capture outcomes):

```bash theme={null}
cdp data webhooks subscriptions create \
  description="Payment Acceptance - auth and capture only" \
  'eventTypes:=["acceptance.payment_session.authorization_succeeded","acceptance.payment_session.authorization_failed","acceptance.payment_session.capture_succeeded","acceptance.payment_session.capture_failed"]' \
  target.url=https://your-webhook-url.com \
  'labels:={}' \
  isEnabled:=true
```

<Accordion title="Example response">
  ```json theme={null}
  {
    "createdAt": "2026-05-16T13:58:38.681893Z",
    "description": "Payment Acceptance webhook",
    "eventTypes": [
      "acceptance.payment_session.authorization_succeeded",
      "acceptance.payment_session.authorization_failed",
      "acceptance.payment_session.capture_succeeded",
      "acceptance.payment_session.capture_failed"
    ],
    "isEnabled": true,
    "labels": {
      "entity": "<YOUR_ENTITY_ID>"
    },
    "secret": "<SECRET_FOR_WEBHOOK_VERIFICATION>",
    "subscriptionId": "<YOUR_SUBSCRIPTION_ID>",
    "target": {
      "url": "https://your-webhook-url.com"
    }
  }
  ```
</Accordion>

<Warning>
  Save the `secret` from the response. You'll need it to verify incoming webhook signatures. It is only returned at creation time.
</Warning>

If your webhook URL requires custom headers (e.g., an API key), pass them inline:

```bash theme={null}
cdp data webhooks subscriptions create \
  description="Payment Acceptance webhook" \
  'eventTypes:=[...]' \
  target.url=https://your-webhook-url.com \
  'target.headers:={"x-api-key":"your-key"}' \
  'labels:={}' \
  isEnabled:=true
```

## Manage subscriptions

Use the `subscriptionId` from the creation response to view, update, or delete subscriptions.

**List all subscriptions:**

```bash theme={null}
cdp data webhooks subscriptions list
```

**View a subscription:**

```bash theme={null}
cdp data webhooks subscriptions get <SUBSCRIPTION_ID>
```

**Update a subscription** (full replace - pass every field, including ones you aren't changing):

```bash theme={null}
cdp data webhooks subscriptions update <SUBSCRIPTION_ID> \
  description="Updated: Payment Acceptance webhook" \
  'eventTypes:=["acceptance.payment_session.authorization_succeeded","acceptance.payment_session.capture_succeeded"]' \
  target.url=https://your-new-webhook-url.com \
  'labels:={}' \
  isEnabled:=true
```

**Delete a subscription:**

```bash theme={null}
cdp data webhooks subscriptions delete <SUBSCRIPTION_ID>
```

**Re-enable a disabled subscription:**

```bash theme={null}
cdp data webhooks subscriptions update <SUBSCRIPTION_ID> \
  description="Payment Acceptance webhook" \
  'eventTypes:=[...]' \
  target.url=https://your-webhook-url.com \
  'labels:={}' \
  isEnabled:=true
```

## Related

<CardGroup cols={2}>
  <Card title="Verification" icon="shield-check" href="/webhooks/payment-acceptance/verification">
    Verify webhook signatures
  </Card>

  <Card title="Example payloads" icon="file-code" href="/webhooks/payment-acceptance/example-payloads">
    Event payload shapes
  </Card>
</CardGroup>
