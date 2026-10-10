> Coinbase CDP docs — **stablecoins** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Production Readiness

Everything you need for production swaps.

## Best practices

### Token decimals

The program supports tokens with different decimal precision. Amounts are automatically normalized during swaps so equivalent values are preserved across different decimal precisions.

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    EVM tokens commonly use **6 decimals** (USDC) or **18 decimals**. The contract normalizes between them automatically.

    ```typescript theme={null}
    // Example: expressing 100 tokens for a 6-decimal token (e.g., USDC)
    const amount = ethers.parseUnits("100", 6);

    // Example: expressing 100 tokens for an 18-decimal token
    const amount18 = ethers.parseUnits("100", 18);
    ```

    You can query a token's decimals from the contract:

    ```typescript theme={null}
    const decimals = await stableSwapper.getTokenDecimals(tokenAddress);
    ```
  </Tab>

  <Tab title="Solana Virtual Machine">
    Solana tokens typically use **6 to 9 decimals**.

    ```typescript theme={null}
    // Example: expressing 100 tokens for a 6-decimal token
    const amount = 100 * Math.pow(10, 6); // = 100_000_000

    // Using anchor.BN for large numbers
    const amountBN = new anchor.BN(100 * 10 ** 6);
    ```
  </Tab>
</Tabs>

### Slippage protection

Always set `minAmountOut` to protect against fee rate changes between when you construct the transaction and when it executes.

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    ```typescript theme={null}
    // Read fee from contract and calculate expected output
    const feeBps = await stableSwapper.feeBasisPoints();
    const amountIn = ethers.parseUnits("100", 6);

    // Fee is charged on the input token, rounded up
    const fee = (amountIn * BigInt(feeBps) + 9999n) / 10000n;
    const expectedOutput = amountIn - fee;

    // Apply slippage tolerance (2%)
    const slippageBps = 200n;
    const minAmountOut = expectedOutput * (10000n - slippageBps) / 10000n;
    ```
  </Tab>

  <Tab title="Solana Virtual Machine">
    ```typescript theme={null}
    // Calculate slippage tolerance
    const expectedOutput = new anchor.BN(100 * 10 ** 6);
    const slippageTolerance = 0.02; // 2%
    const minAmountOut = expectedOutput.muln(1 - slippageTolerance);

    // Or use the helper function
    const { amountOut, fee } = await calculateSwapOutput(amountIn);
    const minAmountOut = amountOut.muln(0.98); // Allow 2% variance
    ```
  </Tab>
</Tabs>

### Allowlist

<Warning>
  On **EVM**, the allowlist may be **enabled** for this pool. When active, only allowlisted addresses can execute swaps, and transactions from others will fail — contact your integration partner to be added. The **Solana** program does not gate swaps by an allowlist; any signer can swap.
</Warning>

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    **For smart contract integrations:** The calling contract's address (`msg.sender`) must be allowlisted, not the EOA that initiated the outer transaction. You can check allowlist status before sending a transaction:

    ```typescript theme={null}
    const allowlistEnabled = await stableSwapper.isFeatureEnabled(2); // 2 = ALLOWLIST
    if (allowlistEnabled) {
      const isAllowed = await stableSwapper.isAllowlisted(walletAddress);
      if (!isAllowed) {
        throw new Error("Address not allowlisted");
      }
    }
    ```
  </Tab>

  <Tab title="Solana Virtual Machine">
    Swaps are not gated by a whitelist on Solana — any signer can swap. **For smart contract integrations via CPI (Cross-Program Invocation):** when calling via `invoke_signed`, ensure the signing PDA has sufficient SOL to cover potential token-account creation fees.
  </Tab>
</Tabs>

### ERC-20 approvals (Base only)

Before swapping on Base, the Stableswapper contract must be approved to transfer your input tokens. This is a standard ERC-20 requirement.

```typescript theme={null}
const token = new ethers.Contract(tokenInAddress, ERC20_ABI, signer);

// Option 1: Approve exact amount (most secure, requires approval per swap)
await token.approve(STABLESWAPPER_ADDRESS, amountIn);

// Option 2: Approve a larger amount to avoid repeated approvals
await token.approve(STABLESWAPPER_ADDRESS, ethers.MaxUint256);
```

<Warning>
  Approving `MaxUint256` is convenient but gives the contract unlimited spending authority over that token. For production, consider approving exact amounts or using a reasonable upper bound.
</Warning>

***

## Security considerations

<Accordion title="Always verify addresses">
  1. **Verify the contract address** before sending transactions — use the address from the [Key Addresses](/custom-stablecoins/conversions/stableswapper-contract/key-addresses) page
  2. **Double-check token addresses** — confirm both input and output token addresses against the Key Addresses page
  3. **Validate user inputs** — sanitize and bounds-check all amounts and addresses
</Accordion>

<Accordion title="Test thoroughly">
  1. **Test on devnet/testnet first** with small amounts
  2. **Run integration tests** covering success and failure cases
  3. **Test edge cases** like zero amounts, maximum amounts, and missing accounts or approvals
</Accordion>

<Accordion title="Handle failures gracefully">
  1. **Never assume success** — always check transaction results
  2. **Provide clear error messages** to users
  3. **Implement retry logic** for network failures (but not for validation errors)
</Accordion>

<Accordion title="Monitor transactions">
  1. **Log transaction signatures/hashes** for debugging and support
  2. **Track failed transactions** to identify patterns
  3. **Monitor pool liquidity** to warn users before failures
</Accordion>

***

## Pre-flight checklist

Before sending a swap on mainnet, verify:

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    * User has sufficient input token balance
    * User has sufficient ETH for gas fees
    * ERC-20 approval is set for the Stableswapper contract on the input token
    * Both tokens are listed and swappable
    * Swap feature is enabled
    * Contract has sufficient output token liquidity (balance minus reserved amount)
    * User address is allowlisted (if allowlist feature is enabled)
    * Slippage tolerance accounts for current fee rate
    * Contract address and token addresses match the Key Addresses page

    <Tip>See [Key Addresses](/custom-stablecoins/conversions/stableswapper-contract/key-addresses) for all contract and token addresses.</Tip>
  </Tab>

  <Tab title="Solana Virtual Machine">
    * User has sufficient input token balance
    * User has sufficient SOL for transaction fees (0.000005 SOL typical, plus \~0.002 SOL if creating a new token account)
    * Destination token account exists, or ATA creation is prepended to the transaction
    * Pool has sufficient liquidity for the swap amount
    * Slippage tolerance accounts for current fee rate
    * Program ID and mint addresses match the Key Addresses page

    <Tip>See [Key Addresses](/custom-stablecoins/conversions/stableswapper-contract/key-addresses) for all program IDs and token mints.</Tip>
  </Tab>
</Tabs>

***

## What to read next

<CardGroup cols={2}>
  <Card title="Troubleshooting" icon="triangle-exclamation" href="/custom-stablecoins/conversions/stableswapper-contract/troubleshooting">
    Common errors and solutions
  </Card>

  <Card title="Examples" icon="code" href="/custom-stablecoins/conversions/stableswapper-contract/examples">
    Code samples for common scenarios
  </Card>

  <Card title="Reference" icon="book" href="/custom-stablecoins/conversions/stableswapper-contract/reference">
    Swap instruction parameters
  </Card>

  <Card title="Quickstart" icon="rocket" href="/custom-stablecoins/conversions/stableswapper-contract/quickstart">
    Get up and running in 10 minutes
  </Card>
</CardGroup>
