> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Fiat Deposit Destinations Quickstart

> Issue a fiat deposit destination for an entity owned or customer owned account, then simulate an inbound fiat deposit

CDP supports two kinds of fiat deposit destinations, depending on who owns the receiving account:

* **Entity Owned FIAT Deposit Destinations**: for accounts owned directly by your entity, available on Fedwire or J.P. Morgan's Kinexys Digital Payments network.
* [**Customer Owned FIAT Deposit Destinations**](#customer-owned-fiat-deposit-destinations): for accounts owned by a KYC'd customer, available on ACH and Fedwire for US customers.

Each section below walks through the full journey in Sandbox: create the account, issue the fiat deposit destination, simulate an inbound deposit, and confirm it settles. Every step is a real API call so you can see exactly which endpoints your integration needs to hit.

## Prerequisites

<AccordionGroup>
  <Accordion title="CDP CLI">
    Install the CDP CLI (requires Node.js 22+):

    ```bash theme={null}
    npm install -g @coinbase/cdp-cli
    ```

    Configure a Sandbox environment using your CDP Secret API Key JSON file from the [CDP Portal](https://portal.cdp.coinbase.com). Point it at the Sandbox host so both the `/platform/v2` APIs and the Sandbox-only simulation helper resolve:

    ```bash theme={null}
    cdp env sandbox --key-file ./cdp-api-key.json --url https://sandbox.cdp.coinbase.com
    ```

    <Warning>
      Keep the API key secret. Never commit it to source control.
    </Warning>
  </Accordion>
</AccordionGroup>

<Warning>
  Sandbox does not connect to any bank. Deposit instructions returned here are placeholders for API testing, and deposits are triggered with a simulation helper, not real money movement. Do not send real funds to a Sandbox fiat deposit destination.
</Warning>

## Entity Owned FIAT Deposit Destinations

Entity owned accounts can issue a fiat deposit destination on the Fedwire rail or the Kinexys rail (J.P. Morgan's Kinexys Digital Payments network). Fedwire deposit destinations are ABA-routed, using a bank routing number and account number. Kinexys deposit destinations are BIC-routed instead: a Bank Identifier Code (BIC) addresses the account rather than an ABA routing number. Both rails also return a `referenceCode` that **must** be included in the payment memo to attribute the deposit to your account.

### 1. Create the entity-owned account

[Create account](/api-reference/v2/rest-api/accounts/create-account) without an `owner`. When `owner` is omitted, the account is owned by the entity making the request:

```bash theme={null}
ACCOUNT_ID=$(cdp api -X POST /platform/v2/accounts -e sandbox \
  name="Treasury Account" \
  --jq=.accountId)
echo "ACCOUNT_ID=$ACCOUNT_ID"
```

<Note>
  Entity owned accounts skip customer onboarding entirely: there's no KYC'd customer, no capability requests, and no `compliance.requesterIpAddress` requirement, since these calls aren't made on a customer's behalf.
</Note>

### 2. Issue the fiat deposit destination

[Create deposit destination](/api-reference/v2/rest-api/deposit-destinations/create-deposit-destination) with type `fiat` and `paymentRail` set to `fedwire` or `kinexys`. Entity owned accounts only support these two rails:

<Tabs>
  <Tab title="Fedwire">
    ```bash theme={null}
    DEPOSIT_DESTINATION_ID=$(cdp api -X POST /platform/v2/deposit-destinations -e sandbox --jq=.depositDestinationId \
      accountId=$ACCOUNT_ID \
      type=fiat \
      fiat.currency=usd \
      fiat.paymentRail=fedwire)
    echo "DEPOSIT_DESTINATION_ID=$DEPOSIT_DESTINATION_ID"
    ```

    <Accordion title="Example response">
      ```json theme={null}
      {
        "accountId": "account_8bd258ab-75d9-474d-bbc9-6858443ae620",
        "depositDestinationId": "depositDestination_11b26de4-dcc9-4956-b656-9ce1b0d4fabd",
        "type": "fiat",
        "status": "active",
        "fiat": {
          "accountType": "us_bank",
          "bankName": "Fake Customer Bank N.A.",
          "bankAddress": "100 Sandbox Way, San Francisco, CA 94105",
          "beneficiaryName": "Sandbox User",
          "routingNumber": "123456789",
          "accountNumber": "5544394999",
          "referenceCode": "T6YTN23X",
          "supportedRails": ["fedwire"],
          "currency": "usd"
        }
      }
      ```
    </Accordion>
  </Tab>

  <Tab title="Kinexys">
    ```bash theme={null}
    DEPOSIT_DESTINATION_ID=$(cdp api -X POST /platform/v2/deposit-destinations -e sandbox --jq=.depositDestinationId \
      accountId=$ACCOUNT_ID \
      type=fiat \
      fiat.currency=usd \
      fiat.paymentRail=kinexys)
    echo "DEPOSIT_DESTINATION_ID=$DEPOSIT_DESTINATION_ID"
    ```

    <Accordion title="Example response">
      ```json theme={null}
      {
        "depositDestinationId": "depositDestination_a80ab82f-1961-4dff-964a-d9ec9ab5e4ae",
        "accountId": "account_22fed29d-794d-480a-9e6f-1264dd973ba4",
        "type": "fiat",
        "status": "active",
        "fiat": {
          "accountType": "us_bank_bic",
          "bic": "CHASUS33ONX",
          "accountNumber": "2126496091",
          "referenceCode": "F8XV5W3Q",
          "supportedRails": ["kinexys"],
          "currency": "usd"
        }
      }
      ```
    </Accordion>
  </Tab>
</Tabs>

<Note>
  Unlike the customer owned ACH flow, both entity owned rails activate immediately: `status` is `active` in the create response itself, there's no `pending` provisioning step to poll for.
</Note>

### 3. Share the deposit instructions

Once active, the `fiat` object holds the coordinates the depositor uses to send USD:

<Tabs>
  <Tab title="Fedwire">
    | Field | Purpose |
    | - | - |
    | `bankName` | The receiving bank (e.g. `Fake Customer Bank N.A.` in Sandbox) |
    | `bankAddress` | Bank address, present when required by the receiving institution |
    | `beneficiaryName` | The account holder name funds are sent to — matches your entity's name |
    | `routingNumber` | ABA routing number |
    | `accountNumber` | The bank account number |
    | `referenceCode` | Must be included in the payment memo/reference, as this code is what attributes the deposit to your account |
    | `supportedRails` | The rails this destination can receive on, `["fedwire"]` |
  </Tab>

  <Tab title="Kinexys">
    | Field | Purpose |
    | - | - |
    | `bic` | The Bank Identifier Code that routes the deposit (BIC-routed rails don't use an ABA routing number) |
    | `accountNumber` | The bank account number |
    | `referenceCode` | Mandatory for Kinexys. Kinexys payments carry no sender name, so this code (included in the payment memo/reference) is what attributes the deposit to the correct account |
    | `supportedRails` | The rails this destination can receive on, `["kinexys"]` |

    <Note>
      Kinexys deposit destinations don't return `bankName`, `beneficiaryName`, or `routingNumber` (fields the ACH/Fedwire `us_bank` account type uses), since BIC-routed accounts are identified differently.
    </Note>
  </Tab>
</Tabs>

<Warning>
  Always include the `referenceCode` in the payment memo/reference. Without it, the deposit may not be attributed to your account and the funds may not land.
</Warning>

### 4. Simulate an inbound deposit

`paymentRail` is required when simulating a deposit to a fiat destination, matching whichever rail you created the destination on:

<Tabs>
  <Tab title="Fedwire">
    ```bash theme={null}
    TRANSFER_ID=$(cdp api -X POST /platform/v2/simulations/deposits -e sandbox --jq=.transferId \
      depositDestinationId=$DEPOSIT_DESTINATION_ID \
      amount=100.00 \
      asset=usd \
      paymentRail=fedwire)
    echo "TRANSFER_ID=$TRANSFER_ID"
    ```

    <Accordion title="Example response">
      ```json theme={null}
      {
        "transferId": "transfer_84a37885-58fc-465a-9830-4cfa24a19be2"
      }
      ```
    </Accordion>
  </Tab>

  <Tab title="Kinexys">
    ```bash theme={null}
    TRANSFER_ID=$(cdp api -X POST /platform/v2/simulations/deposits -e sandbox --jq=.transferId \
      depositDestinationId=$DEPOSIT_DESTINATION_ID \
      amount=100.00 \
      asset=usd \
      paymentRail=kinexys)
    echo "TRANSFER_ID=$TRANSFER_ID"
    ```

    <Accordion title="Example response">
      ```json theme={null}
      {
        "transferId": "transfer_1e6ec943-431c-4539-836d-a5509058c17b"
      }
      ```
    </Accordion>
  </Tab>
</Tabs>

After simulation, the same events fire as for the customer owned flow:

* **Webhook events fire**: `payments.transfers.processing` then `payments.transfers.completed`
* **Transfer record is created**: visible via [List transfers](/api-reference/v2/rest-api/transfers/list-transfers)
* **Balance is credited**: this deposit destination has no `target` set, so funds land directly in the same account and currency (`usd`) rather than converting to another asset

### 5. Inspect the transfer and webhook

[Get transfer](/api-reference/v2/rest-api/transfers/get-transfer) to confirm settlement:

```bash theme={null}
cdp api /platform/v2/transfers/$TRANSFER_ID -e sandbox
```

The resolved transfer's `source` shape depends on the rail.

Kinexys's `source` reflects the BIC-routed rail: since Kinexys carries no sender name, `source` identifies the sending bank (for example `JPMorgan Chase Bank, N.A.`) rather than an individual or company name the way the ACH `source` object does ([Step 8](#8-inspect-the-webhook-payload) of the customer owned flow, below).

Fedwire's `source` isn't shown here. An entity owned Fedwire deposit is attributed by matching the incoming wire's beneficiary against your entity's legal name (the `beneficiaryName` from [Step 3](#3-share-the-deposit-instructions)) rather than by capturing the sender's identity, so there's no sender detail to expose.

The same `payments.transfers.completed` webhook fires for either rail.

### 6. Verify the balance update

[List balances for account](/api-reference/v2/rest-api/accounts/list-balances-for-account):

```bash theme={null}
cdp api /platform/v2/accounts/$ACCOUNT_ID/balances -e sandbox --jq=.balances
```

### 7. Withdraw to a linked payment method

Entity owned accounts settle outbound Fedwire and Kinexys payments through a [payment method](/payments/payment-methods/overview) rather than a bank-detail target. List payment methods to find the linked one, filtering by rail:

<Tabs>
  <Tab title="Fedwire">
    ```bash theme={null}
    PAYMENT_METHOD_ID=$(cdp api /platform/v2/payment-methods -e sandbox \
      --jq='first(.paymentMethods[] | select(.paymentRail=="fedwire" and .active) | .paymentMethodId)')
    echo "PAYMENT_METHOD_ID=$PAYMENT_METHOD_ID"
    ```

    Then create a transfer targeting it directly, with `execute: true` to settle in one call:

    ```bash theme={null}
    cdp api -X POST /platform/v2/transfers -e sandbox \
      source.accountId=$ACCOUNT_ID \
      source.asset=usd \
      target.paymentMethodId=$PAYMENT_METHOD_ID \
      target.asset=usd \
      amount=50.00 \
      asset=usd \
      'execute:=true'
    ```

    <Accordion title="Example response">
      ```json theme={null}
      {
        "transferId": "transfer_a02f3fee-05d3-4efb-8e38-ad6aa9e06987",
        "status": "completed",
        "sourceAmount": "50",
        "sourceAsset": "usd",
        "targetAmount": "50",
        "targetAsset": "usd",
        "metadata": {
          "payment_code": "PRI-SBXA02F3"
        }
      }
      ```
    </Accordion>
  </Tab>

  <Tab title="Kinexys">
    ```bash theme={null}
    PAYMENT_METHOD_ID=$(cdp api /platform/v2/payment-methods -e sandbox \
      --jq='first(.paymentMethods[] | select(.paymentRail=="kinexys" and .active) | .paymentMethodId)')
    echo "PAYMENT_METHOD_ID=$PAYMENT_METHOD_ID"
    ```

    Then create a transfer targeting it directly, with `execute: true` to settle in one call:

    ```bash theme={null}
    cdp api -X POST /platform/v2/transfers -e sandbox \
      source.accountId=$ACCOUNT_ID \
      source.asset=usd \
      target.paymentMethodId=$PAYMENT_METHOD_ID \
      target.asset=usd \
      amount=50.00 \
      asset=usd \
      'execute:=true'
    ```

    <Accordion title="Example response">
      ```json theme={null}
      {
        "transferId": "transfer_b1be62c4-6d85-47c1-9fb4-0610a622a39d",
        "status": "completed",
        "sourceAmount": "50",
        "sourceAsset": "usd",
        "targetAmount": "50",
        "targetAsset": "usd",
        "metadata": {
          "payment_code": "PRI-SBXB1BE6"
        }
      }
      ```
    </Accordion>
  </Tab>
</Tabs>

The completed transfer includes a `payment_code` in `metadata`, a settlement reference for the outbound wire. To validate a withdrawal without moving funds, set `execute: false` and `validateOnly: true`; this returns a `quoted` status without creating a transfer. See the [Transfers Quickstart](/payments/transfers/quickstart#3-create-a-fiat-withdrawal-to-a-payment-method) for the full payment method withdrawal walkthrough and the [Transfers overview](/payments/transfers/overview) for fee quotes and travel rule requirements.

## Customer Owned FIAT Deposit Destinations

Customer owned accounts can issue fiat deposit destinations on the ACH and Fedwire rail. With FIAT deposit destinations for customer owned accounts, you can provision a Virtual Account for your end users, powered by Coinbase and Citi.

### 1. Onboard a KYC'd customer

[Create a customer](/api-reference/v2/rest-api/customers/create-a-customer) with type `individual`, requesting the capabilities this flow needs:

| Capability | What it enables |
| - | - |
| `custodyCrypto` | Hold cryptocurrency in a Coinbase custodial account |
| `custodyFiat` | Hold fiat currency in a Coinbase custodial account |
| `custodyStablecoin` | Hold stablecoin in a Coinbase custodial account |

See the full [capability set](/customers-kyc/capabilities#capability-set) for every capability CDP supports.

In Sandbox, the `fullSsn` value `000-00-0000` is a [magic value](/customers-kyc/requirements#testing-in-sandbox) that forces a deterministic **approval**, so the requested capabilities verify and become `active` without real PII.

```bash theme={null}
CUSTOMER_ID=$(cdp api -X POST /platform/v2/customers -e sandbox --jq=.customerId - <<'JSON'
{
  "type": "individual",
  "individual": {
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane.doe@example.com",
    "phoneNumber": "+16175551212",
    "fullSsn": "000-00-0000",
    "dateOfBirth": { "day": "1", "month": "1", "year": "1987" },
    "address": {
      "line1": "500 Main St",
      "city": "Boston",
      "state": "MA",
      "postCode": "02108",
      "countryCode": "US"
    },
    "purposeOfAccount": "investing",
    "sourceOfFunds": "salary"
  },
  "tosAcceptances": [
    { "versionId": "us_individual_2026-05-29", "language": "en", "acceptedAt": "2026-04-17T20:00:00Z" }
  ],
  "taxAttestations": [
    { "form": "us_w9", "isExemptBackupWithholding": true, "edeliveryConsent": true, "acceptedAt": "2026-04-17T20:00:00Z" }
  ],
  "compliance": { "requesterIpAddress": "203.0.113.10" },
  "capabilities": {
    "custodyCrypto": { "requested": true },
    "custodyFiat": { "requested": true },
    "custodyStablecoin": { "requested": true }
  }
}
JSON
)
echo "CUSTOMER_ID=$CUSTOMER_ID"
```

For the full customer lifecycle (identity fields, Terms of Service, tax attestations, and the requirements each capability needs), see the [Customers Quickstart](/customers-kyc/quickstart).

### 2. Confirm the `custodyFiat` capability is active

Creating a fiat deposit destination requires the customer's `custodyFiat` capability to be `active`. Verification is asynchronous; with the approval magic value it settles quickly. Poll with [Get a customer](/api-reference/v2/rest-api/customers/get-a-customer):

```bash theme={null}
cdp api /platform/v2/customers/$CUSTOMER_ID -e sandbox --jq=.capabilities.custodyFiat
```

```json theme={null}
{ "requested": true, "status": "active" }
```

<Note>
  In production, subscribe to the [`customers.capability.changed`](/customers-kyc/capabilities#webhooks) webhook rather than polling. If `custodyFiat` is not `active`, the create call in [Step 4](#4-issue-the-fiat-deposit-destination) returns `403 customer_not_authorized`.
</Note>

### 3. Create the customer's account

[Create account](/api-reference/v2/rest-api/accounts/create-account) with the customer as owner. This is where deposited funds will land as USDC. Passing the customer ID as `owner` makes it customer-owned; customer-facing operations require the end-user's IP on `compliance.requesterIpAddress`.

```bash theme={null}
ACCOUNT_ID=$(cdp api -X POST /platform/v2/accounts -e sandbox \
  owner=$CUSTOMER_ID name="Jane Doe account" \
  compliance.requesterIpAddress=8.8.8.8 \
  --jq=.accountId)
echo "ACCOUNT_ID=$ACCOUNT_ID"
```

### 4. Issue the fiat deposit destination

[Create deposit destination](/api-reference/v2/rest-api/deposit-destinations/create-deposit-destination) with type `fiat` for the account. For customer-owned accounts, this provisions a virtual bank account at Citi. This is a customer-facing operation, so it also requires the end-user's IP on `compliance.requesterIpAddress`.

Choose a `target` for the incoming funds: credit a CDP account, or route straight out on-chain to an external address as each deposit settles (useful for automated sweeps to a non-custodial address):

<Tabs>
  <Tab title="Credit an account">
    Set `target.asset` to `usdc` so incoming USD is converted and credited as USDC:

    ```bash theme={null}
    DEPOSIT_DESTINATION_ID=$(cdp api -X POST /platform/v2/deposit-destinations -e sandbox --jq=.depositDestinationId \
      accountId=$ACCOUNT_ID \
      type=fiat \
      fiat.currency=usd \
      target.accountId=$ACCOUNT_ID \
      target.asset=usdc \
      compliance.requesterIpAddress=8.8.8.8)
    echo "DEPOSIT_DESTINATION_ID=$DEPOSIT_DESTINATION_ID"
    ```

    <Accordion title="Example response">
      ```json theme={null}
      {
        "depositDestinationId": "depositDestination_cf4958d2-b068-6bf9-da01-eee44f157336",
        "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
        "type": "fiat",
        "status": "pending",
        "fiat": {
          "accountType": "us_bank",
          "currency": "usd",
          "bankName": "Citibank N.A.",
          "beneficiaryName": "Jane Doe",
          "routingNumber": "987654321",
          "accountNumber": "123456789",
          "bankAddress": "399 Park Avenue, New York, NY 10022",
          "supportedRails": ["ach", "fedwire"]
        },
        "target": {
          "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
          "asset": "usdc"
        },
        "metadata": {
          "customer_id": "123e4567-e89b-12d3-a456-426614174000"
        },
        "createdAt": "2025-06-01T00:00:00Z",
        "updatedAt": "2025-06-01T00:00:00Z"
      }
      ```
    </Accordion>
  </Tab>

  <Tab title="Onchain address">
    Set `target.address`, `target.network`, and `target.asset` instead of `target.accountId`:

    ```bash theme={null}
    DEPOSIT_DESTINATION_ID=$(cdp api -X POST /platform/v2/deposit-destinations -e sandbox --jq=.depositDestinationId \
      accountId=$ACCOUNT_ID \
      type=fiat \
      fiat.currency=usd \
      target.address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
      target.network=base \
      target.asset=usdc \
      compliance.requesterIpAddress=8.8.8.8)
    echo "DEPOSIT_DESTINATION_ID=$DEPOSIT_DESTINATION_ID"
    ```

    <Accordion title="Example response">
      ```json theme={null}
      {
        "depositDestinationId": "depositDestination_cf4958d2-b068-6bf9-da01-eee44f157336",
        "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
        "type": "fiat",
        "status": "pending",
        "fiat": {
          "accountType": "us_bank",
          "currency": "usd",
          "bankName": "Citibank N.A.",
          "beneficiaryName": "Jane Doe",
          "routingNumber": "987654321",
          "accountNumber": "123456789",
          "bankAddress": "399 Park Avenue, New York, NY 10022",
          "supportedRails": ["ach", "fedwire"]
        },
        "target": {
          "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "network": "base",
          "asset": "usdc"
        },
        "metadata": {
          "customer_id": "123e4567-e89b-12d3-a456-426614174000"
        },
        "createdAt": "2025-06-01T00:00:00Z",
        "updatedAt": "2025-06-01T00:00:00Z"
      }
      ```
    </Accordion>
  </Tab>
</Tabs>

The rest of this guide continues with a deposit destination that credits an account. If you use the [onchain address](#onchain-address) target instead, deposits forward automatically once the destination is `active`, without a separate transfer.

<Note>
  If `custodyFiat` is not active, this returns `403` with `errorType: customer_not_authorized` and the missing capability under `unauthorizedCapabilities`. Resolve it ([Step 2](#2-confirm-the-custodyfiat-capability-is-active)) and retry.
</Note>

The response `status` is `pending`: the banking partner (Citi in production) is still provisioning the account.

### 5. Wait for activation

Poll [Get deposit destination](/api-reference/v2/rest-api/deposit-destinations/get-deposit-destination) until the fiat deposit destination is `active`. In production, the destination activates once Citi completes provisioning; Sandbox activates it without any bank interaction. Only then can it receive deposits.

```bash theme={null}
cdp api /platform/v2/deposit-destinations/$DEPOSIT_DESTINATION_ID -e sandbox --jq=.status
```

```json theme={null}
"active"
```

<Warning>
  **No webhook fires** for fiat deposit destination creation or the `pending → active` transition. You must poll `GET /v2/deposit-destinations/{depositDestinationId}` to confirm `status` is `active` before sharing deposit instructions or simulating a deposit.
</Warning>

### 6. Share the deposit instructions

Once active, the `fiat` object holds the bank coordinates the depositor uses to send USD:

| Field | Purpose |
| - | - |
| `bankName` | The receiving bank (e.g. `Citibank N.A.`) |
| `beneficiaryName` | The account holder name funds are sent to |
| `routingNumber` | ABA routing number, used for ACH and Fedwire |
| `accountNumber` | The bank account number |
| `bankAddress` | Bank address, present when required by the receiving institution |
| `referenceCode` | When present, must be included in the payment memo/reference so the deposit routes to the correct account |
| `supportedRails` | The rails this account can receive on (e.g. `["ach", "fedwire"]`) |

ACH and Fedwire are currently the publicly supported rails.

<Note>
  A fiat deposit destination can be funded by the customer themselves (the sender name must match the KYC'd customer).
</Note>

### 7. Simulate a deposit

Because Sandbox is not connected to a bank, use the simulation endpoint to trigger an inbound deposit. `paymentRail` is required when simulating a deposit to a fiat destination (`ach` or `fedwire`). For a fiat destination, `asset` defaults to the destination's currency (`usd`).

```bash theme={null}
cdp api -X POST /platform/v2/simulations/deposits -e sandbox \
  depositDestinationId=$DEPOSIT_DESTINATION_ID \
  amount=100.00 \
  asset=usd \
  paymentRail=ach
```

<Accordion title="Example response">
  ```json theme={null}
  {
    "transferId": "transfer_b340437d-4705-446f-8852-2345c83ace60"
  }
  ```
</Accordion>

After simulation:

* **Webhook events fire**: `payments.transfers.processing` then `payments.transfers.completed`
* **Transfer record is created**: visible via [List transfers](/api-reference/v2/rest-api/transfers/list-transfers)
* **Balance is credited**: the account receives USDC (converted 1:1 from USD)

### 8. Inspect the webhook payload

When the deposit settles, CDP fires a `payments.transfers.completed` webhook to your subscribed endpoint. The payload includes the transfer record, a reference back to the fiat deposit destination, and any metadata set on it.

<Note>
  This requires a webhook subscription; CDP has nowhere to deliver the event otherwise. See [Create webhook subscription](/api-reference/v2/rest-api/webhooks/create-webhook-subscription) and [Transfer Webhooks](/webhooks/transfers/overview) to set one up.
</Note>

<Accordion title="Example webhook payload">
  ```json theme={null}
  {
    "eventID": "4557efb9-391b-4a9d-987d-d263b9d7fd37",
    "eventType": "payments.transfers.completed",
    "timestamp": "2026-01-21T20:15:04Z",
    "data": {
      "transferId": "transfer_af2937b0-9846-4fe7-bfe9-ccc22d935114",
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
        "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
        "asset": "usdc"
      },
      "targetAmount": "100.00",
      "targetAsset": "usdc",
      "details": {
        "depositDestination": {
          "id": "depositDestination_cf4958d2-b068-6bf9-da01-eee44f157336"
        }
      },
      "metadata": {
        "customer_id": "123e4567-e89b-12d3-a456-426614174000"
      }
    }
  }
  ```
</Accordion>

A `payments.transfers.processing` event fires earlier when the deposit is first detected. For most integrations, listening for `completed` is sufficient. If a deposit is returned, a `payments.transfers.failed` event fires with the reason.

### 9. Verify the balance update

Confirm the deposit credited to the account as USDC with [List balances for account](/api-reference/v2/rest-api/accounts/list-balances-for-account):

```bash theme={null}
cdp api /platform/v2/accounts/$ACCOUNT_ID/balances -e sandbox --jq=.balances
```

## Move to production

To run either flow for real, switch the Sandbox base URL to the production base URL and use a production API key. In production there are no magic values (customer owned flows require the customer to complete real KYC), and fiat deposit destinations are provisioned at a banking partner.

## What to read next

<CardGroup cols={2}>
  <Card title="Deposit Destinations overview" icon="circle-info" href="/payments/deposit-destinations/overview">
    Crypto and fiat deposit destinations: concepts, rails, lifecycle, and who can send funds
  </Card>

  <Card title="Customers & KYC" icon="user-check" href="/customers-kyc/quickstart">
    Onboard and verify the customer that owns a customer owned fiat deposit destination
  </Card>

  <Card title="Payment Methods" icon="building-columns" href="/payments/payment-methods/overview">
    Link and use external bank accounts, including Fedwire and Kinexys, as transfer targets
  </Card>

  <Card title="Transfers" icon="arrow-right-arrow-left" href="/payments/transfers/quickstart">
    Move funds out of an account to a wallet address, email, or payment method
  </Card>

  <Card title="Webhooks" icon="webhook" href="/webhooks/transfers/overview">
    Subscribe to real-time deposit event notifications
  </Card>

  <Card title="REST API reference" icon="code" href="/api-reference/v2/rest-api/deposit-destinations/deposit-destinations">
    Full Deposit Destinations API reference
  </Card>
</CardGroup>
