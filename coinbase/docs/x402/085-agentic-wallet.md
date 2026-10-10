> Coinbase CDP docs — **x402** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Agentic Wallet

Agentic Wallet gives your AI agent a Coinbase-managed wallet for holding USDC and paying for x402
services. Your agent can discover a service, make the paid request, and return the result without
handling a private key.

Use Agentic Wallet when you want to add x402 payments to an agent you run in a coding harness,
terminal, or other Model Context Protocol (MCP) client. You fund the wallet and set spending limits;
the agent can only pay within those limits.

## Choose how your agent connects

<CardGroup cols={2}>
  <Card title="CLI and Agent Skills" icon="terminal" href="/agentic-wallet/cli/welcome">
    Use the `awal` CLI and installable skills when your agent can run commands and you want payment,
    transfer, or trading capabilities.
  </Card>

  <Card title="MCP server" icon="plug" href="/agentic-wallet/mcp/welcome">
    Add x402 discovery and payment tools to an MCP-compatible agent without writing the payment flow
    in your application.
  </Card>
</CardGroup>

Both options support x402 payments. The CLI is the better fit when you are building an agent with
code and want a broader wallet tool set. Use the MCP server when your agent already supports MCP and
only needs tools to discover and pay for services.

## What to read next

* [Set up Agentic Wallet CLI](/agentic-wallet/cli/quickstart)
* [Set up Agentic Wallet MCP](/agentic-wallet/mcp/quickstart)
