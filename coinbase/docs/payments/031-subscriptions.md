> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Subscriptions

Create and manage webhook subscriptions for transfer lifecycle events.

## Prerequisites

You will need:

* Your CDP API Key ID and secret
* A webhook notification HTTPS URL
* Install the [CDP CLI](/ai-agents/cdp-for-agents/cdp-mcp) and run `cdp env live --key-file ./cdp_api_key.json` once to configure credentials.

## 1. Review the configuration

Define which transfer events to receive and where webhooks should be delivered.

Important configuration notes:

* `target.url` should be your webhook endpoint that will receive the events

* You can also set a `headers` object in `target` if your url requires specific headers. Pass it inline with `'target.headers:={"custom-header":"value"}'`.

* All Transfer event types should be included to ensure you receive notifications for every transfer state change:

| Event type | Description |
| :- | :- |
| `payments.transfers.quoted` | Transfer has been quoted with fee breakdown |
| `payments.transfers.processing` | Transfer is being executed |
| `payments.transfers.completed` | Transfer completed successfully |
| `payments.transfers.failed` | Transfer failed |

## 2. Subscribe

Create the subscription with the CDP CLI and store the returned `subscriptionId` and `secret`.

```bash lines theme={null}
cdp data webhooks subscriptions create \
  description="CDP Transfers webhook" \
  'eventTypes:=["payments.transfers.quoted","payments.transfers.processing","payments.transfers.completed","payments.transfers.failed"]' \
  target.url=https://your-webhook-url.com \
  'labels:={}' \
  isEnabled:=true
```

Sample webhook subscription response:

```bash lines wrap theme={null}
201 Created
{
  "createdAt": "2025-09-10T13:58:38.681893Z",
  "description": "CDP Transfers webhook",
  "eventTypes": [
    "payments.transfers.quoted",
    "payments.transfers.processing",
    "payments.transfers.completed",
    "payments.transfers.failed"
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
  description="Updated: CDP Transfers webhook" \
  'eventTypes:=["payments.transfers.quoted","payments.transfers.processing","payments.transfers.completed","payments.transfers.failed"]' \
  target.url=https://your-new-webhook-url.com \
  'labels:={}' \
  isEnabled:=true
```

<b>Delete subscription</b>

```bash theme={null}
cdp data webhooks subscriptions delete <SUBSCRIPTION_ID>
```
