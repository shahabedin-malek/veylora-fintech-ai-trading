> Coinbase CDP docs — **platform** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Testing with Postman

> Use Postman to test Payment APIs via UI

## Overview

[Postman](https://www.postman.com/) is a popular API testing tool that lets you send requests and inspect responses without writing code. We provide a pre-configured collection with all Payment API endpoints ready to use.

## Prerequisites

* Postman account ([sign up](https://www.postman.com/) or use the web version)
* Sandbox API credentials from the [CDP Portal Sandbox](https://portal.cdp.coinbase.com/v2/sandbox) (covered in the [Quickstart](/get-started/sandbox/quickstart))

## 1. Download files

Download both files below:

* <a href="/get-started/sandbox/downloads/CDP Payments Sandbox.postman_collection.json" download>CDP Payments Collection</a>: Pre-built requests for all Payment API endpoints with the correct HTTP methods, headers, and request body templates
* <a href="/get-started/sandbox/downloads/CDP Payments Sandbox.postman_environment.json" download>CDP Payments Environment</a>: Variables for the Sandbox base URL and your API keys

## 2. Import into Postman

<Steps>
  <Step title="Import collection">
    In Postman, go to **Collections** (left pane) → **Import** → upload the Collection file
  </Step>

  <Step title="Import environment">
    Go to **Environments** (left pane) → **Import** → upload the Environment file
  </Step>
</Steps>

## 3. Configure API keys

<Steps>
  <Step title="Select environment">
    In the top-right dropdown, select **CDP Payments Sandbox**
  </Step>

  <Step title="Update API key variables">
    On your variable settings, update values for `privateKey` and `name` according to your CDP Sandbox API Key you created during the [Quickstart](/get-started/sandbox/quickstart)
  </Step>
</Steps>

## 4. Test requests

<Steps>
  <Step title="Open a request">
    Select any request from the collection (e.g., "List Payment Methods")
  </Step>

  <Step title="Update request body">
    For POST requests, update the request body with your test data:

    * Get account IDs from "List Accounts" request (see [Custodial Wallets Quickstart](/wallets/custodial-wallets/quickstart))
    * Get payment method IDs from "List Payment Methods" request (see [Payment Methods Quickstart](/payments/payment-methods/quickstart))
    * Use test email addresses: `testuser1@domain.com` or `testuser2@domain.com` (see [Transfers Quickstart](/payments/transfers/quickstart))
  </Step>

  <Step title="Send">
    Click **Send** to execute the request
  </Step>
</Steps>

The collection handles JWT authentication automatically using your configured API keys.

<Tip>
  Start with GET requests (List Accounts, List Payment Methods) to retrieve IDs, then use those IDs in POST requests (Create Transfer, Create Deposit Destination).
</Tip>

## Available endpoints

The Postman collection includes all Sandbox endpoints:

* **[Accounts](/wallets/custodial-wallets/quickstart)** - Create and list accounts
* **[Deposit Destinations](/payments/crypto-deposit-destinations/quickstart)** - Create and list deposit destinations
* **[Payment Methods](/payments/payment-methods/quickstart)** - List payment methods and test withdrawals
* **[Transfers](/payments/transfers/quickstart)** - Create, execute, and list transfers (onchain, email, payment method)

## What to read next

<CardGroup cols={2}>
  <Card title="Quickstart" icon="rocket" href="/get-started/sandbox/quickstart">
    Alternative setup with CDP CLI
  </Card>

  <Card title="Payment APIs Overview" icon="book" href="/payments/overview">
    Learn more about Payment APIs
  </Card>
</CardGroup>
