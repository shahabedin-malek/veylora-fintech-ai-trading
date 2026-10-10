> Coinbase CDP docs — **agents** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Coinbase MCP

> Give your AI agent access to Coinbase.

Coinbase for Agents connects your AI apps to your Coinbase account for crypto, equities, and derivatives trading, portfolio management, and x402 payments. Your agent can pay for trading data and research from your existing Coinbase USDC balance, then use the results to inform trades you authorize.

## Get started

Paste this prompt into your agent:

```text wrap theme={null}
Set up coinbase.com/skill.md
```

For this command, the [Coinbase entry skill](https://coinbase.com/skill.md) directs your agent to the [Coinbase MCP setup guide](https://docs.cdp.coinbase.com/coinbase-for-agents/skill.md). On a supported client, your agent reuses an existing connection or helps you sign in to Coinbase, then lists your portfolios to verify access.

**Use it in future chats:** If your harness supports installed skills, ask your agent to adopt the guide using its documented skill mechanism. Reading a URL does not install a skill or guarantee discovery in a new chat. Preserve any existing connector and credential helpers; the guide explains how to add the instructions without replacing them.

<Tip>
  **Portfolio isolation:** Create a separate [Advanced portfolio](https://www.coinbase.com/advanced-trade), fund it with only what you're willing to risk, and scope your agent's access to that portfolio. This limits the blast radius if the agent makes an unexpected trade.
</Tip>

<Tabs>
  <Tab title="MCP (Recommended)">
    The remote MCP connects directly to `https://agents.coinbase.com/mcp` via OAuth. It includes x402 payments for premium data services.

    ### Supported harnesses

    Remote MCP supports Dynamic Client Registration (DCR) and Client ID Metadata Documents (CIMD). Coinbase still approves clients through allowlisting, including DCR clients; DCR is not unrestricted self-service access. Successful registration does not grant every account, scope, or tool permission.

    * **Supported:** ChatGPT, Grok, Grok Bot, Muse, Perplexity Computer, Claude, and Claude Code
    * **Additional harnesses:** Support is expanding as clients are approved. DCR support alone does not mean a client is available yet.
    * **Other or custom harnesses:** Use the <a className="link" href="/ai-agents/coinbase-for-agents/coinbase-mcp#cli">CLI</a>. To request support for a harness, reach out to us on [Discord](https://discord.com/invite/cdp).

    On hosted chat clients, high-reasoning and extended-thinking modes sometimes draft an order but stop short of executing it. If that happens, reply asking the agent to place the order explicitly, or use the CLI setup below for the most consistent execution.

    <Tabs>
      <Tab title="ChatGPT">
        <Frame>
          <video controls className="w-full aspect-video" src="https://mintcdn.com/coinbase-prod/BvbOBhYodwO9uiuH/ai-agents/coinbase-for-agents/resources/coinbase-mcp/videos/connect-chatgpt.mp4?fit=max&auto=format&n=BvbOBhYodwO9uiuH&q=85&s=b640d4d82b160631090c1be83527f9b2" data-path="ai-agents/coinbase-for-agents/resources/coinbase-mcp/videos/connect-chatgpt.mp4" />
        </Frame>

        1. Open **Plugins** in the side navigation
        2. Click **Add** (top right) > **Create MCP app**
        3. Enter `https://agents.coinbase.com/mcp` as the MCP URL
        4. Connect your Coinbase account when prompted

        <Note>
          If **Create MCP app** isn't available, turn on developer mode in ChatGPT **Settings**. Availability depends on your plan and workspace policy; see OpenAI's [developer mode requirements](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta).
        </Note>

        <Info>
          **Desktop & mobile:** Set up the connection on ChatGPT web first. Once connected, the app will automatically be available in ChatGPT desktop and mobile.
        </Info>
      </Tab>

      <Tab title="Grok">
        <Frame>
          <video controls className="w-full aspect-video" src="https://mintcdn.com/coinbase-prod/BvbOBhYodwO9uiuH/ai-agents/coinbase-for-agents/resources/coinbase-mcp/videos/connect-grok.mp4?fit=max&auto=format&n=BvbOBhYodwO9uiuH&q=85&s=9b8b3480a88b36f5a55e58b71a4b7122" data-path="ai-agents/coinbase-for-agents/resources/coinbase-mcp/videos/connect-grok.mp4" />
        </Frame>

        1. Click the **Plugins** button in the bottom-left corner
        2. Search for **Coinbase**
        3. Click **Add**, then **Connect**
        4. Sign in with your Coinbase account

        <Info>
          **Using Grok Bot?** If you've already connected Coinbase in Grok, it should also appear in your Grok Bot account. Otherwise, follow the **Grok Bot** setup instructions in the next tab.
        </Info>
      </Tab>

      <Tab title="Grok Bot">
        <Frame>
          <video controls preload="metadata" aria-label="Connect Coinbase for Agents in Grok Bot" className="w-full" src="https://mintcdn.com/coinbase-prod/T4uygXprprId5Cdq/ai-agents/coinbase-for-agents/resources/coinbase-mcp/videos/connect-grok-bot.mp4?fit=max&auto=format&n=T4uygXprprId5Cdq&q=85&s=df940254dfcc3f99f3f48e8cf1784c3b" data-path="ai-agents/coinbase-for-agents/resources/coinbase-mcp/videos/connect-grok-bot.mp4" />
        </Frame>

        If you've already connected Coinbase in Grok, it should also appear in your Grok Bot account. Otherwise:

        1. Click the **Marketplace** button
        2. Search for **Coinbase**
        3. Click **Add**
        4. Sign in with your Coinbase account if prompted

        <Info>
          **Connectors are account-wide:** A connector added by one Bot is available to all of your Bots. Limit access by selecting a dedicated portfolio on the approval screen.
        </Info>
      </Tab>

      <Tab title="Muse">
        In Muse, share this page or the [agent setup guide](https://docs.cdp.coinbase.com/coinbase-for-agents/skill.md) and use the setup prompt above.

        Follow the agent's authentication prompt to sign in to Coinbase and choose the access to approve. No CDP API key is needed. Verify by listing portfolios.
      </Tab>

      <Tab title="Perplexity Computer">
        <Frame>
          <video controls className="w-full aspect-video" src="https://mintcdn.com/coinbase-prod/BvbOBhYodwO9uiuH/ai-agents/coinbase-for-agents/resources/coinbase-mcp/videos/connect-perplexity-computer.mp4?fit=max&auto=format&n=BvbOBhYodwO9uiuH&q=85&s=326b4642e4fc81e3d9724a5d1fff759d" data-path="ai-agents/coinbase-for-agents/resources/coinbase-mcp/videos/connect-perplexity-computer.mp4" />
        </Frame>

        <a className="not-prose mt-6 block w-full" href="https://www.perplexity.ai/computer/connectors?query=coinbase&connector=coinbase" target="_blank" rel="noopener noreferrer">
          <div className="not-prose flex w-full items-center justify-center gap-2 bg-[#1652F0] text-white rounded-lg px-6 py-3 font-semibold text-lg hover:bg-[#1544CC] transition-colors cursor-pointer">
            Add Coinbase to Perplexity Computer →
          </div>
        </a>

        Click the button above to add the Coinbase connector in one step, then sign in with your Coinbase account.

        <Accordion title="Manual setup (if the button doesn't work)">
          1. Click **Customize** in the left navigation
          2. Under **Connectors**, search for **Coinbase**
          3. Click **Add Connector**
          4. Sign in with your Coinbase account
        </Accordion>
      </Tab>

      <Tab title="Claude">
        <Frame>
          <video controls className="w-full aspect-video" src="https://mintcdn.com/coinbase-prod/BvbOBhYodwO9uiuH/ai-agents/coinbase-for-agents/resources/coinbase-mcp/videos/connect-claude.mp4?fit=max&auto=format&n=BvbOBhYodwO9uiuH&q=85&s=61aad2bbb2e79b46d22b3fc5ba9274b9" data-path="ai-agents/coinbase-for-agents/resources/coinbase-mcp/videos/connect-claude.mp4" />
        </Frame>

        <a className="not-prose mt-6 block w-full" href="https://claude.ai/new?modal=add-custom-connector&connectorName=Coinbase&connectorUrl=https%3A%2F%2Fagents.coinbase.com%2Fmcp#settings/customize-connectors" target="_blank">
          <div className="not-prose flex w-full items-center justify-center gap-2 bg-[#1652F0] text-white rounded-lg px-6 py-3 font-semibold text-lg hover:bg-[#1544CC] transition-colors cursor-pointer">
            Add Coinbase to Claude →
          </div>
        </a>

        Click the button above to add the Coinbase connector in one step. Then:

        1. Sign in with your Coinbase account when prompted
        2. On the approval screen, select which portfolios to give the agent access to

        <Accordion title="Manual setup (if the button doesn't work)">
          1) Click the **Customize** toolbox icon in the left sidebar
          2) Go to **Connectors**
          3) Click the **+** button, then **Add custom connector**
          4) Name it (e.g., "Coinbase") and enter the server URL: `https://agents.coinbase.com/mcp`
          5) Leave all other fields blank, then click **Create**
          6) Sign in with your Coinbase account when prompted
          7) On the approval screen, select which portfolios to give the agent access to
        </Accordion>

        <Warning>
          **Known limitation:** On hosted chat clients, high-reasoning and extended-thinking modes sometimes draft an order but stop short of placing it. If your agent only previews, ask it explicitly to execute the order — or use the CLI setup below, which executes most consistently across models.
        </Warning>
      </Tab>

      <Tab title="Claude Code">
        <Frame>
          <video controls className="w-full aspect-video" src="https://mintcdn.com/coinbase-prod/BvbOBhYodwO9uiuH/ai-agents/coinbase-for-agents/resources/coinbase-mcp/videos/connect-claude-code.mp4?fit=max&auto=format&n=BvbOBhYodwO9uiuH&q=85&s=5be75476b04aa5a2bc317a5c70f7dc3a" data-path="ai-agents/coinbase-for-agents/resources/coinbase-mcp/videos/connect-claude-code.mp4" />
        </Frame>

        To configure Claude Code:

        1. Run `claude mcp add coinbase --transport http https://agents.coinbase.com/mcp`
        2. Start Claude. Run `/mcp`, then choose **coinbase** > **Authenticate**
        3. Once complete, Claude is ready to use your account
      </Tab>
    </Tabs>
  </Tab>

  <Tab id="cli" title="CLI">
    The CLI runs on your machine with a CDP API key. It's the most reliable setup for executing trades consistently across all models — remote MCP has known issues with high-reasoning models blocking trades on certain platforms. It also supports x402 payments through its x402 commands.

    ### Quickstart

    Share the [agent setup guide](https://docs.cdp.coinbase.com/coinbase-for-agents/skill.md) with your coding agent, then ask:

    ```
    Follow https://docs.cdp.coinbase.com/coinbase-for-agents/skill.md to install and configure the local CLI.
    ```

    Your agent will ask you to create a CDP API key (below) during setup.

    ### Create a CDP API key

    1. Go to [API Keys](https://portal.cdp.coinbase.com/api-keys/secret) in the CDP Portal (a project is auto-created on first sign-in)
    2. Click **Create API Key** and give it a name (e.g., `my-trading-agent`)
    3. Under **Advanced Settings** > **Coinbase App & Advanced Trade**:
       * Under **Accounts**, select the portfolio you want the agent to trade from (Primary is selected by default). US Derivatives (Futures) only work in your **default** portfolio — include it in the key scope if the agent will trade US Derivatives (Futures).
       * Enable **Trade** and **Transfer**. Transfer allows moves between your portfolios only and does not allow withdrawals to external addresses.
       * Check **Allow requests from any IP address** if you haven't configured specific IP addresses.
    4. Click **Create & Download** and save the JSON key file

    <Warning>
      The key secret is only shown at creation time.
    </Warning>

    ### Manual setup

    If you prefer to set things up yourself instead of using the quickstart:

    **1. Install the CLI**

    ```bash theme={null}
    npm install -g @coinbase/coinbase-cli
    coinbase --version
    ```

    <Info>
      Node.js 22 or later is required.
    </Info>

    **Linux only**: install keyring support to keep secrets out of plaintext:

    ```bash theme={null}
    which secret-tool || sudo apt install -y libsecret-tools
    ```

    **2. Configure your API key**

    ```bash theme={null}
    coinbase env live --key-file <path-to-key.json>
    coinbase env           # verify: shows "live" with your key ID
    coinbase balance       # verify: returns JSON with account balances
    ```
  </Tab>
</Tabs>

**Disconnect:** To revoke Coinbase access, go to [Coinbase Account > Security > Connections](https://accounts.coinbase.com/security/connections) and revoke the connection. If your agent cannot disconnect through the harness, do this yourself. Deleting a local skill or clearing a chat is not the same as revoking access.

***

## What's supported today

Coinbase for Agents currently supports:

* **Spot crypto trading**: buy and sell 900+ trading pairs on Coinbase
* **US Derivatives (Futures)**: trade CFM dated futures contracts on Coinbase
* **Equities**: trade eligible US stocks on Coinbase
* **Isolated agent portfolios**: spot crypto only, scoped to a specific portfolio selected when logging in or creating an API key. US Derivatives (Futures) are available only in your default portfolio.
* **Portfolio management**: Check balances and positions across your account
* **x402 payments** (remote MCP and local CLI): pay for premium data services per-request from your USDC balance
* **Agent feedback**: agents can send the Coinbase team short notes about the integration

Orders execute through [Coinbase Advanced Trade](https://www.coinbase.com/advanced-trade), so Advanced Trade fees and eligibility requirements apply.

<Info>
  **Coming soon:** prediction markets and additional asset classes.
</Info>

***

## x402 payments

Your agent can pay per request for trading data and research, including onchain analytics, market intelligence, and stock data, directly from your retail Coinbase USDC balance. You don't need a separate wallet, provider API key, or data subscription for these resources. The remote MCP uses Coinbase OAuth; the local CLI uses your configured CDP API key. Payments use USDC on Base through the [x402 protocol](/x402/buyer/quickstart).

### Discover, pay, and use the data

1. **Discover:** Call `coinbase_x402_resources` or run `coinbase x402 resources q==<keyword>`. Discovery is free and returns resource URLs, input schemas, and advisory pricing.
2. **Set a budget:** Tell your agent how much it may spend on research. Research authorization does not authorize a trade.
3. **Fetch:** Call `coinbase_x402_fetch` or run `coinbase x402 fetch` with a catalog resource URL and the required inputs. The tool handles the payment challenge and returns the resource response.
4. **Review:** Ask the agent to cite the data, report what it spent, and propose a trade only if that is part of your instructions.

<Info>
  Tool availability depends on your account and client. The dedicated ChatGPT trading integration does not expose x402 tools. These instructions use the core remote MCP or the local CLI.
</Info>

### Limits and payment safety

* Payments are capped at **5 USDC per payment**. Additional account and spending controls may apply.
* `max_amount` is an optional per-request ceiling for fetch, in atomic USDC units: `1000000` is 1 USDC. It can lower, not raise, the catalog payment ceiling. It does not set a session or daily budget.
* Fetch accepts curated catalog resources and x402 v2 challenges. It is not an unrestricted web-fetch or Bazaar-discovery tool.
* Generate an `idempotency_key` UUID before a payment and retain it. If a request times out or the payment outcome is unknown, reuse that key for the same logical payment; a new key can create another hold. Follow terminal-error instructions rather than retrying blindly.
* A successful payment authorization does not guarantee that the provider returned usable data. Report payment and data-delivery outcomes separately.

### Data providers

The curated catalog includes Arkham, Dripstack (listed as Drip), Exa, Glassnode, Massive, Nansen, and You.com. Run `coinbase x402 resources` or call `coinbase_x402_resources` for current resources, schemas, and advisory prices. The provider's payment challenge determines the exact price, subject to your request ceiling and server limits. Catalog inclusion does not guarantee provider availability.

<Tip>
  Try: *"Use Coinbase x402 to research ETH smart-money flows. Spend no more than 1 USDC total, cite the data and what you paid, and do not place any trades."*
</Tip>

<Warning>
  Settled x402 payments are irreversible and recorded on Base. Set a research budget before authorizing paid requests; an instruction to the agent is not a server-enforced session spending limit.
</Warning>

***

## Guiding agents to place orders

Based on order-creation testing across Claude and ChatGPT clients and models connected to the Coinbase for Agents remote MCP server:

* Web clients for Claude and ChatGPT reliably create orders from clear, well-specified instructions, across models. The exception is **GPT-5.5 Pro**, which doesn't appear to automatically discover the connected MCP.
* Claude previews and requests confirmation in the chat to create the order, whereas ChatGPT creates the order in one turn.
* Claude Desktop refuses most orders that the web client creates; **Sonnet 4.6** is the exception, creating orders when the request includes an explicit authorization (e.g. `I authorize you to buy…`).
* Lower-tier models may create orders with the wrong product, for example, `ETH-USD` instead of `ETH-USDC`. Prompt for approval to confirm before creating the order.

For reliable order creation, specify the order type, the amount and asset or currency, and the portfolio in one instruction, for example, `Buy 1 USDC of ETH in my agent portfolio`. Vague or partial requests require the model to infer and resolve additional details.

### Best practices

* Scope the agent's access to the portfolio(s) you want it to use. A focused set gives the agent a clear, unambiguous target.
* Higher-reasoning models translate more complex intent and recover from underspecified orders; use one for multi-step or vague requests, e.g. `check my balance, then put 5% of my USDC into BTC`.

***

## Send feedback

You or your agent can send feedback about the Coinbase MCP directly through the `coinbase_feedback_submit` tool. Submit a prompt in this form: `Tell Coinbase that [your feedback].` The team reads submitted feedback every day.

* Feedback is limited to 2,000 characters or less.
* Each user can send up to 6 submissions per day.

***

## Tools

The tables use short MCP tool names. The core server prefixes these with `coinbase_` (for example, `coinbase_portfolios_list`); use the exact names returned by your connection's `tools/list`.

### Market data

| CLI command | MCP tool | Description |
| :- | :- | :- |
| `coinbase products get <product_id>` | `products_get` | Price, 24-hour volume/change, and size limits |
| `coinbase products list` | `products_list` | All tradable products (hundreds of results, filter with `symbol` or `--jq`) |
| `coinbase products list symbol==USD` | `products_list` | Products with USD as the base or quote currency |
| `coinbase products ticker <product_id>` | `products_ticker` | Recent trades with best bid/ask |
| `coinbase products book <product_id>` | `products_book` | Full order book (bids + asks) |
| `coinbase products candles <product_id> granularity==1h` | `products_candles` | OHLCV price history |
| `coinbase products best-bid-ask product_ids=BTC-USD` | `products_best_bid_ask` | Current best bid and ask |

**Equities:** Use `products_get` or `products_list` for a reference price, not a guaranteed executable quote. Do not assume equity ticker, order-book, bid/ask, candle, or preview support from a successful product lookup. See the [agent guide's product-type limitations](https://docs.cdp.coinbase.com/coinbase-for-agents/skill.md#product-type-support-and-limitations) before building an equity workflow.

### Orders

| CLI command | MCP tool | Description |
| :- | :- | :- |
| `coinbase orders preview ...` | `orders_preview` | Estimate fill, fees, and slippage; equity previews may be unavailable |
| `coinbase orders create ...` | `orders_create` | Execute an order |
| `coinbase orders list` | `orders_list` | All orders with status, fill percentage, and fees |
| `coinbase orders get <order_id>` | `orders_get` | Single order detail |
| `coinbase orders fills` | `orders_fills` | All trade fills with price, size, and commission |
| `coinbase orders edit <order_id>` | `orders_edit` | Modify an existing order |
| `coinbase orders cancel order_ids:='["<id>"]'` | `orders_cancel` | Batch cancel orders |
| `coinbase orders close-position product_id=<id> size=<n>` | `orders_close_position` | Close an open position |

**Market order**: executes immediately at the best available price.

```bash theme={null}
# Buy $100 of BTC (quote_size = USD amount to spend)
coinbase orders create product_id=BTC-USD side=BUY type=market quote_size=100

# Sell 0.5 ETH (base_size = amount of the asset to sell)
coinbase orders create product_id=ETH-USD side=SELL type=market base_size=0.5
```

**Limit order**: executes at the specified price or better.

```bash theme={null}
coinbase orders create product_id=BTC-USD side=BUY type=limit \
  base_size=0.001 limit_price=50000
```

<Info>
  Market buys use `quote_size` (the amount to spend in USD). Market sells use `base_size` (the amount of the asset to sell). When switching between buy and sell, explicitly clear the other field (e.g., add `quote_size=` to clear a stale value).
</Info>

<Info>
  **Futures**: CFM dated futures market orders require `base_size` (number of contracts)—`quote_size` is rejected. Contract codes roll on a schedule (e.g. `BIT-28AUG26-CDE`); discover the live one with `coinbase products list product_type=FUTURE`. Preview the order first to check `predicted_liquidation_price`.
</Info>

<Info>
  **Equities**: use `TICKER-QUOTE` as the product ID (e.g. `AAPL-USD` or `AAPL-USDC`). Discover eligible tickers with the product tools. Orders trade regular market hours by default; check the current tool schema for supported sessions, order types, and sizing restrictions.
</Info>

### Portfolios and balances

| CLI command | MCP tool | Description |
| :- | :- | :- |
| `coinbase balance` | `balance` | All account balances (crypto + fiat) |
| `coinbase portfolios list` | `portfolios_list` | All portfolios with UUID, name, and type |
| `coinbase portfolios get <portfolio_id>` | `portfolios_get` | Breakdown: balances, positions, allocation %, unrealized PnL |
| `coinbase portfolios create name=<name>` | `portfolios_create` | Create a new portfolio |
| `coinbase portfolios edit <portfolio_id> name=<n>` | `portfolios_edit` | Rename a portfolio |
| `coinbase portfolios delete <portfolio_id>` | `portfolios_delete` | Delete a portfolio (must be empty) |
| `coinbase transfer amount=<n> currency=<c> from=<uuid> to=<uuid>` | `transfer` | Move funds between portfolios |

### Conversions

| CLI command | MCP tool | Description |
| :- | :- | :- |
| `coinbase convert quote from=<c> to=<c> amount=<n>` | `convert_quote` | Get a conversion quote (rate + fee) |
| `coinbase convert execute <quote_id> from=<c> to=<c>` | `convert_execute` | Execute a quoted conversion |
| `coinbase convert get <quote_id>` | `convert_get` | Check conversion status |

### x402 payments

| CLI command | Remote MCP tool | Description |
| :- | :- | :- |
| `coinbase x402 resources q==<keyword>` | `coinbase_x402_resources` | Discover curated x402 services. Discovery does not spend funds. |
| `coinbase x402 fetch resource=<url> input:=<json> max_amount=<atomic-units>` | `coinbase_x402_fetch` | Pay for and fetch a catalog resource in one call. `max_amount` can lower the catalog payment ceiling. |
| `coinbase x402 pay ...` | `coinbase_x402_pay` | Authorize a payment and return a header; does not fetch data. Use `X-PAYMENT` for v1 or `PAYMENT-SIGNATURE` for v2 when retrying the provider request. |

### Feedback

| CLI command | Remote MCP tool | Description |
| :- | :- | :- |
| `coinbase feedback note="..." tool_name=<tool>` | `coinbase_feedback_submit` | Send the Coinbase team a short note (2,000 characters or less) about the integration. Limited to 6 submissions per user per day. Submissions are screened. |

### Info and session

| CLI command | MCP tool | Description |
| :- | :- | :- |
| `coinbase fees` | `fees` | Fee tier (maker/taker rates) and 30-day volume |
| `coinbase env` | - | View and manage credential environments |

***

## Global flags

These flags work on any CLI command:

| Flag | What it does | When to use |
| :- | :- | :- |
| `--watch` | Live-stream updates over WebSocket (local CLI + CDP API key; not OAuth) | Only on `orders list`, `products ticker`, `products book`. Watch a price live, or add `--until "price > 70k"` to exit on a condition. |
| `--template` | Print the expected request body without sending | Before your first call to any command. Discover field names instead of guessing. |
| `--dry-run` | Assemble the full request and print it without sending | Before any write operation to verify what will be sent |
| `--jq <expr>` | Filter the JSON response with a [jq](https://jqlang.github.io/jq/) expression | Extract specific fields: `--jq '.price'`, `--jq '.accounts[].currency'` |
| `-e <env>` | Override the active environment | Switch between configured environments |

## Field syntax

CLI commands use the following field syntax:

| Syntax | Meaning | Example |
| :- | :- | :- |
| `key=value` | String body field | `product_id=BTC-USD` |
| `key:=value` | Raw JSON (arrays, numbers, Boolean values) | `order_ids:='["abc","def"]'` |
| `key==value` | Query parameter | `product_type==SPOT` |
| `@file.json` | Load body from a JSON file | `@order.json` |

## Troubleshooting

| Error | Cause | Fix |
| :- | :- | :- |
| `HTTP 401` | Missing or expired credentials | For remote MCP, reconnect the Coinbase connector and sign in again. For the CLI, check the active key with `coinbase env` and replace an expired or revoked key in the [CDP Portal](https://portal.cdp.coinbase.com/api-keys/secret). |
| `HTTP 403 Missing required scopes` | API key missing Trade or Transfer permission | Check key permissions in the Portal |
| `insufficient fund` | Account balance too low | Run `coinbase balance` to check available funds |
| `coinbase: command not found` | CLI not on PATH | Run `npm install -g @coinbase/coinbase-cli`; on Windows, add `%APPDATA%\npm` to PATH |
| `MISSING_FIELDS` | Required fields not provided | Run `coinbase <command> --template` to see expected fields |
| `INVALID_VALUE` | Unrecognized enum value | Check the error message for accepted values |
| `INVALID_FORMAT` | Wrong date/time format | Use RFC 3339 with timezone (e.g., `2024-01-01T00:00:00Z`) |

***

## Disclaimer

AI agents can make errors, misinterpret instructions, or produce inaccurate output. Coinbase does not guarantee the accuracy of any action taken by an AI agent using this product. You are solely responsible for reviewing and authorizing any trades, transfers, or account changes made through agentic workflows.
