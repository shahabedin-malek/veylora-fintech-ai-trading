> Coinbase CDP docs — **wallets** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# API key wallets quickstart

**CDP API key wallets**, built by Coinbase, let your backend create and control non-custodial EVM wallets programmatically — no browser SDK, no end-user sign-in. This prompt walks you through the TypeScript SDK: create your first wallet, fund it from the testnet faucet, and send your first transaction.

**Docs:** https://docs.cdp.coinbase.com/wallets/quickstart/api-key-auth
**Recommended:** install the CDP docs MCP so I can ground in live docs — `claude mcp add --transport http coinbase-cdp https://docs.cdp.coinbase.com/mcp`

## Setup

Check each item IN ORDER. Stop at the first missing one, fix it, then resume after you confirm.

1. **CDP Portal account.** portal.cdp.coinbase.com → create one if needed, verify your email.
2. **API key + three credentials.** You need three values — keep them in a `.env` file:
   - `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET`: go to **portal.cdp.coinbase.com/api-keys/secret** → create a new Secret API Key. Under **Advanced settings**, check **Non-custodial: Export** and **Non-custodial: Manage**. Keep **Ed25519** as the signature algorithm (ECDSA is only needed for Coinbase App & Advanced Trade SDKs). Download the JSON before closing the dialog — the key ID and private key are inside.
   - `CDP_WALLET_SECRET`: go to **portal.cdp.coinbase.com/wallets/non-custodial/security** → click **Generate Wallet Secret**. **It is shown exactly once — copy it now.** If you miss it, you must generate a new one.
3. **Node.js 22+.** In the terminal: `node --version`. If <22 — nvm installed: `source ~/.nvm/nvm.sh && nvm use v22` (applies to this session only — add `nvm use v22` to `~/.zshrc` or re-run in any new terminal). No nvm: install from https://github.com/nvm-sh/nvm then `nvm install 22`.
4. **A TypeScript project to work in.** Ask me where your project lives. If you don't have one yet: `mkdir cdp-wallet-demo && cd cdp-wallet-demo && npm init -y && npm pkg set type="module" && touch main.ts && touch .env`. ⚠ If `cdp-wallet-demo` already exists from a prior attempt, `mkdir` fails silently — delete or rename the existing folder first.

## Install the SDK

```
npm install @coinbase/cdp-sdk dotenv viem
```

(`dotenv` loads .env credentials; `viem` is needed for `waitForTransactionReceipt`.)

## Configure credentials

Create a `.env` file **yourself in a text editor** (do not paste credential values into this chat — secrets in conversation history are a security risk):

```
CDP_API_KEY_ID=your-key-id-here
CDP_API_KEY_SECRET=your-private-key-here
CDP_WALLET_SECRET=your-wallet-secret-here
```

Add `.env` to `.gitignore` immediately.

## Create, fund, and send

Reference shape (verify method names + types against current SDK docs):

```typescript
import { CdpClient } from "@coinbase/cdp-sdk";
import { http, createPublicClient, parseEther } from "viem";
import { baseSepolia } from "viem/chains";
import dotenv from "dotenv";

dotenv.config();

const cdp = new CdpClient();
const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

const account = await cdp.evm.createAccount();
console.log("Wallet address:", account.address);

const { transactionHash: faucetHash } = await cdp.evm.requestFaucet({
  address: account.address,
  network: "base-sepolia",
  token: "eth",
});
await publicClient.waitForTransactionReceipt({ hash: faucetHash });
await new Promise(r => setTimeout(r, 3000)); // CDP API balance sync delay

const { transactionHash } = await cdp.evm.sendTransaction({
  address: account.address,
  transaction: { to: account.address, value: parseEther("0.000001") },
  network: "base-sepolia",
});
await publicClient.waitForTransactionReceipt({ hash: transactionHash });
console.log("View on BaseScan: https://sepolia.basescan.org/tx/" + transactionHash);
```

Run it: `npx tsx main.ts`

## Common stuck points

| Symptom | Fix |
|---|---|
| **401 / "invalid API key"** | Re-download JSON from portal.cdp.coinbase.com → API Keys. CDP_API_KEY_ID is the key name/ID; CDP_API_KEY_SECRET is the private key value. |
| **"wallet secret invalid" / wallet-related 403** | portal.cdp.coinbase.com/wallets/non-custodial/security → Generate Wallet Secret → update CDP_WALLET_SECRET in .env. |
| **Faucet throws / no funds after 30s** | Testnet faucet has rate limits. Try a different address or wait a few minutes. |
| **`sendTransaction` "insufficient funds"** | Onchain tx confirmed but CDP API balance hasn't synced yet. Increase the setTimeout delay (try 10s). |
| **SDK method not found / not exported** | SDK version changed. Check current docs and surface what you used. |
| **TypeScript errors from `@coinbase/cdp-sdk`** | If you have a tsconfig.json: set `"moduleResolution": "node16"`, `"esModuleInterop": true`, `"verbatimModuleSyntax": false`. With `npm pkg set type="module"` you may not need a tsconfig at all. |
| **`waitForTransactionReceipt` not found** | Run `npm install viem`. |

## Done — ready for production?

🎉 You just created an onchain wallet, funded it from the testnet faucet, and confirmed your first transaction on Base Sepolia.

To go live on mainnet: (1) Swap `network: "base-sepolia"` to `network: "base"` and remove `requestFaucet`. (2) Fund your wallet with real ETH via transfer or onramp. (3) Optionally use a dedicated production API key and Wallet Secret for cleaner audit logs.

**Full integration guide:** https://docs.cdp.coinbase.com/wallets/quickstart/api-key-auth
