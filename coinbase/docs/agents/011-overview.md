> Coinbase CDP docs — **agents** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Overview

> Choose between Coinbase MCP, Wallet MCP, and CDP MCP based on what you want your agent to do.

We offer three agent tools depending on what you want to accomplish:

* **If you are a trader with a Coinbase account**, use [Coinbase MCP](/ai-agents/coinbase-for-agents/coinbase-mcp). It connects your agent to your Coinbase account so it can check prices, place orders, and manage portfolios.

* **If you have or want a self-custodial Coinbase Wallet**, use [Wallet MCP](/ai-agents/coinbase-for-agents/wallet-mcp). It lets your agent interact with DeFi, check balances, send funds, swap tokens, sign messages, and make x402 payments. You approve every write action in Coinbase Wallet.

* **If you are a builder** developing a crypto app with a coding agent, use the [CDP MCP](/ai-agents/cdp-for-agents/cdp-mcp). It gives your agent access to the full CDP API surface: server wallets, onchain data, smart accounts, x402 payments, and more.

## Compare agent tools

| | [Coinbase MCP](/ai-agents/coinbase-for-agents/coinbase-mcp) | [Wallet MCP](/ai-agents/coinbase-for-agents/wallet-mcp) | [CDP MCP](/ai-agents/cdp-for-agents/cdp-mcp) |
| - | - | - | - |
| **Best for** | Trading crypto, equities, and derivatives on Coinbase (Recommended) | Giving an AI assistant access to your Coinbase Wallet | Building applications with CDP APIs |
| **Interface** | CLI and MCP server | Remote MCP server | CLI and MCP server |
| **Command or endpoint** | `coinbase` or `https://agents.coinbase.com/mcp` | `https://wallet-mcp.coinbase.com` | `cdp` |
| **Capabilities** | Trade 900+ crypto pairs, US equities, and derivatives. x402 payments coming soon. | Interact with DeFi protocols, check balances, send funds, swap tokens, sign messages, and make x402 payments | Use server wallets, onchain data, smart accounts, and x402 APIs |
| **Package** | [`@coinbase/coinbase-cli`](https://www.npmjs.com/package/@coinbase/coinbase-cli) | No package required | [`@coinbase/cdp-cli`](https://www.npmjs.com/package/@coinbase/cdp-cli) |
| **Authentication** | Sign in with Coinbase or API key (CLI) | Sign in with Coinbase Wallet | CDP API key and wallet secret |
| **Approval model** | Agent can operate autonomously or with your approval — you choose | You approve every write action in Coinbase Wallet | Not applicable (server-side) |
