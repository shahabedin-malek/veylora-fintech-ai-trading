> Coinbase CDP docs — **custody** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Custodial Wallets Quickstart

> Create a custodial account in Sandbox and verify balances with the CDP CLI or the CDP SDK

This guide walks you through creating an **entity-owned** custodial account in **Sandbox**, adding test balances in the CDP Portal, and checking balances. You can also [create a customer-owned account](#create-a-customer-owned-account) with the CLI or SDK by setting the optional `owner` parameter.

You can follow along with the **[CDP CLI](/ai-agents/cdp-for-agents/cdp-mcp)**, **[TypeScript SDK](https://www.npmjs.com/package/@coinbase/cdp-sdk)**, or **[Java SDK](/sdks/cdp-sdks-v2/java/index)**. Use the tabs in each step to switch between them.

<Info>
  Custodial account operations are available in the **TypeScript** and **Java** SDKs. For other languages, use the CDP CLI or call the [Accounts REST API](/api-reference/v2/rest-api/accounts/accounts) directly.
</Info>

For Sandbox API keys and environment basics, see the [Sandbox quickstart](/get-started/sandbox/quickstart).

**Base API URL (Sandbox):** `https://sandbox.cdp.coinbase.com`

## Prerequisites

* A CDP login with access to the [CDP Portal](https://portal.cdp.coinbase.com)
* For the CLI or TypeScript SDK: [Node.js](https://nodejs.org/) 22 or later
* For the Java SDK: JDK 21, Gradle, and a GitHub personal access token (classic) with `read:packages` access
* A **Sandbox** API key JSON from the Portal (**Sandbox** environment, **Accounts** permission enabled)

<Warning>
  Never commit API keys to source control. Store them in environment variables or a secrets manager. Do not use real personal data in the Sandbox environment.
</Warning>

## 1. Install and configure

<Tabs>
  <Tab title="CDP CLI">
    [CDP CLI](/ai-agents/cdp-for-agents/cdp-mcp) handles JWT authentication for you — configure your API key once and it signs requests.

    ```bash theme={null}
    npm install -g @coinbase/cdp-cli
    cdp --version
    ```

    <Info>
      Node.js 22 or later is required.
    </Info>

    **Configure your Sandbox API key:**

    ```bash theme={null}
    cdp env sandbox --key-file ~/Downloads/cdp_api_key.json
    ```

    Use `-e sandbox` on commands below if your default environment is not `sandbox`, or run `cdp env sandbox` to switch context. More detail: [CDP CLI quickstart](/ai-agents/cdp-for-agents/cdp-mcp).
  </Tab>

  <Tab title="TypeScript SDK">
    Install the [CDP SDK](https://www.npmjs.com/package/@coinbase/cdp-sdk). Customer-owned accounts require version `1.57.0` or later. The SDK handles JWT authentication for you — configure your API key once and it signs requests.

    <Tabs>
      <Tab title="npm">
        ```bash theme={null}
        npm install @coinbase/cdp-sdk
        ```
      </Tab>

      <Tab title="pnpm">
        ```bash theme={null}
        pnpm add @coinbase/cdp-sdk
        ```
      </Tab>

      <Tab title="yarn">
        ```bash theme={null}
        yarn add @coinbase/cdp-sdk
        ```
      </Tab>
    </Tabs>

    <Info>
      Node.js 22 or later is required.
    </Info>

    **Configure your Sandbox API key.** The custodial APIs authenticate with your API key ID and secret. `CdpClient` reads these from the environment automatically:

    ```bash theme={null}
    export CDP_API_KEY_ID="YOUR_API_KEY_ID"
    export CDP_API_KEY_SECRET="YOUR_API_KEY_SECRET"
    ```

    Point the client at Sandbox with the `basePath` option (the default is the production platform base `https://api.cdp.coinbase.com/platform`):

    ```typescript main.ts theme={null}
    import { CdpClient } from "@coinbase/cdp-sdk";

    const cdp = new CdpClient({
      basePath: "https://sandbox.cdp.coinbase.com/platform",
    });
    ```

    <Tip>
      Load your API key from a `.env` file instead of `export` by adding `import "dotenv/config";` before you construct the client. Never commit API keys to source control.
    </Tip>
  </Tab>

  <Tab title="Java SDK">
    Use **JDK 21** and a Gradle project. The [Java SDK](/sdks/cdp-sdks-v2/java/index) is distributed through [GitHub Packages](https://github.com/coinbase/cdp-sdk/packages/2844582).

    **Configure package access.** Create a [GitHub personal access token (classic)](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-gradle-registry#authenticating-to-github-packages) with the `read:packages` scope. GitHub requires authentication to download the package. These credentials are separate from your CDP API key:

    ```bash theme={null}
    export GITHUB_USERNAME="YOUR_GITHUB_USERNAME"
    export GITHUB_TOKEN="YOUR_GITHUB_PERSONAL_ACCESS_TOKEN"
    ```

    Add the application plugin, repositories, and SDK dependency to `build.gradle.kts`:

    ```kotlin build.gradle.kts theme={null}
    plugins {
        application
    }

    repositories {
        mavenCentral()
        // Required by the SDK's Solana dependency.
        maven { url = uri("https://jitpack.io") }
        maven {
            url = uri("https://maven.pkg.github.com/coinbase/cdp-sdk")
            credentials {
                username = System.getenv("GITHUB_USERNAME")
                password = System.getenv("GITHUB_TOKEN")
            }
            content { includeGroup("com.coinbase") }
        }
    }

    dependencies {
        implementation("com.coinbase:cdp-sdk:1.0.1")
    }

    java {
        toolchain {
            languageVersion.set(JavaLanguageVersion.of(21))
        }
    }

    application {
        mainClass.set("Main")
    }
    ```

    **Configure your Sandbox API key.** These account operations need an API key, not a wallet secret. The SDK signs requests for you:

    ```bash theme={null}
    export CDP_API_KEY_ID="YOUR_API_KEY_ID"
    export CDP_API_KEY_SECRET="YOUR_API_KEY_SECRET"
    ```

    Create `src/main/java/Main.java`. The Java `url` option takes the platform base URL; the SDK adds `/v2/accounts` to it:

    ```java src/main/java/Main.java theme={null}
    import com.coinbase.cdp.CdpClient;
    import com.coinbase.cdp.resources.accounts.requests.CreateAccountRequest;
    import com.coinbase.cdp.types.AccountId;
    import com.coinbase.cdp.types.AccountName;
    import com.coinbase.cdp.types.Compliance;
    import com.coinbase.cdp.types.Owner;
    import java.util.UUID;

    public class Main {
        public static void main(String[] args) {
            CdpClient cdp = CdpClient.builder()
                .credentials(
                    System.getenv("CDP_API_KEY_ID"),
                    System.getenv("CDP_API_KEY_SECRET"))
                .url("https://sandbox.cdp.coinbase.com/platform")
                .build();

            // Add the Java code from the following steps here.
        }
    }
    ```

    Paste the Java examples below inside `main`, after creating `cdp`. After adding the account-creation code, run the application with `gradle run`, or `./gradlew run` if your project has a Gradle wrapper. Never commit either set of credentials to source control.
  </Tab>
</Tabs>

## 2. Create an account

Create a named entity account. Omitting `owner` makes the account entity-owned. Supplying an idempotency key is optional but recommended — it makes the request safely retryable, so retries return the same result instead of creating duplicate accounts. See [Idempotency](/api-reference/v2/idempotency).

<Tabs>
  <Tab title="CDP CLI">
    Create the account with `POST /v2/accounts`:

    ```bash theme={null}
    cdp api -X POST /accounts name="My Test Account" -e sandbox
    ```

    With an idempotency key:

    ```bash theme={null}
    cdp api -X POST /accounts name="My Test Account" "Header:X-Idempotency-Key:$(uuidgen)" -e sandbox
    ```

    <Info>
      `cdp api` paths are relative to the Sandbox platform base `https://sandbox.cdp.coinbase.com/platform/v2`. If `cdp api` fails with a host or path error, configure the URL explicitly: `cdp env sandbox --key-file ~/Downloads/cdp_api_key.json --url https://sandbox.cdp.coinbase.com/platform/v2`. See [How it works](/ai-agents/cdp-for-agents/cdp-mcp#how-it-works).
    </Info>
  </Tab>

  <Tab title="TypeScript SDK">
    Create the account with `cdp.accounts.createAccount`. The returned object includes the `accountId` you use in later steps:

    ```typescript main.ts theme={null}
    import { randomUUID } from "node:crypto";

    const account = await cdp.accounts.createAccount({
      idempotencyKey: randomUUID(),
      name: "My Test Account",
    });

    console.log(JSON.stringify(account, null, 2));
    ```
  </Tab>

  <Tab title="Java SDK">
    Create the account with `cdp.accounts().createAccount`. Omitting `.owner(...)` keeps it entity-owned:

    ```java theme={null}
    var account = cdp.accounts().createAccount(
        CreateAccountRequest.builder()
            .idempotencyKey(UUID.randomUUID().toString())
            .name(AccountName.of("My Test Account"))
            .build());

    System.out.println(account);
    ```
  </Tab>
</Tabs>

<Accordion title="Example response">
  ```json theme={null}
  {
    "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
    "type": "cdp",
    "owner": "entity_af2937b0-9846-4fe7-bfe9-ccc22d935114",
    "name": "My Test Account",
    "createdAt": "2023-10-08T14:30:00Z",
    "updatedAt": "2023-10-08T14:30:00Z"
  }
  ```
</Accordion>

Copy the `accountId` from the response (for example `account_af2937b0-9846-4fe7-bfe9-ccc22d935114`). You use it in the Portal and in later steps below.

### Create a customer-owned account

To create a customer-owned account instead, pass the customer's ID as `owner`. Before you run an example:

* Follow the [Customers quickstart](/customers-kyc/quickstart#1-create-a-kyc-d-customer) to create a customer in Sandbox.
* Confirm that all three custody capabilities — `custodyCrypto`, `custodyFiat`, and `custodyStablecoin` — are `active`. If any are missing, account creation returns `403` with `errorType: customer_not_authorized`.
* Replace the example customer ID with your customer's ID.
* Set `REQUESTER_IP_ADDRESS` to the end user's public IPv4 or IPv6 address. Pass it as `compliance.requesterIpAddress`, not your application's server IP. Customer-owned account creation requires this field under the custody capability policy; omitting it returns `400` with `errorType: invalid_request` when enforcement is active.

```bash theme={null}
export REQUESTER_IP_ADDRESS="<end-user-public-ip>"
```

Replace the placeholder before running an example. In your application, obtain the IP from the end user's request using your trusted proxy configuration.

Replace the entity-owned account creation call with the CLI or SDK example:

<Tabs>
  <Tab title="CDP CLI">
    Reuse the Sandbox environment configured in step 1. Pass the customer ID as `owner`:

    ```bash theme={null}
    cdp api -X POST /accounts \
      owner="customer_af2937b0-9846-4fe7-bfe9-ccc22d935114" \
      compliance.requesterIpAddress="${REQUESTER_IP_ADDRESS:?Set REQUESTER_IP_ADDRESS to the end-user public IP}" \
      name="My Test Account" \
      "Header:X-Idempotency-Key:$(uuidgen)" \
      -e sandbox
    ```
  </Tab>

  <Tab title="TypeScript SDK">
    Reuse the `cdp` client and `randomUUID` import from the preceding steps.

    ```typescript main.ts theme={null}
    const requesterIpAddress = process.env.REQUESTER_IP_ADDRESS;
    if (!requesterIpAddress) {
      throw new Error("Set REQUESTER_IP_ADDRESS to the end user's public IP");
    }

    const account = await cdp.accounts.createAccount({
      idempotencyKey: randomUUID(),
      owner: "customer_af2937b0-9846-4fe7-bfe9-ccc22d935114",
      compliance: { requesterIpAddress },
      name: "My Test Account",
    });

    console.log(JSON.stringify(account, null, 2));
    ```
  </Tab>

  <Tab title="Java SDK">
    Reuse the `cdp` client and imports from step 1. Set the customer ID with `.owner(Owner.of(...))`:

    ```java theme={null}
    var requesterIpAddress = System.getenv("REQUESTER_IP_ADDRESS");
    if (requesterIpAddress == null || requesterIpAddress.isBlank()) {
        throw new IllegalArgumentException("Set REQUESTER_IP_ADDRESS to the end user's public IP");
    }

    var account = cdp.accounts().createAccount(
        CreateAccountRequest.builder()
            .idempotencyKey(UUID.randomUUID().toString())
            .owner(Owner.of("customer_af2937b0-9846-4fe7-bfe9-ccc22d935114"))
            .compliance(Compliance.builder()
                .requesterIpAddress(requesterIpAddress)
                .build())
            .name(AccountName.of("My Test Account"))
            .build());

    System.out.println(account);
    ```
  </Tab>
</Tabs>

The response's `owner` is the customer ID you supplied. Use the returned account ID for the remaining funding and balance steps. See [Create account](/api-reference/v2/rest-api/accounts/create-account) for the full request and response schema.

## 3. Create and fund the account through the Portal

Sandbox does not move real funds. You add **simulated** balances in the Portal:

<Steps>
  <Step title="Go to Sandbox Accounts">
    In **Sandbox** mode in the CDP Portal, open the **Accounts** tab.
  </Step>

  <Step title="Select the test account">
    Open the account you created with the API (for example **My Test Account**).
  </Step>

  <Step title="Add test assets">
    Add balances in supported test assets (for example **USD** and **USDC**). Values are for testing only.
  </Step>
</Steps>

<Frame>
  <img src="https://mintcdn.com/coinbase-prod/XmV3g17i7b8SBr0T/images/sandbox_account_balance.png?fit=max&auto=format&n=XmV3g17i7b8SBr0T&q=85&s=16c3bcc710959a8cfe1d357c267c9e10" alt="Sandbox account showing test balances for USD, USDT, and USDC" width="1116" height="660" data-path="images/sandbox_account_balance.png" />
</Frame>

<Warning>
  All balances are simulated in Sandbox — no blockchain or testnet connectivity. You cannot fund accounts by sending real or testnet crypto.
</Warning>

## 4. List and inspect accounts

After funding the account, list your Sandbox accounts and inspect one account's balances.

<Tabs>
  <Tab title="CDP CLI">
    List all accounts:

    ```bash theme={null}
    cdp api /accounts -e sandbox
    ```

    <Accordion title="Example list response">
      ```json theme={null}
      {
        "accounts": [
          {
            "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
            "name": "My Test Account",
            "createdAt": "2026-02-11T20:00:00Z",
            "updatedAt": "2026-02-11T20:00:00Z"
          }
        ]
      }
      ```
    </Accordion>

    Inspect an account:

    ```bash theme={null}
    export ACCOUNT_ID="account_af2937b0-9846-4fe7-bfe9-ccc22d935114"
    cdp api "/accounts/$ACCOUNT_ID" -e sandbox
    ```

    <Accordion title="Example account response">
      ```json theme={null}
      {
        "accountId": "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
        "name": "My Test Account",
        "balances": [
          {
            "asset": "usd",
            "amount": "1000.00"
          },
          {
            "asset": "usdc",
            "amount": "500.00"
          }
        ],
        "createdAt": "2026-02-11T20:00:00Z",
        "updatedAt": "2026-02-11T23:00:00Z"
      }
      ```
    </Accordion>
  </Tab>

  <Tab title="TypeScript SDK">
    List accounts, then fetch balances for the account you want to inspect:

    ```typescript main.ts theme={null}
    const { accounts } = await cdp.accounts.listAccounts();
    console.log(JSON.stringify(accounts, null, 2));

    const accountId = accounts[0].accountId;
    const accountDetails = await cdp.accounts.getAccountById({
      accountId,
    });
    const { balances } = await cdp.accounts.listBalances({
      accountId,
    });

    console.log(JSON.stringify({ ...accountDetails, balances }, null, 2));
    ```
  </Tab>

  <Tab title="Java SDK">
    After funding the account, replace the account-creation code inside `main` with this read-only example. Replace the example account ID with the ID returned when you created the account. This lets you run `gradle run` again without creating another account:

    ```java theme={null}
    var accountId = AccountId.of("account_af2937b0-9846-4fe7-bfe9-ccc22d935114");
    var accounts = cdp.accounts().listAccounts();
    System.out.println(accounts);

    var accountDetails = cdp.accounts().getAccountById(accountId);
    var accountBalances = cdp.accounts().listBalances(accountId);
    System.out.println(accountDetails);
    System.out.println(accountBalances);
    ```
  </Tab>
</Tabs>

## 5. Verify balance(s)

<Tabs>
  <Tab title="CDP CLI">
    ```bash theme={null}
    export ACCOUNT_ID="account_af2937b0-9846-4fe7-bfe9-ccc22d935114"
    cdp accounts balances "$ACCOUNT_ID"
    ```

    <Tip>
      List all custodial account IDs:

      ```bash theme={null}
      cdp accounts list
      ```
    </Tip>

    <Info>
      `cdp accounts list` and `cdp accounts balances` ship in recent `@coinbase/cdp-cli` releases. If your CLI reports an unknown command, run `npm install -g @coinbase/cdp-cli@latest`, then try again. You can always use `cdp api "/accounts/$ACCOUNT_ID/balances" -e sandbox` as a fallback; see [List balances for account](/api-reference/v2/rest-api/accounts/list-balances-for-account).
    </Info>
  </Tab>

  <Tab title="TypeScript SDK">
    List the balances with `cdp.accounts.listBalances`. Replace the example account ID with the ID of the account you created and funded:

    ```typescript main.ts theme={null}
    const { balances } = await cdp.accounts.listBalances({
      accountId: "account_af2937b0-9846-4fe7-bfe9-ccc22d935114",
    });

    console.log(JSON.stringify(balances, null, 2));
    ```
  </Tab>

  <Tab title="Java SDK">
    Reuse `accountId` from step 4 to read the balances for the account you created:

    ```java theme={null}
    var balances = cdp.accounts().listBalances(accountId).getBalances();
    System.out.println(balances);
    ```
  </Tab>
</Tabs>

## What to read next

<CardGroup cols={2}>
  <Card title="Custodial wallets overview" icon="book" href="/wallets/custodial-wallets/overview">
    Concepts: custody model, ownership, and how accounts connect to payments
  </Card>

  <Card title="CDP CLI how it works" icon="terminal" href="/ai-agents/cdp-for-agents/cdp-mcp#how-it-works">
    Environments and `cdp api` field syntax
  </Card>

  <Card title="Deposit Destinations Quickstart" icon="arrow-down-to-line" href="/payments/crypto-deposit-destinations/quickstart">
    Generate inbound addresses tied to an account
  </Card>

  <Card title="Accounts API reference" icon="code" href="/api-reference/v2/rest-api/accounts/accounts">
    REST reference for account and balance endpoints
  </Card>
</CardGroup>
