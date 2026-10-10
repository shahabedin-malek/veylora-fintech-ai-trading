> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Example payloads

The examples are grouped by event type, then by source and target. UUID-backed identifiers use placeholders. Other sample values follow the cdp-api transfer webhook examples.

## Quoted

**Event type:** `payments.transfers.quoted`

<AccordionGroup>
  <Accordion title="Account to onchain address (onchainWithdrawal)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.quoted",
      "timestamp": "2025-01-01T00:00:00Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "quoted",
        "createdAt": "2025-01-01T00:00:00Z",
        "expiresAt": "2025-01-01T00:15:00Z",
        "source": {
          "accountId": "account_<uuid>",
          "asset": "usd"
        },
        "sourceAmount": "103.50",
        "sourceAsset": "usd",
        "target": {
          "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "network": "base",
          "asset": "usdc"
        },
        "targetAmount": "100.00",
        "targetAsset": "usdc"
      }
    }
    ```
  </Accordion>

  <Accordion title="Onchain address to account (onchainAddress)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.quoted",
      "timestamp": "2026-02-10T09:00:00Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "quoted",
        "createdAt": "2026-02-10T09:00:00Z",
        "expiresAt": "2026-02-10T09:15:00Z",
        "source": {
          "address": "0xabc1234567890abcdef1234567890abcdef123456",
          "network": "base",
          "asset": "usdc"
        },
        "sourceAmount": "250.00",
        "sourceAsset": "usdc",
        "target": {
          "accountId": "account_<uuid>",
          "asset": "usdc"
        },
        "targetAmount": "250.00",
        "targetAsset": "usdc"
      }
    }
    ```
  </Accordion>

  <Accordion title="Account to payment method (paymentMethodWithdrawal)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.quoted",
      "timestamp": "2026-03-15T14:00:00Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "quoted",
        "createdAt": "2026-03-15T14:00:00Z",
        "expiresAt": "2026-03-15T14:15:00Z",
        "source": {
          "accountId": "account_<uuid>",
          "asset": "usd"
        },
        "sourceAmount": "503.50",
        "sourceAsset": "usd",
        "target": {
          "paymentMethodId": "paymentMethod_<uuid>",
          "asset": "usd"
        },
        "targetAmount": "500.00",
        "targetAsset": "usd"
      }
    }
    ```
  </Accordion>

  <Accordion title="Account to email (emailTransfer)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.quoted",
      "timestamp": "2026-04-02T10:00:00Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "quoted",
        "createdAt": "2026-04-02T10:00:00Z",
        "expiresAt": "2026-04-02T10:15:00Z",
        "source": {
          "accountId": "account_<uuid>",
          "asset": "usdc"
        },
        "sourceAmount": "50.19",
        "sourceAsset": "usdc",
        "target": {
          "email": "recipient@example.com",
          "asset": "usdc"
        },
        "targetAmount": "50.00",
        "targetAsset": "usdc"
      }
    }
    ```
  </Accordion>
</AccordionGroup>

## Processing

**Event type:** `payments.transfers.processing`

<AccordionGroup>
  <Accordion title="Account to onchain address (onchainWithdrawal)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.processing",
      "timestamp": "2025-01-01T00:01:30Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "processing",
        "createdAt": "2025-01-01T00:00:00Z",
        "source": {
          "accountId": "account_<uuid>",
          "asset": "usd"
        },
        "sourceAmount": "103.50",
        "sourceAsset": "usd",
        "target": {
          "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "network": "base",
          "asset": "usdc"
        },
        "targetAmount": "100.00",
        "targetAsset": "usdc"
      }
    }
    ```
  </Accordion>

  <Accordion title="Onchain address to account (onchainDeposit)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.processing",
      "timestamp": "2026-02-10T09:02:30Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "processing",
        "createdAt": "2026-02-10T09:00:00Z",
        "source": {
          "address": "0xabc1234567890abcdef1234567890abcdef123456",
          "network": "base",
          "asset": "usdc"
        },
        "sourceAmount": "250.00",
        "sourceAsset": "usdc",
        "target": {
          "accountId": "account_<uuid>",
          "asset": "usdc"
        },
        "targetAmount": "250.00",
        "targetAsset": "usdc",
        "details": {
          "depositDestination": {
            "id": "depositDestination_<uuid>"
          },
          "onchainTransactions": [
            {
              "transactionHash": "0x363cd3b3d4f49497cf5076150cd709307b90e9fc897fdd623546ea7b9313cecb",
              "network": "base"
            }
          ]
        }
      }
    }
    ```
  </Accordion>

  <Accordion title="ACH to account (achDeposit)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.processing",
      "timestamp": "2026-01-21T20:13:30Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "processing",
        "createdAt": "2026-01-21T20:12:46Z",
        "source": {
          "currency": "usd",
          "companyName": "A*** C***",
          "companyEntryDescription": "PAYROLL",
          "individualIdentificationNumber": "J*** D***"
        },
        "sourceAmount": "100.00",
        "sourceAsset": "usd",
        "target": {
          "accountId": "account_<uuid>",
          "asset": "usdc"
        },
        "targetAmount": "100.00",
        "targetAsset": "usdc",
        "details": {
          "depositDestination": {
            "id": "depositDestination_<uuid>"
          }
        },
        "metadata": {
          "customer_id": "123e4567-e89b-12d3-a456-426614174000"
        }
      }
    }
    ```
  </Accordion>

  <Accordion title="Fedwire to account (fedwireDeposit)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.processing",
      "timestamp": "2026-05-10T09:13:30Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "processing",
        "createdAt": "2026-05-10T09:12:46Z",
        "source": {
          "currency": "usd",
          "omad": "20260510MMQFMP2P000042",
          "accountNumber": "8***",
          "originatorName": "A*** C***",
          "originatorToBeneficiary": [
            "Inv*** 1234"
          ]
        },
        "sourceAmount": "1000.00",
        "sourceAsset": "usd",
        "target": {
          "accountId": "account_<uuid>",
          "asset": "usdc"
        },
        "targetAmount": "1000.00",
        "targetAsset": "usdc",
        "details": {
          "depositDestination": {
            "id": "depositDestination_<uuid>"
          }
        }
      }
    }
    ```
  </Accordion>

  <Accordion title="Account to payment method (paymentMethodWithdrawal)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.processing",
      "timestamp": "2026-03-15T14:01:30Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "processing",
        "createdAt": "2026-03-15T14:00:00Z",
        "source": {
          "accountId": "account_<uuid>",
          "asset": "usd"
        },
        "sourceAmount": "503.50",
        "sourceAsset": "usd",
        "target": {
          "paymentMethodId": "paymentMethod_<uuid>",
          "asset": "usd"
        },
        "targetAmount": "500.00",
        "targetAsset": "usd"
      }
    }
    ```
  </Accordion>

  <Accordion title="Account to email (emailTransfer)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.processing",
      "timestamp": "2026-04-02T10:01:30Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "processing",
        "createdAt": "2026-04-02T10:00:00Z",
        "source": {
          "accountId": "account_<uuid>",
          "asset": "usdc"
        },
        "sourceAmount": "50.19",
        "sourceAsset": "usdc",
        "target": {
          "email": "recipient@example.com",
          "asset": "usdc"
        },
        "targetAmount": "50.00",
        "targetAsset": "usdc"
      }
    }
    ```
  </Accordion>
</AccordionGroup>

## Completed

**Event type:** `payments.transfers.completed`

<AccordionGroup>
  <Accordion title="Account to onchain address (onchainWithdrawal)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.completed",
      "timestamp": "2025-01-01T00:05:00Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "completed",
        "createdAt": "2025-01-01T00:00:00Z",
        "completedAt": "2025-01-01T00:05:00Z",
        "source": {
          "accountId": "account_<uuid>",
          "asset": "usd"
        },
        "sourceAmount": "103.50",
        "sourceAsset": "usd",
        "target": {
          "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "network": "base",
          "asset": "usdc"
        },
        "targetAmount": "100.00",
        "targetAsset": "usdc",
        "details": {
          "onchainTransactions": [
            {
              "transactionHash": "0x1d9006a308aebef4e7b22563ce4c8f2716f965a7c9ac6cdc2ce25ea4e75708d9",
              "network": "base"
            }
          ]
        }
      }
    }
    ```
  </Accordion>

  <Accordion title="Onchain address to account (onchainDeposit)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.completed",
      "timestamp": "2026-02-10T09:05:10Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "completed",
        "createdAt": "2026-02-10T09:00:00Z",
        "completedAt": "2026-02-10T09:05:10Z",
        "source": {
          "address": "0xabc1234567890abcdef1234567890abcdef123456",
          "network": "base",
          "asset": "usdc"
        },
        "sourceAmount": "250.00",
        "sourceAsset": "usdc",
        "target": {
          "accountId": "account_<uuid>",
          "asset": "usdc"
        },
        "targetAmount": "250.00",
        "targetAsset": "usdc",
        "details": {
          "depositDestination": {
            "id": "depositDestination_<uuid>"
          },
          "onchainTransactions": [
            {
              "transactionHash": "0x363cd3b3d4f49497cf5076150cd709307b90e9fc897fdd623546ea7b9313cecb",
              "network": "base"
            }
          ]
        }
      }
    }
    ```
  </Accordion>

  <Accordion title="ACH to account (achDeposit)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.completed",
      "timestamp": "2026-01-21T20:15:04Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "completed",
        "createdAt": "2026-01-21T20:12:46Z",
        "completedAt": "2026-01-21T20:15:04Z",
        "source": {
          "currency": "usd",
          "companyName": "A*** C***",
          "companyEntryDescription": "PAYROLL",
          "individualIdentificationNumber": "J*** D***"
        },
        "sourceAmount": "100.00",
        "sourceAsset": "usd",
        "target": {
          "accountId": "account_<uuid>",
          "asset": "usdc"
        },
        "targetAmount": "100.00",
        "targetAsset": "usdc",
        "details": {
          "depositDestination": {
            "id": "depositDestination_<uuid>"
          }
        },
        "metadata": {
          "customer_id": "123e4567-e89b-12d3-a456-426614174000"
        }
      }
    }
    ```
  </Accordion>

  <Accordion title="Fedwire to account (fedwireDeposit)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.completed",
      "timestamp": "2026-05-10T09:15:00Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "completed",
        "createdAt": "2026-05-10T09:12:46Z",
        "completedAt": "2026-05-10T09:15:00Z",
        "source": {
          "currency": "usd",
          "omad": "20260510MMQFMP2P000042",
          "accountNumber": "8***",
          "originatorName": "A*** C***",
          "originatorToBeneficiary": [
            "Inv*** 1234"
          ]
        },
        "sourceAmount": "1000.00",
        "sourceAsset": "usd",
        "target": {
          "accountId": "account_<uuid>",
          "asset": "usdc"
        },
        "targetAmount": "1000.00",
        "targetAsset": "usdc",
        "details": {
          "depositDestination": {
            "id": "depositDestination_<uuid>"
          }
        }
      }
    }
    ```
  </Accordion>

  <Accordion title="Account to payment method (paymentMethodWithdrawal)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.completed",
      "timestamp": "2026-03-15T14:05:00Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "completed",
        "createdAt": "2026-03-15T14:00:00Z",
        "completedAt": "2026-03-15T14:05:00Z",
        "source": {
          "accountId": "account_<uuid>",
          "asset": "usd"
        },
        "sourceAmount": "503.50",
        "sourceAsset": "usd",
        "target": {
          "paymentMethodId": "paymentMethod_<uuid>",
          "asset": "usd"
        },
        "targetAmount": "500.00",
        "targetAsset": "usd"
      }
    }
    ```
  </Accordion>

  <Accordion title="Account to email (emailTransfer)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.completed",
      "timestamp": "2026-04-02T10:05:00Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "completed",
        "createdAt": "2026-04-02T10:00:00Z",
        "completedAt": "2026-04-02T10:05:00Z",
        "source": {
          "accountId": "account_<uuid>",
          "asset": "usdc"
        },
        "sourceAmount": "50.19",
        "sourceAsset": "usdc",
        "target": {
          "email": "recipient@example.com",
          "asset": "usdc"
        },
        "targetAmount": "50.00",
        "targetAsset": "usdc"
      }
    }
    ```
  </Accordion>
</AccordionGroup>

## Failed

**Event type:** `payments.transfers.failed`

<AccordionGroup>
  <Accordion title="Account to onchain address (onchainWithdrawal)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.failed",
      "timestamp": "2025-01-01T00:02:15Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "failed",
        "createdAt": "2025-01-01T00:00:00Z",
        "failureReason": "Insufficient balance to complete this transfer.",
        "source": {
          "accountId": "account_<uuid>",
          "asset": "usd"
        },
        "sourceAmount": "103.50",
        "sourceAsset": "usd",
        "target": {
          "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "network": "base",
          "asset": "usdc"
        },
        "targetAmount": "100.00",
        "targetAsset": "usdc"
      }
    }
    ```
  </Accordion>

  <Accordion title="Onchain address to account (onchainDeposit)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.failed",
      "timestamp": "2026-02-05T11:33:45Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "failed",
        "createdAt": "2026-02-05T11:30:00Z",
        "failureReason": "Onchain deposit was reversed after failing compliance screening.",
        "source": {
          "address": "0xabc1234567890abcdef1234567890abcdef123456",
          "network": "base",
          "asset": "usdc"
        },
        "sourceAmount": "75.00",
        "sourceAsset": "usdc",
        "target": {
          "accountId": "account_<uuid>",
          "asset": "usdc"
        },
        "targetAmount": "75.00",
        "targetAsset": "usdc",
        "details": {
          "depositDestination": {
            "id": "depositDestination_<uuid>"
          }
        }
      }
    }
    ```
  </Accordion>

  <Accordion title="ACH to account (achDeposit)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.failed",
      "timestamp": "2026-01-20T14:08:30Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "failed",
        "createdAt": "2026-01-20T14:05:00Z",
        "failureReason": "ACH deposit returned: insufficient funds in originating account.",
        "source": {
          "currency": "usd",
          "companyName": "A*** C***",
          "companyEntryDescription": "PAYROLL",
          "individualIdentificationNumber": "J*** D***"
        },
        "sourceAmount": "100.00",
        "sourceAsset": "usd",
        "target": {
          "accountId": "account_<uuid>",
          "asset": "usdc"
        },
        "targetAmount": "100.00",
        "targetAsset": "usdc",
        "details": {
          "depositDestination": {
            "id": "depositDestination_<uuid>"
          }
        },
        "metadata": {
          "customer_id": "123e4567-e89b-12d3-a456-426614174000"
        }
      }
    }
    ```
  </Accordion>

  <Accordion title="Fedwire to account (fedwireDeposit)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.failed",
      "timestamp": "2026-05-10T09:15:00Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "failed",
        "createdAt": "2026-05-10T09:12:46Z",
        "failureReason": "Fedwire deposit rejected: beneficiary account could not be located.",
        "source": {
          "currency": "usd",
          "omad": "20260510MMQFMP2P000043",
          "accountNumber": "8***",
          "originatorName": "A*** C***",
          "originatorToBeneficiary": [
            "Inv*** 1234"
          ]
        },
        "sourceAmount": "1000.00",
        "sourceAsset": "usd",
        "target": {
          "accountId": "account_<uuid>",
          "asset": "usdc"
        },
        "targetAmount": "1000.00",
        "targetAsset": "usdc",
        "details": {
          "depositDestination": {
            "id": "depositDestination_<uuid>"
          }
        }
      }
    }
    ```
  </Accordion>

  <Accordion title="Account to payment method (paymentMethodWithdrawal)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.failed",
      "timestamp": "2026-03-15T14:05:00Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "failed",
        "createdAt": "2026-03-15T14:00:00Z",
        "failureReason": "Payment method withdrawal declined by the receiving bank.",
        "source": {
          "accountId": "account_<uuid>",
          "asset": "usd"
        },
        "sourceAmount": "503.50",
        "sourceAsset": "usd",
        "target": {
          "paymentMethodId": "paymentMethod_<uuid>",
          "asset": "usd"
        },
        "targetAmount": "500.00",
        "targetAsset": "usd"
      }
    }
    ```
  </Accordion>

  <Accordion title="Account to email (emailTransfer)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.failed",
      "timestamp": "2026-04-02T10:05:00Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "failed",
        "createdAt": "2026-04-02T10:00:00Z",
        "failureReason": "The recipient email address is not associated with a Coinbase account.",
        "source": {
          "accountId": "account_<uuid>",
          "asset": "usdc"
        },
        "sourceAmount": "50.19",
        "sourceAsset": "usdc",
        "target": {
          "email": "recipient@example.com",
          "asset": "usdc"
        },
        "targetAmount": "50.00",
        "targetAsset": "usdc"
      }
    }
    ```
  </Accordion>
</AccordionGroup>

## Expired

**Event type:** `payments.transfers.expired`

<AccordionGroup>
  <Accordion title="Account to onchain address (onchainWithdrawal)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.expired",
      "timestamp": "2025-01-01T00:15:00Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "quoted",
        "createdAt": "2025-01-01T00:00:00Z",
        "expiresAt": "2025-01-01T00:15:00Z",
        "source": {
          "accountId": "account_<uuid>",
          "asset": "usd"
        },
        "sourceAmount": "103.50",
        "sourceAsset": "usd",
        "target": {
          "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "network": "base",
          "asset": "usdc"
        },
        "targetAmount": "100.00",
        "targetAsset": "usdc"
      }
    }
    ```
  </Accordion>

  <Accordion title="Onchain address to account (onchainAddress)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.expired",
      "timestamp": "2026-02-10T09:15:00Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "quoted",
        "createdAt": "2026-02-10T09:00:00Z",
        "expiresAt": "2026-02-10T09:15:00Z",
        "source": {
          "address": "0xabc1234567890abcdef1234567890abcdef123456",
          "network": "base",
          "asset": "usdc"
        },
        "sourceAmount": "250.00",
        "sourceAsset": "usdc",
        "target": {
          "accountId": "account_<uuid>",
          "asset": "usdc"
        },
        "targetAmount": "250.00",
        "targetAsset": "usdc"
      }
    }
    ```
  </Accordion>

  <Accordion title="Account to payment method (paymentMethodWithdrawal)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.expired",
      "timestamp": "2026-03-15T14:15:00Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "quoted",
        "createdAt": "2026-03-15T14:00:00Z",
        "expiresAt": "2026-03-15T14:15:00Z",
        "source": {
          "accountId": "account_<uuid>",
          "asset": "usd"
        },
        "sourceAmount": "503.50",
        "sourceAsset": "usd",
        "target": {
          "paymentMethodId": "paymentMethod_<uuid>",
          "asset": "usd"
        },
        "targetAmount": "500.00",
        "targetAsset": "usd"
      }
    }
    ```
  </Accordion>

  <Accordion title="Account to email (emailTransfer)">
    ```json lines wrap theme={null}
    {
      "eventID": "<uuid>",
      "eventType": "payments.transfers.expired",
      "timestamp": "2026-04-02T10:15:00Z",
      "data": {
        "transferId": "transfer_<uuid>",
        "status": "quoted",
        "createdAt": "2026-04-02T10:00:00Z",
        "expiresAt": "2026-04-02T10:15:00Z",
        "source": {
          "accountId": "account_<uuid>",
          "asset": "usdc"
        },
        "sourceAmount": "50.19",
        "sourceAsset": "usdc",
        "target": {
          "email": "recipient@example.com",
          "asset": "usdc"
        },
        "targetAmount": "50.00",
        "targetAsset": "usdc"
      }
    }
    ```
  </Accordion>
</AccordionGroup>

<Note>
  For schema and event details, see the [quoted](/api-reference/v2/webhooks/webhook-payments-transfers-quoted), [processing](/api-reference/v2/webhooks/webhook-payments-transfers-processing), [completed](/api-reference/v2/webhooks/webhook-payments-transfers-completed), [failed](/api-reference/v2/webhooks/webhook-payments-transfers-failed), and [expired](/api-reference/v2/webhooks/webhook-payments-transfers-expired) API reference pages. The travel-rule transfer events currently have no request-body examples in the API specification.
</Note>
