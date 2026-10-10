> Coinbase CDP docs — **stablecoins** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Stableswapper Quickstart

Get up and running with Stableswapper, the onchain liquidity program that enables fee-free, permissionless 1:1 swaps between USDC and custom stablecoins.

In this quickstart, you will configure your environment, connect to the deployed contracts or program on devnet, approve USDC spending, and execute a swap into a custom stablecoin.

Use the tabs below for EVM and Solana examples, and learn more about Custom Stablecoins.

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    ## Prerequisites

    * Node.js 18+ installed
    * A wallet with a private key for Base Sepolia
    * Base Sepolia ETH for gas fees (get from [CDP Faucet](/faucets/introduction/quickstart))
    * Base Sepolia USDC tokens (get from [CDP Faucet](/faucets/introduction/quickstart))
    * A custom stablecoin to swap with (this guide uses CBTUSD, a test token on Base Sepolia)
    * Basic familiarity with TypeScript

    <Note>
      **Don't have a custom stablecoin yet?** This quickstart uses **CBTUSD**, a test custom stablecoin already deployed on Base Sepolia for testing. For production with your own branded stablecoin, contact Coinbase about Custom Stablecoins issuance.
    </Note>

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

    ## 3. Set environment variables

    ```bash theme={null}
    export PRIVATE_KEY="your-wallet-private-key"
    export RPC_URL="https://sepolia.base.org"
    ```

    <Warning>
      Never commit your private key to source control. Use environment variables or a secrets manager. For production, use [CDP Non-custodial Wallets](/wallets/quickstart/api-key-auth) for secure key management.
    </Warning>

    ## 4. Create your swap script

    Now we'll create a script that swaps **0.1 USDC** for the custom stablecoin (CBTUSD). The script will:

    * Connect to the Stableswapper contract on Base Sepolia
    * Approve the contract to spend your USDC
    * Execute the swap with slippage protection

    ```typescript swap.ts theme={null}
    import { ethers } from "ethers";

    // Base Sepolia addresses — see Key Addresses page for details
    const STABLESWAPPER_ADDRESS = "0x57AB1E2c6289aCe985Bd5c5571EbF6d98CD41Ab7";
    const USDC_ADDRESS          = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const CBTUSD_ADDRESS        = "0x57AB1EFE59b1C7b36b1Dc9315B4782bCcBb83721";

    // Minimal ABIs for the functions we need
    const ERC20_ABI = [
      "function approve(address spender, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function balanceOf(address account) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ];

    const STABLESWAPPER_ABI = [
      "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient) external",
      "function feeBasisPoints() view returns (uint16)",
      "function isTokenListed(address token) view returns (bool)",
      "function isTokenSwappable(address token) view returns (bool)",
      "function isFeatureEnabled(uint8 feature) view returns (bool)",
      "function isAllowlisted(address addr) view returns (bool)",
    ];

    async function swapUsdcForCustomToken() {
      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

      const stableSwapper = new ethers.Contract(STABLESWAPPER_ADDRESS, STABLESWAPPER_ABI, signer);
      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);

      // Swap 0.1 USDC (6 decimals)
      const amountIn = ethers.parseUnits("0.1", 6);
      const minAmountOut = ethers.parseUnits("0.09", 6);

      // Step 1: Approve the Stableswapper to spend your USDC
      const currentAllowance = await usdc.allowance(signer.address, STABLESWAPPER_ADDRESS);
      if (currentAllowance < amountIn) {
        console.log("Approving USDC spend...");
        const approveTx = await usdc.approve(STABLESWAPPER_ADDRESS, amountIn);
        await approveTx.wait();
        console.log("Approval confirmed");
      }

      // Step 2: Execute the swap
      console.log("Executing swap...");
      const swapTx = await stableSwapper.swap(
        USDC_ADDRESS,      // tokenIn
        CBTUSD_ADDRESS,    // tokenOut
        amountIn,          // amountIn
        minAmountOut,      // minAmountOut (slippage protection)
        signer.address     // recipient
      );

      const receipt = await swapTx.wait();
      console.log("Swap successful!");
      console.log("Transaction hash:", receipt.hash);
    }

    swapUsdcForCustomToken()
      .then(() => process.exit(0))
      .catch((err) => { console.error("Swap failed:", err.message); process.exit(1); });
    ```

    ## 5. Run your swap

    ```bash theme={null}
    npx ts-node swap.ts
    ```

    <Note>
      **Running into issues?** See the [Troubleshooting guide](/custom-stablecoins/conversions/stableswapper-contract/troubleshooting) for common errors and solutions.
    </Note>
  </Tab>

  <Tab title="Solana Virtual Machine">
    ## Prerequisites

    * Node.js 18+ installed
    * A Solana wallet keypair file
    * Devnet SOL - at least 0.05 SOL recommended for transaction fees and rent (get from [CDP Faucet](/faucets/introduction/quickstart))
    * Devnet USDC tokens (get from [CDP Faucet](/faucets/introduction/quickstart))
    * A custom stablecoin to swap with (this guide uses CBTUSD, a test token on devnet)
    * Basic familiarity with TypeScript

    <Note>
      **Don't have a custom stablecoin yet?** This quickstart uses **CBTUSD**, a test custom stablecoin already deployed on devnet for testing. For production with your own branded stablecoin, contact Coinbase about Custom Stablecoins issuance.
    </Note>

    <Accordion title="Don't have a Solana wallet?">
      ```bash theme={null}
      # Install Solana CLI
      sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

      # Create wallet keypair
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
        "strict": false,
        "noImplicitAny": false
      }
    }
    ```

    ## 2. Install dependencies

    ```bash theme={null}
    npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token
    npm install --save-dev ts-node typescript @types/node
    ```

    ## 3. Set environment variables

    ```bash theme={null}
    export ANCHOR_WALLET=~/.config/solana/id.json
    export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
    ```

    <Accordion title="What do these environment variables mean?">
      * **ANCHOR\_WALLET**: Path to your Solana wallet keypair file
      * **ANCHOR\_PROVIDER\_URL**: Solana RPC endpoint URL

      **Available RPC endpoints:**

      * Devnet (testing): `https://api.devnet.solana.com`
      * Mainnet (production): `https://api.mainnet-beta.solana.com`
    </Accordion>

    ## 4. Get the IDL

    The **Stableswapper program** is already deployed on Solana at program ID `9vDwZVJXw5nxymWmUcgmNpemDH5EBcJwLNhtsznrgJDH` (see [Key Addresses](/custom-stablecoins/conversions/stableswapper-contract/key-addresses)).

    To call this program from your code, you can access its instructions and required parameters from the IDL (Interface Definition Language). This guide uses the [Anchor framework](https://www.anchor-lang.com/) to simplify interacting with the program.

    You can also download the IDL from [Solana Explorer](https://explorer.solana.com/address/9vDwZVJXw5nxymWmUcgmNpemDH5EBcJwLNhtsznrgJDH/idl?cluster=devnet):

    1. Visit the IDL page link above
    2. Click the download button or copy the JSON
    3. Save as `custom_stablecoins.json` in your project directory

    ## 5. Create your swap script

    Now we'll create a script that swaps **0.1 USDC** for the custom stablecoin (CBTUSD). The script will:

    * Connect to the Stableswapper program using the IDL
    * Derive the required program addresses (pool, vaults, token accounts)
    * Build a swap instruction with your parameters
    * Submit the transaction to Solana devnet

    ```typescript swap.ts theme={null}
    import * as anchor from "@coral-xyz/anchor";
    import { Program, AnchorProvider } from "@coral-xyz/anchor";
    import { PublicKey } from "@solana/web3.js";
    import {
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
      getAssociatedTokenAddress,
      getAccount,
      createAssociatedTokenAccountInstruction,
    } from "@solana/spl-token";
    import idl from "./custom_stablecoins.json";

    // Devnet addresses - see Key Addresses page for details
    const PROGRAM_ID        = new PublicKey("9vDwZVJXw5nxymWmUcgmNpemDH5EBcJwLNhtsznrgJDH");
    const USDC_MINT         = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    const CUSTOM_TOKEN_MINT = new PublicKey("5P6MkoaCd9byPxH4X99kgKtS6SiuCQ67ZPCJzpXGkpCe"); // CBTUSD testnet token

    // Initialize provider
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    // @ts-ignore - IDL type compatibility
    const program = new Program(idl, provider);

    async function swapUsdcForCustomToken() {
      // Swap 0.1 USDC for custom token
      const swapAmount   = new anchor.BN(0.1 * 10 ** 6);
      const minAmountOut = new anchor.BN(0.09 * 10 ** 6);

      // Derive program addresses
      const [pool] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_pool")],
        PROGRAM_ID
      );

      const [usdcVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_vault"), pool.toBuffer(), USDC_MINT.toBuffer()],
        PROGRAM_ID
      );

      const [customTokenVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_vault"), pool.toBuffer(), CUSTOM_TOKEN_MINT.toBuffer()],
        PROGRAM_ID
      );

      const [usdcVaultTokenAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_token_account"), usdcVault.toBuffer()],
        PROGRAM_ID
      );

      const [customTokenVaultTokenAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_token_account"), customTokenVault.toBuffer()],
        PROGRAM_ID
      );

      const [whitelist] = PublicKey.findProgramAddressSync(
        [Buffer.from("address_whitelist")],
        PROGRAM_ID
      );

      // Get user token accounts
      const userUsdcAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        provider.wallet.publicKey
      );

      const userCustomTokenAccount = await getAssociatedTokenAddress(
        CUSTOM_TOKEN_MINT,
        provider.wallet.publicKey
      );

      // Fetch pool to get fee recipient
      const poolAccount = await (program.account as any).liquidityPool.fetch(pool);

      const feeRecipientUsdcAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        poolAccount.feeRecipient
      );

      // Check if destination account needs to be created
      let needsAccountCreation = false;
      try {
        await getAccount(provider.connection, userCustomTokenAccount);
      } catch {
        needsAccountCreation = true;
      }

      // Build swap instruction
      const swapIx = await program.methods
        .swap(swapAmount, minAmountOut)
        .accounts({
          pool,
          inVault: usdcVault,
          outVault: customTokenVault,
          inVaultTokenAccount: usdcVaultTokenAccount,
          outVaultTokenAccount: customTokenVaultTokenAccount,
          userFromTokenAccount: userUsdcAccount,
          toTokenAccount: userCustomTokenAccount,
          feeRecipientTokenAccount: feeRecipientUsdcAccount,
          feeRecipient: poolAccount.feeRecipient,
          fromMint: USDC_MINT,
          toMint: CUSTOM_TOKEN_MINT,
          user: provider.wallet.publicKey,
          whitelist,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .instruction();

      // Build transaction
      const transaction = new anchor.web3.Transaction();
      if (needsAccountCreation) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            provider.wallet.publicKey,
            userCustomTokenAccount,
            provider.wallet.publicKey,
            CUSTOM_TOKEN_MINT
          )
        );
      }
      transaction.add(swapIx);

      // Send transaction
      try {
        const tx = await provider.sendAndConfirm(transaction);
        console.log("Swap successful!");
        console.log("Transaction signature:", tx);
      } catch (error: any) {
        console.error("Swap failed:", error.message);
        throw error;
      }
    }

    swapUsdcForCustomToken()
      .then(() => process.exit(0))
      .catch((err) => { console.error(err); process.exit(1); });
    ```

    ## 6. Run your swap

    ```bash theme={null}
    npx ts-node swap.ts
    ```

    <Note>
      **Running into issues?** See the [Troubleshooting guide](/custom-stablecoins/conversions/stableswapper-contract/troubleshooting) for common errors and solutions.
    </Note>
  </Tab>
</Tabs>

## What to read next?

<CardGroup cols={2}>
  <Card title="Reference" icon="book" href="/custom-stablecoins/conversions/stableswapper-contract/reference">
    Swap instruction parameters and accounts
  </Card>

  <Card title="Production Readiness" icon="shield-check" href="/custom-stablecoins/conversions/stableswapper-contract/production-readiness">
    Helper functions, error handling, and best practices
  </Card>

  <Card title="Key Addresses" icon="location-dot" href="/custom-stablecoins/conversions/stableswapper-contract/key-addresses">
    Program IDs and deployed addresses
  </Card>

  <Card title="Overview" icon="info" href="/custom-stablecoins/overview">
    Learn about Custom Stablecoins and use cases
  </Card>
</CardGroup>
