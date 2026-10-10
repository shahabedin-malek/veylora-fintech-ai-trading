> Coinbase CDP docs — **agents** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# CDP Docs MCP

> Connect AI tools to CDP documentation using the Model Context Protocol for enhanced development assistance.

## Overview

The CDP Docs MCP server gives any [MCP](https://modelcontextprotocol.io)-compatible AI tool a direct connection to the Coinbase Developer Platform documentation. Instead of guessing how CDP works, the AI can search the docs and ground its answers in current content.

**Without the docs MCP:**

```
You: "Create a wallet connection component"
AI: *generates generic code that might not work with CDP*
```

**With the docs MCP:**

```
You: "Create a wallet connection component"
AI: *searches CDP docs automatically*
AI: *generates code using actual CDP components*
```

## How it helps you

When you connect the docs MCP to your AI tools, the AI becomes a CDP expert that can:

* **Generate accurate code** using current components
* **Answer specific questions** about CDP APIs and authentication
* **Suggest best practices** for embedded wallets, payments, and transactions
* **Find the right documentation** when you're stuck on implementation

<Note>
  The CDP Docs MCP server provides documentation `search` only. It does not execute API calls — that keeps your development environment secure. To execute CDP API operations from an AI agent, see [CDP CLI MCP Integration](/ai-agents/cdp-for-agents/cdp-mcp#mcp-server).
</Note>

## Server URL

```
https://docs.cdp.coinbase.com/mcp
```

Add this URL to any MCP-compatible client. Most clients accept either a URL-based remote MCP server or a manual entry in their MCP configuration file.

## Configuration

### URL-based connection

If your client supports remote MCP servers, paste the server URL into its connector settings.

### File-based configuration

If your client uses an `mcp.json` (or equivalent) configuration file, add an entry like:

```json theme={null}
{
  "mcpServers": {
    "coinbase-cdp": {
      "url": "https://docs.cdp.coinbase.com/mcp"
    }
  }
}
```

### One-click connectors

Many CDP documentation pages include one-click MCP connectors in the **Copy page** dropdown next to the document header. See [AI-Optimized Documentation](/ai-agents/cdp-for-agents/ai-optimized-documentation) for details.

## Testing your MCP connection

Once configured, verify the connection by asking your AI tool:

```
"What MCP tools do you have available?"
```

You should see the CDP documentation search tool listed. Then try:

```
"Search for information about embedded wallets in the CDP documentation"
```

The AI should be able to search and return relevant CDP documentation.

## Troubleshooting

### Connection issues

**Problem:** MCP server not connecting

**Solution:**

* Verify the URL is exactly: `https://docs.cdp.coinbase.com/mcp`
* Check your internet connection
* Restart your AI tool after configuration

**Problem:** Search tool not available

**Solution:**

* Confirm the MCP server was added correctly
* Try removing and re-adding the server configuration
* Check the AI tool's MCP support documentation

### Search issues

**Problem:** Search returns no results

**Solution:**

* Try different search terms
* Use more general terms (e.g., "wallet" instead of "embedded wallet API")
* Verify the MCP connection is working

## Additional resources

* [Model Context Protocol documentation](https://modelcontextprotocol.io/docs/tutorials/use-remote-mcp-server#connecting-to-a-remote-mcp-server)
* [Mintlify MCP documentation](https://mintlify.com/docs/ai/model-context-protocol)
