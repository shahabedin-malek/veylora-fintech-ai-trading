> Coinbase CDP docs — **x402** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Production Configuration

Use this guide to move beyond the [seller quickstart](/x402/seller/quickstart) defaults and
configure your x402 server for production. Choose the sections relevant to your deployment.

## Use CDP with an existing x402 server

<Tabs>
  <Tab title="TypeScript">
    Already have an x402 server? Add `createCdpFacilitatorClient()` for CDP settlement without
    migrating to `createX402Server`. It uses your CDP API key and secret.

    ```typescript theme={null}
    import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";
    import { x402ResourceServer } from "@x402/core/server";
    import { ExactEvmScheme } from "@x402/evm/exact/server";

    const facilitator = createCdpFacilitatorClient();

    const server = new x402ResourceServer(facilitator).register(
      "eip155:8453",
      new ExactEvmScheme(),
    );
    ```

    To cover `exact` and `upto` on Base and Solana, pass `getCdpDefaultSchemes()`:

    ```typescript theme={null}
    import { createCdpFacilitatorClient, getCdpDefaultSchemes } from "@coinbase/cdp-sdk/x402";
    import { x402ResourceServer } from "@x402/core/server";

    const facilitator = createCdpFacilitatorClient();
    const server = new x402ResourceServer(facilitator);

    for (const registration of getCdpDefaultSchemes()) {
      server.register(registration.network, registration.server);
    }
    ```

    This works with `x402HTTPResourceServer` and `x402MCPResourceServer`. See
    [`server.ts`](https://github.com/coinbase/cdp-sdk/blob/main/examples/typescript/x402/servers/express/server.ts)
    for a runnable example.
  </Tab>

  <Tab title="Python">
    Python servers can replace their existing facilitator configuration with
    `create_facilitator_config` from `cdp.x402`. The
    [Python seller setup](/x402/seller/quickstart#2-price-a-route) shows how to pass it to
    `HTTPFacilitatorClient`.
  </Tab>
</Tabs>

## Choose your environment

`createX402Server` supports Base and Solana by default:

* `"development"` uses testnets and test funds.
* `"production"` uses mainnets and real funds.

<Tabs>
  <Tab title="TypeScript">
    Routes inherit this setting unless they list specific networks. Switching `environment` changes
    every inherited route:

    ```typescript theme={null}
    const server = await createX402Server({
      environment: "production",
      routes: {
        "GET /report": { price: "$0.01" },
      },
    });
    ```

    To accept specific networks, list them on the route:

    ```typescript theme={null}
    "GET /report": { price: "$0.01", networks: ["eip155:8453", "eip155:137"] },
    ```
  </Tab>

  <Tab title="Python">
    Python servers configure each network and payment option explicitly:

    ```python theme={null}
    server = x402ResourceServer(HTTPFacilitatorClient(create_facilitator_config()))
    server.register("eip155:8453", ExactEvmServerScheme())
    server.register("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", ExactSvmServerScheme())

    routes = {
        "GET /report": RouteConfig(
            accepts=[
                PaymentOption(
                    scheme="exact",
                    pay_to=PAY_TO_EVM,
                    price="$0.01",
                    network="eip155:8453",
                ),
                PaymentOption(
                    scheme="exact",
                    pay_to=PAY_TO_SVM,
                    price="$0.01",
                    network="solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
                ),
            ],
            mime_type="application/json",
            description="AI-generated report",
        ),
    }
    ```
  </Tab>
</Tabs>

For the complete chain and token matrix, see the CDP Facilitator's
[supported networks, tokens, and schemes](/x402/seller/facilitator#advanced).

## Choose a payment scheme

A payment scheme defines when the amount is determined and how the payment settles:

* `exact` charges a known price for a synchronous endpoint.
* `upto` authorizes a maximum, then settles the amount used by a synchronous endpoint.
* `batch-settlement` supports repeated, high-throughput payments by redeeming per-request
  commitments later in batches.

Use `exact` unless your endpoint requires usage-based pricing or payment channels.

### How each scheme moves money

<Tabs>
  <Tab title="Exact">
    `exact` moves an exact amount of money from the buyer to the seller.

    <Frame>
      <img src="https://mintcdn.com/coinbase-prod/-J6KygVa438dtGfZ/images/x402-payment-flow.svg?fit=max&auto=format&n=-J6KygVa438dtGfZ&q=85&s=b7e097682771ca1d22615393d5665270" alt="x402 exact payment flow between a client, resource server, and facilitator" width="1200" height="930" data-path="images/x402-payment-flow.svg" />
    </Frame>
  </Tab>

  <Tab title="Upto">
    `upto` moves an amount of money from the buyer to the seller up to a maximum.

    <Tabs>
      <Tab title="EVM">
        <Frame>
          <img src="https://mintcdn.com/coinbase-prod/zaF3mfx6GAZt1DC_/images/x402-evm-upto-payment-flow.svg?fit=max&auto=format&n=zaF3mfx6GAZt1DC_&q=85&s=26c2903599c01e71052f9b9536e6db6e" alt="EVM x402 upto payment flow, where the client authorizes a maximum and the server settles the metered amount" width="1200" height="930" data-path="images/x402-evm-upto-payment-flow.svg" />
        </Frame>
      </Tab>

      <Tab title="SVM">
        <Frame>
          <img src="https://mintcdn.com/coinbase-prod/zaF3mfx6GAZt1DC_/images/x402-svm-upto-payment-flow.svg?fit=max&auto=format&n=zaF3mfx6GAZt1DC_&q=85&s=f0466edb5c83a991d1ea3ef1d30cd946" alt="SVM x402 upto payment flow, where the maximum is deposited in escrow before work and the unused amount is refunded after settlement" width="1200" height="930" data-path="images/x402-svm-upto-payment-flow.svg" />
        </Frame>

        On Solana, the CDP Facilitator signs each settlement voucher.
      </Tab>
    </Tabs>
  </Tab>

  <Tab title="Batch-settlement">
    `batch-settlement` trades per-request transfers for a payment channel, batching payments for high-throughput,
    sub-cent traffic. Five flows make up its lifecycle:

    <Tabs>
      <Tab title="1. Deposit">
        The buyer's first request, or any request after the channel runs dry. It signs a token
        authorization and a voucher together, and settlement opens or tops up the channel onchain.

        <Frame>
          <img src="https://mintcdn.com/coinbase-prod/-J6KygVa438dtGfZ/images/x402-batch-settlement-deposit-flow.svg?fit=max&auto=format&n=-J6KygVa438dtGfZ&q=85&s=d946ef52f537502252e4ff4441f5453c" alt="Batch settlement deposit flow, where the client funds a payment channel during its first paid request" width="1200" height="930" data-path="images/x402-batch-settlement-deposit-flow.svg" />
        </Frame>

        The only leg in the lifecycle that pays onchain gas, so it's also the slowest.
      </Tab>

      <Tab title="2. Voucher">
        Every request after the channel is funded. The buyer already knows the price and channel, so it
        attaches a voucher up front instead of waiting for a 402. Your server checks the signature against
        its mirrored channel state and serves the request.

        <Frame>
          <img src="https://mintcdn.com/coinbase-prod/-J6KygVa438dtGfZ/images/x402-batch-settlement-voucher-flow.svg?fit=max&auto=format&n=-J6KygVa438dtGfZ&q=85&s=1476c41307fe9c62b1ec8778e5278f7f" alt="Batch settlement voucher flow, where the server verifies a voucher locally and records the charge without an onchain transaction" width="1200" height="820" data-path="images/x402-batch-settlement-voucher-flow.svg" />
        </Frame>

        No facilitator call, no transaction. It only steps in for smart-wallet signers or stale local
        state.
      </Tab>

      <Tab title="3. Claim">
        Checkpoints the vouchers you've collected onto the chain. Run it on a fixed interval, once
        unclaimed value crosses a threshold, or as soon as a buyer starts a withdrawal.

        <Frame>
          <img src="https://mintcdn.com/coinbase-prod/-J6KygVa438dtGfZ/images/x402-batch-settlement-claim-flow.svg?fit=max&auto=format&n=-J6KygVa438dtGfZ&q=85&s=204bcfcd358c2a29259e770e5295e9db" alt="Batch settlement claim flow, where a scheduled job submits collected vouchers and the facilitator records them onchain" width="1200" height="650" data-path="images/x402-batch-settlement-claim-flow.svg" />
        </Frame>

        One call can cover many channels. Claim before a buyer's withdrawal delay elapses, or the
        vouchers stop being claimable.
      </Tab>

      <Tab title="4. Settle">
        Turns claimed accounting into an actual transfer, sweeping everything claimed for one receiver and
        token into a single payment.

        <Frame>
          <img src="https://mintcdn.com/coinbase-prod/-J6KygVa438dtGfZ/images/x402-batch-settlement-settle-flow.svg?fit=max&auto=format&n=-J6KygVa438dtGfZ&q=85&s=f425239e2683c8ff5f4d9eb0079d1973" alt="Batch settlement settle flow, where claimed funds are swept to the receiver in one onchain transfer" width="1200" height="650" data-path="images/x402-batch-settlement-settle-flow.svg" />
        </Frame>

        Pair it with your claim job. Funds always land at the channel's receiver, regardless of who
        triggers it.
      </Tab>

      <Tab title="5. Refund">
        The buyer asks for its unclaimed balance back without waiting out the withdrawal delay, by sending
        a zero-charge voucher. Your server settles the operation but never runs the protected route.

        <Frame>
          <img src="https://mintcdn.com/coinbase-prod/-J6KygVa438dtGfZ/images/x402-batch-settlement-refund-flow.svg?fit=max&auto=format&n=-J6KygVa438dtGfZ&q=85&s=6905ae4d0ec7928cc23ca2cd674c5e61" alt="Batch settlement refund flow, where a zero-charge voucher returns the unclaimed balance to the payer" width="1200" height="750" data-path="images/x402-batch-settlement-refund-flow.svg" />
        </Frame>

        Refunds are cooperative: they need a receiver-side signature, which your server supplies unless
        that key is delegated to the facilitator. Without one, the buyer falls back to a timed withdrawal.
      </Tab>
    </Tabs>

    For the full channel model, including withdrawal delays and state recovery, see the
    [batch-settlement specification](https://github.com/x402-foundation/x402/blob/main/specs/schemes/batch-settlement/scheme_batch_settlement_evm.md).
  </Tab>
</Tabs>

### Configure non-default schemes

<Tabs>
  <Tab title="TypeScript">
    `exact` and `upto` are registered for Base and Solana. `exact` is the default for every route.
    To use `upto`, set it on the route:

    ```typescript theme={null}
    "GET /usage": { price: "$0.10", scheme: "upto", description: "Usage-based billing" },
    ```

    Omitting `networks` expands the route to Base and Solana. Pass an explicit `networks` list to
    limit which networks the route accepts.

    Your handler must report the final amount. See the
    [Express usage-based pricing example](https://github.com/coinbase/cdp-sdk/blob/main/examples/typescript/x402/servers/express/server.ts)
    for the complete flow.

    `batch-settlement` requires the full x402 `RouteConfig` and direct scheme registration. See the
    [x402 batch-settlement guide](https://docs.x402.org/schemes/batch-settlement).
  </Tab>

  <Tab title="Python">
    Register every scheme and network pair the server accepts:

    ```python theme={null}
    from x402.mechanisms.evm.upto import UptoEvmServerScheme
    from x402.mechanisms.evm.batch_settlement.server import BatchSettlementEvmScheme

    server.register(NETWORK, UptoEvmServerScheme())
    server.register(NETWORK, BatchSettlementEvmScheme(PAY_TO))
    ```

    The route's `PaymentOption` must request the same scheme. See the x402 guides for
    [usage-based pricing](https://docs.x402.org/schemes/upto) and
    [batch settlement](https://docs.x402.org/schemes/batch-settlement).
  </Tab>
</Tabs>

### (Optional) Choose an exact payment flow

EVM and Solana `exact` support two payment flows:

<Tabs>
  <Tab title="Authorization">
    Authorization is the default. The facilitator verifies the payment before your endpoint runs and
    settles it after the work succeeds.

    <Frame>
      <img src="https://mintcdn.com/coinbase-prod/-J6KygVa438dtGfZ/images/x402-payment-flow.svg?fit=max&auto=format&n=-J6KygVa438dtGfZ&q=85&s=b7e097682771ca1d22615393d5665270" alt="Authorization payment flow, where the facilitator verifies before the endpoint runs and settles afterward" width="1200" height="930" data-path="images/x402-payment-flow.svg" />
    </Frame>
  </Tab>

  <Tab title="Upfront">
    Upfront settles the payment before your endpoint runs.

    <Frame>
      <img src="https://mintcdn.com/coinbase-prod/aZ3l4sDniAjtvPHy/images/x402-upfront-payment-flow.svg?fit=max&auto=format&n=aZ3l4sDniAjtvPHy&q=85&s=02bdd1ba856160d548eda16e52dfb9e8" alt="Upfront payment flow, where the facilitator settles before the endpoint runs" width="1200" height="780" data-path="images/x402-upfront-payment-flow.svg" />
    </Frame>
  </Tab>
</Tabs>

Set `paymentFlow` on an `exact` route to use Upfront:

```typescript theme={null}
const server = await createX402Server({
  routes: {
    "GET /report": { price: "$0.01", paymentFlow: "upfront" },
  },
});
```

Upfront reduces the risk of completing work without payment and, for long-running Solana
endpoints, gas-price slippage before settlement. If the work fails, the client has already paid
and you must handle the refund outside x402.

Escrow deposits or locks funds before work and distributes or releases them afterward. It is
defined by schemes such as EVM `auth-capture` and Solana `upto`; you cannot select it for a scheme
that does not support it. See section 6.1, "Asset Transfer Methods and Payment Flow Models," of the
[x402 specification](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md)
for details.

## Configure who receives payment

Configure an onchain address to receive payments.
This can be a [CDP custodial wallet](/wallets/custodial-wallets/overview), a
[CDP non-custodial wallet](/wallets/non-custodial-wallets/overview),
[Coinbase Prime](/prime/concepts/transactions/deposits),
[Coinbase Business](/coinbase-business/introduction/welcome), a Coinbase retail
deposit address, or a wallet you custody yourself. You only need
`CDP_WALLET_SECRET` if the SDK should provision an
[API Key Wallet](/wallets/quickstart/api-key-auth) to receive payments.

<Tabs>
  <Tab title="TypeScript">
    By default, `createX402Server` provisions an API Key Wallet, which requires
    `CDP_WALLET_SECRET`. Use `payToConfig` with `type: "address"` to receive at an
    address you already control, with no wallet secret:

    ```typescript theme={null}
    const server = await createX402Server({
      payToConfig: {
        type: "address",
        evm: "0x...",
        solana: "...",
      },
      routes,
    });
    ```

    To provision a Smart Contract Wallet instead:

    ```typescript theme={null}
    const server = await createX402Server({
      payToConfig: {
        type: "smart",
        accountName: "x402-receiver",
        ownerAccountName: "x402-owner",
      },
      routes,
    });
    ```

    ### Resolve the recipient dynamically

    Use the full x402 route format when the receiving address depends on the request:

    ```typescript theme={null}
    const server = await createX402Server({
      payToConfig: { type: "address" },
      routes: {
        "GET /report": {
          accepts: [
            {
              scheme: "exact",
              network: "eip155:8453",
              price: "$0.01",
              payTo: async (context) => resolveRecipient(context),
            },
          ],
        },
      },
    });
    ```
  </Tab>

  <Tab title="Python">
    Set `pay_to`, `price`, `network`, and `scheme` in each `PaymentOption`. Pass any
    address that can receive the asset on that network. `CDP_WALLET_SECRET` is only
    required if you provision the address with `CdpClient`.

    ### Resolve the recipient dynamically

    Pass a synchronous or asynchronous function to `pay_to` when the receiving address depends on the
    request:

    ```python theme={null}
    from x402.http import HTTPRequestContext, PaymentOption
    from x402.http.types import RouteConfig

    async def resolve_recipient(context: HTTPRequestContext) -> str:
        return await lookup_recipient(context)

    routes = {
        "GET /report": RouteConfig(
            accepts=[
                PaymentOption(
                    scheme="exact",
                    network="eip155:8453",
                    price="$0.01",
                    pay_to=resolve_recipient,
                )
            ]
        )
    }
    ```
  </Tab>
</Tabs>

## Accept other tokens

Routes can accept tokens other than USDC.

<Tabs>
  <Tab title="TypeScript">
    Use the full x402 `RouteConfig` to set the asset for each payment option. Check the CDP
    Facilitator's [supported networks and tokens](/x402/seller/facilitator#advanced) first.
  </Tab>

  <Tab title="Python">
    Set the asset on each `PaymentOption`. Check the CDP Facilitator's
    [supported networks and tokens](/x402/seller/facilitator#advanced) first.
  </Tab>
</Tabs>

## Add onchain attribution

[Builder Codes](https://docs.base.org/apps/builder-codes/builder-codes) attribute the application
that exposed a paid endpoint. The CDP Facilitator records this code in ERC-8021 Schema 2 calldata
when it settles an EVM payment.

<Tabs>
  <Tab title="TypeScript">
    Pass your Builder Code to `createX402Server`:

    ```typescript theme={null}
    const server = await createX402Server({
      builderCode: "my_app",
      routes,
    });
    ```

    The server advertises the code on every EVM route. Solana-only routes are skipped because Builder
    Code attribution uses EVM calldata.
  </Tab>

  <Tab title="Python">
    Add the standard x402 Builder Code declaration to each route:

    ```python theme={null}
    from x402.extensions.builder_code import BUILDER_CODE, declare_builder_code_extension

    routes = {
        "GET /report": RouteConfig(
            accepts=[...],
            extensions={
                BUILDER_CODE: declare_builder_code_extension("my_app"),
            },
        ),
    }
    ```
  </Tab>
</Tabs>

Each code must contain 1–32 lowercase letters, numbers, or underscores. Omit the option or
extension to leave application attribution unset. See the
[builder-code specification](https://github.com/x402-foundation/x402/blob/main/specs/extensions/builder_code.md)
for the attribution fields and protocol flow.

## Lifecycle hooks

<Tabs>
  <Tab title="TypeScript">
    Use resource-server hooks for payment lifecycle events. Available hooks include
    `onProtectedRequest`, `onBeforeVerify`, `onAfterVerify`, `onVerifyFailure`, `onBeforeSettle`,
    `onAfterSettle`, `onSettleFailure`, and `onVerifiedPaymentCanceled`.

    ```typescript theme={null}
    server.resourceServer.onAfterSettle(async ({ result }) => {
      console.info("Payment settled", {
        network: result.network,
        transaction: result.transaction,
      });
    });
    ```
  </Tab>

  <Tab title="Python">
    Register Python lifecycle hooks directly on `server`:

    ```python theme={null}
    def log_settlement(context) -> None:
        print(
            "Payment settled",
            {"network": context.result.network, "transaction": context.result.transaction},
        )

    server.on_after_settle(log_settlement)
    ```
  </Tab>
</Tabs>

## Handle pending settlements

Resource servers using the CDP SDK or the canonical x402 Foundation packages automatically retry once when the CDP Facilitator broadcasts
a transaction but cannot confirm it within the synchronous settlement window. If you call the
Facilitator API directly, or if the automatic retry remains pending, reconcile the original
transaction before requesting another payment. See
[Settlement Pending and Reconciliation](./settlement-pending.mdx) for the automatic SDK behavior
and the manual procedure.

## What to read next

* [CDP Facilitator](/x402/seller/facilitator) for supported chains, tokens, and schemes.
* [Charge over MCP](./mcp-payments.mdx) to protect an MCP tool instead of an HTTP route.
