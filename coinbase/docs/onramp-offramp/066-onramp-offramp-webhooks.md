> Coinbase CDP docs — **onramp-offramp** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Onramp & Offramp Webhooks

Onramp and offramp webhooks provide your app with real-time transaction status updates. Subscribe your endpoint to receive a notification every time a transaction made by your users is created or updated.

## Setup

### Prerequisites

<AccordionGroup>
  <Accordion title="A Secret API Key">
    Sign up at [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com), then navigate to [API Keys](https://portal.cdp.coinbase.com/api-keys/secret) and select **Create API key** under the **Secret API Keys** tab.

    1. Enter an API key nickname (restrictions are optional)
    2. Click **Create**
    3. Secure your API Key ID and Secret in a safe location
  </Accordion>

  <Accordion title="A webhook URL">
    You'll need an HTTPS URL to receive webhook events. For quick testing, [webhook.site](https://webhook.site) gives free temporary URLs instantly.

    For production, use your own HTTPS endpoint.
  </Accordion>

  <Accordion title="CDP CLI">
    The [CDP CLI](/ai-agents/cdp-for-agents/cdp-mcp) handles authentication and exposes webhook subscription endpoints as typed commands (`cdp data webhooks subscriptions create`, `list`, `update`, `delete`). For raw HTTP, use `cdp api`.

    ```bash theme={null}
    npm install -g @coinbase/cdp-cli
    cdp env live --key-file ./cdp_api_key.json
    cdp data webhooks subscriptions list
    ```
  </Accordion>
</AccordionGroup>

### Create a webhook subscription

1. Review the configuration you'll submit:

Important configuration notes:

* `target.url` should be your webhook endpoint that will receive the events

* You can also set a `headers` object in `target` if your url requires specific headers. Pass it inline with `'target.headers:={"custom-header":"value"}'`.

* All Onramp event types should be included to ensure you receive notifications for every Onramp transaction state change:

| Event type | Description |
| :- | :- |
| `onramp.transaction.created` | New Onramp transaction created |
| `onramp.transaction.updated` | Onramp transaction status changed |
| `onramp.transaction.success` | Onramp transaction completed successfully |
| `onramp.transaction.failed` | Onramp transaction failed |

Offramp transactions are also supported:

| Event type | Description |
| :- | :- |
| `offramp.transaction.created` | New Offramp transaction created |
| `offramp.transaction.updated` | Offramp transaction status changed |
| `offramp.transaction.success` | Offramp transaction completed successfully |
| `offramp.transaction.failed` | Offramp transaction failed |

2. Create the webhook subscription with the CDP CLI:

```bash lines theme={null}
cdp data webhooks subscriptions create \
  description="Onramp transaction status webhook" \
  'eventTypes:=["onramp.transaction.created","onramp.transaction.updated","onramp.transaction.success","onramp.transaction.failed"]' \
  target.url=https://your-webhook-url.com \
  target.method=POST \
  'labels:={}' \
  isEnabled:=true
```

Sample webhook subscription response:

```bash lines wrap theme={null}
201 Created
{
  "createdAt": "2025-09-10T13:58:38.681893Z",
  "description": "Onramp transaction status webhook",
  "eventTypes": [
    "onramp.transaction.created",
    "onramp.transaction.updated",
    "onramp.transaction.success",
    "onramp.transaction.failed"
  ],
  "isEnabled": true,
  "labelKey": "project",
  "labelValue": "<YOUR_CDP_PROJECT_ID>",
  "labels": {
    "project": "<YOUR_CDP_PROJECT_ID>"
  },
  "metadata": {
    "secret": "<SECRET_FOR_WEBHOOK_VERIFICATION>"
  },
  "subscriptionId": "<YOUR_SUBSCRIPTION_ID>",
  "target": {
    "url": "https://your-webhook-url.com"
  }
}
```

## Manage subscriptions

Use the `subscriptionId` from the response to view, update, or delete the subscription.

<b>List all subscriptions</b>

```bash theme={null}
cdp data webhooks subscriptions list
```

<b>View specified subscription details by subscription ID</b>

```bash theme={null}
cdp data webhooks subscriptions get <SUBSCRIPTION_ID>
```

<b>Update subscription</b>

`update` is a full replace — pass every field, including ones you aren't changing:

```bash lines theme={null}
cdp data webhooks subscriptions update <SUBSCRIPTION_ID> \
  description="Updated: Onramp transaction status webhook" \
  'eventTypes:=["onramp.transaction.created","onramp.transaction.updated","onramp.transaction.success","onramp.transaction.failed"]' \
  target.url=https://your-new-webhook-url.com \
  target.method=POST \
  'labels:={}' \
  isEnabled:=true
```

<b>Delete subscription</b>

```bash theme={null}
cdp data webhooks subscriptions delete <SUBSCRIPTION_ID>
```

### Webhook signature verification

Use the standard CDP webhook verification flow — the same code works for all webhook event domains. See [Verify signatures](/webhooks/verify-signatures) for the full step-by-step implementation.

### Next steps

Once your subscription is created, your endpoint will begin receiving webhook events for transactions!

#### Sample transaction event payloads

```json lines wrap theme={null}
// Guest checkout transaction event
{
  "coinbaseFee": {
    "currency": "USD",
    "value": "0"
  },
  "completedAt": "0001-01-01T00:00:00Z",
  "country": "US",
  "createdAt": "2025-09-02T02:34:13Z",
  "eventType": "onramp.transaction.updated",
  "exchangeRate": {
    "currency": "USDC",
    "value": "1"
  },
  "networkFee": {
    "currency": "USD",
    "value": "0.19"
  },
  "paymentMethod": "CARD",
  "paymentSubtotal": {
    "currency": "USD",
    "value": "4.81"
  },
  "paymentTotal": {
    "currency": "USD",
    "value": "5"
  },
  "paymentTotalUsd": {
    "currency": "USD",
    "value": "5"
  },
  "purchaseAmount": {
    "currency": "USDC",
    "value": "4.81"
  },
  "purchaseCurrency": "USDC",
  "purchaseNetwork": "ethereum",
  "status": "ONRAMP_TRANSACTION_STATUS_IN_PROGRESS",
  "transactionId": "1f087a54-ff1f-62e8-9f85-aa77ac0499a5",
  "txHash": "0x",
  "type": "ONRAMP_TRANSACTION_TYPE_BUY_AND_SEND",
  "userId": "4132b63ee21128686458155b28570289",
  "userType": "USER_TYPE_GUEST",
  "walletAddress": "0xe0512E358C347cc2b1A42d057065CE642068b7Ba",
  "partnerUserRef": "example_user_ref"
}

// Headless Onramp API order event (Apple Pay / Google Pay)
{
  "orderId": "123e4567-e89b-12d3-a456-426614174000",
  "eventType": "onramp.transaction.success",
  "paymentTotal": "100.75",
  "paymentSubtotal": "100",
  "paymentCurrency": "USD",
  "paymentMethod": "GUEST_CHECKOUT_APPLE_PAY",
  "purchaseAmount": "100.000000",
  "purchaseCurrency": "USDC",
  "fees": [
    {
      "feeType": "FEE_TYPE_NETWORK",
      "feeAmount": "0.5",
      "feeCurrency": "USD"
    },
    {
      "feeType": "FEE_TYPE_EXCHANGE",
      "feeAmount": "0.25",
      "feeCurrency": "USD"
    }
  ],
  "exchangeRate": "1",
  "destinationAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "destinationNetwork": "base",
  "status": "ONRAMP_ORDER_STATUS_COMPLETED",
  "txHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "createdAt": "2025-09-10T10:30:00Z",
  "updatedAt": "2025-09-10T10:35:00Z",
  "partnerUserRef": "example_user_ref"
}
```

## Best practices

To ensure reliable webhook delivery:

* **Test endpoints locally** before enabling subscriptions in production
* **Handle concurrent requests** - ensure your target URL can process multiple events simultaneously
* **Process events asynchronously** - return a `200` response quickly and process the event in the background
* **Monitor webhook receiver health** - track delivery success rates to your target URL
* **Set up subscription monitoring** - use a scheduled job (e.g., cron, systemd timer) to periodically call the List Subscriptions API and verify critical subscriptions have `isEnabled: true`

<Note>
  Subscriptions may be automatically disabled if your endpoint experiences sustained delivery failures (e.g., high failure rates, endpoint unavailability, or throughput issues). If this happens, fix the underlying endpoint issue and use the Update Subscription API to re-enable.
</Note>
