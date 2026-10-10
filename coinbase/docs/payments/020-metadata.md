> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Metadata

> Attach custom key-value pairs to deposit destinations, transfers, and webhook subscriptions for reconciliation and reporting.

Many CDP Payments resources accept an optional `metadata` field — a flat map of string-to-string key-value pairs you can use to tie API objects back to records in your own system (invoice IDs, customer IDs, order numbers, internal references, and so on).

The same `metadata` schema is used across:

* **[Deposit destinations](/payments/deposit-destinations/overview)** — track the purpose or source of inbound deposits
* **[Transfers](/payments/transfers/overview)** — tag outbound or internal movements with your own references
* **[Webhook subscriptions](/webhooks/transfers/overview)** — annotate subscriptions for routing or organization

## Constraints and limitations

| Property | Constraint |
| - | - |
| Maximum key-value pairs | 10 per resource |
| Maximum key length | 40 characters |
| Maximum value length | 500 characters |
| Type | Strings only (both keys and values) |
| Immutable | Yes — cannot be updated or deleted after creation |
| Searchable / filterable | No |
| Included in webhook event payloads | No |

<Warning>
  Never store sensitive data like passwords, account numbers, or PII in metadata. Metadata is returned in API responses and may appear in logs.
</Warning>

<Note>
  **Deposit destinations have a temporary additional restriction:** metadata values must currently be in UUID format or integer string format. Free-form values are accepted on transfers and webhook subscriptions today and will be supported on deposit destinations in a future release.
</Note>

## Usage

Include the optional `metadata` field on the create request for the resource.

### On a transfer

```json highlight={13-16} theme={null}
{
  "source": {
    "accountId": "account_123",
    "asset": "usd"
  },
  "target": {
    "email": "user@example.com",
    "asset": "usd"
  },
  "amount": "100.00",
  "asset": "usd",
  "execute": true,
  "metadata": {
    "invoiceId": "INV-001",
    "customerId": "cust_123"
  }
}
```

### On a deposit destination

```json highlight={5-8} theme={null}
{
  "accountId": "account_123",
  "network": "base",
  "type": "crypto",
  "metadata": {
    "customerId": "123e4567-e89b-12d3-a456-426614174000",
    "orderRef": "12345"
  }
}
```

### On a webhook subscription

````json highlight={7-9} theme={null}
{
  "target": {
    "url": "https://api.example.com/webhooks/cdp"
  },
  "eventTypes": ["payments.transfers.completed"],
  "metadata": {
    "team": "payments-ops"
  }
}

## Retrieving metadata

Metadata is returned automatically on every read of the resource. No additional API calls are required.

```json highlight={4-7}
{
  "transferId": "transfer_123",
  "status": "completed",
  "metadata": {
    "invoiceId": "INV-001",
    "customerId": "cust_123"
  }
}
````

Metadata persists for the lifetime of the resource and is included in every subsequent response.

## Best practices

* **Use consistent key names** across resources (e.g., always `invoiceId`, never sometimes `invoice_id`) so you can correlate records across your own systems.
* **Store IDs, not full data.** Reference your system's records by ID rather than duplicating information into metadata.
* **Keep keys concise** — they're capped at 40 characters and count toward the 10-pair limit.
* **Plan for immutability.** Treat metadata as write-once: if you need a mutable annotation, store it in your own database keyed by the resource ID.

## Related endpoints

* [Create a transfer](/api-reference/v2/rest-api/transfers/create-transfer)
* [Get a transfer](/api-reference/v2/rest-api/transfers/get-transfer)
* [List transfers](/api-reference/v2/rest-api/transfers/list-transfers)
* [Create a deposit destination](/api-reference/v2/rest-api/deposit-destinations/create-deposit-destination)
* [Webhook subscriptions](/api-reference/v2/rest-api/webhooks/create-webhook-subscription)
