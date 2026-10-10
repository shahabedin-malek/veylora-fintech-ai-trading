> Coinbase CDP docs — **stablecoins** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Stablecoin Quickstart

Get up and running with your custom stablecoin. This guide walks through reading a balance and sending your first transfer. The onchain source code is available at [coinbase/custom-stablecoin](https://github.com/coinbase/custom-stablecoin).

<Tip>
  A custom stablecoin is a **standard token** — an ERC-20 on EVM networks and an SPL token on Solana. That means you read balances and move funds with the same libraries, wallets, and explorers you'd use for any token. There is nothing custom-stablecoin-specific in the code below, so anything you already know about ERC-20 or SPL transfers applies directly.
</Tip>

<Note>
  **Select your environment first.** This guide covers both EVM and Solana. Choose your network in the tabs below — the prerequisites, dependencies, and code differ for each, so follow a single tab end to end.
</Note>

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    ## Prerequisites

    * Node.js 18+ installed
    * A wallet with a private key for Base Sepolia
    * Base Sepolia ETH to pay for gas (get from [CDP Faucet](/faucets/introduction/quickstart)) — every transfer, including the self-transfer below, is an onchain transaction that costs gas
    * A CBTUSD balance to transfer (see **How do I get testnet CBTUSD?** below)
    * Basic familiarity with TypeScript

    <Note>
      This quickstart uses **CBTUSD**, a test custom stablecoin already deployed on Base Sepolia. Your production stablecoin address is provided during onboarding.
    </Note>

    <Accordion title="How do I get testnet CBTUSD?">
      On testnet, you have two ways to get CBTUSD:

      1. Request **CBTUSD** directly from the [CDP Faucet](/faucets/introduction/quickstart).
      2. Get **USDC** from the [CDP Faucet](/faucets/introduction/quickstart) and swap it 1:1 for CBTUSD using the [Stableswapper quickstart](/custom-stablecoins/conversions/stableswapper-contract/quickstart). There is no added Coinbase fee for the swap — you only pay network gas.

      Either way, make sure you also have Base Sepolia **ETH** for gas. Once you hold CBTUSD, you can pick up below.

      In production, you acquire your own custom stablecoin the same way — swap USDC for it via [Stableswapper](/custom-stablecoins/conversions/stableswapper-contract/quickstart), or through Coinbase Retail, Exchange, and Prime. Issuance itself is managed by Coinbase as part of [onboarding](/custom-stablecoins/overview).
    </Accordion>

    ## 1. Create tsconfig.json

    ```json theme={null}
    {
      "compilerOptions": {
        "target": "ES2020",
        "module": "CommonJS",
        "esModuleInterop": true,
        "resolveJsonModule": true,
        "skipLibCheck": true,
        "strict": true
      }
    }
    ```

    ## 2. Install dependencies

    ```bash theme={null}
    npm install ethers
    npm install --save-dev ts-node typescript @types/node
    ```

    We use [ethers](https://docs.ethers.org/) here, but any EVM library (viem, web3.js) works the same way — the stablecoin is a plain ERC-20.

    ## 3. Set environment variables

    ```bash theme={null}
    export PRIVATE_KEY="your-wallet-private-key"
    export RPC_URL="https://sepolia.base.org"
    ```

    `RPC_URL` is the Base Sepolia endpoint your script reads from and submits transactions to. The public endpoint above is fine for testing; for production traffic, use a dedicated [Base node](/data/node/quickstart) or RPC provider to avoid rate limits.

    <Warning>
      Never commit your private key to source control. Use environment variables or a secrets manager. For production, use [CDP Non-custodial Wallets](/wallets/quickstart/api-key-auth) for secure key management.
    </Warning>

    ## 4. Create your script

    The script below reads your CBTUSD balance and then sends a small transfer. It will:

    * Connect to Base Sepolia and load your wallet from `PRIVATE_KEY`
    * Read the token's `decimals` so amounts display in human-readable units
    * Print your current CBTUSD balance
    * Transfer 1 CBTUSD **to your own address** as a smoke test

    <Note>
      **Why transfer to yourself?** A self-transfer exercises the full signing-and-broadcasting path — proving your wallet, RPC, and the token contract all work together — without needing a second wallet and without changing your net balance. You still need to hold at least 1 CBTUSD (the contract checks your balance) and you still pay gas in ETH.
    </Note>

    ```typescript transfer.ts theme={null}
    import { ethers } from "ethers";

    const TOKEN_ADDRESS = "0x57AB1EFE59b1C7b36b1Dc9315B4782bCcBb83721"; // CBTUSD on Base Sepolia

    // A minimal ABI — you only need to declare the functions you actually call,
    // not the token's entire interface.
    const ERC20_ABI = [
      "function balanceOf(address account) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function transfer(address to, uint256 amount) returns (bool)",
    ];

    async function main() {
      // The provider reads chain state; the signer signs and pays for transactions.
      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      const signer   = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
      const token    = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);

      // ERC-20 balances are stored as integers in the token's smallest unit.
      // `decimals` tells us the scaling factor so we can convert to/from whole tokens.
      const decimals = await token.decimals();
      const balance  = await token.balanceOf(signer.address);
      console.log("Balance:", ethers.formatUnits(balance, decimals));

      // Make the "you need a balance" assumption explicit with a friendly error.
      const amount = ethers.parseUnits("1", decimals);
      if (balance < amount) {
        throw new Error(
          "Not enough CBTUSD to transfer. See 'How do I get testnet CBTUSD?' in the quickstart."
        );
      }

      // Transfer 1 token to yourself as a smoke test
      const tx      = await token.transfer(signer.address, amount);
      const receipt = await tx.wait();
      console.log("Transfer confirmed:", receipt.hash);
    }

    main()
      .then(() => process.exit(0))
      .catch((err) => { console.error(err.message); process.exit(1); });
    ```

    ## 5. Run your script

    ```bash theme={null}
    npx ts-node transfer.ts
    ```

    You should see output similar to:

    ```text theme={null}
    Balance: 5.0
    Transfer confirmed: 0x6c3f...a91b
    ```

    Paste the transaction hash into [Base Sepolia explorer](https://sepolia.basescan.org/) to view the transfer onchain.

    <Note>
      **Going to production?** The only changes are configuration, not code: point `RPC_URL` at Base Mainnet, fund the wallet with real ETH for gas, and set `TOKEN_ADDRESS` to your stablecoin's address from onboarding.
    </Note>

    <Note>
      **Running into issues?** See the [Troubleshooting guide](/custom-stablecoins/stablecoin-contract/troubleshooting) for common errors and solutions.
    </Note>
  </Tab>

  <Tab title="Solana Virtual Machine">
    ## Prerequisites

    * Node.js 18+ installed
    * A Solana wallet keypair file
    * Devnet SOL to pay for transaction fees **and account rent** (get from [CDP Faucet](/faucets/introduction/quickstart)) — see the note on token accounts below for why rent matters
    * A CBTUSD balance to transfer (see **How do I get testnet CBTUSD?** below)
    * Basic familiarity with TypeScript

    <Note>
      This quickstart uses **CBTUSD**, a test custom stablecoin already deployed on Solana devnet. Your production stablecoin mint address is provided during onboarding.
    </Note>

    <Accordion title="How do I get testnet CBTUSD?">
      On devnet, you have two ways to get CBTUSD:

      1. Request **CBTUSD** directly from the [CDP Faucet](/faucets/introduction/quickstart).
      2. Get **USDC** from the [CDP Faucet](/faucets/introduction/quickstart) and swap it 1:1 for CBTUSD using the [Stableswapper quickstart](/custom-stablecoins/conversions/stableswapper-contract/quickstart). There is no added Coinbase fee for the swap — you only pay network gas.

      Either way, make sure you also have devnet **SOL** for transaction fees and account rent. Once you hold CBTUSD, you can pick up below.

      In production, you acquire your own custom stablecoin the same way — swap USDC for it via [Stableswapper](/custom-stablecoins/conversions/stableswapper-contract/quickstart), or through Coinbase Retail, Exchange, and Prime. Issuance itself is managed by Coinbase as part of [onboarding](/custom-stablecoins/overview).
    </Accordion>

    <Accordion title="Don't have a Solana wallet?">
      ```bash theme={null}
      # Install Solana CLI
      sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

      # Create a wallet keypair
      solana-keygen new --outfile ~/.config/solana/id.json
      ```

      For production, use [CDP Non-custodial Wallets](/wallets/quickstart/api-key-auth) for secure key management.
    </Accordion>

    ## 1. Create tsconfig.json

    ```json theme={null}
    {
      "compilerOptions": {
        "target": "ES2020",
        "module": "CommonJS",
        "esModuleInterop": true,
        "resolveJsonModule": true,
        "skipLibCheck": true,
        "strict": false
      }
    }
    ```

    ## 2. Install dependencies

    ```bash theme={null}
    npm install @solana/web3.js @solana/spl-token
    npm install --save-dev ts-node typescript @types/node
    ```

    ## 3. Set environment variables

    ```bash theme={null}
    export RPC_URL="https://api.devnet.solana.com"
    export WALLET_PATH="$HOME/.config/solana/id.json"
    ```

    * `RPC_URL` — the Solana cluster your script talks to. The public devnet endpoint is fine for testing; for production, use a dedicated RPC provider to avoid rate limits.
    * `WALLET_PATH` — the path to your keypair file. The script loads this to sign transactions and pay fees.

    ## 4. Create your script

    <Note>
      **Why `getOrCreateAssociatedTokenAccount`?** Unlike EVM, where a token contract tracks every holder's balance internally, Solana stores each wallet's balance in a separate **associated token account (ATA)** — one per (wallet, mint) pair. An ATA must exist before it can hold tokens, and creating one costs a small, one-time amount of SOL (rent), which is why you need devnet SOL beyond just transaction fees. `getOrCreateAssociatedTokenAccount` returns the account if it already exists and creates it (paying rent from `payer`) if it doesn't.
    </Note>

    The script below will:

    * Connect to devnet and load your keypair from `WALLET_PATH`
    * Resolve (or create) your CBTUSD token account
    * Print your current CBTUSD balance
    * Transfer 1 CBTUSD **to your own account** as a smoke test

    ```typescript transfer.ts theme={null}
    import {
      Connection,
      Keypair,
      PublicKey,
    } from "@solana/web3.js";
    import {
      getMint,
      getOrCreateAssociatedTokenAccount,
      transfer,
    } from "@solana/spl-token";
    import * as fs from "fs";

    const MINT_ADDRESS = new PublicKey("5P6MkoaCd9byPxH4X99kgKtS6SiuCQ67ZPCJzpXGkpCe"); // CBTUSD on devnet

    async function main() {
      const connection = new Connection(process.env.RPC_URL!);
      const keyData    = JSON.parse(fs.readFileSync(process.env.WALLET_PATH!, "utf-8"));
      // `payer` signs the transaction, covers fees, and owns the token account below.
      const payer      = Keypair.fromSecretKey(Uint8Array.from(keyData));

      // Get or create the token account for your wallet (creates an ATA if needed).
      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        MINT_ADDRESS,
        payer.publicKey
      );

      // SPL balances are integers in the smallest unit; `decimals` scales them to whole tokens.
      const mintInfo = await getMint(connection, MINT_ADDRESS);
      const balance  = Number(tokenAccount.amount) / Math.pow(10, mintInfo.decimals);
      console.log("Balance:", balance);

      // Make the "you need a balance" assumption explicit with a friendly error.
      const amount = BigInt(1) * BigInt(10 ** mintInfo.decimals);
      if (tokenAccount.amount < amount) {
        throw new Error(
          "Not enough CBTUSD to transfer. See 'How do I get testnet CBTUSD?' in the quickstart."
        );
      }

      // Transfer 1 token to yourself as a smoke test
      const sig = await transfer(
        connection,
        payer,
        tokenAccount.address,   // source
        tokenAccount.address,   // destination (self-transfer for test)
        payer,
        amount
      );
      console.log("Transfer confirmed:", sig);
    }

    main()
      .then(() => process.exit(0))
      .catch((err) => { console.error(err.message); process.exit(1); });
    ```

    <Note>
      **Why transfer to yourself?** A self-transfer exercises the full signing-and-submitting path — proving your keypair, RPC, and token account all work together — without needing a second wallet and without changing your net balance. You still need to hold at least 1 CBTUSD and you still pay fees in SOL.
    </Note>

    ## 5. Run your script

    ```bash theme={null}
    npx ts-node transfer.ts
    ```

    You should see output similar to:

    ```text theme={null}
    Balance: 5
    Transfer confirmed: 4mZc...K8vQ
    ```

    Paste the transaction signature into [Solana Explorer](https://explorer.solana.com/?cluster=devnet) (with the devnet cluster selected) to view the transfer onchain.

    <Note>
      **Going to production?** The only changes are configuration, not code: point `RPC_URL` at Solana Mainnet, fund the wallet with real SOL, and set `MINT_ADDRESS` to your stablecoin's mint from onboarding.
    </Note>

    <Note>
      **Running into issues?** See the [Troubleshooting guide](/custom-stablecoins/stablecoin-contract/troubleshooting) for common errors and solutions.
    </Note>
  </Tab>
</Tabs>

## What to read next?

<CardGroup cols={2}>
  <Card title="Examples" icon="code" href="/custom-stablecoins/stablecoin-contract/examples">
    Memos, permit, gasless transfers, and more
  </Card>

  <Card title="Reference" icon="book" href="/custom-stablecoins/stablecoin-contract/reference">
    Full function and program reference
  </Card>

  <Card title="Key Addresses" icon="location-dot" href="/custom-stablecoins/conversions/stableswapper-contract/key-addresses">
    Contract and mint addresses
  </Card>

  <Card title="Overview" icon="info" href="/custom-stablecoins/overview">
    Learn about Custom Stablecoins
  </Card>
</CardGroup>
