> Coinbase CDP docs — **x402** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Quickstart: charge for an endpoint

This guide takes you from an unprotected HTTP route to an x402-gated endpoint with one successful payment.

<Info>
  **Selling products to people and agents?** The
  [Business Checkouts API](/api-reference/business-api/rest-api/checkouts/introduction) creates one
  checkout with a hosted payment URL for people and an `x402_url` for agents. Use it to support
  both payment flows without running your own x402 server or facilitator. See
  [Accept agentic payments with x402](/coinbase-business/checkout-apis/accept-x402-payments).

  **Charging for an MCP tool instead?** Follow [Charge over MCP](/x402/seller/mcp-payments). This
  quickstart covers HTTP routes.
</Info>

<Tip>
  **Using a coding agent?** Install the matching skill and your agent runs this guide in your own
  project:

  ```bash theme={null}
  npx skills add coinbase/cdp-sdk --skill build-x402-server
  ```
</Tip>

## Prerequisites

* A [CDP API key](https://portal.cdp.coinbase.com/api-keys/secret). The API key authenticates
  your server to the [CDP Facilitator](/x402/seller/facilitator) for verify and settle. It
  does **not** decide where funds land.
* A `payTo` address that can receive the asset on each network you advertise. The
  [CDP Facilitator](/x402/seller/facilitator) settles on multiple EVM networks and on
  Solana: one EVM address covers every EVM network you list; Solana needs a separate
  Solana address. Examples in this guide use a single EVM address on Base Sepolia. See
  [Pay-to address](#pay-to-address).
* Node.js 22 or later.

Set the facilitator credentials and your receiving address before running anything:

```bash theme={null}
export CDP_API_KEY_ID="your-api-key-id"
export CDP_API_KEY_SECRET="your-api-key-secret"
export X402_PAY_TO="0xYourReceivingAddress"
```

If you have no receiving address, create one following the
[alternate path](#2-price-a-route).

## Pay-to address

Set `X402_PAY_TO` to an onchain address that can receive the asset. Use one you
already control: a [CDP custodial wallet](/wallets/custodial-wallets/overview), a
[CDP non-custodial wallet](/wallets/non-custodial-wallets/overview),
[Coinbase Prime](/prime/concepts/transactions/deposits),
[Coinbase Business](/coinbase-business/introduction/welcome), a Coinbase retail
deposit address, or a wallet you custody. This guide uses Base Sepolia; switch to
a mainnet address in production. See
[Configure who receives payment](/x402/seller/production-configuration#configure-who-receives-payment).

## 1. Install the SDKs

The CDP SDK authenticates the facilitator. The x402 packages handle the protocol and the
framework middleware.

<Tabs>
  <Tab title="TypeScript">
    ```bash theme={null}
    npm install express @coinbase/cdp-sdk @x402/core @x402/evm @x402/svm @x402/extensions @x402/express
    ```

    This guide uses Express. For Hono and Next.js, see [Runnable examples](#runnable-examples).
  </Tab>

  <Tab title="Python">
    Python 3.10 or later is required.

    ```bash theme={null}
    pip install "cdp-sdk" "x402[evm,svm,fastapi]" uvicorn
    ```

    This guide uses FastAPI. For Flask, see [Runnable examples](#runnable-examples).
  </Tab>
</Tabs>

## 2. Price a route

The following servers charge \$0.01 for `GET /report` and settle to `X402_PAY_TO`.

<Tabs>
  <Tab title="TypeScript">
    `createX402Server` connects to the CDP Facilitator, registers payment schemes, and
    returns a server object that any x402 framework adapter accepts. `payToConfig` with
    `type: "address"` sends funds to the address you provide.

    ```typescript theme={null}
    // server.ts
    import { createX402Server } from "@coinbase/cdp-sdk/x402";
    import { paymentMiddlewareFromHTTPServer } from "@x402/express";
    import express from "express";

    const app = express();

    const payTo = process.env.X402_PAY_TO as `0x${string}`;
    if (!payTo) {
      throw new Error("Set X402_PAY_TO to the address that should receive payments");
    }

    const server = await createX402Server({
      environment: "development", // uses testnets and test funds
      payToConfig: {
        type: "address",
        evm: payTo, // reuse on any additional EVM networks the facilitator supports
      },
      routes: {
        "GET /report": {
          price: "$0.01",
          networks: ["eip155:84532"], // Base Sepolia; add other eip155: IDs or a solana: network
          description: "Generate a concise research report",
        },
      },
    });

    app.use(paymentMiddlewareFromHTTPServer(server));

    app.get("/report", (_req, res) => res.json({ report: "..." }));

    app.listen(8402, () =>
      console.log(`Receiving payments at ${server.payToEvmAddress}`),
    );
    ```

    Every route you add to `routes` is protected; everything else stays free. To accept Solana
    as well, pass `solana` on `payToConfig` (a Solana address, not the EVM one) and include a
    `solana:` network on the route. See
    [supported networks](/x402/seller/facilitator#advanced).
  </Tab>

  <Tab title="Python">
    Python has no `createX402Server`, so you assemble the same pieces: an address to
    receive payments, and the x402 Foundation middleware pointed at the CDP Facilitator
    with `create_facilitator_config`.

    ```python theme={null}
    # server.py
    import os

    from cdp.x402 import create_facilitator_config
    from fastapi import FastAPI
    from x402.http import HTTPFacilitatorClient, PaymentOption
    from x402.http.middleware.fastapi import PaymentMiddlewareASGI
    from x402.http.types import RouteConfig
    from x402.mechanisms.evm.exact import ExactEvmServerScheme
    from x402.server import x402ResourceServer

    NETWORK = "eip155:84532"  # Base Sepolia
    PAY_TO = os.environ["X402_PAY_TO"]

    # create_facilitator_config() reads your CDP API key and authenticates verify
    # and settle against the CDP Facilitator. It does not create a receiving wallet.
    server = x402ResourceServer(HTTPFacilitatorClient(create_facilitator_config()))
    server.register(NETWORK, ExactEvmServerScheme())

    routes = {
        "GET /report": RouteConfig(
            accepts=[
                PaymentOption(
                    scheme="exact", pay_to=PAY_TO, price="$0.01", network=NETWORK
                )
            ],
            mime_type="application/json",
            description="AI-generated report",
        ),
    }

    app = FastAPI()
    app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)

    @app.get("/report")
    async def get_report() -> dict:
        return {"report": "..."}

    if __name__ == "__main__":
        import uvicorn

        print(f"Receiving payments at {PAY_TO}")
        uvicorn.run(app, port=8402)
    ```

    Every route you list in `routes` is protected; everything else stays free.
  </Tab>
</Tabs>

<AccordionGroup>
  <Accordion title="Alternative: let CDP provision an API Key Wallet">
    If you do **not** already have a receiving address, CDP can create one. This replaces
    the address path above rather than adding to it: the SDK provisions an
    [API Key Wallet](/wallets/quickstart/api-key-auth) — the API key variant of CDP
    non-custodial wallets — and that wallet's address becomes your `payTo`. It is not
    required to sell over x402.

    Instead of exporting `X402_PAY_TO`, add a
    [wallet secret](/wallets/quickstart/api-key-auth):

    ```bash theme={null}
    export CDP_API_KEY_ID="your-api-key-id"
    export CDP_API_KEY_SECRET="your-api-key-secret"
    export CDP_WALLET_SECRET="your-wallet-secret"
    ```

    <Tabs>
      <Tab title="TypeScript">
        In `server.ts`, delete the `payTo` lookup and its `throw`, and drop `payToConfig`
        so `createX402Server` provisions the wallet:

        ```typescript theme={null}
        const server = await createX402Server({
          environment: "development",
          routes: {
            "GET /report": {
              price: "$0.01",
              networks: ["eip155:84532"],
              description: "Generate a concise research report",
            },
          },
        });
        ```

        The rest of the file is unchanged; `server.payToEvmAddress` reports the
        provisioned address.
      </Tab>

      <Tab title="Python">
        In `server.py`, replace `PAY_TO = os.environ["X402_PAY_TO"]` (and the now-unused
        `import os`) with a lookup that resolves the account before `routes` is built:

        ```python theme={null}
        import asyncio

        from cdp import CdpClient

        async def resolve_pay_to() -> str:
            """Provision (or reuse) the API Key Wallet that receives payments."""
            async with CdpClient() as cdp:
                account = await cdp.evm.get_or_create_account(name="x402-receiver-wallet-1")
                return account.address

        PAY_TO = asyncio.run(resolve_pay_to())
        ```

        Keep this above the `routes` definition, since each `PaymentOption` reads `PAY_TO`.
      </Tab>
    </Tabs>
  </Accordion>
</AccordionGroup>

## 3. Start the server and confirm x402 is set up

In a new terminal, start the server:

<Tabs>
  <Tab title="TypeScript">
    ```bash theme={null}
    npx tsx server.ts
    ```
  </Tab>

  <Tab title="Python">
    ```bash theme={null}
    python server.py
    ```
  </Tab>
</Tabs>

From a second terminal, request the route without paying:

```bash theme={null}
curl -i http://localhost:8402/report
```

```console theme={null}
HTTP/1.1 402 Payment Required
Content-Type: application/json; charset=utf-8
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkIiwi...

{}
```

The `402 Payment Required` response confirms that the route is protected.

## 4. Test the payment

Choose either testing path:

* Ask your agent to use the
  [Pay for Service skill](/agentic-wallet/cli/skills/pay-for-service) with
  `http://localhost:8402/report`.
* Build a basic client with the [buyer quickstart](/x402/buyer/quickstart), then point its
  request at `http://localhost:8402/report`.

Both paths fund a buyer wallet and make the paid request. A successful call returns `HTTP 200`.

## 5. Move to production

After the test payment succeeds, switch the route to a mainnet before accepting real payments:

<Tabs>
  <Tab title="TypeScript">
    ```diff theme={null}
    - environment: "development",
    + environment: "production",
    ```

    Routes without an explicit `networks` list switch from Base Sepolia and Solana Devnet to Base
    and Solana mainnets.
  </Tab>

  <Tab title="Python">
    ```diff theme={null}
    - NETWORK = "eip155:84532"  # Base Sepolia
    + NETWORK = "eip155:8453"   # Base
    ```
  </Tab>
</Tabs>

Confirm that each `payTo` address can receive funds on its mainnet — for example your
Coinbase Business, Prime, or entity deposit address, not a testnet wallet. Dollar prices
such as `"$0.01"` automatically use the network's default USDC asset. If you specify a
token address and amount directly, replace any testnet asset address with its mainnet
equivalent and verify its decimals.

See [Production configuration](/x402/seller/production-configuration) for custom networks, assets,
receiving destinations, and payment schemes.

## Runnable examples

Complete versions of the server cover more frameworks:

<Tabs>
  <Tab title="TypeScript">
    * [Express](https://github.com/coinbase/cdp-sdk/blob/main/examples/typescript/x402/servers/express/server.ts)
    * [Hono](https://github.com/coinbase/cdp-sdk/blob/main/examples/typescript/x402/servers/hono/server.ts)
    * [Next.js](https://github.com/coinbase/cdp-sdk/tree/main/examples/typescript/x402/servers/next)
  </Tab>

  <Tab title="Python">
    * [FastAPI](https://github.com/coinbase/cdp-sdk/blob/main/examples/python/x402/servers/fastapi/server.py)
    * [Flask](https://github.com/coinbase/cdp-sdk/blob/main/examples/python/x402/servers/flask/server.py)
  </Tab>
</Tabs>

## What to read next

Your endpoint is priced and paid. The next step is making it [discoverable](/x402/seller/get-discovered).

* **What settled your payment?** [CDP Facilitator](/x402/seller/facilitator) covers
  the supported networks, schemes, and pricing.
* **Need production networks, another scheme, or a different receiving destination?** See
  [Production configuration](/x402/seller/production-configuration).
