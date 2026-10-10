> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Payment Acceptance Webhooks

> Real-time status updates for Payment Acceptance payment sessions, disbursements, and mandates.

Payment Acceptance webhooks deliver real-time status updates to your application as payment sessions, disbursements, and mandates move through their lifecycle. Subscribe to specific event types and receive POST requests at your webhook URL whenever a status change occurs.

## Getting started

<Steps>
  <Step title="Subscribe to webhooks">
    Set up a [webhook subscription](/webhooks/payment-acceptance/subscriptions) to Payment Acceptance events. This is a webhook delivery configuration, unrelated to billing subscriptions. For recurring payments, see [Recurring Payments](/payments/payment-acceptance/recurring-payments).
  </Step>

  <Step title="Verify">
    Implement [signature verification](/webhooks/payment-acceptance/verification) in your receiver.
  </Step>

  <Step title="Inspect payloads">
    See [example payloads](/webhooks/payment-acceptance/example-payloads) for event shapes.
  </Step>
</Steps>

## Event types

### Payment session events

Subscribe to `acceptance.payment_session.*` events to track the full payment lifecycle:

| Event type | Description |
| - | - |
| `acceptance.payment_session.created` | Session created |
| `acceptance.payment_session.canceled` | Session canceled before authorization |
| `acceptance.payment_session.authorization_pending` | Authorization in progress |
| `acceptance.payment_session.authorization_succeeded` | Funds held successfully |
| `acceptance.payment_session.authorization_failed` | Authorization failed |
| `acceptance.payment_session.capture_pending` | Capture in progress |
| `acceptance.payment_session.capture_succeeded` | Funds captured and settled |
| `acceptance.payment_session.capture_failed` | Capture failed |
| `acceptance.payment_session.void_pending` | Void in progress |
| `acceptance.payment_session.void_succeeded` | Uncaptured funds released |
| `acceptance.payment_session.void_failed` | Void failed |
| `acceptance.payment_session.refund_pending` | Refund in progress |
| `acceptance.payment_session.refund_succeeded` | Captured funds returned to buyer |
| `acceptance.payment_session.refund_failed` | Refund failed |

### Disbursement events

Subscribe to `acceptance.disbursement.*` events to track standalone payouts:

| Event type | Description |
| - | - |
| `acceptance.disbursement.pending` | Disbursement accepted, awaiting settlement |
| `acceptance.disbursement.succeeded` | Disbursement settled onchain |
| `acceptance.disbursement.failed` | Disbursement could not be completed |

### Mandate events

Subscribe to `acceptance.mandate.*` events to track [recurring payment](/payments/payment-acceptance/recurring-payments) approvals, cancellations, and revocations. Payments authorized with a mandate fire the payment session events above.

| Event type | Description |
| - | - |
| `acceptance.mandate.created` | Mandate created |
| `acceptance.mandate.approval_initiated` | Customer signed, approval confirming |
| `acceptance.mandate.approval_succeeded` | Mandate approved and ready to use |
| `acceptance.mandate.approval_failed` | Approval failed, customer can retry |
| `acceptance.mandate.canceled` | Mandate canceled |
| `acceptance.mandate.revocation_initiated` | Customer signed a revocation |
| `acceptance.mandate.revocation_succeeded` | Approval removed from the customer's wallet |
| `acceptance.mandate.revocation_failed` | Revocation failed, customer can retry |

## Payload structure

Every webhook delivers a standard CDP envelope:

```json theme={null}
{
  "eventId": "evt_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "eventType": "acceptance.payment_session.capture_succeeded",
  "timestamp": "2026-05-16T12:05:00Z",
  "data": {
    ...
  }
}
```

For payment session events, `data.paymentSession` always contains a session summary. For action-triggered events (authorization, capture, void, refund), the corresponding action detail is also present as a sibling field — `data.authorization`, `data.capture`, `data.void`, or `data.refund`. For session-level events (created, canceled), no action field is included — the `paymentSession.status` value is sufficient.

For disbursement events, the `data` object contains the full disbursement resource.

For mandate events, `data.mandate` always contains the full mandate. Approval events also include `data.approval`, and revocation events include `data.revocation`.

See [example payloads](/webhooks/payment-acceptance/example-payloads) for complete event shapes.

## Security

Webhook requests include an `X-Hook0-Signature` header containing an HMAC-SHA256 signature of the request body using your webhook secret. Always verify this signature before processing events.

See [verification](/webhooks/payment-acceptance/verification) for implementation details.

## Best practices

* **Acknowledge quickly** - return `200` immediately, then process in the background
* **Support concurrent delivery** - your endpoint may receive multiple events at the same time
* **Verify signatures** - always check `X-Hook0-Signature` before processing
* **Handle duplicates** - use `eventId` for idempotent processing
* **Monitor delivery health** - subscriptions can be auto-disabled after sustained delivery failures
* **Test locally first** before enabling production subscriptions

<Note>
  If a subscription is auto-disabled due to delivery failures, fix the endpoint issue and re-enable it via the [Update Subscription API](/api-reference/v2/rest-api/webhooks/update-webhook-subscription).
</Note>

## Related

<CardGroup cols={2}>
  <Card title="Webhook Subscriptions" icon="bell" href="/webhooks/payment-acceptance/subscriptions">
    Create and manage webhook subscriptions
  </Card>

  <Card title="Verification" icon="shield-check" href="/webhooks/payment-acceptance/verification">
    Verify webhook signatures
  </Card>

  <Card title="Example payloads" icon="file-code" href="/webhooks/payment-acceptance/example-payloads">
    Complete event payload examples
  </Card>

  <Card title="Payment Sessions" icon="rectangle-history" href="/payments/payment-acceptance/payment-sessions">
    Understand the payment lifecycle
  </Card>
</CardGroup>
