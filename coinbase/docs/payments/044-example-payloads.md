> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Example Payloads

> Complete Payment Acceptance webhook payload examples for payment session, disbursement, and mandate events.

Use this page to see the shape of incoming webhook payloads for Payment Acceptance events.

Every event follows the standard CDP webhook envelope: `eventId`, `eventType`, `timestamp`, and `data`. For payment session events, `data.paymentSession` always contains a session summary. For action-triggered events, the corresponding action detail is also included as a sibling field: `data.authorization`, `data.capture`, `data.void`, or `data.refund`.

## Payment session events

<Tabs>
  <Tab title="Authorization Succeeded">
    Buyer's funds are held. Ready to capture.

    ```json theme={null}
    {
      "eventId": "evt_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "eventType": "acceptance.payment_session.authorization_succeeded",
      "timestamp": "2026-05-16T12:02:00Z",
      "data": {
        "paymentSession": {
          "paymentSessionId": "paymentSession_82c879c1-84e1-44ed-a8c2-1ac239cf09ad",
          "entityId": "entity_af2937b0-9846-4fe7-bfe9-ccc22d935114",
          "status": "authorization_succeeded",
          "amount": "100.00",
          "asset": "usdc",
          "target": {
            "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
            "asset": "usd"
          },
          "source": {
            "address": "0xAbC1234567890aBcDeF1234567890AbCdEf123456",
            "network": "base"
          },
          "balances": {
            "capturable": "100.00",
            "captured": "0",
            "refundable": "0",
            "refunded": "0"
          },
          "externalReferenceId": "order-12345",
          "metadata": {
            "customer_id": "cust_12345"
          },
          "createdAt": "2026-05-16T12:00:00.000Z",
          "updatedAt": "2026-05-16T12:02:00.000Z"
        },
        "authorization": {
          "authorizationId": "authorization_93d980d2-95f2-55fe-b9d3-2bd340cf10be",
          "status": "succeeded",
          "amount": "100.00",
          "source": {
            "address": "0xAbC1234567890aBcDeF1234567890AbCdEf123456",
            "network": "base"
          },
          "onchainTransactions": [
            {
              "transactionHash": "0xabc123def456789012345678901234567890abcdef1234567890abcdef123456",
              "network": "base"
            }
          ],
          "createdAt": "2026-05-16T12:01:00.000Z",
          "updatedAt": "2026-05-16T12:02:00.000Z"
        }
      }
    }
    ```
  </Tab>

  <Tab title="Authorization Failed">
    Authorization could not be completed.

    ```json theme={null}
    {
      "eventId": "evt_b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "eventType": "acceptance.payment_session.authorization_failed",
      "timestamp": "2026-05-16T12:02:00Z",
      "data": {
        "paymentSession": {
          "paymentSessionId": "paymentSession_82c879c1-84e1-44ed-a8c2-1ac239cf09ad",
          "entityId": "entity_af2937b0-9846-4fe7-bfe9-ccc22d935114",
          "status": "authorization_failed",
          "amount": "100.00",
          "asset": "usdc",
          "target": {
            "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
            "asset": "usd"
          },
          "balances": {
            "capturable": "0",
            "captured": "0",
            "refundable": "0",
            "refunded": "0"
          },
          "createdAt": "2026-05-16T12:00:00.000Z",
          "updatedAt": "2026-05-16T12:02:00.000Z"
        },
        "authorization": {
          "authorizationId": "authorization_93d980d2-95f2-55fe-b9d3-2bd340cf10be",
          "status": "failed",
          "amount": "100.00",
          "error": {
            "code": "insufficient_funds",
            "message": "The payer does not have sufficient funds.",
            "occurredAt": "2026-05-16T12:02:00.000Z"
          },
          "createdAt": "2026-05-16T12:01:00.000Z",
          "updatedAt": "2026-05-16T12:02:00.000Z"
        }
      }
    }
    ```
  </Tab>

  <Tab title="Capture Succeeded">
    Funds captured and settled.

    ```json theme={null}
    {
      "eventId": "evt_c3d4e5f6-a7b8-9012-cdef-123456789012",
      "eventType": "acceptance.payment_session.capture_succeeded",
      "timestamp": "2026-05-16T12:06:00Z",
      "data": {
        "paymentSession": {
          "paymentSessionId": "paymentSession_82c879c1-84e1-44ed-a8c2-1ac239cf09ad",
          "entityId": "entity_af2937b0-9846-4fe7-bfe9-ccc22d935114",
          "status": "capture_succeeded",
          "amount": "100.00",
          "asset": "usdc",
          "target": {
            "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
            "asset": "usd"
          },
          "source": {
            "address": "0xAbC1234567890aBcDeF1234567890AbCdEf123456",
            "network": "base"
          },
          "balances": {
            "capturable": "0",
            "captured": "100.00",
            "refundable": "100.00",
            "refunded": "0"
          },
          "externalReferenceId": "order-12345",
          "createdAt": "2026-05-16T12:00:00.000Z",
          "updatedAt": "2026-05-16T12:06:00.000Z"
        },
        "capture": {
          "captureId": "capture_a4eaa1f3-c6a4-77f9-d1f5-4df562df32df",
          "status": "succeeded",
          "amount": "100.00",
          "onchainTransactions": [
            {
              "transactionHash": "0xdef456abc789012345678901234567890abcdef1234567890abcdef12345678",
              "network": "base"
            }
          ],
          "createdAt": "2026-05-16T12:05:00.000Z",
          "updatedAt": "2026-05-16T12:06:00.000Z"
        }
      }
    }
    ```
  </Tab>

  <Tab title="Refund Succeeded">
    Captured funds returned to the buyer.

    ```json theme={null}
    {
      "eventId": "evt_d4e5f6a7-b8c9-0123-def0-234567890123",
      "eventType": "acceptance.payment_session.refund_succeeded",
      "timestamp": "2026-05-16T14:00:00Z",
      "data": {
        "paymentSession": {
          "paymentSessionId": "paymentSession_82c879c1-84e1-44ed-a8c2-1ac239cf09ad",
          "entityId": "entity_af2937b0-9846-4fe7-bfe9-ccc22d935114",
          "status": "refund_succeeded",
          "amount": "100.00",
          "asset": "usdc",
          "target": {
            "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
            "asset": "usd"
          },
          "source": {
            "address": "0xAbC1234567890aBcDeF1234567890AbCdEf123456",
            "network": "base"
          },
          "balances": {
            "capturable": "0",
            "captured": "100.00",
            "refundable": "50.00",
            "refunded": "50.00"
          },
          "externalReferenceId": "order-12345",
          "createdAt": "2026-05-16T12:00:00.000Z",
          "updatedAt": "2026-05-16T14:00:00.000Z"
        },
        "refund": {
          "refundId": "refund_b5fbb2f4-d7a5-88af-e2f6-5ef673ef43ef",
          "status": "succeeded",
          "amount": "50.00",
          "reason": "Customer returned item",
          "onchainTransactions": [
            {
              "transactionHash": "0x012345678901234567890abcdef1234567890abcdef1234567890abcdef1234",
              "network": "base"
            }
          ],
          "createdAt": "2026-05-16T13:55:00.000Z",
          "updatedAt": "2026-05-16T14:00:00.000Z"
        }
      }
    }
    ```
  </Tab>

  <Tab title="Void Succeeded">
    Uncaptured authorized funds released back to the buyer.

    ```json theme={null}
    {
      "eventId": "evt_e5f6a7b8-c9d0-1234-ef01-345678901234",
      "eventType": "acceptance.payment_session.void_succeeded",
      "timestamp": "2026-05-16T12:35:00Z",
      "data": {
        "paymentSession": {
          "paymentSessionId": "paymentSession_82c879c1-84e1-44ed-a8c2-1ac239cf09ad",
          "entityId": "entity_af2937b0-9846-4fe7-bfe9-ccc22d935114",
          "status": "void_succeeded",
          "amount": "100.00",
          "asset": "usdc",
          "target": {
            "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
            "asset": "usd"
          },
          "balances": {
            "capturable": "0",
            "captured": "0",
            "refundable": "0",
            "refunded": "0"
          },
          "createdAt": "2026-05-16T12:00:00.000Z",
          "updatedAt": "2026-05-16T12:35:00.000Z"
        },
        "void": {
          "voidId": "void_c6gcc3g5-e8b6-99bg-f3g7-6fg784fg54fg",
          "status": "succeeded",
          "amount": "100.00",
          "onchainTransactions": [
            {
              "transactionHash": "0x789012345678901234567890abcdef1234567890abcdef1234567890abcdef12",
              "network": "base"
            }
          ],
          "createdAt": "2026-05-16T12:30:00.000Z",
          "updatedAt": "2026-05-16T12:35:00.000Z"
        }
      }
    }
    ```

    <Note>
      Void webhook events are reserved for future use and are not yet emitted.
    </Note>
  </Tab>

  <Tab title="Canceled">
    Session canceled before authorization. Session-level events like this one have no action detail field — the `paymentSession.status` value is sufficient.

    ```json theme={null}
    {
      "eventId": "evt_f6a7b8c9-d0e1-2345-f012-456789012345",
      "eventType": "acceptance.payment_session.canceled",
      "timestamp": "2026-05-16T12:10:00Z",
      "data": {
        "paymentSession": {
          "paymentSessionId": "paymentSession_82c879c1-84e1-44ed-a8c2-1ac239cf09ad",
          "entityId": "entity_af2937b0-9846-4fe7-bfe9-ccc22d935114",
          "status": "canceled",
          "amount": "100.00",
          "asset": "usdc",
          "target": {
            "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
            "asset": "usd"
          },
          "balances": {
            "capturable": "0",
            "captured": "0",
            "refundable": "0",
            "refunded": "0"
          },
          "createdAt": "2026-05-16T12:00:00.000Z",
          "updatedAt": "2026-05-16T12:10:00.000Z"
        }
      }
    }
    ```
  </Tab>
</Tabs>

## Disbursement events

<Tabs>
  <Tab title="Succeeded">
    Disbursement settled onchain.

    ```json theme={null}
    {
      "eventId": "evt_g7b8c9d0-e1f2-3456-0123-567890123456",
      "eventType": "acceptance.disbursement.succeeded",
      "timestamp": "2026-05-16T17:05:00Z",
      "data": {
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
        "status": "succeeded",
        "reason": "Goodwill credit for delayed shipment",
        "externalReferenceId": "credit-2026-05-1234",
        "metadata": {
          "customer_id": "cust_12345"
        },
        "onchainTransactions": [
          {
            "transactionHash": "0xabc123def456789012345678901234567890abcdef1234567890abcdef123456",
            "network": "base"
          }
        ],
        "createdAt": "2026-05-16T17:00:00.000Z",
        "updatedAt": "2026-05-16T17:05:00.000Z"
      }
    }
    ```
  </Tab>

  <Tab title="Failed">
    Disbursement could not be completed.

    ```json theme={null}
    {
      "eventId": "evt_h8c9d0e1-f2a3-4567-1234-678901234567",
      "eventType": "acceptance.disbursement.failed",
      "timestamp": "2026-05-16T17:01:00Z",
      "data": {
        "disbursementId": "disbursement_93d980d2-95f2-55fe-b9d3-2bd340cf10be",
        "source": {
          "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
          "asset": "usdc"
        },
        "target": {
          "coinbaseUserId": "coinbase_user_def456"
        },
        "amount": "50.00",
        "asset": "usdc",
        "status": "failed",
        "reason": "Refund for order cancellation",
        "error": {
          "code": "insufficient_funds",
          "message": "The source account does not have sufficient funds.",
          "occurredAt": "2026-05-16T17:01:00.000Z"
        },
        "createdAt": "2026-05-16T17:00:00.000Z",
        "updatedAt": "2026-05-16T17:01:00.000Z"
      }
    }
    ```
  </Tab>
</Tabs>

## Mandate events

For mandate events, `data.mandate` always contains the full mandate. Approval events also include `data.approval`, and revocation events include `data.revocation`. The created and canceled events carry only the mandate.

<Tabs>
  <Tab title="Approval Succeeded">
    The customer approved the mandate. You can now authorize payments with it.

    ```json theme={null}
    {
      "eventId": "evt_i9d0e1f2-a3b4-5678-2345-789012345678",
      "eventType": "acceptance.mandate.approval_succeeded",
      "timestamp": "2026-06-15T12:05:00Z",
      "data": {
        "mandate": {
          "mandateId": "mandate_82c879c1-84e1-44ed-a8c2-1ac239cf09ad",
          "asset": "usdc",
          "source": {
            "address": "0xAbC1234567890aBcDeF1234567890AbCdEf123456",
            "network": "base",
            "asset": "usdc"
          },
          "policy": {
            "maxPerAuthorization": "50.00",
            "maxPerPeriod": {
              "amount": "100.00",
              "period": "month"
            }
          },
          "status": "approval_succeeded",
          "metadata": {
            "customer_id": "cust_12345"
          },
          "approvedAt": "2026-06-15T12:05:00.000Z",
          "createdAt": "2026-06-15T12:00:00.000Z",
          "updatedAt": "2026-06-15T12:05:00.000Z"
        },
        "approval": {
          "approvalId": "approval_5f0e9d8c-7b6a-4321-fedc-ba0987654321",
          "status": "succeeded",
          "source": {
            "address": "0xAbC1234567890aBcDeF1234567890AbCdEf123456",
            "network": "base",
            "asset": "usdc"
          },
          "onchainTransactions": [
            {
              "transactionHash": "0xabc123def456789012345678901234567890abcdef1234567890abcdef123456",
              "network": "base"
            }
          ],
          "createdAt": "2026-06-15T12:04:00.000Z",
          "updatedAt": "2026-06-15T12:05:00.000Z"
        }
      }
    }
    ```
  </Tab>

  <Tab title="Canceled">
    You canceled the mandate. No further payments can be authorized with it.

    ```json theme={null}
    {
      "eventId": "evt_j0e1f2a3-b4c5-6789-3456-890123456789",
      "eventType": "acceptance.mandate.canceled",
      "timestamp": "2026-08-21T14:02:00Z",
      "data": {
        "mandate": {
          "mandateId": "mandate_82c879c1-84e1-44ed-a8c2-1ac239cf09ad",
          "asset": "usdc",
          "source": {
            "address": "0xAbC1234567890aBcDeF1234567890AbCdEf123456",
            "network": "base",
            "asset": "usdc"
          },
          "policy": {
            "maxPerAuthorization": "50.00",
            "maxPerPeriod": {
              "amount": "100.00",
              "period": "month"
            }
          },
          "status": "canceled",
          "metadata": {
            "customer_id": "cust_12345"
          },
          "approvedAt": "2026-06-15T12:05:00.000Z",
          "canceledAt": "2026-08-21T14:02:00.000Z",
          "createdAt": "2026-06-15T12:00:00.000Z",
          "updatedAt": "2026-08-21T14:02:00.000Z"
        }
      }
    }
    ```
  </Tab>
</Tabs>

<Note>
  This page shows full incoming webhook request bodies (`eventId`, `eventType`, `timestamp`, `data`). See the [API Reference](/api-reference/v2/rest-api/payment-sessions/payment-sessions) for complete field definitions.
</Note>

## Related

<CardGroup cols={2}>
  <Card title="Webhook Subscriptions" icon="bell" href="/webhooks/payment-acceptance/subscriptions">
    Create and manage webhook subscriptions
  </Card>

  <Card title="Verification" icon="shield-check" href="/webhooks/payment-acceptance/verification">
    Verify webhook signatures
  </Card>
</CardGroup>
