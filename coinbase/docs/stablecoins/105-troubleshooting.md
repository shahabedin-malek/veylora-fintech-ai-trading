> Coinbase CDP docs — **stablecoins** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Troubleshooting

Common issues and solutions when integrating with Custom Stablecoins swaps.

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    ## Common Errors

    ### SwapsCannotBePaused

    **Error:** Transaction reverts with `SwapsCannotBePaused()`

    **Solution:** Swaps are currently disabled on the contract. Wait for the PAUSE\_ROLE holder to re-enable swaps.

    ### TokenNotListed

    **Error:** Transaction reverts with `TokenNotListed(address)`

    **Solution:** The token address you provided is not listed on the contract. Verify the token address against the [Key Addresses](/custom-stablecoins/conversions/stableswapper-contract/key-addresses) page.

    ### TokenMustBeSwappable

    **Error:** Transaction reverts with `TokenMustBeSwappable(address)`

    **Solution:** The token is listed but currently disabled for swapping. Wait for the PAUSE\_ROLE holder to re-enable the token.

    ### SlippageExceeded

    **Error:** Transaction reverts with `SlippageExceeded()`

    **Solution:** The output amount after fees and decimal normalization is less than your `minAmountOut`. Increase your slippage tolerance or re-read the current `feeBasisPoints()` value and recalculate.

    ### AmountOutExceedsAvailableLiquidity

    **Error:** Transaction reverts with `AmountOutExceedsAvailableLiquidity(amountOut, availableLiquidity)`

    **Solution:** Reduce your swap amount. The contract doesn't have enough output token liquidity (after accounting for reserved amounts) to fulfill the swap.

    ### AddressNotInAllowlist

    **Error:** Transaction reverts with `AddressNotInAllowlist(address)`

    **Solution:** The allowlist feature is enabled and your wallet address is not allowlisted. Contact support to be added.

    ### CannotSwapSameToken

    **Error:** Transaction reverts with `CannotSwapSameToken(address)`

    **Solution:** You specified the same token address for both `tokenIn` and `tokenOut`. Use two different token addresses.

    ### ERC-20 approval errors

    **Error:** Transaction reverts during `transferFrom` with no descriptive error

    **Solution:** You need to approve the Stableswapper contract to spend your input tokens before calling `swap()`. Call `approve()` on the input token contract first:

    ```typescript theme={null}
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    await token.approve(STABLESWAPPER_ADDRESS, amountIn);
    ```

    ### Insufficient gas

    **Error:** Transaction fails with `insufficient funds for gas`

    **Solution:** You need Base Sepolia ETH for gas fees. Get testnet ETH from [CDP Faucet](/faucets/introduction/quickstart).
  </Tab>

  <Tab title="Solana Virtual Machine">
    ## Common Errors

    ### AccountNotInitialized

    **Error:** `user_from_token_account` - Account not initialized

    **Solution:** You need USDC tokens in your wallet. Get devnet USDC from [CDP Faucet](/faucets/introduction/quickstart).

    <Note>
      The example code includes logic to auto-create the destination token account if needed (`needsAccountCreation`). However, you must have the **input token** (USDC) before swapping.
    </Note>

    ### Insufficient lamports

    **Error:** `insufficient lamports` or `insufficient funds for rent`

    **Solution:** You need more SOL for transaction fees and rent. Get at least 0.05 SOL from [CDP Faucet](/faucets/introduction/quickstart).

    ### InsufficientLiquidity

    **Error:** Not enough reserves in the output vault

    **Solution:** Reduce swap amount or wait for liquidity to be added.

    ### SlippageExceeded

    **Error:** Output is less than `min_amount_out`

    **Solution:** Increase slippage tolerance or re-fetch current fee rate.
  </Tab>
</Tabs>

***

## What to read next

<CardGroup cols={2}>
  <Card title="Production Readiness" icon="shield-check" href="/custom-stablecoins/conversions/stableswapper-contract/production-readiness">
    Helper functions for validation
  </Card>

  <Card title="Examples" icon="code" href="/custom-stablecoins/conversions/stableswapper-contract/examples">
    More swap code examples
  </Card>

  <Card title="Reference" icon="book" href="/custom-stablecoins/conversions/stableswapper-contract/reference">
    Swap instruction parameters
  </Card>

  <Card title="Quickstart" icon="rocket" href="/custom-stablecoins/conversions/stableswapper-contract/quickstart">
    Back to quickstart guide
  </Card>
</CardGroup>
