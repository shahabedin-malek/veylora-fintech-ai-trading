> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Deposit Destinations Quickstart

> Create a deposit address and simulate an inbound deposit

This guide creates a crypto deposit destination and simulates an inbound deposit in Sandbox. In Sandbox, deposit destinations are placeholder addresses for API testing. The Sandbox does not connect to any blockchain network.

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
  Sandbox deposit addresses are placeholders for API testing only. They are not real blockchain addresses. Do **not** send real funds to Sandbox addresses. Your funds will be lost.
</Warning>

## 1. Create a deposit destination

Create a deposit destination for the account on Base network. The example below also includes an optional `target` (which makes it a liquidation address) and `metadata` for tracking:

<Tabs>
  <Tab title="CDP CLI">
    ```bash theme={null}
    cdp api -X POST /platform/v2/deposit-destinations -e sandbox \
      accountId=$ACCOUNT_ID \
      type=crypto \
      crypto.network=base \
      target.accountId=$ACCOUNT_ID \
      target.asset=usd \
      'metadata.customer_id=123e4567-e89b-12d3-a456-426614174000' \
      metadata.reference=77b50ed5-7e8b-41a5-a6ac-ff3cc5a08981
    ```
  </Tab>

  <Tab title="TypeScript SDK">
    ```typescript main.ts theme={null}
    import { randomUUID } from "node:crypto";

    const destination = await cdp.depositDestinations.createDepositDestination({
      idempotencyKey: randomUUID(),
      type: "crypto",
      accountId: "YOUR_ACCOUNT_ID",
      target: { accountId: "YOUR_ACCOUNT_ID", asset: "usd" },
      crypto: { network: "base" },
      metadata: {
        customer_id: "123e4567-e89b-12d3-a456-426614174000",
        reference: "77b50ed5-7e8b-41a5-a6ac-ff3cc5a08981",
      },
    });

    console.log(JSON.stringify(destination, null, 2));
    ```
  </Tab>
</Tabs>

<Accordion title="Example response">
  ```json theme={null}
  {
    "depositDestinationId": "depositDestination_af2937b0-9846-4fe7-bfe9-ccc22d935114",
    "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
    "type": "crypto",
    "crypto": {
      "network": "base",
      "address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    },
    "target": {
      "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
      "asset": "usd"
    },
    "status": "active",
    "metadata": {
      "customer_id": "123e4567-e89b-12d3-a456-426614174000",
      "reference": "77b50ed5-7e8b-41a5-a6ac-ff3cc5a08981"
    },
    "createdAt": "2023-10-08T14:30:00Z",
    "updatedAt": "2023-10-08T14:30:00Z"
  }
  ```
</Accordion>

Save the address:

```bash theme={null}
export DEPOSIT_ADDRESS="0x..." # the crypto.address from the response above
```

## 2. List deposit destinations

List all deposit destinations for the account:

<Tabs>
  <Tab title="CDP CLI">
    ```bash theme={null}
    cdp api /platform/v2/deposit-destinations -e sandbox accountId==$ACCOUNT_ID
    ```
  </Tab>

  <Tab title="TypeScript SDK">
    ```typescript main.ts theme={null}
    const { depositDestinations } =
      await cdp.depositDestinations.listDepositDestinations({
        accountId: "YOUR_ACCOUNT_ID",
      });

    console.log(JSON.stringify({ depositDestinations }, null, 2));
    ```
  </Tab>
</Tabs>

<Accordion title="Example response">
  ```json theme={null}
  {
    "depositDestinations": [
      {
        "depositDestinationId": "depositDestination_af2937b0-9846-4fe7-bfe9-ccc22d935114",
        "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
        "type": "crypto",
        "crypto": {
          "network": "base",
          "address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
        },
        "target": {
          "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
          "asset": "usd"
        },
        "status": "active",
        "createdAt": "2023-10-08T14:30:00Z",
        "updatedAt": "2023-10-08T14:30:00Z"
      }
    ]
  }
  ```
</Accordion>

## 3. Simulate a deposit

Because Sandbox is not connected to a blockchain, use the fake-deposit endpoint to trigger the inbound flow.

Simulate an external sender depositing funds to the deposit address:

<Info>
  Sandbox deposit simulation uses a Sandbox-only endpoint (`/fake/deposit/crypto`) with no SDK equivalent. Use the CDP CLI or Portal UI for this step.
</Info>

```bash theme={null}
cdp api -X POST /fake/deposit/crypto -e sandbox \
  deposit_address=$DEPOSIT_ADDRESS \
  amount=100.00 \
  asset_symbol=usdc \
  network=base
```

<Accordion title="Example response">
  ```json theme={null}
  {
    "transfer_id": "transfer_b340437d-4705-446f-8852-2345c83ace60",
    "created_at": "2026-02-24T03:12:10.077Z"
  }
  ```
</Accordion>

After simulation:

* **Webhook events fire**: `payments.transfers.processing` then `payments.transfers.completed`
* **Transfer record is created**: visible via the List Transfers API
* **Balance is credited**: the account balance updates immediately

<Note>
  The `asset_symbol` and `network` in the simulation request must match the deposit destination's configuration.
</Note>

## 4. Inspect the webhook payload

When the simulated deposit settles, CDP fires a `payments.transfers.completed` webhook to your subscribed endpoint. The payload includes the full transfer record, a reference back to the deposit destination, and any metadata set on the destination.

<Accordion title="Example webhook payload">
  ```json theme={null}
  {
    "eventID": "4557efb9-391b-4a9d-987d-d263b9d7fd37",
    "eventType": "payments.transfers.completed",
    "timestamp": "2026-01-21T20:15:04Z",
    "data": {
      "transferId": "transfer_af2937b0-9846-4fe7-bfe9-ccc22d935114",
      "status": "completed",
      "createdAt": "2026-01-21T20:12:46.296Z",
      "updatedAt": "2026-01-21T20:15:04.654Z",
      "source": {
        "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "asset": "usdc",
        "network": "base"
      },
      "sourceAmount": "100.00",
      "sourceAsset": "usdc",
      "target": {
        "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
        "asset": "usdc"
      },
      "targetAmount": "100.00",
      "targetAsset": "usdc",
      "details": {
        "depositDestination": {
          "id": "depositDestination_af2937b0-9846-4fe7-bfe9-ccc22d935114"
        },
        "onchainTransactions": [
          {
            "network": "base",
            "transactionHash": "0x363cd3b3d4f49497cf5076150cd709307b90e9fc897fdd623546ea7b9313cecb"
          }
        ]
      },
      "metadata": {
        "customer_id": "123e4567-e89b-12d3-a456-426614174000",
        "reference": "77b50ed5-7e8b-41a5-a6ac-ff3cc5a08981"
      }
    }
  }
  ```
</Accordion>

Key fields:

* **`eventType`**: `payments.transfers.completed`, the deposit settled into the account
* **`data.source.address`**: the on-chain address of the external sender
* **`data.details.depositDestination.id`**: links the transfer back to the destination created in Step 1
* **`data.metadata`**: the metadata set on the deposit destination is propagated to every payin transfer for that destination
* **`eventID`**: unique per (transferId, status). Use it for idempotency to deduplicate retries

A `payments.transfers.processing` event also fires earlier in the flow when the deposit is first detected. For most integrations, listening only for `completed` is sufficient.

To receive these events, subscribe a webhook endpoint via the [Webhooks API](/webhooks/transfers/overview).

## 5. Verify the balance update

Confirm the deposit credited to the account:

<Tabs>
  <Tab title="CDP CLI">
    ```bash theme={null}
    cdp api /platform/v2/accounts/$ACCOUNT_ID -e sandbox --jq=.balances
    ```
  </Tab>

  <Tab title="TypeScript SDK">
    ```typescript main.ts theme={null}
    const { balances } = await cdp.accounts.listBalances({
      accountId: "YOUR_ACCOUNT_ID",
    });

    for (const balance of balances) {
      const { symbol } = balance.asset;
      const { available, total } = balance.amount[symbol];
      console.log(`${symbol}: ${available} available, ${total} total`);
    }
    ```
  </Tab>
</Tabs>

## Using the Portal UI

Deposit destinations can also be created and deposits simulated through the Portal UI.

<Steps>
  <Step title="Navigate to Accounts">
    Go to the [Accounts page](https://portal.cdp.coinbase.com/v2/sandbox) in CDP Portal Sandbox
  </Step>

  <Step title="Open Deposit addresses tab">
    Click on an account row, then select the **Deposit addresses** tab
  </Step>

  <Step title="Create a new deposit address">
    Click **Create deposit address**, select the account and network, then click **Create address**
  </Step>

  <Step title="Simulate a deposit">
    Click **Deposit** under the Action column for the address to test, enter an amount, and click **Deposit now**
  </Step>
</Steps>

## Move to production

To run this flow on real blockchains, switch from the Sandbox base URL to the production base URL and use a production API key. Production deposit destinations are real on-chain addresses.

## What to read next

<CardGroup cols={2}>
  <Card title="Deposit Destinations overview" icon="circle-info" href="/payments/deposit-destinations/overview">
    Concepts, types, and supported networks
  </Card>

  <Card title="Transfers" icon="arrow-right-arrow-left" href="/payments/transfers/quickstart">
    Move funds from an account to an external address
  </Card>

  <Card title="Webhooks" icon="webhook" href="/webhooks/transfers/overview">
    Subscribe to real-time deposit event notifications
  </Card>

  <Card title="REST API reference" icon="code" href="/api-reference/v2/rest-api/deposit-destinations/deposit-destinations">
    Full Deposit Destinations API reference
  </Card>
</CardGroup>
