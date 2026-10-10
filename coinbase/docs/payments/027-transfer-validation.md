> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Transfer Validation

Use `validateOnly: true` to validate a transfer without initiating or persisting it. This is useful for verifying that a target can receive funds before committing to execution.

## When to use validation

Transfer validation is particularly useful when you need to:

* **Verify recipient addresses** before performing foreign exchange (FX) conversions
* **Pre-validate email recipients** to ensure users exist before showing transfer confirmation
* **Check onchain addresses** are valid for the specified network before committing funds

## How it works

When you set `validateOnly: true`:

* The transfer is **validated but not persisted**
* The transfer will **not appear in list transfer responses**
* A `2xx` response indicates valid transfer parameters
* A `4xx` response indicates validation failure with an `errorType`

<Note>
  `validateOnly` and `execute` are mutually exclusive. Setting both to `true` returns a `400` error.
</Note>

## Example request

```json theme={null}
{
  "source": {
    "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
    "asset": "usd"
  },
  "target": {
    "email": "recipient@example.com",
    "asset": "usd"
  },
  "amount": "100.00",
  "asset": "usd",
  "validateOnly": true
}
```

## Validation response

When validation succeeds, the response includes validated transfer details without persistence fields:

```json theme={null}
{
  "source": {
    "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
    "asset": "usd"
  },
  "target": {
    "email": "recipient@example.com",
    "asset": "usd"
  },
  "sourceAmount": "100.00",
  "sourceAsset": "usd",
  "targetAmount": "100.00",
  "targetAsset": "usd"
}
```

<Note>
  When `validateOnly` is `true`, the response does not include `transferId`, `status`, `createdAt`, or `updatedAt`.
</Note>

## Validation errors

| Error Type | Description |
| - | - |
| `invalid_request` | The request format is invalid or missing required fields, including invalid recipient addresses or unsupported networks |
| `not_found` | The specified target user or account was not found |

## Sandbox testing

<Note>
  When testing email transfers in sandbox, only specific whitelisted emails will validate successfully. See the [Transfers Quickstart](/payments/transfers/quickstart) for valid test emails.
</Note>
