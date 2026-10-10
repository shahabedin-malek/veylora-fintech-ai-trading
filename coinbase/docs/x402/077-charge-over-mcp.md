> Coinbase CDP docs — **x402** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Charge over MCP

Charging for an MCP tool call runs the same request/price/pay/settle loop as x402 over HTTP, just
carried in MCP's wire format instead of HTTP headers. If you've read
[How x402 works](/x402/how-it-works), this is that same loop applied to a tool
handler instead of an HTTP route.

## The loop over MCP

The full wire-level detail lives in the x402 Foundation's
[MCP transport spec](https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/mcp.md);
this is the short version:

1. The client calls your tool with no payment attached.
2. Your server returns a tool result with `isError: true` and a `PaymentRequired` payload — MCP's
   equivalent of an HTTP 402 status and `PAYMENT-REQUIRED` header.
3. The client builds a payment payload and retries the same tool call, this time with it attached
   at `_meta["x402/payment"]` — MCP's equivalent of `PAYMENT-SIGNATURE`.
4. Your server verifies and settles the payment, then returns the tool's real result with
   settlement info attached at `_meta["x402/payment-response"]` — MCP's equivalent of
   `PAYMENT-RESPONSE`.

<Frame>
  <img src="https://mintcdn.com/coinbase-prod/-J6KygVa438dtGfZ/images/x402-mcp-payment-flow.svg?fit=max&auto=format&n=-J6KygVa438dtGfZ&q=85&s=265a3a69091f17cc5a15fe42849c5f06" alt="x402 payment flow over MCP between a client, MCP server, and facilitator" width="1200" height="930" data-path="images/x402-mcp-payment-flow.svg" />
</Frame>

## Charging for tool calls

Wrap individual tool handlers with verify-and-settle logic, and route settlement through the CDP
Facilitator so there's no facilitator infrastructure of your own to run. `payTo` / `pay_to` is
any address that can receive the asset — a Coinbase Business, Prime, or CDP custodial wallet deposit
address, a self-custody wallet, or an [API Key Wallet](/wallets/quickstart/api-key-auth). A
wallet secret is only needed if you provision that API Key Wallet; see
[Pay-to address](/x402/seller/quickstart#pay-to-address).

<Tabs>
  <Tab title="TypeScript">
    ```bash theme={null}
    npm install @coinbase/cdp-sdk @modelcontextprotocol/sdk @x402/core @x402/evm @x402/mcp zod
    ```

    `x402ResourceServer` (from `@x402/core/server`) paired with `createPaymentWrapper` (from
    `@x402/mcp`) wraps tool handlers; `createCdpFacilitatorClient()` from the CDP SDK is the
    drop-in facilitator. The CDP SDK's `createX402Server` is HTTP-only, so it isn't a fit here —
    build the resource server directly and swap in the CDP facilitator and wallet, same as below.

    ```typescript theme={null}
    import { x402ResourceServer } from "@x402/core/server";
    import { createPaymentWrapper } from "@x402/mcp";
    import { ExactEvmScheme } from "@x402/evm/exact/server";
    import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";

    const resourceServer = new x402ResourceServer(createCdpFacilitatorClient());
    resourceServer.register("eip155:84532", new ExactEvmScheme());
    await resourceServer.initialize();

    const accepts = await resourceServer.buildPaymentRequirements({
      scheme: "exact",
      network: "eip155:84532",
      payTo, // address that can receive the asset
      price: "$0.01",
    });

    const paid = createPaymentWrapper(resourceServer, { accepts });

    mcpServer.tool(
      "generate_report",
      "Generate an AI report on a topic. Requires payment of $0.01 USDC.",
      { topic: z.string() },
      paid(async args => ({
        content: [{ type: "text", text: generateReport(args.topic) }],
      })),
    );
    ```

    Full runnable version, including a CDP-managed receiver wallet:
    [`servers/mcp/server.ts`](https://github.com/coinbase/cdp-sdk/blob/main/examples/typescript/x402/servers/mcp/server.ts).
  </Tab>

  <Tab title="Python">
    ```bash theme={null}
    pip install "cdp-sdk" "x402[evm,mcp]"
    ```

    `x402ResourceServerSync` paired with `create_payment_wrapper` (both from `x402`) wraps tool
    handlers; `create_facilitator_config()` from the CDP SDK feeds `HTTPFacilitatorClientSync` the
    CDP facilitator.

    ```python theme={null}
    from cdp.x402 import create_facilitator_config
    from x402.http import HTTPFacilitatorClientSync
    from x402.mcp import create_payment_wrapper
    from x402.mechanisms.evm.exact import ExactEvmServerScheme
    from x402.schemas import ResourceConfig
    from x402.server import x402ResourceServerSync

    resource_server = x402ResourceServerSync(HTTPFacilitatorClientSync(create_facilitator_config()))
    resource_server.register("eip155:84532", ExactEvmServerScheme())
    resource_server.initialize()

    accepts = resource_server.build_payment_requirements(
        ResourceConfig(
            scheme="exact",
            network="eip155:84532",
            pay_to=pay_to,  # address that can receive the asset
            price="$0.01",
        )
    )

    paid = create_payment_wrapper(resource_server, accepts=accepts)

    @mcp_server.tool(name="generate_report", description="Requires payment of $0.01 USDC.")
    @paid
    async def generate_report(topic: str) -> str:
        return generate_report_text(topic)
    ```

    Full runnable version, including a CDP-managed receiver wallet:
    [`servers/mcp/server.py`](https://github.com/coinbase/cdp-sdk/blob/main/examples/python/x402/servers/mcp/server.py).
  </Tab>
</Tabs>

## Reference

For exact signatures and every configuration option, see the generated
[SDK reference](/sdks/cdp-sdks-v2/typescript/x402/index).

## What to read next

Want to test the buyer side? [Discover and pay over MCP](/x402/buyer/mcp-payments) shows how an
agent finds, pays for, and calls paid MCP tools. Learn more about the service settling these
payments in [CDP Facilitator](/x402/seller/facilitator). Want your paid tool to be
discoverable? See [Get discovered](/x402/seller/get-discovered). Questions about the protocol,
pricing, or anything else not covered here? See the [FAQ](/x402/support/faq).
