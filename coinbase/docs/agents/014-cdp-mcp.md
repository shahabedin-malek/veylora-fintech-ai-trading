> Coinbase CDP docs — **agents** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# CDP MCP

> Authenticate once, access every CDP API from the terminal or an AI agent.

`@coinbase/cdp-cli` is a CLI and [MCP](https://modelcontextprotocol.io) server for the [CDP API](/api-reference/v2/introduction). It handles authentication, provides inline documentation for every endpoint, and exposes the full API surface as typed tools for AI agents.

<CardGroup cols={2}>
  <Card title="Auth-transparent" icon="key">
    Configure credentials once per environment. The CLI handles JWT signing for every request.
  </Card>

  <Card title="AI-native" icon="microchip-ai">
    Doubles as an MCP server with bundled agent skills. New API features become available the moment the CLI updates.
  </Card>

  <Card title="Inline schema discovery" icon="terminal">
    Every command has built-in help with fields, types, and examples.
  </Card>

  <Card title="Zero dependencies" icon="feather">
    A single ESM bundle on Node.js 22+. Zero runtime dependencies.
  </Card>
</CardGroup>

## Get started

The fastest way to get started is to point your AI agent at the setup instructions. Copy this into Claude Code, Cursor, Codex, or any coding agent:

```
Follow https://docs.cdp.coinbase.com/cdp-cli/skill.md to install and configure the CDP CLI.
```

Your agent will install the CLI, walk you through API key creation, and verify the connection.

<Info>
  The [skill file](https://docs.cdp.coinbase.com/cdp-cli/skill.md) is a machine-readable guide that teaches agents how to install, authenticate, and use the CLI. It covers every command and common workflows.
</Info>

### Manual install

If you prefer to set things up yourself:

#### 1. Install the CLI

```bash theme={null}
npm install -g @coinbase/cdp-cli
cdp --version
```

<Info>
  Node.js 22 or later is required.
</Info>

#### 2. Create a CDP API key

1. Go to [API Keys](https://portal.cdp.coinbase.com/api-keys/secret) in the CDP Portal. Sign in (a project is auto-created on first sign-in).
2. Click **Create API Key** → download the JSON key file. The key secret is only shown at creation time.

#### 3. Configure the environment

```bash theme={null}
# From the downloaded key file
cdp env live --key-file ./cdp-api-key.json

# Or configure inline
cdp env live --key-id <id> --key-secret <secret>
```

Verify it works:

```bash theme={null}
cdp evm accounts list
```

An empty project returns `{"accounts":[]}`. This is expected.

#### 4. Add a wallet secret

The [wallet secret](/wallets/security-and-policies/security-overview) is a separate credential required for any operation that touches private keys (creating accounts, signing, sending).

Generate one in the [Non-custodial Wallet](https://portal.cdp.coinbase.com/wallets/non-custodial/security) section of the Portal. Look for **Generate Wallet Secret**, then download the file.

```bash theme={null}
cdp env live --wallet-secret-file ./cdp_wallet_secret.txt
# or inline
cdp env live --wallet-secret <secret>
```

<Tip>
  Run `cdp env` to verify. `live` should appear with the key ID and a `(wallet)` indicator.
</Tip>

#### 5. Create an account and send a transaction

```bash theme={null}
# Create an account
cdp evm accounts create name=my-wallet
```

```json theme={null}
{
  "address": "0x3c0D84055994c3062819Ce8730869D0aDeA4c3Bf",
  "name": "my-wallet"
}
```

Non-custodial wallet accounts are network-agnostic. The same address works on any EVM network (Base, Ethereum, Arbitrum, etc.). The network is specified when sending a transaction.

```bash theme={null}
# Fund the account from the testnet faucet
address=$(cdp evm accounts by-name my-wallet --jq '.address')
cdp evm faucet address=$address network=base-sepolia token=eth

# Verify the funds arrived
cdp evm token-balances get base-sepolia $address

# Encode, sign, and send a transaction
TX=$(cdp util tx-encode \
  --network base-sepolia \
  --to 0x0000000000000000000000000000000000000000 \
  --value 0.00001ether \
  --from $address)

SIGNED=$(cdp evm accounts sign transaction $address \
  transaction=$TX \
  --jq '.signedTransaction')

cdp evm accounts send transaction $address \
  network=base-sepolia \
  transaction=$SIGNED
```

A `transactionHash` appears in the response. Your first on-chain transaction is complete.

***

## What's available

Run `cdp` to see the current resources and commands.

**EVM Accounts and Solana Accounts**: create accounts, sign messages and transactions, send using the encode-sign-send pipeline, manage smart accounts ([ERC-4337](https://eips.ethereum.org/EIPS/eip-4337)), and execute token swaps.

**Onchain Data**: token balances, SQL queries against indexed chain data, and webhook subscriptions for on-chain event monitoring.

**Policy Engine**: accept/reject rules by value, address, or network, attachable to any account.

**End User Accounts, Onramp, and x402**: self-custodial wallets for end users, fiat-to-crypto onramp via Coinbase, and payments over the [x402 protocol](/x402/welcome).

**Client-side utilities**: transaction encoding and decoding, ABI encoding, and key encryption. These run locally with no network calls.

## Already using the CDP SDK?

The CLI complements the SDK for workflows where a command is faster than writing code:

* **Ad-hoc operations**: create an account, check a balance, or fund a testnet wallet without opening an editor
* **Debugging**: decode a raw transaction with `cdp util tx-decode`, inspect request and response headers with `cdp api -v`
* **Exploration**: browse every endpoint with `cdp api`, preview request shapes with `--template`, iterate with `--edit`
* **AI agents**: the [MCP server](#mcp-server) exposes every CDP operation as a typed tool

The CLI is self-documenting. Run `cdp evm --help` to see all actions, or `cdp evm accounts create --help` to see fields and examples for a specific action.

***

## Commands

Every resource action (`cdp <resource> <action>`) follows the same workflow.

### Discover

```bash theme={null}
cdp evm accounts create --help       # see fields, types, response shape, example
cdp evm accounts create --template   # print the full request body as JSON
```

### Compose

```bash theme={null}
cdp evm accounts create name=my-wallet                   # inline fields
cdp evm accounts create --edit                           # open in $EDITOR
cdp evm accounts create @body.json                       # from file
echo '{"name":"my-wallet"}' | cdp evm accounts create -  # from stdin
```

### Preview

```bash theme={null}
cdp evm accounts create --dry-run    # show the assembled request without sending
```

### Send and filter

```bash theme={null}
cdp evm accounts create name=my-wallet
cdp evm accounts list --jq '.accounts[].address'   # filter response with jq
cdp evm accounts list --paginate                   # auto-follow nextPageToken
```

### Reuse

The CLI saves the last successful request body per environment and action. On the next run, omit unchanged fields:

```bash theme={null}
cdp evm accounts create name=my-wallet   # saves on success
cdp evm accounts create                  # reuses saved values
cdp evm accounts create name=other       # overrides just the name
```

View or clear saved history with `cdp history`:

```bash theme={null}
cdp history        # show saved request history
cdp history clear  # clear all saved history
```

***

## Global flags

These flags work on any command:

| Flag | What it does | When to use |
| - | - | - |
| `--help` | Show fields, types, response shape, and examples | Before your first call to any command |
| `--template` | Print the expected request body without sending | Discover field names and shapes |
| `--dry-run` | Assemble the full request and print it without sending | Before any write operation to verify what will be sent |
| `--jq <expr>` | Filter the JSON response with a [jq](https://jqlang.github.io/jq/) expression | Extract specific fields: `--jq '.address'`, `--jq '.accounts[].currency'` |
| `--edit` | Open the request body in `$EDITOR` | Complex requests or iterative editing |
| `--paginate` | Auto-follow `nextPageToken` | Retrieve all results for list operations |
| `-e <env>` | Override the active environment | Switch between configured environments |

## Field syntax

| Syntax | Meaning | Example |
| - | - | - |
| `key=value` | String body field | `name=my-wallet` |
| `key:=value` | Raw JSON (arrays, numbers, booleans) | `'owners:=["0x..."]'` |
| `key==value` | Query parameter | `product_type==SPOT` |
| `a.b.c=value` | Nested body field | `config.network=base-sepolia` |
| `@file.json` | Load body from a JSON file | `@body.json` |
| `-` | Body from stdin | `echo '{"name":"w"}' \| cdp evm accounts create -` |
| `Header:value` | Custom HTTP header | `X-Custom-Header:value` |

***

## How it works

### Auth and environments

The CLI uses two credentials, each serving a different purpose:

| Credential | What it does | Where to get it |
| - | - | - |
| **API key** (key ID + secret) | Authenticates all requests to the CDP API | [Portal → API Keys](https://portal.cdp.coinbase.com/api-keys/secret) |
| **Wallet secret** | Authorizes account operations: creating accounts, signing, and sending transactions | [Portal → Non-custodial Wallet → Security](https://portal.cdp.coinbase.com/wallets/non-custodial/security) |

Both are stored in the OS keyring and used to generate short-lived JWTs for every request. Read-only operations like listing accounts or checking balances only need the API key. The wallet secret is additionally required whenever the request touches private key material.

#### Environments

An environment is a named credential set. The built-in `live` environment has the CDP API URL pre-configured. Only keys need to be supplied.

```bash theme={null}
cdp env live --key-file ./cdp-api-key.json
cdp env live --wallet-secret-file ./cdp_wallet_secret.txt
cdp env                                    # list all environments
cdp env live --remove                      # remove an environment
cdp env live --remove-wallet-secret        # remove wallet secret (keeps API key)
```

**Multiple keys:** Prefix `live` with any name to create additional environments that inherit `live`'s URL:

```bash theme={null}
cdp env live-team-a --key-id <id> --key-secret <secret>
cdp evm accounts list -e live-team-a    # use for one request
```

Custom environment names that don't start with `live` require `--url`:

```bash theme={null}
cdp env custom --key-id <id> --key-secret <secret> --url https://api.cdp.coinbase.com/platform/v2
```

#### Headless / environment variable configuration

As an alternative to `cdp env`, the CLI can be configured entirely through environment variables. This is useful when secrets are managed externally (Vault, AWS Secrets Manager, etc.) or in headless environments without an OS keyring:

| Variable | Purpose |
| - | - |
| `CDP_ENV` | Active environment name |
| `CDP_KEY_ID` | API key ID |
| `CDP_KEY_SECRET` | API key secret |
| `CDP_WALLET_SECRET` | Wallet secret |
| `CDP_URL` | Base URL override |
| `CDP_NO_HISTORY` | Set to `1` to disable request history |
| `CDP_CONFIG_DIR` | Config directory (default: `~/.config/cdp`, `%APPDATA%\cdp` on Windows) |

### The encode-sign-send pipeline

Sending a transaction is a three-step process: **encode** an unsigned transaction locally, **sign** it with the account's private key in the [Trusted Execution Environment (TEE)](/wallets/security-and-policies/security-overview), and **send** it to the network.

#### EVM

```bash theme={null}
address=$(cdp evm accounts by-name my-wallet --jq '.address')

# 1. Encode — builds an unsigned EIP-1559 transaction
TX=$(cdp util tx-encode \
  --network base-sepolia \
  --to 0x4252e0c9A3da5A2700e7d91cb50aEf522D0C6Fe8 \
  --value 0.00001ether \
  --from $address)

# 2. Sign — signs with the account's private key in the TEE
SIGNED=$(cdp evm accounts sign transaction $address \
  transaction=$TX \
  --jq '.signedTransaction')

# 3. Send — broadcasts to the network
cdp evm accounts send transaction $address \
  network=base-sepolia \
  transaction=$SIGNED
```

For **ERC-20 transfers**, use `abi-encode` to build the calldata:

```bash theme={null}
DATA=$(cdp util abi-encode "transfer(address,uint256)" 0x4252e0c9A3da5A2700e7d91cb50aEf522D0C6Fe8 1000000)

TX=$(cdp util tx-encode \
  --network base-sepolia \
  --to 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  --data $DATA \
  --value 0 \
  --from $address)
# then sign and send as above
```

#### Solana

```bash theme={null}
address=$(cdp solana accounts by-name my-sol-wallet --jq '.address')

# Encode (outputs base64)
TX=$(cdp util tx-encode \
  --network solana-devnet \
  --to <recipient> \
  --value 1000000 \
  --from $address)

# Sign
SIGNED=$(cdp solana accounts sign transaction $address \
  transaction=$TX \
  --jq '.signedTransaction')

# Send (Solana send does not take an address; it is inferred from the transaction)
cdp solana accounts send transaction \
  network=solana-devnet \
  transaction=$SIGNED
```

#### Smart accounts

Smart accounts ([ERC-4337](https://eips.ethereum.org/EIPS/eip-4337)) use user operations instead of the encode-sign-send pipeline:

```bash theme={null}
cdp evm smart-accounts user-operations prepare-and-send 0xSmartAddr \
  network=base-sepolia \
  'calls:=[{"to":"0xRecipient","value":"10000000000000","data":"0x"}]' \
  paymasterUrl=https://paymaster.cdp.coinbase.com
```

### `cdp api`

Browse the embedded API spec or make raw authenticated requests:

```bash theme={null}
cdp api                          # list all API groups
cdp api /evm                     # list all endpoints in a group
cdp api /evm/accounts --help     # full detail for endpoint(s) at that path
cdp api /evm/accounts            # GET request
cdp api -X POST /evm/accounts name=my-wallet   # POST request
cdp api /evm/accounts -v         # verbose (show headers)
```

Same field syntax as resource commands, plus `Header:value` for custom HTTP headers.

### Client-side utilities

`cdp util` commands run locally. See `cdp util <command> -h` for full options.

| Command | What it does |
| - | - |
| `tx-encode` | Build an unsigned EVM or Solana transaction. Auto-fetches nonce/gas/blockhash when `--from` is provided. Supports `--value 0.001ether` and `--value 0.5sol` unit syntax. |
| `tx-decode` | Decode a raw transaction (hex for EVM, base64 for Solana) to inspect its contents. |
| `abi-encode` | ABI-encode function calls (`"transfer(address,uint256)" 0x... 1000`) or raw value tuples. |
| `encrypt-key` | Encrypt a private key for account import using CDP's RSA public key. Accepts `--file` or stdin. |

### Agent skills

Bundled skills teach AI agents complete workflows. Install them with `cdp skills add`.

```bash theme={null}
cdp skills list                # list installed skills
cdp skills add                 # install/update all bundled skills
cdp skills add --dir <path>    # install to a specific directory
cdp skills remove              # remove all installed skills
```

Skills cover: account creation and funding, the encode-sign-send pipeline, signing, import/export, smart accounts, spend permissions, token swaps, data queries, policies, end users, onramp, Solana, and x402.

***

## MCP server

The `cdp mcp` command starts an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that exposes every CDP API operation as a typed tool. Any MCP-compatible agent can call these tools directly, with no manual API wiring needed.

Tools are generated dynamically from the embedded OpenAPI spec, so new endpoints appear automatically whenever the CLI updates. All tool names are prefixed with `cdp_` and mirror the nested resource structure using underscores (e.g. `cdp_evm_accounts_create`, `cdp_evm_accounts_sign_message`).

In addition to API tools, bundled skills walk agents through complete workflows like account creation, the encode-sign-send pipeline, and token swaps. Install them with `cdp skills add`.

### Setup

#### Claude Code

**With the CLI installed globally:**

```bash theme={null}
claude mcp add --scope user --transport stdio cdp -- cdp mcp
```

**MCP only** (no global install needed, runs via `npx`):

```bash theme={null}
claude mcp add --scope user --transport stdio cdp -- npx -y @coinbase/cdp-cli mcp
```

<Info>
  When using both the CLI and MCP, install globally so they share the same version and spec.
</Info>

#### Project-scoped setup

To enable the MCP server for a single project, add it to the project's `.mcp.json`:

```json theme={null}
{
  "mcpServers": {
    "cdp": { "transport": "stdio", "command": "cdp", "args": ["mcp"] }
  }
}
```

#### Other MCP-compatible agents

Add the server to the agent's MCP configuration (format varies by agent):

```json theme={null}
{ "command": "cdp", "args": ["mcp"], "transport": "stdio" }
```

### Available tools

| Tool | Purpose |
| - | - |
| `cdp_env` | Show active and configured environments |
| `cdp_set_env` | Switch the active environment |
| `cdp_help` | Usage help for a resource or action |
| `cdp_template` | Request body template with examples |
| `cdp_<resource>_<action>` | Execute an API operation |

<Tip>
  Start any write operation with `cdp_template`. It returns the full request shape with field documentation and examples, which reduces back-and-forth guessing field names.
</Tip>

### Permissions

By default, Claude Code prompts before calling any MCP tool. To auto-approve read operations while requiring confirmation for writes, add the following to `.claude/settings.json`:

```json theme={null}
{
  "permissions": {
    "allow": [
      "mcp__cdp__cdp_env",
      "mcp__cdp__cdp_help",
      "mcp__cdp__cdp_template",
      "mcp__cdp__cdp_*_list",
      "mcp__cdp__cdp_*_get"
    ]
  }
}
```

This auto-approves `cdp_env`, `cdp_help`, `cdp_template`, `list`, and `get` operations. All mutating operations (`create`, `update`, `delete`, `sign`, `send`) still require confirmation.

***

## Troubleshooting

| Error | Cause | Fix |
| - | - | - |
| `Must use a CDP Entity scoped API key` | Using a legacy key | Create a new API key in the [Portal](https://portal.cdp.coinbase.com/api-keys/secret) |
| `Wallet authentication error` | Wallet secret missing or incorrect | Re-add with `cdp env live --wallet-secret-file` |
| `forbidden` | API key permissions issue | Check key permissions in the Portal |
| `cdp: command not found` | CLI not on PATH | Run `npm install -g @coinbase/cdp-cli` again; on Windows, add `%APPDATA%\npm` to PATH |
