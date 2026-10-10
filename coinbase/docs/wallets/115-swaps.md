> Coinbase CDP docs — **wallets** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Swaps

CDP Wallets provide a convenient way to execute swaps. This feature combines the core Trade APIs (which handle price discovery and quote creation) with the CDP Wallet’s ability to sign and broadcast transactions.

<CardGroup cols={2}>
  <Card title="Any ERC-20 Pair" icon="arrow-right-arrow-left">
    Swap between any supported tokens using contract addresses
  </Card>

  <Card title="Price Discovery" icon="chart-line">
    Get indicative prices with fee and slippage estimates before executing
  </Card>

  <Card title="Smart Account Support" icon="wallet">
    Works with both EOAs and ERC-4337 Smart Accounts
  </Card>

  <Card title="Gas Sponsorship" icon="gas-pump">
    Built-in Paymaster support for gasless Smart Account swaps
  </Card>
</CardGroup>

<Info>
  Swaps are EVM only and supported on mainnet networks: Base, Ethereum, Arbitrum, Optimism, and Polygon. Testnet is not supported.
</Info>

## Get a price

Fetch a non-binding price estimate before executing. Check the `issues` field to surface problems like insufficient balance or missing token allowance before the user confirms.

### User authentication

<Tabs>
  <Tab title="React">
    ```tsx theme={null}
    import { useGetSwapPrice } from "@coinbase/cdp-hooks";

    const { data, status } = useGetSwapPrice({
      network: "base",
      fromToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
      toToken: "0x4200000000000000000000000000000000000006",   // WETH
      fromAmount: "1000000", // 1 USDC in atomic units (6 decimals)
      slippageBps: 100,      // 1% max slippage
    });

    if (data?.liquidityAvailable) {
      console.log("Expected output:", data.toAmount);
      console.log("Minimum after slippage:", data.minToAmount);
      console.log("Network fee:", data.totalNetworkFee);
    }
    ```
  </Tab>

  <Tab title="Vanilla TypeScript">
    ```typescript theme={null}
    import { getSwapPrice } from "@coinbase/cdp-core";

    const price = await getSwapPrice({
      network: "base",
      fromToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      toToken: "0x4200000000000000000000000000000000000006",
      fromAmount: "1000000",
      slippageBps: 100,
    });

    if (price.liquidityAvailable) {
      console.log("Expected output:", price.toAmount);
      console.log("Minimum after slippage:", price.minToAmount);
    }
    ```
  </Tab>
</Tabs>

### API key authentication

See [Trade API: Price discovery](/trade-api/quickstart#regular-accounts-eoas) for how to get a quote using CDP EVM accounts.

## Execute a swap

### User authentication

`useSwap` tracks the full lifecycle through on-chain confirmation. For EOA accounts it waits for a transaction receipt; for Smart Accounts it polls the user operation until completion.

<Tabs>
  <Tab title="React">
    ```tsx theme={null}
    import { useSwap } from "@coinbase/cdp-hooks";

    function ExecuteSwap() {
      const { swap, status, data, error } = useSwap();

      const handleSwap = async () => {
        await swap({
          network: "base",
          fromToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          toToken: "0x4200000000000000000000000000000000000006",
          fromAmount: "1000000",
          slippageBps: 100,
        });
      };

      return (
        <div>
          <button onClick={handleSwap} disabled={status === "pending"}>
            {status === "pending" ? "Swapping..." : "Swap"}
          </button>
          {status === "success" && data && (
            <p>Swap confirmed. Received: {data.toAmount}</p>
          )}
          {error && <p>Swap failed: {error.message}</p>}
        </div>
      );
    }
    ```
  </Tab>

  <Tab title="Vanilla TypeScript">
    ```typescript theme={null}
    import { executeSwap } from "@coinbase/cdp-core";

    const result = await executeSwap({
      network: "base",
      fromToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      toToken: "0x4200000000000000000000000000000000000006",
      fromAmount: "1000000",
      slippageBps: 100,
    });

    if (result.type === "evm-eoa") {
      console.log("Transaction hash:", result.transactionHash);
    } else {
      console.log("User operation hash:", result.userOpHash);
    }
    ```
  </Tab>
</Tabs>

The result is a discriminated union based on account type: `"evm-eoa"` results include a `transactionHash`, while `"evm-smart"` results include a `userOpHash`. Both include the resolved token addresses, amounts, fees, and network fee estimate. See [`ExecuteSwapResult`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-core/Type-Aliases/ExecuteSwapResult) for the full type.

<Note>
  When using the `useSwap` hook, the `data` object is enriched with confirmation details: `receipt` for EOA transactions, and `transactionHash` / `receipts` / `userOperation` for Smart Accounts. These values are populated once the operation completes on-chain.
</Note>

### API key authentication

CDP EVM accounts support two approaches:

1. **All-in-one swap** (recommended): submit a swap in a single call.
2. **Quote, then swap** (advanced): create a quote first, then execute. Useful for inspecting swap details or applying custom logic before committing.

See the Trade API quickstart for code examples:

* [Regular accounts (EOAs)](/trade-api/quickstart#regular-accounts-eoas)
* [Smart Accounts](/trade-api/quickstart#smart-accounts)

## Token approvals

Swaps use [Permit2](https://github.com/Uniswap/permit2) for token transfers. The CDP Swap API signs the per-swap Permit2 permit automatically, but the `fromToken` must have an ERC-20 approval to the Permit2 contract.

<Note>
  Use `getSwapPrice` / `useGetSwapPrice` to check before executing. If `issues.allowance` is non-null, the taker needs to approve `issues.allowance.spender` (the Permit2 contract) for at least `fromAmount`. Approving a larger amount avoids re-approving on every swap.
</Note>

## Gas sponsorship

For Smart Account users, pass `useCdpPaymaster: true` to enable gasless swaps on Base, or provide a custom `paymasterUrl` for any ERC-7677-compatible paymaster. These options are ignored for EOA accounts.

<Warning>
  `useCdpPaymaster` is only supported on Base. For other chains, use `paymasterUrl`. You cannot specify both.
</Warning>

## Account selection

By default, the SDK auto-selects the taker account:

| Configuration | Result |
| - | - |
| 1 Smart Account + 1 EOA | Prefers the Smart Account |
| 1 EOA only | Uses the EOA |
| Multiple accounts | Error: must specify `account` explicitly |

## Error handling

Swap failures throw a `SwapError` with a typed `code`:

```typescript theme={null}
import { executeSwap, SwapError } from "@coinbase/cdp-core";

try {
  await executeSwap({ /* ... */ });
} catch (err) {
  if (err instanceof SwapError) {
    switch (err.code) {
      case "INSUFFICIENT_BALANCE":
        console.log("Not enough tokens to swap");
        break;
      case "INSUFFICIENT_LIQUIDITY":
        console.log("No route available. Try a different pair or amount.");
        break;
      default:
        console.log("Swap error:", err.message);
    }
  }
}
```

When using `useSwap`, check the returned `error` value instead of a `try/catch`.

## FAQ

<AccordionGroup>
  <Accordion title="How do I specify token addresses?">
    Tokens are identified by their **0x-prefixed ERC-20 contract address** on the target network. The same token (e.g., USDC) has different addresses on different networks. You can find contract addresses on block explorers like [Basescan](https://basescan.org) or [Etherscan](https://etherscan.io).
  </Accordion>

  <Accordion title="What units should fromAmount be in?">
    `fromAmount` must be a **positive integer string in atomic units** (the smallest denomination of the token). For example, USDC has 6 decimals, so 1 USDC = `"1000000"`. WETH has 18 decimals, so 0.1 WETH = `"100000000000000000"`.
  </Accordion>

  <Accordion title="What does slippageBps control?">
    `slippageBps` sets the maximum acceptable price impact in basis points (1 bps = 0.01%). The default is `100` (1%), applied by the API when omitted. If the price moves beyond this threshold between the quote and execution, the transaction will revert to protect the user.
  </Accordion>

  <Accordion title="Are testnets supported?">
    Swaps are currently available on **mainnet networks only** (Base, Ethereum, Arbitrum, Optimism, Polygon). Testnet support is not yet available.
  </Accordion>

  <Accordion title="Can I swap the native gas token (ETH, POL)?">
    Yes. Use the sentinel address `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` as `fromToken` or `toToken` to represent the chain's native token (ETH on Ethereum/Base/Arbitrum/Optimism, POL on Polygon). No Permit2 approval is needed for native tokens.
  </Accordion>

  <Accordion title="Does the SDK handle token approvals?">
    The CDP Swap API handles the per-swap Permit2 signature automatically. However, the `fromToken` must have an ERC-20 approval to the Permit2 contract. See [Token approvals](#token-approvals) for details.
  </Accordion>

  <Accordion title="What's the difference between useSwap and executeSwap?">
    `executeSwap` (core) returns a `Promise` that resolves with the swap result (transaction hash or user op hash) as soon as it's submitted. `useSwap` (hooks) additionally tracks on-chain confirmation: `status` stays `"pending"` until the transaction receipt (EOA) or user operation (Smart Account) is confirmed, then moves to `"success"`.
  </Accordion>
</AccordionGroup>

## Reference

### `@coinbase/cdp-core`

| Resource | Description |
| - | - |
| [`getSwapPrice`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-core/Functions/getSwapPrice) | Get an indicative price |
| [`executeSwap`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-core/Functions/executeSwap) | Execute a swap |
| [`GetSwapPriceOptions`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-core/Type-Aliases/GetSwapPriceOptions) | Parameters for price requests |
| [`GetSwapPriceResult`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-core/Type-Aliases/GetSwapPriceResult) | Price response when liquidity is available |
| [`SwapUnavailableResult`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-core/Type-Aliases/SwapUnavailableResult) | Price response when no route exists |
| [`ExecuteSwapOptions`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-core/Type-Aliases/ExecuteSwapOptions) | Parameters for swap execution |
| [`ExecuteSwapResult`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-core/Type-Aliases/ExecuteSwapResult) | Swap result type (EOA / Smart Account) |
| [`SwapError`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-core/Classes/SwapError) | Typed error class for swap failures |

### `@coinbase/cdp-hooks`

| Resource | Description |
| - | - |
| [`useGetSwapPrice`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks/Functions/useGetSwapPrice) | Reactive price fetching |
| [`useSwap`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks/Functions/useSwap) | Execute and track a swap |
| [`UseGetSwapPriceOptions`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks/Interfaces/UseGetSwapPriceOptions) | Options for `useGetSwapPrice` |
| [`UseGetSwapPriceReturnType`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks/Type-Aliases/UseGetSwapPriceReturnType) | Return type of `useGetSwapPrice` |
| [`UseSwapReturnType`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks/Type-Aliases/UseSwapReturnType) | Return type of `useSwap` |
| [`SwapTransactionData`](/sdks/cdp-sdks-v2/frontend/@coinbase/cdp-hooks/Type-Aliases/SwapTransactionData) | Hook swap result (EOA / Smart Account) |
