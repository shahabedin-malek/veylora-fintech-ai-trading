> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Hosted Checkout

> Redirect and embedded checkout flows for Payment Acceptance, including the coinbase-payment web component and mandate approval.

## Environments

Payment Acceptance has separate **Sandbox** (testing) and **Production** (live) environments. Use the host and URLs for your target environment consistently — the REST API, the returned hosted checkout URL, and the embedded component are all environment-specific.

| Environment | REST API host | Embedded component script |
| - | - | - |
| Sandbox | `https://sandbox.cdp.coinbase.com/platform` | `https://payments.coinbase.com/sandbox/payments/components/v1/payment-link.mjs` |
| Production | `https://api.cdp.coinbase.com/platform` | `https://payments.coinbase.com/payments/components/v1/payment-link.mjs` |

<Note>
  Keep the environment consistent across all three. For example, a Sandbox payment session will not render in the Production component.
</Note>

## Overview

### Redirect flow

Redirect customers to a hosted checkout page.

<Steps>
  <Step title="Create a payment session">
    Call `POST /v2/payment-sessions` on the host for your environment (see [Environments](#environments)) with your payment details. Include a `redirect` object in the request body with `successUrl` and `failureUrl` to control where customers land after payment.
  </Step>

  <Step title="Extract the payment URL">
    From the response, get the top-level `url` field. This is the hosted payment page where customers complete the payment.
  </Step>

  <Step title="Redirect customers">
    Redirect customers to the `url` to complete the payment.
  </Step>

  <Step title="Handle the redirect">
    After payment completion, customers are automatically redirected to your `redirect.successUrl` or `redirect.failureUrl`.
  </Step>
</Steps>

## Embedded UI

The payment UI can be embedded natively into your website using Coinbase's `<coinbase-payment>` web component. This allows customers to complete payments without leaving your checkout page.

### Setup

Load the web component from the URL for your target environment. Use the Sandbox URL for testing and switch to the Production URL when you go live.

<CodeGroup>
  ```html Production theme={null}
  <script
    type="module"
    src="https://payments.coinbase.com/payments/components/v1/payment-link.mjs"
  ></script>

  <coinbase-payment id="payment-link"></coinbase-payment>
  ```

  ```html Sandbox theme={null}
  <script
    type="module"
    src="https://payments.coinbase.com/sandbox/payments/components/v1/payment-link.mjs"
  ></script>

  <coinbase-payment id="payment-link"></coinbase-payment>
  ```
</CodeGroup>

### Rendering

Call `render()` with the `paymentSessionId` from the `POST /v2/payment-sessions` response:

```javascript theme={null}
const paymentComponent = document.querySelector('#payment-link');
paymentComponent.render({ paymentSessionId });
```

To re-render with updated payment data, call `render()` again. To navigate back to the wallet selection view, call `back()`:

```javascript theme={null}
paymentComponent.back();
```

### Attributes

| Attribute | Description |
| - | - |
| `layout` | Set to `"single-column"` to force the small desktop view regardless of screen size. Set to `"default"` for the standard 2-column layout when appropriate. |

```html theme={null}
<coinbase-payment layout="single-column"></coinbase-payment>
```

### Events

The component emits Custom Events for handling payment outcomes:

| Event | Description |
| - | - |
| `rendered` | Fired when the component is ready. Includes `installedWallets` in detail. |
| `completed` | Payment completed. Detail includes `status: 'success' \| 'failure'`. |
| `cancelled` | User cancelled the payment. |
| `walletAction` | Wallet interaction events (selected, connected, rejected). |
| `pageNavigated` | Navigation between views. Detail includes `page` name. |
| `paymentError` | Error occurred. Detail includes `error` message. |
| `deeplink` | Deeplink URL for mobile wallet redirects. Detail includes `url`. |

```javascript theme={null}
paymentComponent.addEventListener('completed', (event) => {
  if (event.detail.status === 'success') {
    // Handle successful payment
  }
});

paymentComponent.addEventListener('paymentError', (event) => {
  console.error('Payment error:', event.detail.error);
});
```

### Deeplink handling (iframes)

When the component is rendered inside an iframe, it cannot redirect the browser directly. You must handle the `deeplink` event to perform the redirect from the parent page:

```javascript theme={null}
paymentComponent.addEventListener('deeplink', (event) => {
  window.location.href = event.detail.url;
});
```

### iFrame permissions

If embedding the component inside an iframe, configure the following permissions to enable passkey and clipboard access:

```html theme={null}
<iframe
  src="your-checkout-page.html"
  allow="publickey-credentials-get; publickey-credentials-create; clipboard-write"
></iframe>
```

### Theming

Customize the component appearance using CSS custom properties:

```css theme={null}
coinbase-payment {
  --cb-color-background-primary: #ffffff;
  --cb-color-text-primary: #000000;
  --cb-color-button-primary: #005bd3;
  --cb-color-button-primary-hover: #004bb3;
  --cb-typography-header-font-family: 'Your Font', sans-serif;
  --cb-typography-body-font-family: 'Your Font', sans-serif;
  --cb-border-radius-button-primary: 8px;
}
```

<Accordion title="All CSS custom properties">
  | Property | Default |
  | - | - |
  | `--cb-color-background-primary` | white |
  | `--cb-color-background-secondary` | white |
  | `--cb-color-qr-background` | white |
  | `--cb-color-text-primary` | black |
  | `--cb-color-link-hover` | - |
  | `--cb-color-button-primary` | #005bd3 (blue) |
  | `--cb-color-button-primary-hover` | #005bd3 (blue) |
  | `--cb-color-button-primary-text` | - |
  | `--cb-color-button-border-primary` | - |
  | `--cb-color-accent-primary` | - |
  | `--cb-border-radius-button-primary` | - |
  | `--cb-color-navigation-hover` | - |
  | `--cb-color-border-primary` | - |
  | `--cb-color-icon` | grey |
  | `--cb-color-icon-background-hover` | light gray |
  | `--cb-typography-header-font-family` | System |
  | `--cb-typography-body-font-family` | System |
</Accordion>

## Mandate approval and revocation

The same hosted flows handle [recurring payment](/payments/payment-acceptance/recurring-payments) mandates. Use the `mandateId` wherever you'd use a `paymentSessionId`.

### Redirect flow

<Steps>
  <Step title="Create a mandate">
    Call `POST /v2/mandates`. Include `approvalRedirect` and `revocationRedirect` objects, each with `successUrl` and `failureUrl`, to control where customers land afterward.
  </Step>

  <Step title="Redirect customers">
    Redirect customers to the mandate's `url` to approve it, or to its `revocationUrl` to remove their approval.
  </Step>

  <Step title="Handle the redirect">
    After approval or revocation, customers are automatically redirected to the matching `successUrl` or `failureUrl`.
  </Step>
</Steps>

### Embedded UI

Call `render()` with the `mandateId`:

```javascript theme={null}
paymentComponent.render({ mandateId });
```

Setup, attributes, events, iframe handling, and theming are the same as for payment sessions.

## Related

<CardGroup cols={2}>
  <Card title="Payment Sessions" icon="rectangle-history" href="/payments/payment-acceptance/payment-sessions">
    The `redirect` object and session `url` field used by this flow
  </Card>

  <Card title="Authorization" icon="shield-check" href="/payments/payment-acceptance/authorization">
    Wallet, Coinbase, and x402 authorization flows
  </Card>

  <Card title="API Reference" icon="code" href="/api-reference/v2/rest-api/payment-sessions/create-a-payment-session">
    Create a payment session
  </Card>
</CardGroup>
