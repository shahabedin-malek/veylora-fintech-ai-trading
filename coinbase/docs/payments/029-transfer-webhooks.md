> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Transfer Webhooks

CDP Transfers webhooks provide your app with real-time transfer status updates. By subscribing your webhook endpoint you will receive a notification every time a transfer made by your users is created or updated.

## Getting started

<Steps>
  <Step title="Subscribe">
    Set up a [subscription](/webhooks/transfers/subscriptions) to transfer webhook events.
  </Step>

  <Step title="Verify">
    Implement [signature verification](/webhooks/transfers/verification) in your receiver.
  </Step>

  <Step title="Inspect payloads">
    See the [transfer webhook example payloads](/webhooks/transfers/example-payloads) for full request-body examples.
  </Step>
</Steps>

## Best practices

* **Test locally first** before enabling production subscriptions.
* **Support concurrent delivery** at your webhook endpoint.
* **Acknowledge quickly** (`200`), then process in the background.
* **Monitor delivery health** and alert on failures.
* **Check subscriptions regularly** and confirm critical ones remain `isEnabled: true`.

<Note>
  Subscriptions can be auto-disabled after sustained delivery failures. Fix the endpoint issue, then re-enable with the [Update Subscription API](/api-reference/v2/rest-api/webhooks/update-webhook-subscription).
</Note>
