> Coinbase CDP docs — **x402** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Discover & pay over MCP

[Discover services](/x402/buyer/discover-services) and the
[buyer quickstart](/x402/buyer/quickstart) cover finding and paying for services over HTTP. If
your agent speaks [Model Context Protocol](https://modelcontextprotocol.io) instead, it can do
both jobs as tool calls: search CDP's hosted Bazaar MCP server for a service, then pay for it
through the same x402 loop, carried in MCP's wire format rather than HTTP headers.

## Discover with the Bazaar MCP server

The Bazaar exposes an MCP server so any MCP-compatible agent can search and call paid x402
endpoints:

```
https://api.cdp.coinbase.com/platform/v2/x402/discovery/mcp
```

Discovery is public. The endpoint is unauthenticated, so no CDP API key is required to connect
or search.

It exposes three tools:

| Tool | Does |
| - | - |
| `search_resources` | Semantic search over the Bazaar catalog — same index and filters as the [HTTP search endpoint](/x402/buyer/discover-services), returned as MCP tool results instead of JSON over REST. |
| `proxy_tool_call` | Calls a discovered resource by `toolName` and arguments. If the resource requires payment, it returns a payment-required tool result instead of the resource, which your client resolves using the loop below. |
| `validate_endpoint` | Read-only diagnostics for an x402 URL: whether it's reachable, returns `402`, and advertises a valid discovery block. Makes no payment. |

Searching is free. Only `proxy_tool_call` against a paid resource triggers a payment, and it does
so with the standard x402 MCP transport rather than a Bazaar-specific mechanism, so the client
setup below covers it.

## The payment loop over MCP

The full wire-level detail lives in the x402 Foundation's
[MCP transport spec](https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/mcp.md);
this is the short version:

1. The client calls a paid tool with no payment attached.
2. The server returns a tool result with `isError: true` and a `PaymentRequired` payload — MCP's
   equivalent of an HTTP 402 status and `PAYMENT-REQUIRED` header.
3. The client builds a payment payload and retries the same tool call, this time with it attached
   at `_meta["x402/payment"]` — MCP's equivalent of `PAYMENT-SIGNATURE`.
4. The server verifies and settles the payment, then returns the tool's real result with
   settlement info attached at `_meta["x402/payment-response"]` — MCP's equivalent of
   `PAYMENT-RESPONSE`.

<Frame>
  <img src="https://mintcdn.com/coinbase-prod/-J6KygVa438dtGfZ/images/x402-mcp-payment-flow.svg?fit=max&auto=format&n=-J6KygVa438dtGfZ&q=85&s=265a3a69091f17cc5a15fe42849c5f06" alt="x402 payment flow over MCP between a client, MCP server, and facilitator" width="1200" height="930" data-path="images/x402-mcp-payment-flow.svg" />
</Frame>

## Pay for tool calls

Wrap your MCP client so this loop runs transparently around tool calls, paired with a CDP-managed
wallet — no private keys or manual scheme registration. The same wrapped client works against any
x402 MCP server, including the Bazaar's `proxy_tool_call`.

<Tabs>
  <Tab title="TypeScript">
    ```bash theme={null}
    npm install @coinbase/cdp-sdk @modelcontextprotocol/sdk @x402/core @x402/evm @x402/mcp
    ```

    `@x402/mcp`'s `wrapMCPClientWithPayment` wraps any MCP SDK `Client`; every other method stays a
    direct passthrough. `CdpX402Client` from the CDP SDK provisions its wallet lazily and signs
    payments automatically.

    ```typescript theme={null}
    import { Client } from "@modelcontextprotocol/sdk/client/index.js";
    import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
    import { CdpX402Client } from "@coinbase/cdp-sdk/x402";
    import { wrapMCPClientWithPayment } from "@x402/mcp";

    const payment = new CdpX402Client({
      environment: "development",
      // Bound what this agent can spend — see [Set spend limits](/x402/buyer/client-configuration#set-spend-limits).
      spendControls: {},
    });

    const mcp = wrapMCPClientWithPayment(
      new Client({ name: "my-agent", version: "1.0.0" }, { capabilities: {} }),
      payment,
      // autoPayment: true pays and retries automatically on a 402; false throws
      // instead, so you can inspect the price and pay manually.
      { autoPayment: true },
    );

    await mcp.connect(new SSEClientTransport(new URL("http://localhost:4022/sse")));
    const report = await mcp.callTool("generate_report", { topic: "USDC on Base" });
    ```

    Full runnable version, including wallet funding and a payment-approval hook:
    [`clients/mcp/simple.ts`](https://github.com/coinbase/cdp-sdk/blob/main/examples/typescript/x402/clients/mcp/simple.ts).
  </Tab>

  <Tab title="Python">
    ```bash theme={null}
    pip install "cdp-sdk" "x402[evm,mcp]"
    ```

    The standard `x402Client` runs the same loop via `create_x402_mcp_client`. Give it a CDP-managed
    wallet by wrapping a CDP Server Wallet with `EvmLocalAccount`, then adapting it to the x402
    signer protocol with `EthAccountSigner` — it registers just like a local key.

    ```python theme={null}
    from cdp import CdpClient
    from cdp.evm_local_account import EvmLocalAccount
    from x402 import x402Client
    from x402.mcp import create_x402_mcp_client
    from x402.mechanisms.evm import EthAccountSigner
    from x402.mechanisms.evm.exact import ExactEvmScheme

    account = await CdpClient().evm.get_or_create_account(name="my-agent")
    signer = EthAccountSigner(EvmLocalAccount(account))

    payment = x402Client()
    payment.register("eip155:84532", ExactEvmScheme(signer))

    async with create_x402_mcp_client(payment, "http://localhost:4022") as mcp:
        report = await mcp.call_tool("generate_report", {"topic": "USDC on Base"})
    ```

    Full runnable version, including faucet funding:
    [`clients/mcp/simple.py`](https://github.com/coinbase/cdp-sdk/blob/main/examples/python/x402/clients/mcp/simple.py).
  </Tab>
</Tabs>

## Reference

For exact signatures and every configuration option, see the generated
[SDK reference](/sdks/cdp-sdks-v2/typescript/x402/index).

## What to read next

Want a wallet bundled in rather than bringing your own? See
[Agentic Wallet](/agentic-wallet/welcome). Building on AWS Bedrock AgentCore? Its "Coinbase x402
Bazaar" Gateway target wires up this same endpoint — see
[AgentCore (AWS)](/x402/integrations/amazon-bedrock-agentcore). Building the other side of this
exchange, a paid MCP tool? See [Charge over MCP](/x402/seller/mcp-payments).
