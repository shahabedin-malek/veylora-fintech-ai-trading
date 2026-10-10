> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Disbursements

> Send funds from your CDP account to a Coinbase user or onchain address, independent of any payment session.

Disbursements are merchant-initiated payments of funds from your CDP account to a Coinbase user or onchain address. Use them for standalone refunds, goodwill payments, rebates, and other payouts that are not tied to a specific payment session.

<Note>
  For returning captured funds to the buyer within a payment session, use [session refunds](/payments/payment-acceptance/payment-sessions) instead. Disbursements are for payouts independent of any session.
</Note>

## When to use disbursements

| Scenario | Use |
| - | - |
| Buyer paid $100, you need to return $30 | Session refund (`POST /payment-sessions/{id}/refunds`) |
| Goodwill credit for a delayed shipment | Disbursement (`POST /disbursements`) |
| Rebate to a customer's Coinbase account | Disbursement |
| Payout to an onchain address | Disbursement |

## Create a disbursement

Disbursements are asynchronous. The resource is returned in `pending` status and transitions to `succeeded` or `failed`.

**To a Coinbase user:**

```json theme={null}
{
  "source": {
    "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
    "asset": "usdc"
  },
  "target": {
    "coinbaseUserId": "coinbase_user_abc123"
  },
  "amount": "25.00",
  "asset": "usdc",
  "reason": "Goodwill credit for delayed shipment",
  "externalReferenceId": "credit-2026-05-1234",
  "metadata": {
    "customer_id": "cust_12345",
    "ticket_id": "TICKET-789"
  }
}
```

**To an onchain address:**

```json theme={null}
{
  "source": {
    "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
    "asset": "usdc"
  },
  "target": {
    "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "network": "base"
  },
  "amount": "10.00",
  "asset": "usdc",
  "reason": "Rebate for overcharge"
}
```

## Target types

| Target | Fields | Description |
| - | - | - |
| **Coinbase user** | `coinbaseUserId` | Send to a Coinbase account |
| **Onchain address** | `address`, `network` | Send to any blockchain address. Supported networks: Base, Ethereum, Solana, Aptos, Arbitrum, Optimism, Polygon |

## Disbursement statuses

| Status | Description |
| - | - |
| `pending` | Disbursement accepted, awaiting settlement |
| `succeeded` | Funds delivered. `onchainTransactions` populated with transaction hash and network. |
| `failed` | Disbursement could not be completed. `error` object contains `code` and `message`. |

## Response

```json theme={null}
{
  "disbursementId": "disbursement_82c879c1-84e1-44ed-a8c2-1ac239cf09ad",
  "source": {
    "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
    "asset": "usdc"
  },
  "target": {
    "coinbaseUserId": "coinbase_user_abc123"
  },
  "amount": "25.00",
  "asset": "usdc",
  "status": "pending",
  "reason": "Goodwill credit for delayed shipment",
  "externalReferenceId": "credit-2026-05-1234",
  "metadata": {
    "customer_id": "cust_12345",
    "ticket_id": "TICKET-789"
  },
  "createdAt": "2026-05-16T17:00:00.000Z",
  "updatedAt": "2026-05-16T17:00:00.000Z"
}
```

When the disbursement succeeds, the response includes the onchain transaction:

```json theme={null}
{
  "status": "succeeded",
  "onchainTransactions": [
    {
      "transactionHash": "0xabc123def456789012345678901234567890abcdef1234567890abcdef123456",
      "network": "base"
    }
  ]
}
```

## Filtering

List disbursements with optional filters:

| Filter | Description |
| - | - |
| `status` | Filter by `pending`, `succeeded`, or `failed` |
| `sourceAccountId` | Filter by the source CDP account |
| `externalReferenceId` | Filter by your client-supplied reference |

```bash theme={null}
cdp api /disbursements -e sandbox status==succeeded
```

## Webhooks

Subscribe to `acceptance.disbursement.*` events for real-time status updates:

| Event | Description |
| - | - |
| `acceptance.disbursement.pending` | Disbursement accepted, awaiting settlement |
| `acceptance.disbursement.succeeded` | Disbursement settled onchain |
| `acceptance.disbursement.failed` | Disbursement could not be completed |

See [Webhooks](/webhooks/payment-acceptance/overview) for setup.

## Idempotency

Use the `X-Idempotency-Key` header (UUID v4) to safely retry disbursement requests:

```bash theme={null}
cdp api -X POST /disbursements -e sandbox \
  "Header:X-Idempotency-Key:8e03978e-40d5-43e8-bc93-6894a57f9324" \
  source.accountId=$ACCOUNT_ID \
  source.asset=usdc \
  target.coinbaseUserId=coinbase_user_abc123 \
  amount=25.00 \
  asset=usdc
```

## Related

<CardGroup cols={2}>
  <Card title="Payment Sessions" icon="rectangle-history" href="/payments/payment-acceptance/payment-sessions">
    Session-linked refunds for returning captured funds
  </Card>

  <Card title="Webhooks" icon="webhook" href="/webhooks/payment-acceptance/overview">
    Real-time disbursement status events
  </Card>

  <Card title="API Reference" icon="code" href="/api-reference/v2/rest-api/disbursements/create-a-disbursement">
    Full disbursement API
  </Card>
</CardGroup>
