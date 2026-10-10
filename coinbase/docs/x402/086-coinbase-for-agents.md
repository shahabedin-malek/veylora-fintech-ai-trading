> Coinbase CDP docs — **x402** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Coinbase for Agents

Coinbase for Agents lets your agent trade, manage portfolios, and pay for data and research
from your existing Coinbase account. x402 payments use your retail USDC balance on Base,
without a separate wallet to create or fund.

Connect a [supported client](/ai-agents/coinbase-for-agents/coinbase-mcp#supported-harnesses),
including Grok Bot, through the remote MCP and sign in with Coinbase. Coding agents can also
use the local CLI with a CDP API key authorized for the required payment scopes.

## x402 payments

Discover curated services, review their pricing and inputs, then authorize your agent to pay
per request and retrieve the data. No separate provider API key or subscription is needed for
these x402 resources. Research payments and trade execution are separate actions: set a data
budget and trading instructions before the agent spends funds.

See [x402 payment limits and supported services](/ai-agents/coinbase-for-agents/coinbase-mcp#x402-payments).
Tool availability depends on your account and client; the dedicated ChatGPT trading integration
does not include x402 payments.

## Get started

<Card title="Set up Coinbase for Agents" icon="https://mintcdn.com/coinbase-prod/cCGVQ8zMGF76EFDn/icons/coinbase.svg?fit=max&auto=format&n=cCGVQ8zMGF76EFDn&q=85&s=2017dfa90fa2130b864f03735e88eab3" href="/ai-agents/coinbase-for-agents/coinbase-mcp" width="16" height="16" data-path="icons/coinbase.svg">
  Connect an agent through the remote MCP, or through the local CLI with a CDP API key, for trading, portfolio management, and x402 payments.
</Card>

## What to read next

* [x402 payments](/ai-agents/coinbase-for-agents/coinbase-mcp#x402-payments): Pay for premium services per request from your USDC balance
* [Agentic Wallet](/x402/agentic-accounts/agentic-wallet): Standalone wallet for x402 payment capabilities
