> Coinbase CDP docs — **x402** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Payment Acceptance API

[Payment Acceptance](/payments/payment-acceptance/overview) is Coinbase's full-lifecycle
stablecoin payment API for PSPs, marketplaces, and enterprise platforms. It has native x402
support, so any payment session you create can be authorized by an x402-enabled agent instead of
(or alongside) a human wallet or Coinbase account, using the same session, capture, void, and
refund primitives you already use for the rest of your checkout.

## How it works

Every payment session created with a wallet target includes an `x402Url`. Hand that URL to an
x402-enabled agent and it authorizes the session itself, submitting a signed payment payload to
`.../authorizations/x402` through the standard x402 402-challenge/response flow. There's no
separate integration path: it's the same payment session your web checkout already uses.

## Set up

Payment Acceptance requires onboarding with the Coinbase team.
[Get in touch](mailto:coinbase.payments@coinbase.com) to start. Once you have API access, see
[x402 authorization](/payments/payment-acceptance/authorization#x402-authorization) for the
request and response details, and [Payment Sessions](/payments/payment-acceptance/payment-sessions)
for the `x402Url` field.

## Related

<CardGroup cols={2}>
  <Card title="Payment Acceptance overview" icon="sliders" href="/payments/payment-acceptance/overview">
    Full-lifecycle stablecoin payment APIs for PSPs, marketplaces, and enterprise platforms.
  </Card>

  <Card title="x402 authorization" icon="shield-check" href="/payments/payment-acceptance/authorization#x402-authorization">
    Authorize a payment session with an x402 payment payload.
  </Card>
</CardGroup>
