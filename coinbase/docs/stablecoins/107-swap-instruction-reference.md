> Coinbase CDP docs — **stablecoins** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Swap Instruction Reference

Technical reference for the Stableswapper swap instruction.

For setup and examples, see [Quickstart](/custom-stablecoins/conversions/stableswapper-contract/quickstart) or [Examples](/custom-stablecoins/conversions/stableswapper-contract/examples).

***

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    ## Swap Function

    **Contract:** `0x57AB1E2c6289aCe985Bd5c5571EbF6d98CD41Ab7` ([Key Addresses](/custom-stablecoins/conversions/stableswapper-contract/key-addresses))

    ### Function Signature

    ```solidity theme={null}
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external
    ```

    ### Parameters

    | Parameter | Type | Description |
    | - | - | - |
    | `tokenIn` | `address` | Address of the ERC-20 token being swapped from |
    | `tokenOut` | `address` | Address of the ERC-20 token being swapped to |
    | `amountIn` | `uint256` | Amount of input token to swap (in token's native decimals, before fees) |
    | `minAmountOut` | `uint256` | Minimum acceptable output amount (slippage protection) |
    | `recipient` | `address` | Address that receives the output tokens |

    ### Preconditions

    * The caller must have approved the Stableswapper contract to spend at least `amountIn` of `tokenIn` (ERC-20 `approve`)
    * Both `tokenIn` and `tokenOut` must be listed and swappable
    * The SWAP feature flag must be enabled
    * If the ALLOWLIST feature is enabled, `msg.sender` must be allowlisted
    * `amountIn` and `minAmountOut` must be greater than zero
    * `tokenIn` and `tokenOut` must be different addresses
    * `recipient` must not be the zero address

    ### Fee Model

    Fees are charged on the **input token** and deducted before the 1:1 swap calculation.

    | Step | Description |
    | - | - |
    | 1 | Full `amountIn` is transferred from the caller to the contract |
    | 2 | Fee is calculated: `fee = ceil(amountIn * feeBasisPoints / 10000)` |
    | 3 | Fee is transferred from the contract to the `feeRecipient` |
    | 4 | Net amount (`amountIn - fee`) is normalized for decimal differences and sent to `recipient` |

    **Example:** Swapping 100 USDC with a 1% fee (100 basis points):

    * User sends: 100 USDC
    * Fee: 1 USDC (sent to fee recipient)
    * User receives: 99 of the output token (normalized for decimals)

    ***

    ## View Functions

    ### Token State

    | Function | Returns | Description |
    | - | - | - |
    | `isTokenListed(address token)` | `bool` | Whether a token is listed on the contract |
    | `isTokenSwappable(address token)` | `bool` | Whether a listed token is currently enabled for swapping |
    | `getTokenDecimals(address token)` | `uint8` | Cached decimals for a listed token |
    | `getListedTokens()` | `address[]` | Array of all listed token addresses |
    | `getListedTokensCount()` | `uint256` | Number of listed tokens |
    | `getReservedAmount(address token)` | `uint256` | Amount reserved (not available for swaps) |

    ### Fee Configuration

    | Function | Returns | Description |
    | - | - | - |
    | `feeBasisPoints()` | `uint16` | Current fee in basis points (e.g., 100 = 1%) |
    | `feeRecipient()` | `address` | Address that receives collected fees |

    ### Access Control

    | Function | Returns | Description |
    | - | - | - |
    | `isAllowlisted(address addr)` | `bool` | Whether an address is on the allowlist |
    | `isFeatureEnabled(FeatureFlag feature)` | `bool` | Whether a feature flag is enabled |

    **Feature flag values:**

    | Value | Feature | Description |
    | - | - | - |
    | `0` | SWAP | Enables/disables all swap operations |
    | `1` | WITHDRAW | Enables/disables liquidity withdrawals |
    | `2` | ALLOWLIST | When enabled, only allowlisted addresses can swap |

    ***

    ## Events

    | Event | Parameters | Description |
    | - | - | - |
    | `Swap` | `caller`, `tokenIn`, `tokenOut`, `amountIn`, `amountOut`, `fee`, `recipient` | Emitted on every successful swap |
    | `TokenListingUpdated` | `token`, `isListed` | Token added or removed from listings |
    | `TokenStatusUpdated` | `token`, `isSwappable` | Token swapping enabled or disabled |
    | `FeeUpdated` | `oldFeeBasisPoints`, `newFeeBasisPoints` | Fee rate changed |
    | `FeeRecipientUpdated` | `oldFeeRecipient`, `newFeeRecipient` | Fee recipient address changed |
    | `FeatureFlagUpdated` | `feature`, `isEnabled` | Feature flag toggled |
    | `AllowlistUpdated` | `addr`, `isAllowlisted` | Address added to or removed from allowlist |

    ***

    ## Error Reference

    | Error | Description |
    | - | - |
    | `SwapsCannotBePaused()` | Swap feature is disabled |
    | `CannotBeZeroAddress()` | A required address parameter is the zero address |
    | `CannotSwapSameToken(token)` | `tokenIn` and `tokenOut` are the same |
    | `TokenNotListed(token)` | Token is not listed on the contract |
    | `CannotBeZeroAmount()` | `amountIn` or `minAmountOut` is zero |
    | `AddressNotInAllowlist(addr)` | Allowlist is enabled and caller is not allowlisted |
    | `TokenMustBeSwappable(token)` | Token is listed but not currently swappable |
    | `SlippageExceeded()` | Output amount is below `minAmountOut` |
    | `TokenOutBalanceLessThanReservedAmount(token)` | Contract balance is less than the reserved amount |
    | `AmountOutExceedsAvailableLiquidity(amountOut, availableLiquidity)` | Insufficient liquidity after accounting for reserves |

    ***

    ## Roles

    The contract uses role-based access control. These roles are managed by the `DEFAULT_ADMIN_ROLE` holder.

    | Role | Permissions |
    | - | - |
    | `DEFAULT_ADMIN_ROLE` | Authorize upgrades, grant/revoke all roles (single holder, 2-step transfer) |
    | `TREASURY_ROLE` | Withdraw liquidity, update reserved amounts |
    | `CONFIGURE_ROLE` | List/unlist tokens, update fees, manage allowlist |
    | `PAUSE_ROLE` | Pause/unpause swaps and withdrawals, enable/disable individual tokens |
  </Tab>

  <Tab title="Solana Virtual Machine">
    ## Swap Instruction

    **Program ID:** `9vDwZVJXw5nxymWmUcgmNpemDH5EBcJwLNhtsznrgJDH` ([Key Addresses](/custom-stablecoins/conversions/stableswapper-contract/key-addresses))

    ### Parameters

    | Parameter | Type | Description |
    | - | - | - |
    | `amount_in` | `u64` | Amount of input token (in token's native decimals) |
    | `min_amount_out` | `u64` | Minimum acceptable output (slippage protection) |

    ### Required Accounts

    | Account | Type | Description |
    | - | - | - |
    | `pool` | Read-only | Liquidity pool PDA (seed: `"liquidity_pool"`) |
    | `inVault` | Read-only | Vault PDA for input token |
    | `outVault` | Read-only | Vault PDA for output token |
    | `inVaultTokenAccount` | Writable | Token account holding input token reserves |
    | `outVaultTokenAccount` | Writable | Token account holding output token reserves |
    | `userFromTokenAccount` | Writable | User's token account for input token |
    | `toTokenAccount` | Writable | Destination token account for output token |
    | `feeRecipientTokenAccount` | Writable | Fee recipient's token account for input token |
    | `feeRecipient` | Read-only | Fee recipient authority (validated against pool) |
    | `fromMint` | Read-only | Mint of the input token |
    | `toMint` | Read-only | Mint of the output token |
    | `user` | Signer, Writable | User wallet signing the transaction |
    | `whitelist` | Read-only | Deprecated PDA (seed: `"address_whitelist"`). Required on the instruction; not read and not an allowlist check. |
    | `tokenProgram` | Read-only | SPL Token Program |
    | `associatedTokenProgram` | Read-only | Associated Token Program |
    | `systemProgram` | Read-only | System Program |

    ***

    ### Transaction Structure

    A Solana transaction contains one or more instructions. Each instruction specifies:

    * **Program ID** — the on-chain program to execute
    * **Accounts** — all accounts the instruction reads from or writes to
    * **Instruction Data** — the encoded parameters for the instruction

    | Account type | Description |
    | - | - |
    | Signer | Must sign the transaction |
    | Writable | Will be modified by the instruction |
    | Read-only | Only read from, not modified |
  </Tab>
</Tabs>

***

## What to read next

<CardGroup cols={2}>
  <Card title="Examples" icon="code" href="/custom-stablecoins/conversions/stableswapper-contract/examples">
    Code samples for common swap scenarios
  </Card>

  <Card title="Quickstart" icon="rocket" href="/custom-stablecoins/conversions/stableswapper-contract/quickstart">
    Get up and running in 10 minutes
  </Card>

  <Card title="Key Addresses" icon="location-dot" href="/custom-stablecoins/conversions/stableswapper-contract/key-addresses">
    Program IDs and deployed addresses
  </Card>

  <Card title="Production Readiness" icon="shield-check" href="/custom-stablecoins/conversions/stableswapper-contract/production-readiness">
    Helper functions and best practices
  </Card>
</CardGroup>
