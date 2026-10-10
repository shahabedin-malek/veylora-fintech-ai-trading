> Coinbase CDP docs — **wallets** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Wallet Webhooks

Wallet webhooks let you subscribe to real-time events for transactions, signing operations, and delegation grants across your wallets. Events fire as operations move through each stage — from creation to confirmation or failure.

These webhooks work the same way for both API key wallets and user wallets.

<Note>
  Looking for onchain transfer monitoring (ERC-20 in/out of any address)? See [Onchain Activity Webhooks](/webhooks/onchain-activity/overview) or [Multi-Address subscriptions](/webhooks/onchain-activity/multi-address).
</Note>

## Event types

### Transaction lifecycle events

The following event types cover the full transaction lifecycle:

| Event | Description |
| - | - |
| `wallet.transaction.created` | Transaction is created |
| `wallet.transaction.signed` | Transaction is signed |
| `wallet.transaction.broadcast` | Transaction is broadcast to the network |
| `wallet.transaction.pending` | Transaction stuck in mempool for more than 30 seconds |
| `wallet.transaction.replaced` | Transaction replaced an existing pending transaction |
| `wallet.transaction.confirmed` | Transaction confirmed onchain |
| `wallet.transaction.failed` | Transaction failed onchain or was replaced |

### Signing events

These events fire when signing operations complete outside of a full transaction send flow:

| Event | Description |
| - | - |
| `wallet.typed_data.signed` | EVM EIP-712 typed data signed |
| `wallet.message.signed` | Message signed (EVM EIP-191 or Solana) |
| `wallet.hash.signed` | Arbitrary hash signed (EVM only) |

### Delegation events

These events fire when [delegation grants](/wallets/using-wallets/delegated-signing) are created or revoked:

| Event | Description |
| - | - |
| `wallet.delegation.created` | Delegation grant created for an end user |
| `wallet.delegation.revoked` | Delegation grant revoked |

## Creating a subscription

Use the SDK to create a webhook subscription for wallet events:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import { CdpClient } from "@coinbase/cdp-sdk";

  const cdp = new CdpClient();

  const subscription = await cdp.webhooks.createSubscription({
    description: "Monitor wallet transactions",
    eventTypes: [
      "wallet.transaction.created",
      "wallet.transaction.broadcast",
      "wallet.transaction.pending",
      "wallet.transaction.confirmed",
      "wallet.transaction.failed",
      "wallet.transaction.replaced",
      "wallet.transaction.signed",
      "wallet.typed_data.signed",
      "wallet.message.signed",
      "wallet.hash.signed",
      "wallet.delegation.created",
      "wallet.delegation.revoked",
    ],
    targetUrl: "https://example.com/webhook",
    isEnabled: true,
  });
  ```

  ```python Python theme={null}
  from cdp import CdpClient
  from cdp.webhook_types import CreateWebhookSubscriptionOptions

  async with CdpClient() as cdp:
      subscription = await cdp.webhooks.create_subscription(
          CreateWebhookSubscriptionOptions(
              description="Monitor wallet transactions",
              event_types=[
                  "wallet.transaction.created",
                  "wallet.transaction.broadcast",
                  "wallet.transaction.pending",
                  "wallet.transaction.confirmed",
                  "wallet.transaction.failed",
                  "wallet.transaction.replaced",
                  "wallet.transaction.signed",
                  "wallet.typed_data.signed",
                  "wallet.message.signed",
                  "wallet.hash.signed",
                  "wallet.delegation.created",
                  "wallet.delegation.revoked",
              ],
              target_url="https://example.com/webhook",
          )
      )
  ```
</CodeGroup>

## EVM

### Supported events

All transaction lifecycle, signing, and delegation events are supported on EVM:

| Event | Description |
| - | - |
| `wallet.transaction.created` | Transaction is created |
| `wallet.transaction.signed` | Transaction is signed ([signEvmTransaction](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-core/Functions/signEvmTransaction)) |
| `wallet.transaction.broadcast` | Transaction is broadcast to the network |
| `wallet.transaction.pending` | Transaction stuck in mempool for more than 30 seconds |
| `wallet.transaction.replaced` | Transaction replaced an existing pending transaction |
| `wallet.transaction.confirmed` | Transaction confirmed onchain |
| `wallet.transaction.failed` | Transaction failed onchain or was replaced |
| `wallet.typed_data.signed` | EVM EIP-712 typed data signed |
| `wallet.message.signed` | EVM EIP-191 message signed |
| `wallet.hash.signed` | Arbitrary hash signed |
| `wallet.delegation.created` | Delegation grant created |
| `wallet.delegation.revoked` | Delegation grant revoked |

### Webhook payload

EVM payloads include the `transaction_hash` and the `address` of the account that sent the transaction.

When a transaction is performed via [delegated signing](/wallets/using-wallets/delegated-signing), the payload also includes `user_id` and `delegation_id` for attribution.

**Confirmed event:**

```json theme={null}
{
  "transaction_hash": "0x123...",
  "address": "0xabc...",
  "network": "base-sepolia",
  "user_id": "end-user-123",
  "delegation_id": "d4e5f6...",
  "confirmed_at": "2024-01-15T10:30:00Z"
}
```

**Pending event:**

The `pending` event includes gas parameters so you can evaluate whether to submit a replacement transaction with higher gas.

```json theme={null}
{
  "transaction_hash": "0x123...",
  "address": "0xabc...",
  "network": "base-sepolia",
  "user_id": "end-user-123",
  "delegation_id": "d4e5f6...",
  "pending_since": "2024-01-15T10:30:00Z",
  "max_fee_per_gas": "1000000000",
  "max_priority_fee_per_gas": "100000000"
}
```

## Solana

### Supported events

Solana supports a subset of transaction lifecycle events. The `pending` and `replaced` events are not supported on Solana. Signing and delegation events are also supported on Solana.

| Event | Description |
| - | - |
| `wallet.transaction.created` | Transaction is created |
| `wallet.transaction.signed` | Transaction is signed ([signSolanaTransaction](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-core/Functions/signSolanaTransaction)) |
| `wallet.transaction.broadcast` | Transaction is broadcast to the network |
| `wallet.transaction.confirmed` | Transaction confirmed onchain |
| `wallet.transaction.failed` | Transaction failed onchain |
| `wallet.message.signed` | Message signed |
| `wallet.delegation.created` | Delegation grant created |
| `wallet.delegation.revoked` | Delegation grant revoked |

### Webhook payload

Solana payloads use `transaction_signature` instead of `transaction_hash`.

When a transaction is performed via [delegated signing](/wallets/using-wallets/delegated-signing), the payload includes `user_id` and `delegation_id` for attribution.

**Confirmed event:**

```json theme={null}
{
  "transaction_signature": "5xyz...",
  "network": "solana-devnet",
  "user_id": "end-user-123",
  "delegation_id": "d4e5f6...",
  "confirmed_at": "2024-01-15T10:30:00Z"
}
```

## Transaction lifecycle scenarios

The events you receive depend on how the transaction progresses through the network.

### Transaction confirmed successfully

The most common path: a transaction is created, broadcast, and confirmed onchain.

```
created → broadcast → confirmed
```

No action required.

### Transaction failed onchain

The transaction was broadcast but failed during execution (e.g., reverted).

```
created → broadcast → failed
```

Handle the failure in your application logic.

### Transaction replaced

When a stuck transaction is replaced with a new one (e.g., with higher gas), the original and replacement each emit separate events.

| Transaction | Events |
| - | - |
| **Original (stuck)** | `failed` |
| **Replacement** | `broadcast` → `replaced` → `confirmed` or `failed` |

The original transaction fires a `failed` event because it will never land onchain. Handle the old transaction failure accordingly.

### Transaction stuck > 30 seconds (EVM only)

If a transaction remains pending in the mempool for more than 30 seconds, a `pending` event fires with gas parameters. You can use this to decide whether to submit a replacement transaction or continue waiting.

```
created → broadcast → pending
```

### Transaction monitoring expires (EVM only)

If a transaction is still pending when the monitoring window expires, no further events are fired.

```
created → broadcast → pending → (no further events)
```

<Warning>
  The `pending` event does **not** indicate failure. It means the transaction has been pending for more than 30 seconds. In the rare case that the monitoring window (3 minutes) expires without a `confirmed` or `failed` event, you can query the network to check whether the transaction is still pending, has since confirmed, or has failed.
</Warning>

## Delegated signing attribution

When transactions or signing operations are performed via [delegated signing](/wallets/using-wallets/delegated-signing) (API-key auth with a delegation grant), all `wallet.transaction.*`, `wallet.typed_data.signed`, `wallet.message.signed`, and `wallet.hash.signed` webhook payloads include two additional fields for attribution:

| Field | Description |
| - | - |
| `user_id` | The end user whose wallet was used for the operation |
| `delegation_id` | The delegation grant that authorized the operation |

These fields let you trace which end user and delegation grant were responsible for each operation.

## Best practices

<AccordionGroup>
  <Accordion title="Verify webhook signatures">
    Always verify the signature on incoming webhook payloads using the `secret` returned when you created the subscription. This ensures the payload is genuinely from CDP and has not been tampered with. See [Verify webhook signatures](/webhooks/verify-signatures) for implementation details.
  </Accordion>

  <Accordion title="Handle monitoring window expiry">
    CDP guarantees **at-least-once delivery** for all webhook events fired within the monitoring window. Most transactions confirm well within this period. In the rare case that a transaction is still pending when the monitoring window expires (3 minutes for EVM, 2 minutes for Solana), no further events are fired. You can query the network at that point to check whether the transaction is still pending, has since confirmed, or has failed.
  </Accordion>

  <Accordion title="Handle the pending event correctly">
    The `pending` event means a transaction has been in the mempool for more than 30 seconds — it does **not** mean the transaction failed. When you receive a `pending` event, you can:

    * Submit a replacement transaction with higher gas (using the gas parameters in the payload)
    * Continue waiting for a `confirmed` or `failed` event
  </Accordion>
</AccordionGroup>

## What to read next

<CardGroup cols={2}>
  <Card title="Multi-address subscriptions" icon="layer-group" href="/webhooks/onchain-activity/multi-address">
    Monitor up to 100 wallet addresses with a single subscription.
  </Card>

  <Card title="Onchain Activity webhooks" icon="wave-pulse" href="/webhooks/onchain-activity/overview">
    Monitor smart contract events and ERC-20 token transfers on Base.
  </Card>

  <Card title="Verify webhook signatures" icon="shield-check" href="/webhooks/verify-signatures">
    Validate that webhook payloads are genuinely from CDP.
  </Card>

  <Card title="Webhooks overview" icon="bell" href="/webhooks/overview">
    All webhook surfaces and shared concepts.
  </Card>
</CardGroup>
