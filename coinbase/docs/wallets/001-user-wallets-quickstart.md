> Coinbase CDP docs — **wallets** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# User wallets quickstart

The **CDP non-custodial wallets SDK**, built by Coinbase, gives your React app self-custody wallets your users sign into with email, SMS, or social — no seed phrases, no extensions. This prompt uses the `cdp-create-app` scaffolder to spin up a working demo app, then walks through signing in and sending a first test transaction on Base Sepolia.

**Docs:** https://docs.cdp.coinbase.com/wallets/quickstart/user-auth
**Recommended:** install the CDP docs MCP so I can ground in live docs — `claude mcp add --transport http coinbase-cdp https://docs.cdp.coinbase.com/mcp`

## Setup

Check each item below IN ORDER. Stop at the first missing one, tell me exactly how to fix it, then resume after I confirm.

1. **CDP Portal account.** If none: portal.cdp.coinbase.com → follow the prompts to create one and verify your email. No separate organization-naming step.
2. **CDP project + Project ID + domain allowlist.** Go to **portal.cdp.coinbase.com/wallets/non-custodial/clients**. The **Project ID** is always visible on the page — copy it. Then click your client and under **Client configuration**, add `http://localhost:3000` as an allowed domain. Save. Without this, the SDK throws CORS / auth errors on sign-in. (No Sandbox vs Live distinction — same project works across networks.)
3. **Node.js 22+.** In the terminal, check with `node --version`. If <22 and nvm is installed: `source ~/.nvm/nvm.sh && nvm use v22`. Add `nvm use v22` to `~/.zshrc` to persist. If no nvm: install from https://github.com/nvm-sh/nvm then `nvm install 22`.

## Create the demo app

Run the scaffolder, replacing `YOUR_PROJECT_ID` with the Project ID from step 2:

```
npm create @coinbase/cdp-app@latest cdp-app-react -- --template react --project-id YOUR_PROJECT_ID
```

The CLI prompts for two choices: (1) **Account type** — select `EVM EOA (Regular Accounts)`. (2) **Domain allowlist confirmation** — type `y`.

## Run the app

```
cd cdp-app-react && npm install && npm run dev
```

Open http://localhost:3000. You should see the demo app with a **Sign In** button.

## Sign in and surface the wallet address

Click **Sign In**, enter your email, enter the OTP. After verification your wallet is provisioned — a truncated address (e.g. `0x1234...5678`) appears in the app header.

## Fund and send a test transaction

Copy your wallet address from the app header. Get free Base Sepolia ETH from the CDP Faucet: https://portal.cdp.coinbase.com/onchain-tools/faucet

Once the balance shows in the app, click **Send Transaction**. The demo sends 0.000001 ETH to your own address on Base Sepolia. A transaction hash link appears on success — click it to verify on https://sepolia.basescan.org.

## Common stuck points

| Symptom | Fix |
|---|---|
| **CORS / 401 on sign-in** | Domain not in allowlist. portal.cdp.coinbase.com/wallets/non-custodial/clients → your client → Client configuration → add `http://localhost:3000`. |
| **TypeScript compile errors** | `tsconfig.json compilerOptions.moduleResolution` is `"node"`. Change to `"node16"`, `"nodenext"`, or `"bundler"`. |
| **Blank screen / SDK never initializes** | Gate all wallet UI on `useIsInitialized()` returning `true` before checking sign-in state. |
| **`evmAddress` null after sign-in** | Wallet provisioning is async. Render conditionally on `evmAddress` truthy. |
| **"insufficient funds" on send** | No testnet ETH. Fund at portal.cdp.coinbase.com/onchain-tools/faucet. |
| **Production domain rejects calls** | Use a separate production project. Add only your production domain — do not add localhost to production projects. |
| **OTP email doesn't arrive** | Check spam, or try social login. |
| **SDK component or hook not exported** | Component renamed in a newer SDK version. Check current docs' import paths. |

## Done — ready for production?

🎉 You just gave a user a self-custody wallet and sent their first transaction on Base Sepolia.

To go to production: (1) Create a separate production project. Add only your production domain to Client configuration — no localhost. (2) Set `VITE_CDP_PROJECT_ID` to the new project's ID. (3) Swap `chainId` from `84532` to `8453` and `network` from `"base-sepolia"` to `"base"`. (4) Real ETH replaces faucet ETH.

**Full integration guide:** https://docs.cdp.coinbase.com/wallets/quickstart/user-auth
