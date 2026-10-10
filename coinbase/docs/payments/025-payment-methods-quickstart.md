> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Payment Methods Quickstart

> List payment methods and test a fiat withdrawal flow in Sandbox

This guide walks you through listing your available payment methods and testing a fiat withdrawal transfer in Sandbox. The Sandbox uses pre-provisioned mock payment methods and does not connect to any real bank or payment network.

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

## 1. List payment methods

In Sandbox, test payment methods are pre-configured based on your entity's region. List them to find the IDs you'll use in transfers:

<Tabs>
  <Tab title="CDP CLI">
    ```bash theme={null}
    cdp api /platform/v2/payment-methods -e sandbox
    ```
  </Tab>

  <Tab title="TypeScript SDK">
    ```typescript main.ts theme={null}
    const { paymentMethods } = await cdp.paymentMethods.listPaymentMethods();

    console.log(JSON.stringify({ paymentMethods }, null, 2));
    ```
  </Tab>
</Tabs>

<Accordion title="Example response (US entity)">
  ```json theme={null}
  {
    "paymentMethods": [
      {
        "paymentMethodId": "paymentMethod_398435cb-03bd-5568-b8d5-44accd7ce305",
        "active": true,
        "paymentRail": "fedwire",
        "fedwire": {
          "bankName": "JPMorgan Chase Bank NA",
          "accountLast4": "9012",
          "routingNumber": "021000021",
          "asset": "usd"
        }
      },
      {
        "paymentMethodId": "paymentMethod_82933da3-bd1e-5c8d-a05f-9ef912e5bce9",
        "active": false,
        "paymentRail": "fedwire",
        "fedwire": {
          "bankName": "Bank of America NA",
          "accountLast4": "1098",
          "routingNumber": "026009593",
          "asset": "usd"
        }
      },
      {
        "paymentMethodId": "paymentMethod_d984c884-7fef-51e8-98a2-742ba6e32515",
        "active": true,
        "paymentRail": "swift",
        "swift": {
          "bankName": "Deutsche Bank",
          "bic": "DEUTDEFF",
          "ibanLast4": "3000",
          "asset": "usd"
        }
      }
    ]
  }
  ```
</Accordion>

<Tip>
  Sandbox includes both active and inactive payment methods so you can test both success and failure paths.
</Tip>

Save the payment method IDs you'll use in the next steps:

```bash theme={null}
export ACTIVE_PM_ID="paymentMethod_398435cb-..."   # Active: transfers succeed
export INACTIVE_PM_ID="paymentMethod_82933da3-..." # Inactive: transfers fail
```

## 2. Test a successful fiat withdrawal

Transfer from your USD account to the active Fedwire payment method:

<Tabs>
  <Tab title="CDP CLI">
    ```bash theme={null}
    cdp api -X POST /platform/v2/transfers -e sandbox \
      source.accountId=$ACCOUNT_ID \
      source.asset=usd \
      target.paymentMethodId=$ACTIVE_PM_ID \
      target.asset=usd \
      amount=5.00 \
      asset=usd \
      'execute:=true'
    ```
  </Tab>

  <Tab title="TypeScript SDK">
    ```typescript main.ts theme={null}
    import { randomUUID } from "node:crypto";

    const transfer = await cdp.transfers.createTransfer({
      idempotencyKey: randomUUID(),
      source: { accountId: "YOUR_ACCOUNT_ID", asset: "usd" },
      target: { paymentMethodId: "YOUR_ACTIVE_PM_ID", asset: "usd" },
      amount: "5.00",
      asset: "usd",
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
      "asset": "usd"
    },
    "target": {
      "paymentMethodId": "paymentMethod_398435cb-03bd-5568-b8d5-44accd7ce305",
      "asset": "usd"
    },
    "sourceAmount": "5",
    "sourceAsset": "usd",
    "targetAmount": "5",
    "targetAsset": "usd",
    "createdAt": "2026-02-11T23:19:24.086Z",
    "updatedAt": "2026-02-11T23:19:24.183Z"
  }
  ```
</Accordion>

The transfer completes, your account balance decreases by \$5, and you receive webhook events: `payment.transfer.processing` → `payment.transfer.completed`.

## 3. Test a failed transfer (error handling)

Transfer to the **inactive** payment method to test how your integration handles errors:

<Tabs>
  <Tab title="CDP CLI">
    ```bash theme={null}
    cdp api -X POST /platform/v2/transfers -e sandbox \
      source.accountId=$ACCOUNT_ID \
      source.asset=usd \
      target.paymentMethodId=$INACTIVE_PM_ID \
      target.asset=usd \
      amount=5.00 \
      asset=usd \
      'execute:=true'
    ```
  </Tab>

  <Tab title="TypeScript SDK">
    ```typescript main.ts theme={null}
    try {
      await cdp.transfers.createTransfer({
        idempotencyKey: randomUUID(),
        source: { accountId: "YOUR_ACCOUNT_ID", asset: "usd" },
        target: { paymentMethodId: "YOUR_INACTIVE_PM_ID", asset: "usd" },
        amount: "5.00",
        asset: "usd",
        execute: true,
      });
    } catch (error) {
      console.error(JSON.stringify(error, null, 2));
    }
    ```
  </Tab>
</Tabs>

<Accordion title="Example error response">
  ```json theme={null}
  {
    "errorType": "invalid_request",
    "errorMessage": "Target payment method payment method id is invalid.",
    "errorLink": "https://docs.cdp.coinbase.com/api-reference/v2/errors#invalid-request",
    "correlationId": "9cc7d1cd1cae8b7e-IAD"
  }
  ```
</Accordion>

## Sandbox payment method reference

### US entities

| Payment rail | Bank | Status | Behavior |
| - | - | - | - |
| Fedwire | JPMorgan Chase Bank NA | `active` | Transfers succeed |
| Fedwire | Bank of America NA | `inactive` | Transfers fail |
| Swift | Deutsche Bank | `active` | Transfers succeed |

### EU entities

| Payment rail | Bank | Status | Behavior |
| - | - | - | - |
| SEPA | Deutsche Bank | `active` | Transfers succeed |
| SEPA | Baden-Württembergische Bank | `inactive` | Transfers fail |

## Move to production

To run this flow against real banks, switch from the Sandbox base URL to the production base URL and use a production API key. Production payment methods are real bank accounts you set up in the Coinbase Prime UI.

## What to read next

<CardGroup cols={2}>
  <Card title="Payment methods overview" icon="book" href="/payments/payment-methods/overview">
    Concepts, types, and core operations
  </Card>

  <Card title="Transfers quickstart" icon="rocket" href="/payments/transfers/quickstart">
    Test crypto and email transfers too
  </Card>

  <Card title="Transfers overview" icon="arrow-right-arrow-left" href="/payments/transfers/overview">
    All transfer types, rails, and lifecycle
  </Card>

  <Card title="REST API reference" icon="code" href="/api-reference/v2/rest-api/payment-methods/payment-methods">
    Full Payment Methods API reference
  </Card>
</CardGroup>
