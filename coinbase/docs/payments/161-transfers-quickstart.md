> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Transfers Quickstart

> Create transfers to a crypto address, email, and payment method in Sandbox

This guide creates transfers to a crypto address, an email recipient, and a payment method in Sandbox, then shows how to validate, poll status, handle webhooks, and list transfers. The Sandbox does not connect to any blockchain network or settle funds on real fiat rails.

**Base URL:** `https://sandbox.cdp.coinbase.com`

## Prerequisites

Before you begin, you'll need:

<AccordionGroup>
  <Accordion title="CDP CLI">
    Install the CDP CLI (requires Node.js 22+):

    ```bash theme={null}
    npm install -g @coinbase/cdp-cli
    ```

    Configure a Sandbox environment using your CDP Secret API Key JSON file from the [CDP Portal](https://portal.cdp.coinbase.com):

    ```bash theme={null}
    cdp env sandbox --key-file ./cdp-api-key.json --url https://sandbox.cdp.coinbase.com
    ```

    <Warning>
      Keep the API key secret. Never commit it to source control.
    </Warning>
  </Accordion>

  <Accordion title="TypeScript SDK">
    Install the SDK (requires Node.js 22+):

    ```bash theme={null}
    npm install @coinbase/cdp-sdk
    ```

    Export your API key credentials. `CdpClient` reads them from the environment automatically:

    ```bash theme={null}
    export CDP_API_KEY_ID="YOUR_API_KEY_ID"
    export CDP_API_KEY_SECRET="YOUR_API_KEY_SECRET"
    ```

    Initialize the client pointed at Sandbox:

    ```typescript main.ts theme={null}
    import { CdpClient } from "@coinbase/cdp-sdk";
    import { randomUUID } from "node:crypto";

    const cdp = new CdpClient({
      basePath: "https://sandbox.cdp.coinbase.com/platform",
    });
    ```

    <Warning>
      Keep API keys secret. Never commit them to source control.
    </Warning>
  </Accordion>

  <Accordion title="A funded Sandbox account">
    See the [Custodial Accounts Quickstart](/wallets/custodial-wallets/quickstart) for setting up a Sandbox account with funds.

    Set the account ID:

    ```bash theme={null}
    export ACCOUNT_ID="account_db458f63-..."
    ```
  </Accordion>
</AccordionGroup>

<Warning>
  Sandbox transfers do not move real funds. Crypto targets are placeholder addresses, email targets are mock recipients, and payment method targets simulate fiat rails. Do **not** use real recipient details when testing in Sandbox.
</Warning>

## 1. Create a transfer to a crypto address

Send USDC from the funded account to an external on-chain address. In Sandbox, use these reserved addresses to test specific outcomes:

| Reserved address | Outcome |
| - | - |
| `0x1111111111111111111111111111111111111111` | Success |
| `0x2222222222222222222222222222222222222222` | Invalid target |
| `0x3333333333333333333333333333333333333333` | Invalid address |
| `0x4444444444444444444444444444444444444444` | Unsupported network |
| `0x5555555555555555555555555555555555555555` | Async failure |

Send to the success address:

<Tabs>
  <Tab title="CDP CLI">
    ```bash theme={null}
    cdp api -X POST /platform/v2/transfers -e sandbox \
      source.accountId=$ACCOUNT_ID \
      source.asset=usdc \
      target.network=base \
      target.address=0x1111111111111111111111111111111111111111 \
      target.asset=usdc \
      amount=5.00 \
      asset=usdc \
      'execute:=true'
    ```
  </Tab>

  <Tab title="TypeScript SDK">
    ```typescript main.ts theme={null}
    const transfer = await cdp.transfers.createTransfer({
      idempotencyKey: randomUUID(),
      source: { accountId: "YOUR_ACCOUNT_ID", asset: "usdc" },
      target: {
        address: "0x1111111111111111111111111111111111111111",
        network: "base",
        asset: "usdc",
      },
      amount: "5.00",
      asset: "usdc",
      execute: true,
    });

    console.log(JSON.stringify(transfer, null, 2));
    ```
  </Tab>
</Tabs>

<Accordion title="Example response">
  ```json theme={null}
  {
    "transferId": "transfer_8b707d29-4690-4948-b645-de1cd1f5fd05",
    "status": "completed",
    "source": {
      "accountId": "account_db458f63-418a-4a91-a045-fab93ac35c3f",
      "asset": "usdc"
    },
    "target": {
      "network": "base",
      "address": "0x1111111111111111111111111111111111111111",
      "asset": "usdc"
    },
    "sourceAmount": "5.00",
    "sourceAsset": "usdc",
    "targetAmount": "5.00",
    "targetAsset": "usdc",
    "createdAt": "2026-02-11T23:19:24.086Z",
    "updatedAt": "2026-02-11T23:19:24.183Z"
  }
  ```
</Accordion>

### Reserved address failure responses

Use the same create-transfer payload as the success example and replace only `target.address` to test deterministic Sandbox failures:

<Tabs>
  <Tab title="Invalid target">
    Address: `0x2222222222222222222222222222222222222222`

    Expected response: HTTP `400`

    ```json theme={null}
    {
      "errorType": "invalid_request",
      "errorMessage": "'target' is invalid: must match one of [Account, Payment Method, Onchain Address, Email Instrument]. Account requires 'accountId'; Payment Method requires 'paymentMethodId'; Onchain Address requires 'network'; Email Instrument requires 'email'"
    }
    ```
  </Tab>

  <Tab title="Invalid address">
    Address: `0x3333333333333333333333333333333333333333`

    Expected response: HTTP `400`

    ```json theme={null}
    {
      "errorType": "invalid_request",
      "errorMessage": "Invalid onchain address for network base."
    }
    ```
  </Tab>

  <Tab title="Unsupported network">
    Address: `0x4444444444444444444444444444444444444444`

    Expected response: HTTP `400`

    ```json theme={null}
    {
      "errorType": "invalid_request",
      "errorMessage": "base is not a supported network."
    }
    ```
  </Tab>

  <Tab title="Async failure">
    Use `0x5555555555555555555555555555555555555555` with `execute: true` to test async processing failures. The API initially returns HTTP `200` with status `processing`, then the transfer transitions to `failed` after about 500 ms.

    Expected initial response:

    ```json theme={null}
    {
      "transferId": "transfer_abc123...",
      "status": "processing",
      "target": {
        "asset": "usdc",
        "network": "base",
        "address": "0x5555555555555555555555555555555555555555"
      }
    }
    ```

    Webhook sequence:

    1. `payments.transfers.quoted`, transfer created
    2. `payments.transfers.processing`, transfer accepted and debit taken
    3. `payments.transfers.failed`, async processing failed
  </Tab>
</Tabs>

Save the transfer ID for later steps:

```bash theme={null}
export TRANSFER_ID="transfer_8b707d29-4690-4948-b645-de1cd1f5fd05"
```

## 2. Create a transfer to an email

Send USDC to a Coinbase user by email. In Sandbox, use these reserved test emails to avoid privacy issues with real addresses:

| Test email | Outcome |
| - | - |
| `testuser1@domain.com` | Success |
| `testuser2@domain.com` | Success |
| `sandboxinvalidtarget@domain.com` | Invalid email |
| `sandboxexecutionfails@domain.com` | Validation passes, execution fails (synchronous `422`) |
| `sandboxasyncfailure@domain.com` | Execution accepted (`IN_PROGRESS`), then transitions to `FAILED` async |

Send to the success email:

<Tabs>
  <Tab title="CDP CLI">
    ```bash theme={null}
    cdp api -X POST /platform/v2/transfers -e sandbox \
      source.accountId=$ACCOUNT_ID \
      source.asset=usdc \
      target.email=testuser1@domain.com \
      target.asset=usdc \
      amount=5.00 \
      asset=usdc \
      'execute:=true'
    ```
  </Tab>

  <Tab title="TypeScript SDK">
    ```typescript main.ts theme={null}
    const transfer = await cdp.transfers.createTransfer({
      idempotencyKey: randomUUID(),
      source: { accountId: "YOUR_ACCOUNT_ID", asset: "usdc" },
      target: { email: "testuser1@domain.com", asset: "usdc" },
      amount: "5.00",
      asset: "usdc",
      execute: true,
    });

    console.log(`${transfer.transferId}: ${transfer.status}`);
    ```
  </Tab>
</Tabs>

<Warning>
  Any email not listed above returns a `4xx` error. This prevents Sandbox from validating real email addresses.
</Warning>

### Reserved email failure responses

Use the reserved email addresses to exercise validation, synchronous execution, and asynchronous failure paths.

<Tabs>
  <Tab title="Invalid email target">
    Use `sandboxinvalidtarget@domain.com` with `execute: true`.

    Expected response: HTTP `400`

    ```json theme={null}
    {
      "correlationId": "90d67ad3-d067-41d8-816f-10f3a0144502",
      "errorLink": "https://docs.cdp.coinbase.com/api-reference/v2/errors#invalid-request",
      "errorMessage": "Target email is invalid.",
      "errorType": "invalid_request"
    }
    ```
  </Tab>

  <Tab title="Execution failure">
    Use `sandboxexecutionfails@domain.com` to test the case where validation succeeds but execution fails.

    | Request | Expected result |
    | - | - |
    | `validateOnly: true` | HTTP `200` with status `quoted` |
    | `execute: true` | HTTP `422` |

    Expected execute response:

    ```json theme={null}
    {
      "correlationId": "90d67ad3-d067-41d8-816f-10f3a0144502",
      "errorMessage": "Sandbox: simulated execution failure.",
      "errorType": "invalid_request"
    }
    ```
  </Tab>

  <Tab title="Async failure">
    Use `sandboxasyncfailure@domain.com` with `execute: true` to test async processing failures. The API initially returns HTTP `200` with status `processing`, then the transfer transitions to `failed` after about 500 ms.

    Expected initial response:

    ```json theme={null}
    {
      "transferId": "transfer_abc123...",
      "status": "processing",
      "target": {
        "asset": "usdc",
        "email": "sandboxasyncfailure@domain.com"
      }
    }
    ```

    Webhook sequence:

    1. `payments.transfers.quoted`, transfer created
    2. `payments.transfers.processing`, transfer accepted and debit taken
    3. `payments.transfers.failed`, async processing failed
  </Tab>
</Tabs>

## 3. Create a fiat withdrawal to a payment method

Withdraw USD from the account to a bank-rail payment method (Fedwire, SWIFT, or SEPA). The rail is determined by the payment method itself.

Sandbox auto-provisions mock payment methods on every entity. List them and pick one to use:

```bash theme={null}
cdp api /platform/v2/payment-methods -e sandbox

export PAYMENT_METHOD_ID="paymentMethod_8e03978e-..."
```

Send the withdrawal:

<Tabs>
  <Tab title="CDP CLI">
    ```bash theme={null}
    cdp api -X POST /platform/v2/transfers -e sandbox \
      source.accountId=$ACCOUNT_ID \
      source.asset=usd \
      target.paymentMethodId=$PAYMENT_METHOD_ID \
      target.asset=usd \
      amount=100.00 \
      asset=usd \
      'execute:=true'
    ```
  </Tab>

  <Tab title="TypeScript SDK">
    ```typescript main.ts theme={null}
    const transfer = await cdp.transfers.createTransfer({
      idempotencyKey: randomUUID(),
      source: { accountId: "YOUR_ACCOUNT_ID", asset: "usd" },
      target: { paymentMethodId: "YOUR_PAYMENT_METHOD_ID", asset: "usd" },
      amount: "100.00",
      asset: "usd",
      execute: true,
    });

    console.log(`${transfer.transferId}: ${transfer.status}`);
    ```
  </Tab>
</Tabs>

## 4. Validate before executing

Use `validateOnly: true` to verify recipient details before committing a transfer. This is useful for preflight checks on user-entered addresses or emails:

<Tabs>
  <Tab title="CDP CLI">
    ```bash theme={null}
    cdp api -X POST /platform/v2/transfers -e sandbox \
      source.accountId=$ACCOUNT_ID \
      source.asset=usdc \
      target.network=base \
      target.address=0x1111111111111111111111111111111111111111 \
      target.asset=usdc \
      amount=5.00 \
      asset=usdc \
      'validateOnly:=true' \
      'execute:=false'
    ```
  </Tab>

  <Tab title="TypeScript SDK">
    ```typescript main.ts theme={null}
    await cdp.transfers.createTransfer({
      idempotencyKey: randomUUID(),
      source: { accountId: "YOUR_ACCOUNT_ID", asset: "usdc" },
      target: {
        address: "0x1111111111111111111111111111111111111111",
        network: "base",
        asset: "usdc",
      },
      amount: "5.00",
      asset: "usdc",
      validateOnly: true,
      execute: false,
    });
    console.log("Transfer validation successful");
    ```
  </Tab>
</Tabs>

A `200` response means the transfer would succeed. A `4xx` response contains an `errorType` explaining why validation failed.

<Note>
  `validateOnly` and `execute` are mutually exclusive. Do not set both to `true`.
</Note>

## 5. Check transfer status

Poll the transfer to see its current status:

<Tabs>
  <Tab title="CDP CLI">
    ```bash theme={null}
    cdp api /platform/v2/transfers/$TRANSFER_ID -e sandbox --jq=.status
    ```
  </Tab>

  <Tab title="TypeScript SDK">
    ```typescript main.ts theme={null}
    const t = await cdp.transfers.getTransferById({
      transferId: "YOUR_TRANSFER_ID",
    });
    console.log(t.status);
    ```
  </Tab>
</Tabs>

## 6. Handle webhooks

In production, subscribe to `payments.transfers.*` events to receive real-time status updates rather than polling. See [Webhooks](/webhooks/transfers/overview) for setup.

**Events fired for a successful transfer:**

1. `payments.transfers.processing`, transfer is executing
2. `payments.transfers.completed`, transfer succeeded

**Events fired for a failed transfer:**

1. `payments.transfers.processing`, transfer is executing
2. `payments.transfers.failed`, transfer failed; inspect `failureReason`

## 7. List transfers

View all transfers for your entity:

<Tabs>
  <Tab title="CDP CLI">
    ```bash theme={null}
    cdp api /platform/v2/transfers -e sandbox
    ```
  </Tab>

  <Tab title="TypeScript SDK">
    ```typescript main.ts theme={null}
    const { transfers } = await cdp.transfers.listTransfers();

    for (const t of transfers) {
      console.log(`${t.transferId}: ${t.status}`);
    }
    ```
  </Tab>
</Tabs>

## Move to production

To run this flow on real rails, switch from the Sandbox base URL to the production base URL and use a production API key. Production transfers move real funds: crypto targets settle on-chain, email targets credit real Coinbase users, and payment method targets execute on Fedwire, SWIFT, or SEPA.

## What to read next

<CardGroup cols={2}>
  <Card title="Transfers overview" icon="circle-info" href="/payments/transfers/overview">
    Transfer types, fee quotes, travel rule, and lifecycle
  </Card>

  <Card title="Deposit Destinations" icon="arrow-down-to-line" href="/payments/crypto-deposit-destinations/quickstart">
    Receive inbound crypto into a custodial account
  </Card>

  <Card title="Webhooks" icon="webhook" href="/webhooks/transfers/overview">
    Subscribe to real-time transfer status events
  </Card>

  <Card title="REST API reference" icon="code" href="/api-reference/v2/rest-api/transfers/transfers">
    Create, execute, list, and get transfers
  </Card>
</CardGroup>
