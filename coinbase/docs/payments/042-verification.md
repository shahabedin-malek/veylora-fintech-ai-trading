> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Verification

> Verify Payment Acceptance webhook signatures using the shared CDP X-Hook0-Signature mechanism.

Verify webhook signatures to ensure incoming Payment Acceptance events are authentic. Payment Acceptance uses the same `X-Hook0-Signature` verification mechanism as all CDP webhooks.

<Warning>
  Always verify webhook signatures before processing events. This protects your application from forged webhooks and potential security threats.
</Warning>

## How it works

When you create a webhook subscription, the response includes a `secret`. Each incoming webhook request includes an `X-Hook0-Signature` header containing:

* `t` field - the timestamp
* `h` field - list of headers included in the signature
* `v1` field - the HMAC-SHA256 signature

## Implementation

For complete verification code in TypeScript, Python, Go, Ruby, PHP, and Java, see the [CDP Webhook Verification guide](/webhooks/transfers/verification). The mechanism is identical for all CDP products, including Payment Acceptance.

The short version:

1. Extract `t`, `h`, and `v1` from the `X-Hook0-Signature` header
2. Build the signed payload: `{timestamp}.{headerNames}.{headerValues}.{body}`
3. Compute HMAC-SHA256 using your subscription `secret`
4. Compare the computed signature with `v1` using constant-time comparison
5. Reject events older than 5 minutes (replay protection)

## Quick example

```typescript theme={null}
app.post("/webhook", (req, res) => {
  const payload = req.body.toString();
  const signature = req.headers["x-hook0-signature"];
  const secret = process.env.WEBHOOK_SECRET;

  if (verifyWebhookSignature(payload, signature, secret, req.headers)) {
    const event = JSON.parse(payload);

    switch (event.eventType) {
      case "acceptance.payment_session.authorization_succeeded":
        // Funds held - ready to capture after fulfillment
        break;
      case "acceptance.payment_session.capture_succeeded":
        // Payment complete - update order status
        break;
      case "acceptance.payment_session.refund_succeeded":
        // Refund complete - notify customer
        break;
      case "acceptance.disbursement.succeeded":
        // Disbursement settled - update records
        break;
    }

    res.status(200).send("OK");
    return;
  }

  res.status(400).send("Invalid signature");
});
```

## Related

<CardGroup cols={2}>
  <Card title="Full verification code" icon="code" href="/webhooks/transfers/verification">
    Complete verification implementations in 6 languages
  </Card>

  <Card title="Webhook Subscriptions" icon="bell" href="/webhooks/payment-acceptance/subscriptions">
    Create and manage webhook subscriptions
  </Card>

  <Card title="Example payloads" icon="file-code" href="/webhooks/payment-acceptance/example-payloads">
    Event payload shapes for testing
  </Card>
</CardGroup>
