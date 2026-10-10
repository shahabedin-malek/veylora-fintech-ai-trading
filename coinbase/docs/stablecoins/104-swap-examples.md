> Coinbase CDP docs — **stablecoins** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Swap Examples

Code examples for common swap scenarios using the Stableswapper program.

<Note>
  These examples assume you've completed the [Quickstart](/custom-stablecoins/conversions/stableswapper-contract/quickstart) setup steps (dependencies, environment variables, and IDL/ABI).
</Note>

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    ## Setup

    Use these Base Sepolia addresses in your examples. For mainnet, replace with your production addresses from [Key Addresses](/custom-stablecoins/conversions/stableswapper-contract/key-addresses).

    ```typescript theme={null}
    import { ethers } from "ethers";

    // Base Sepolia addresses
    const STABLESWAPPER_ADDRESS = "0x57AB1E2c6289aCe985Bd5c5571EbF6d98CD41Ab7";
    const USDC_ADDRESS          = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const CBTUSD_ADDRESS        = "0x57AB1EFE59b1C7b36b1Dc9315B4782bCcBb83721";

    const ERC20_ABI = [
      "function approve(address spender, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function balanceOf(address account) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ];

    const STABLESWAPPER_ABI = [
      "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient) external",
      "function feeBasisPoints() view returns (uint16)",
      "function feeRecipient() view returns (address)",
      "function isTokenListed(address token) view returns (bool)",
      "function isTokenSwappable(address token) view returns (bool)",
      "function isFeatureEnabled(uint8 feature) view returns (bool)",
      "function isAllowlisted(address addr) view returns (bool)",
      "function getTokenDecimals(address token) view returns (uint8)",
      "function getListedTokens() view returns (address[])",
      "function getReservedAmount(address token) view returns (uint256)",
      // Custom errors — required so ethers can decode revert reasons for retry logic
      "error SwapsCannotBePaused()",
      "error CannotBeZeroAddress()",
      "error CannotSwapSameToken(address token)",
      "error TokenNotListed(address token)",
      "error CannotBeZeroAmount()",
      "error AddressNotInAllowlist(address addr)",
      "error TokenMustBeSwappable(address token)",
      "error SlippageExceeded()",
      "error TokenOutBalanceLessThanReservedAmount(address token)",
      "error AmountOutExceedsAvailableLiquidity(uint256 amountOut, uint256 availableLiquidity)",
    ];

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

    const stableSwapper = new ethers.Contract(STABLESWAPPER_ADDRESS, STABLESWAPPER_ABI, signer);
    ```

    ***

    ## Swap USDC for custom token

    ```typescript theme={null}
    async function swapUsdcForCustomToken() {
      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);

      const amountIn = ethers.parseUnits("0.1", 6);      // 0.1 USDC (6 decimals)
      const minAmountOut = ethers.parseUnits("0.09", 6);  // Allow up to 10% for fees/slippage

      // Approve the Stableswapper to spend USDC
      const currentAllowance = await usdc.allowance(signer.address, STABLESWAPPER_ADDRESS);
      if (currentAllowance < amountIn) {
        const approveTx = await usdc.approve(STABLESWAPPER_ADDRESS, amountIn);
        await approveTx.wait();
      }

      // Execute swap
      const swapTx = await stableSwapper.swap(
        USDC_ADDRESS,      // tokenIn
        CBTUSD_ADDRESS,      // tokenOut
        amountIn,          // amountIn
        minAmountOut,      // minAmountOut
        signer.address     // recipient
      );

      const receipt = await swapTx.wait();
      console.log("Swap successful:", receipt.hash);
    }
    ```

    ***

    ## Swap custom token for USDC

    ```typescript theme={null}
    async function swapCustomTokenForUsdc() {
      const cbtusd = new ethers.Contract(CBTUSD_ADDRESS, ERC20_ABI, signer);

      const amountIn = ethers.parseUnits("0.1", 6);      // 0.1 CBTUSD (6 decimals)
      const minAmountOut = ethers.parseUnits("0.09", 6);  // Allow up to 10% for fees/slippage

      // Approve the Stableswapper to spend CBTUSD
      const currentAllowance = await cbtusd.allowance(signer.address, STABLESWAPPER_ADDRESS);
      if (currentAllowance < amountIn) {
        const approveTx = await cbtusd.approve(STABLESWAPPER_ADDRESS, amountIn);
        await approveTx.wait();
      }

      // Execute swap
      const swapTx = await stableSwapper.swap(
        CBTUSD_ADDRESS,      // tokenIn
        USDC_ADDRESS,      // tokenOut
        amountIn,          // amountIn
        minAmountOut,      // minAmountOut
        signer.address     // recipient
      );

      const receipt = await swapTx.wait();
      console.log("Swap successful:", receipt.hash);
    }
    ```

    ***

    ## Swap to a different recipient

    On Base, you can send swap output directly to another address by specifying a different `recipient`.

    ```typescript theme={null}
    async function swapToRecipient(recipientAddress: string) {
      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);

      const amountIn = ethers.parseUnits("1.0", 6);
      const minAmountOut = ethers.parseUnits("0.99", 6);

      const currentAllowance = await usdc.allowance(signer.address, STABLESWAPPER_ADDRESS);
      if (currentAllowance < amountIn) {
        const approveTx = await usdc.approve(STABLESWAPPER_ADDRESS, amountIn);
        await approveTx.wait();
      }

      const swapTx = await stableSwapper.swap(
        USDC_ADDRESS,
        CBTUSD_ADDRESS,
        amountIn,
        minAmountOut,
        recipientAddress    // output tokens go to this address
      );

      const receipt = await swapTx.wait();
      console.log("Swap to recipient successful:", receipt.hash);
    }
    ```

    ***

    ## Query contract state

    Read contract state before executing swaps for validation and fee calculation.

    ```typescript theme={null}
    async function queryContractState() {
      // Check fee configuration
      const feeBps = await stableSwapper.feeBasisPoints();
      console.log("Fee (basis points):", feeBps.toString());

      // Check token status
      const usdcListed = await stableSwapper.isTokenListed(USDC_ADDRESS);
      const usdcSwappable = await stableSwapper.isTokenSwappable(USDC_ADDRESS);
      console.log("USDC listed:", usdcListed, "swappable:", usdcSwappable);

      // Check if swaps are enabled
      const swapsEnabled = await stableSwapper.isFeatureEnabled(0); // 0 = SWAP
      console.log("Swaps enabled:", swapsEnabled);

      // Check allowlist status (only relevant if allowlist feature is enabled)
      const allowlistEnabled = await stableSwapper.isFeatureEnabled(2); // 2 = ALLOWLIST
      if (allowlistEnabled) {
        const isAllowed = await stableSwapper.isAllowlisted(signer.address);
        console.log("Wallet allowlisted:", isAllowed);
      }

      // Get all listed tokens
      const listedTokens = await stableSwapper.getListedTokens();
      console.log("Listed tokens:", listedTokens);
    }
    ```

    ***

    ## Split a large swap across available liquidity

    A single `swap` reverts with `AmountOutExceedsAvailableLiquidity` if the output exceeds the pool's available `tokenOut` liquidity (balance minus reserved). Split large amounts into chunks that each fit current liquidity; when the pool is temporarily short, **wait and retry** rather than failing — liquidity is replenished over time.

    <Note>
      Re-read available liquidity **before every chunk** (it changes as others swap and as the pool refills) and cap each chunk at a fraction of it (`CHUNK_BPS`, 50% below) so no single tx drains the pool. A lower fraction is gentler on a contended pool — fewer race reverts — but uses more transactions; tune it to your pool's contention.
    </Note>

    <Warning>
      This example waits **indefinitely** for refills. In production, bound the wait (a max retry count or deadline) so a request can't hang forever, and surface progress to the caller.
    </Warning>

    ```typescript theme={null}
    // Available output-token liquidity: contract balance minus reserved amount
    async function getAvailableLiquidity(tokenOut: string): Promise<bigint> {
      const token = new ethers.Contract(tokenOut, ERC20_ABI, provider);
      const [balance, reserved] = await Promise.all([
        token.balanceOf(STABLESWAPPER_ADDRESS),
        stableSwapper.getReservedAmount(tokenOut),
      ]);
      return balance > reserved ? balance - reserved : 0n;
    }

    // Normalize an amount between two decimal precisions (tokenIn <-> tokenOut)
    function convertDecimals(amount: bigint, fromDecimals: number, toDecimals: number): bigint {
      if (fromDecimals === toDecimals) return amount;
      if (toDecimals > fromDecimals) return amount * 10n ** BigInt(toDecimals - fromDecimals);
      return amount / 10n ** BigInt(fromDecimals - toDecimals);
    }

    // Selectors for the liquidity-shortfall custom errors.
    const LIQUIDITY_ERROR_SELECTORS = [
      "0x4dd6d661", // AmountOutExceedsAvailableLiquidity(uint256,uint256)
      "0xd1ac5718", // TokenOutBalanceLessThanReservedAmount(address)
    ];

    // True for an on-chain revert (as opposed to a transient network/RPC failure).
    function isOnChainRevert(err: any): boolean {
      if (err?.code === "CALL_EXCEPTION") return true;
      return /revert/i.test((err?.shortMessage || err?.message || "").toString());
    }

    // Match a revert against known custom errors. Do NOT use err.shortMessage — ethers may report a
    // decoded custom error there as "unknown custom error". Use err.revert.name / err.data / err.message.
    function matchesError(err: any, names: string[], selectors: string[] = []): boolean {
      if (names.includes(err?.revert?.name)) return true;          // decoded custom error
      const data = typeof err?.data === "string" ? err.data : "";
      if (selectors.some((s) => data.startsWith(s))) return true;  // raw revert-data selector
      const msg = `${err?.reason ?? ""} ${err?.message ?? ""}`;    // message/reason (not shortMessage!)
      return names.some((n) => msg.includes(n));
    }

    // Validation errors won't succeed on retry — fail fast on these.
    function isNonRetryable(err: any): boolean {
      return matchesError(err, [
        "SwapsCannotBePaused",
        "CannotBeZeroAddress",
        "CannotSwapSameToken",
        "TokenNotListed",
        "CannotBeZeroAmount",
        "AddressNotInAllowlist",
        "TokenMustBeSwappable",
      ]);
    }

    // Liquidity shortfall is not fatal — the pool is replenished over time, so we wait,
    // re-read liquidity, resize the chunk, and retry rather than failing the request.
    function isLiquidityShortfall(err: any): boolean {
      return matchesError(err,
        ["AmountOutExceedsAvailableLiquidity", "TokenOutBalanceLessThanReservedAmount"],
        LIQUIDITY_ERROR_SELECTORS);
    }

    // Send one swap chunk safely. Blindly resending a fund-moving tx can DOUBLE-SWAP if a send that
    // "failed" (RPC timeout) was actually broadcast. So sign once (fixed nonce -> deterministic hash),
    // broadcast idempotently, and confirm by hash — re-broadcasting the same signed tx can't double-swap.
    async function sendSwapChunk(
      tokenIn: string, tokenOut: string, chunk: bigint, minAmountOut: bigint,
    ): Promise<ethers.TransactionReceipt> {
      // populateTransaction runs estimateGas — a liquidity/validation revert surfaces HERE,
      // before anything is broadcast (safe: there is nothing to double-send).
      const req = await stableSwapper.swap.populateTransaction(tokenIn, tokenOut, chunk, minAmountOut, signer.address);
      const signed = await signer.signTransaction(await signer.populateTransaction(req)); // fixes nonce + gas
      const hash = ethers.keccak256(signed);

      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          await provider.broadcastTransaction(signed); // idempotent: same signed blob every time
        } catch (err: any) {
          if (isOnChainRevert(err)) throw err;
          // "already known" / "nonce" just means it is already in the mempool/mined — fall through.
        }
        const receipt = await provider.waitForTransaction(hash, 1, 30000).catch(() => null);
        if (receipt) {
          if (receipt.status === 0) {
            // A receipt carries no revert reason. Recover it by replaying the swap at the block it
            // reverted in — this yields a decodable error (e.g. AmountOutExceedsAvailableLiquidity)
            // regardless of CURRENT liquidity, which may already have been refilled. Do NOT rely on
            // a "read liquidity now" heuristic here — it misclassifies once the pool is topped up.
            await stableSwapper.swap.staticCall(tokenIn, tokenOut, chunk, minAmountOut, signer.address,
              { from: signer.address, blockTag: receipt.blockNumber });
            throw Object.assign(new Error(`swap ${hash} reverted on-chain`), { code: "CALL_EXCEPTION" });
          }
          return receipt;
        }
        console.warn(`Not yet confirmed (attempt ${attempt}); re-broadcasting same tx ${hash}...`);
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
      throw new Error(`swap ${hash} not confirmed after retries`);
    }

    async function swapLargeAmount(tokenIn: string, tokenOut: string, totalAmountIn: bigint) {
      const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);

      const inDecimals  = Number(await stableSwapper.getTokenDecimals(tokenIn));
      const outDecimals = Number(await stableSwapper.getTokenDecimals(tokenOut));
      const feeBps = await stableSwapper.feeBasisPoints();

      // Approve the full amount once, up front
      const allowance = await tokenInContract.allowance(signer.address, STABLESWAPPER_ADDRESS);
      if (allowance < totalAmountIn) {
        const approveTx = await tokenInContract.approve(STABLESWAPPER_ADDRESS, totalAmountIn);
        await approveTx.wait();
      }

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const REFILL_POLL_MS = 5000; // how long to wait before re-checking liquidity

      let remaining = totalAmountIn;
      let swapCount = 0;

      while (remaining > 0n) {
        // Re-read liquidity before each chunk — it changes as others swap and as the pool refills
        const available = await getAvailableLiquidity(tokenOut);
        const availableAsInput = convertDecimals(available, outDecimals, inDecimals);

        // Cap each chunk at a share of available liquidity so one tx never drains the pool
        // (leaves headroom for concurrent swappers). Tune CHUNK_BPS — see the tip above.
        const CHUNK_BPS = 5000n; // 50%
        const maxChunk = (availableAsInput * CHUNK_BPS) / 10000n;
        if (maxChunk === 0n) {
          // Pool is dry — wait for it to be replenished, then re-check.
          console.log(`No available liquidity; waiting ${REFILL_POLL_MS}ms for refill...`);
          await sleep(REFILL_POLL_MS);
          continue;
        }

        const chunk = remaining > maxChunk ? maxChunk : remaining;

        // Per-chunk slippage protection: fee is charged on the input, rounded up
        const fee = (chunk * BigInt(feeBps) + 9999n) / 10000n;
        const expectedOut = convertDecimals(chunk - fee, inDecimals, outDecimals);
        const minAmountOut = (expectedOut * 9950n) / 10000n; // 0.5% tolerance

        try {
          const receipt = await sendSwapChunk(tokenIn, tokenOut, chunk, minAmountOut);
          swapCount++;
          console.log(`Chunk ${swapCount} (${ethers.formatUnits(chunk, inDecimals)}) swapped: ${receipt.hash}`);
          remaining -= chunk;
          console.log(`Remaining: ${ethers.formatUnits(remaining, inDecimals)}`);
        } catch (err: any) {
          if (isNonRetryable(err)) throw err; // validation error — fatal, don't wait/retry
          // Race: the pool was drained between our read and the tx landing. Not fatal — wait for
          // refill, then loop back to re-read liquidity and resize. sendSwapChunk recovers the real
          // revert reason (even for a mined revert), so this stays reliable regardless of timing.
          if (isLiquidityShortfall(err)) {
            console.log(`Liquidity shortfall; waiting ${REFILL_POLL_MS}ms for refill...`);
            await sleep(REFILL_POLL_MS);
            continue;
          }
          throw err; // some other on-chain revert, or a transient failure that couldn't confirm
        }
      }

      console.log(`Done — ${swapCount} swap(s) completed`);
    }

    // Example: swap 10,000 USDC for the custom token, split across available liquidity
    await swapLargeAmount(USDC_ADDRESS, CBTUSD_ADDRESS, ethers.parseUnits("10000", 6));
    ```

    <Note>
      **Resuming after a crash.** This loop tracks progress (`remaining`) in memory only — if the process dies mid-request, re-running from the original amount would over-swap. For unattended use, persist progress durably: after each confirmed chunk record how much has been swapped, and record a chunk's **tx hash before sending it**. On restart, recompute `remaining` from the confirmed total and re-check that last tx hash to see whether it landed. The sign-once (fixed-nonce) send makes it safe to redo a chunk that didn't land — it can't produce a duplicate.
    </Note>

    ***

    ## Swap between two custom stablecoins

    <Note>
      The contract supports swapping between **any two listed and swappable tokens** — not just USDC pairs. To swap between two custom stablecoins, use their respective addresses as `tokenIn` and `tokenOut`. Both tokens must be listed and have swapping enabled.
    </Note>
  </Tab>

  <Tab title="Solana Virtual Machine">
    ## Setup

    Use these devnet addresses in your examples. For mainnet, replace with your production addresses from [Key Addresses](/custom-stablecoins/conversions/stableswapper-contract/key-addresses).

    ```typescript theme={null}
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

    // Devnet addresses
    const PROGRAM_ID        = new PublicKey("9vDwZVJXw5nxymWmUcgmNpemDH5EBcJwLNhtsznrgJDH");
    const USDC_MINT         = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    const CUSTOM_TOKEN_MINT = new PublicKey("5P6MkoaCd9byPxH4X99kgKtS6SiuCQ67ZPCJzpXGkpCe"); // CBTUSD

    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    // @ts-ignore - IDL type compatibility
    const program = new Program(idl, provider);
    ```

    ***

    ## Swap USDC for custom token

    ```typescript theme={null}
    async function swapUsdcForCustomToken() {
      const swapAmount   = new anchor.BN(0.1 * 10 ** 6);   // 0.1 USDC (6 decimals)
      const minAmountOut = new anchor.BN(0.09 * 10 ** 6);  // Allow up to 10% for fees/slippage

      // Derive PDAs
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

      // User token accounts
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

      // Create destination ATA if it doesn't exist
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

      // Optionally prepend ATA creation
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

      const tx = await provider.sendAndConfirm(transaction);
      console.log("Swap successful:", tx);
    }
    ```

    ***

    ## Swap custom token for USDC

    ```typescript theme={null}
    async function swapCustomTokenForUsdc() {
      const swapAmount   = new anchor.BN(0.1 * 10 ** 6);   // 0.1 custom tokens (6 decimals)
      const minAmountOut = new anchor.BN(0.09 * 10 ** 6);  // Allow up to 10% for fees/slippage

      // Derive PDAs
      const [pool] = PublicKey.findProgramAddressSync(
        [Buffer.from("liquidity_pool")],
        PROGRAM_ID
      );

      const [customTokenVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_vault"), pool.toBuffer(), CUSTOM_TOKEN_MINT.toBuffer()],
        PROGRAM_ID
      );

      const [usdcVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_vault"), pool.toBuffer(), USDC_MINT.toBuffer()],
        PROGRAM_ID
      );

      const [customTokenVaultTokenAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_token_account"), customTokenVault.toBuffer()],
        PROGRAM_ID
      );

      const [usdcVaultTokenAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_token_account"), usdcVault.toBuffer()],
        PROGRAM_ID
      );

      const [whitelist] = PublicKey.findProgramAddressSync(
        [Buffer.from("address_whitelist")],
        PROGRAM_ID
      );

      // User token accounts
      const userCustomTokenAccount = await getAssociatedTokenAddress(
        CUSTOM_TOKEN_MINT,
        provider.wallet.publicKey
      );

      const userUsdcAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        provider.wallet.publicKey
      );

      // Fetch pool to get fee recipient
      const poolAccount = await (program.account as any).liquidityPool.fetch(pool);

      const feeRecipientCustomTokenAccount = await getAssociatedTokenAddress(
        CUSTOM_TOKEN_MINT,
        poolAccount.feeRecipient
      );

      // Build and send swap
      const swapIx = await program.methods
        .swap(swapAmount, minAmountOut)
        .accounts({
          pool,
          inVault: customTokenVault,
          outVault: usdcVault,
          inVaultTokenAccount: customTokenVaultTokenAccount,
          outVaultTokenAccount: usdcVaultTokenAccount,
          userFromTokenAccount: userCustomTokenAccount,
          toTokenAccount: userUsdcAccount,
          feeRecipientTokenAccount: feeRecipientCustomTokenAccount,
          feeRecipient: poolAccount.feeRecipient,
          fromMint: CUSTOM_TOKEN_MINT,
          toMint: USDC_MINT,
          user: provider.wallet.publicKey,
          whitelist,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .instruction();

      const transaction = new anchor.web3.Transaction();
      transaction.add(swapIx);

      const tx = await provider.sendAndConfirm(transaction);
      console.log("Swap successful:", tx);
    }
    ```

    ***

    ## Split a large swap across available liquidity

    A single `swap` fails with `InsufficientLiquidity` when the output amount exceeds the reserves held in the output vault. For large amounts, split the swap into chunks that each fit within the currently available liquidity, and execute them sequentially. When the pool is temporarily short, **wait and retry** rather than failing the whole request — pool liquidity is replenished over time.

    <Note>
      Re-read the output vault balance **before every chunk** (it changes as others swap and as the pool refills) and cap each chunk at a fraction of it (`CHUNK_BPS`, 50% below) so no single tx drains the pool. A lower fraction is gentler on a contended pool — fewer race failures — but uses more transactions; tune it to your pool's contention.
    </Note>

    <Warning>
      This example waits **indefinitely** for refills. In production, bound the wait (a max retry count or deadline) so a request can't hang forever, and surface progress to the caller.
    </Warning>

    <Warning>
      **Idempotent sends:** if a send *appears* to fail (RPC timeout) but was actually submitted, rebuilding re-signs with a new blockhash (a new signature) which can execute the swap **twice**. The example signs **once** per blockhash and re-sends the *same* signed transaction, confirming by signature; it rebuilds only after the blockhash expires. Validate on devnet before mainnet.
    </Warning>

    ```typescript theme={null}
    // Available output-token liquidity: current balance of the output vault token account
    async function getAvailableLiquidity(outVaultTokenAccount: PublicKey): Promise<bigint> {
      const account = await getAccount(provider.connection, outVaultTokenAccount);
      return account.amount; // bigint, in the output token's base units
    }

    // Normalize an amount between two decimal precisions (input <-> output token)
    function convertDecimals(amount: bigint, fromDecimals: number, toDecimals: number): bigint {
      if (fromDecimals === toDecimals) return amount;
      if (toDecimals > fromDecimals) return amount * 10n ** BigInt(toDecimals - fromDecimals);
      return amount / 10n ** BigInt(fromDecimals - toDecimals);
    }

    // Anchor puts the program's #[msg] text in both err.message and err.logs — scan both.
    function errorText(err: any): string {
      const logs = Array.isArray(err?.logs) ? err.logs.join(" ") : "";
      return `${err?.message ?? ""} ${logs}`;
    }

    // Validation errors won't succeed on retry — match the program's error messages.
    function isNonRetryable(err: any): boolean {
      const msg = errorText(err);
      return [
        "Swaps are paused",
        "Token not supported",
        "Cannot swap same token",
        "Token is disabled",
        "Invalid amount",
      ].some((m) => msg.includes(m));
    }

    // Liquidity shortfall is not fatal — the pool is replenished over time, so we wait,
    // re-read liquidity, resize the chunk, and retry rather than failing the request.
    function isLiquidityShortfall(err: any): boolean {
      return errorText(err).includes("Insufficient liquidity");
    }

    // The blockhash expired before the tx landed — it can never execute now, so rebuilding is safe.
    function isBlockhashExpired(err: any): boolean {
      return /block height exceeded|blockhash.*expired|TransactionExpired/i.test(errorText(err));
    }

    // Send one swap instruction SAFELY: sign once, broadcast idempotently, confirm by signature.
    // Re-sending the identical signed tx cannot double-swap (same signature — the cluster dedupes).
    async function sendSwapChunk(swapIx: anchor.web3.TransactionInstruction): Promise<string> {
      const { blockhash, lastValidBlockHeight } = await provider.connection.getLatestBlockhash("confirmed");
      const tx = new anchor.web3.Transaction({ feePayer: provider.wallet.publicKey, blockhash, lastValidBlockHeight }).add(swapIx);
      const signed = await provider.wallet.signTransaction(tx); // sign ONCE
      const raw = signed.serialize();

      // Broadcast (retry-safe: identical raw tx). A preflight-caught program error never landed —
      // rethrow so the caller can classify it.
      let signature = "";
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          signature = await provider.connection.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 0 });
          break;
        } catch (err: any) {
          if (isNonRetryable(err) || isLiquidityShortfall(err)) throw err;
          if (attempt >= 3) throw err;
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }

      // Confirm within the blockhash window; rejects on expiry (tx definitively didn't land).
      const res = await provider.connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
      if (res.value.err) {
        // Landed but failed — recover the reason from the tx logs so we can classify it.
        const parsed = await provider.connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
        throw Object.assign(new Error(`swap ${signature} failed on-chain`), { logs: parsed?.meta?.logMessages ?? [] });
      }
      return signature;
    }

    async function swapLargeAmount(totalAmountIn: anchor.BN) {
      const IN_DECIMALS  = 6; // USDC
      const OUT_DECIMALS = 6; // custom token — adjust if your token uses different precision

      // Derive PDAs (USDC -> custom token direction)
      const [pool] = PublicKey.findProgramAddressSync([Buffer.from("liquidity_pool")], PROGRAM_ID);
      const [usdcVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_vault"), pool.toBuffer(), USDC_MINT.toBuffer()], PROGRAM_ID);
      const [customTokenVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_vault"), pool.toBuffer(), CUSTOM_TOKEN_MINT.toBuffer()], PROGRAM_ID);
      const [usdcVaultTokenAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_token_account"), usdcVault.toBuffer()], PROGRAM_ID);
      const [customTokenVaultTokenAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_token_account"), customTokenVault.toBuffer()], PROGRAM_ID);
      const [whitelist] = PublicKey.findProgramAddressSync(
        [Buffer.from("address_whitelist")], PROGRAM_ID);

      const userUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, provider.wallet.publicKey);
      const userCustomTokenAccount = await getAssociatedTokenAddress(CUSTOM_TOKEN_MINT, provider.wallet.publicKey);

      const poolAccount = await (program.account as any).liquidityPool.fetch(pool);
      const feeRecipientUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, poolAccount.feeRecipient);

      // Ensure the destination ATA exists once, up front
      try {
        await getAccount(provider.connection, userCustomTokenAccount);
      } catch {
        const createIx = createAssociatedTokenAccountInstruction(
          provider.wallet.publicKey, userCustomTokenAccount, provider.wallet.publicKey, CUSTOM_TOKEN_MINT);
        await provider.sendAndConfirm(new anchor.web3.Transaction().add(createIx));
      }

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const REFILL_POLL_MS = 5000; // how long to wait before re-checking liquidity

      let remaining = BigInt(totalAmountIn.toString());
      let swapCount = 0;

      while (remaining > 0n) {
        // Re-read liquidity before each chunk — it changes as others swap and as the pool refills
        const available = await getAvailableLiquidity(customTokenVaultTokenAccount);
        const availableAsInput = convertDecimals(available, OUT_DECIMALS, IN_DECIMALS);

        // Cap each chunk at a share of available liquidity so one tx never drains the pool
        // (leaves headroom for concurrent swappers). Tune CHUNK_BPS — see the tip above.
        const CHUNK_BPS = 5000n; // 50%
        const maxChunk = (availableAsInput * CHUNK_BPS) / 10000n;
        if (maxChunk === 0n) {
          // Pool is dry — wait for it to be replenished, then re-check.
          console.log(`No available liquidity; waiting ${REFILL_POLL_MS}ms for refill...`);
          await sleep(REFILL_POLL_MS);
          continue;
        }

        const chunk = remaining > maxChunk ? maxChunk : remaining;
        const swapAmount = new anchor.BN(chunk.toString());
        // Deduct the fee before applying slippage tolerance (same model as EVM). The pool's
        // fee_rate (basis points) lives on the pool account fetched above.
        const feeBps = BigInt(poolAccount.feeRate.toString());
        const fee = (chunk * feeBps + 9999n) / 10000n; // ceil(chunk * feeRate / 10000)
        const expectedOut = convertDecimals(chunk - fee, IN_DECIMALS, OUT_DECIMALS);
        const minAmountOut = new anchor.BN(((expectedOut * 9950n) / 10000n).toString()); // 0.5% tolerance

        try {
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

          const signature = await sendSwapChunk(swapIx);
          swapCount++;
          console.log(`Chunk ${swapCount} (${Number(chunk) / 10 ** IN_DECIMALS}) swapped: ${signature}`);
          remaining -= chunk;
          console.log(`Remaining: ${Number(remaining) / 10 ** IN_DECIMALS}`);
        } catch (err: any) {
          if (isNonRetryable(err)) throw err;        // validation error — fatal, don't wait/retry
          if (isBlockhashExpired(err)) continue;     // tx never landed — rebuild & resend (no wait)
          // Race: the pool was drained between our read and the tx landing. Not fatal —
          // wait for refill, then loop back to re-read liquidity and resize the chunk.
          if (isLiquidityShortfall(err)) {
            console.log(`Liquidity shortfall; waiting ${REFILL_POLL_MS}ms for refill...`);
            await sleep(REFILL_POLL_MS);
            continue;
          }
          throw err; // some other on-chain failure, or a transient error that couldn't confirm
        }
      }

      console.log(`Done — ${swapCount} swap(s) completed`);
    }

    // Example: swap 10,000 USDC for the custom token, split across available liquidity
    await swapLargeAmount(new anchor.BN(10000 * 10 ** 6));
    ```

    <Note>
      **Resuming after a crash.** This loop tracks progress (`remaining`) in memory only — if the process dies mid-request, re-running from the original amount would over-swap. For unattended use, persist progress durably: after each confirmed chunk record how much has been swapped, and record a chunk's **signature before sending it**. On restart, recompute `remaining` from the confirmed total and re-check that signature to see whether it landed. The sign-once-per-blockhash send makes it safe to redo a chunk that didn't land — it can't produce a duplicate.
    </Note>

    ***

    ## Swap between two custom stablecoins

    <Note>
      The program supports swapping between **any two supported tokens** — not just USDC pairs. To swap between two custom stablecoins, substitute both `CUSTOM_TOKEN_MINT` references with the respective `fromMint` and `toMint` addresses for your tokens.
    </Note>
  </Tab>
</Tabs>

***

## What to read next

<CardGroup cols={2}>
  <Card title="Reference" icon="book" href="/custom-stablecoins/conversions/stableswapper-contract/reference">
    Complete swap instruction parameters and accounts
  </Card>

  <Card title="Production Readiness" icon="shield-check" href="/custom-stablecoins/conversions/stableswapper-contract/production-readiness">
    Helper functions and best practices
  </Card>

  <Card title="Quickstart" icon="rocket" href="/custom-stablecoins/conversions/stableswapper-contract/quickstart">
    Get up and running in 10 minutes
  </Card>

  <Card title="Key Addresses" icon="location-dot" href="/custom-stablecoins/conversions/stableswapper-contract/key-addresses">
    Program IDs and deployed addresses
  </Card>
</CardGroup>
