> Coinbase CDP docs — **stablecoins** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Stablecoin Reference

Technical reference for the custom stablecoin. The source code is available on GitHub at [coinbase/custom-stablecoin](https://github.com/coinbase/custom-stablecoin).

For code examples and common workflows, see [Quickstart](/custom-stablecoins/stablecoin-contract/quickstart) and [Examples](/custom-stablecoins/stablecoin-contract/examples).

***

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    ## Overview

    Each custom stablecoin is an ERC-20 token that extends the standard with additional capabilities:

    | Standard | Description |
    | - | - |
    | ERC-20 | Fungible token interface |
    | ERC-2612 | Permit — gasless approvals via EIP-712 signatures |
    | ERC-3009 | Transfer with authorization — meta-transaction transfers |
    | ERC-7572 | Contract-level metadata URI |
    | ERC-165 | Interface detection |

    Your stablecoin's contract address is provided during onboarding. See [Key Addresses](/custom-stablecoins/conversions/stableswapper-contract/key-addresses) for the testnet CBTUSD address.

    <Note>
      Coinbase may update the stablecoin implementation over time. Your contract address does not change on update, and the public interface described below remains stable.
    </Note>

    ***

    ## ERC-20 functions

    ### `transfer`

    ```solidity theme={null}
    function transfer(address to, uint256 amount) external returns (bool)
    ```

    Transfers `amount` tokens from the caller to `to`.

    **Failure scenarios:**

    | Condition | Error |
    | - | - |
    | `msg.sender` or `to` is blocklisted | `AddressBlocklisted(account)` |
    | Transfers are paused | `EnforcedPause()` |
    | Caller has insufficient balance | `ERC20InsufficientBalance` |

    ### `transferFrom`

    ```solidity theme={null}
    function transferFrom(address from, address to, uint256 amount) external returns (bool)
    ```

    Transfers `amount` tokens from `from` to `to`, deducting from the caller's allowance.

    **Failure scenarios:**

    | Condition | Error |
    | - | - |
    | `msg.sender`, `from`, or `to` is blocklisted | `AddressBlocklisted(account)` |
    | Transfers are paused | `EnforcedPause()` |
    | Caller's allowance is insufficient | `ERC20InsufficientAllowance` |
    | `from` has insufficient balance | `ERC20InsufficientBalance` |

    ### `approve`

    ```solidity theme={null}
    function approve(address spender, uint256 amount) external returns (bool)
    ```

    Sets the caller's allowance for `spender` to `amount`.

    **Failure scenarios:**

    | Condition | Error |
    | - | - |
    | `msg.sender` or `spender` is blocklisted | `AddressBlocklisted(account)` |

    ### `balanceOf`

    ```solidity theme={null}
    function balanceOf(address account) external view returns (uint256)
    ```

    Returns the token balance of `account`.

    ### `totalSupply`

    ```solidity theme={null}
    function totalSupply() external view returns (uint256)
    ```

    Returns the total token supply currently in circulation.

    ### `allowance`

    ```solidity theme={null}
    function allowance(address owner, address spender) external view returns (uint256)
    ```

    Returns the remaining number of tokens `spender` is allowed to transfer on behalf of `owner`.

    ### `decimals`

    ```solidity theme={null}
    function decimals() public view returns (uint8)
    ```

    Returns the number of decimal places used for token amounts (between 6 and 18, set at deployment).

    ### `name`

    ```solidity theme={null}
    function name() public view returns (string)
    ```

    Returns the token name (set at deployment).

    ### `symbol`

    ```solidity theme={null}
    function symbol() public view returns (string)
    ```

    Returns the token symbol (set at deployment).

    ***

    ## Memo functions

    These functions attach a 32-byte `memo` to a transfer. The `Memo` event is emitted immediately after the ERC-20 `Transfer` event. Memos are useful for correlating on-chain transactions with off-chain order IDs, payment references, or other business records.

    <Warning>
      Memo values are permanently visible on the public blockchain. Do not include sensitive information such as customer names, account numbers, or PII. If you need to attach sensitive data, encrypt it off-chain before encoding it as bytes32 and decrypt it off-chain when reading the event. Use only non-sensitive references (such as a hashed or opaque order ID) as the on-chain memo value.
    </Warning>

    ### `transferWithMemo`

    ```solidity theme={null}
    function transferWithMemo(address to, uint256 amount, bytes32 memo) external
    ```

    Transfers `amount` from the caller to `to` with a memo.

    ### `transferFromWithMemo`

    ```solidity theme={null}
    function transferFromWithMemo(address from, address to, uint256 amount, bytes32 memo) external
    ```

    Transfers `amount` from `from` to `to` with a memo, deducting from the caller's allowance.

    ***

    ## ERC-2612 Permit

    Permit allows a token holder to authorize a spender using an off-chain EIP-712 signature, so the spender can pull tokens without the holder sending a prior approval transaction.

    ### `permit`

    ```solidity theme={null}
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external
    ```

    Sets `spender`'s allowance for `owner` to `value`, validated by an EIP-712 signature signed by `owner`.

    **Failure scenarios:**

    | Condition | Error |
    | - | - |
    | Signature is invalid or does not match `owner` | `ERC2612InvalidSigner` |
    | `block.timestamp > deadline` | `ERC2612ExpiredSignature` |
    | Nonce does not match `nonces(owner)` | `ERC2612InvalidSigner` |

    ### `nonces`

    ```solidity theme={null}
    function nonces(address owner) external view returns (uint256)
    ```

    Returns the current ERC-2612 nonce for `owner`. This is a sequential counter — increment after each `permit` call.

    ### `DOMAIN_SEPARATOR`

    ```solidity theme={null}
    function DOMAIN_SEPARATOR() external view returns (bytes32)
    ```

    Returns the EIP-712 domain separator for this contract. Most signing libraries compute this automatically from `name()`, `"1"` (version), `chainId`, and the contract address — you rarely need to call this directly.

    ***

    ## ERC-3009 Transfer with authorization

    ERC-3009 meta-transactions let a token holder sign a time-bounded transfer authorization. Any party can submit the transaction on-chain. Nonces are random 32-byte values (not sequential) to support multiple concurrent authorizations.

    **ERC-3009 vs ERC-2612 Permit — when to use each:**

    | | ERC-2612 Permit | ERC-3009 |
    | - | - | - |
    | **What it authorizes** | Approval (spending allowance) | A specific transfer |
    | **Who submits** | Anyone | Anyone (`transferWithAuthorization`) or recipient only (`receiveWithAuthorization`) |
    | **Nonce type** | Sequential — one active at a time | Random — multiple concurrent authorizations supported |
    | **Use case** | Gasless `approve` before a `transferFrom` | Gasless direct transfer, pay-for-me flows |
    | **Front-running risk** | Low | Use `receiveWithAuthorization` when front-running is a concern |

    ### `transferWithAuthorization`

    ```solidity theme={null}
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external
    ```

    Executes a transfer from `from` to `to` validated by a signed authorization. The authorization must be signed by `from`. Anyone may submit the transaction.

    | Parameter | Description |
    | - | - |
    | `from` | Payer — must sign the authorization |
    | `to` | Recipient |
    | `value` | Amount to transfer |
    | `validAfter` | Earliest unix timestamp at which the authorization is valid (exclusive) |
    | `validBefore` | Latest unix timestamp at which the authorization is valid (exclusive) |
    | `nonce` | Random 32-byte nonce — must not have been used or canceled |
    | `v`, `r`, `s` | ECDSA signature components |

    **Failure scenarios:**

    | Condition | Error |
    | - | - |
    | `block.timestamp <= validAfter` | `AuthorizationNotYetValid(validAfter)` |
    | `block.timestamp >= validBefore` | `AuthorizationExpired(validBefore)` |
    | Nonce already used or canceled | `AuthorizationAlreadyUsed(authorizer, nonce)` |
    | Signature does not match `from` | `InvalidAuthorization()` |
    | `from`, `to`, or `msg.sender` is blocklisted | `AddressBlocklisted(account)` |
    | Transfers are paused | `EnforcedPause()` |

    ### `receiveWithAuthorization`

    Same parameters as `transferWithAuthorization`, but `msg.sender` must equal `to`. This prevents front-running by restricting submission to the intended recipient.

    ```solidity theme={null}
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external
    ```

    ### `cancelAuthorization`

    ```solidity theme={null}
    function cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external
    ```

    Voids an unused authorization nonce. The `authorizer` must sign a `CancelAuthorization` message. Once canceled, the nonce cannot be used for a transfer.

    ### `authorizationState`

    ```solidity theme={null}
    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool)
    ```

    Returns `true` if the authorization nonce has been used or canceled.

    ***

    ## View functions

    ### `isBlocklisted`

    ```solidity theme={null}
    function isBlocklisted(address account) external view returns (bool)
    ```

    Returns `true` if `account` is on the blocklist. Blocklisted addresses cannot be the sender, recipient, or `msg.sender` of any transfer or approval.

    ### `contractURI`

    ```solidity theme={null}
    function contractURI() external view returns (string)
    ```

    Returns the contract-level metadata URI (ERC-7572). The URI typically points to a JSON file containing the token's name, symbol, and image.

    ### `supportsInterface`

    ```solidity theme={null}
    function supportsInterface(bytes4 interfaceId) external view returns (bool)
    ```

    Returns `true` for ERC-20 (`0x36372b07`), ERC-2612 (`0x9d8ff7da`), and all inherited interfaces.

    ***

    ## Safety controls

    Custom stablecoins include two safety mechanisms managed by Coinbase. These are transparent on-chain — your integration should handle them gracefully.

    ### Blocklist

    Specific addresses can be blocked from sending or receiving tokens. Any transfer involving a blocklisted address will revert with `AddressBlocklisted(account)`. You can check blocklist status before sending with `isBlocklisted(address)`.

    ### Pause

    All token transfers can be paused in an emergency. Any transfer attempted while paused will revert with `EnforcedPause()`. Monitor the `Paused` and `Unpaused` events to detect state changes.

    ***

    ## Events

    | Event signature | Emitted when |
    | - | - |
    | `Transfer(address indexed from, address indexed to, uint256 amount)` | Tokens are transferred, minted (`from = 0x0`), or burned (`to = 0x0`) |
    | `Approval(address indexed owner, address indexed spender, uint256 amount)` | An allowance is set |
    | `Minted(address indexed minter, address indexed to, uint256 amount)` | Tokens are minted by Coinbase |
    | `Burned(address indexed burner, uint256 amount)` | Tokens are burned by Coinbase |
    | `Memo(bytes32 indexed memo)` | A memo-bearing transfer is performed |
    | `AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)` | An ERC-3009 authorization is consumed |
    | `AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce)` | An ERC-3009 authorization is canceled |
    | `BlocklistStatusUpdated(address indexed account, bool blocklisted)` | An address is added to or removed from the blocklist |
    | `Paused(address account)` | All transfers are paused |
    | `Unpaused(address account)` | Transfers are resumed |

    ***

    ## Errors

    | Error | Description |
    | - | - |
    | `AddressBlocklisted(address account)` | A blocklisted address attempted a transfer or approval |
    | `EnforcedPause()` | Operation attempted while transfers are paused |
    | `ERC20InsufficientBalance` | Caller has insufficient balance for the transfer |
    | `ERC20InsufficientAllowance` | Caller's allowance is insufficient for `transferFrom` |
    | `ERC2612InvalidSigner` | Permit signature is invalid or nonce does not match |
    | `ERC2612ExpiredSignature` | Permit deadline has passed |
    | `AuthorizationAlreadyUsed(address authorizer, bytes32 nonce)` | ERC-3009 nonce has already been consumed or canceled |
    | `AuthorizationNotYetValid(uint256 validAfter)` | ERC-3009 authorization submitted before `validAfter` |
    | `AuthorizationExpired(uint256 validBefore)` | ERC-3009 authorization submitted after `validBefore` |
    | `CallerMustBePayee(address caller, address payee)` | `receiveWithAuthorization` caller is not the `to` address |
    | `InvalidAuthorization()` | ERC-3009 signature is invalid for the given authorizer |
  </Tab>

  <Tab title="Solana Virtual Machine">
    ## Overview

    Custom stablecoins on Solana are standard **SPL tokens** (not Token-2022). You interact with them using the standard `@solana/spl-token` library — no custom program or IDL is required.

    Your stablecoin's mint address is provided during onboarding. See [Key Addresses](/custom-stablecoins/conversions/stableswapper-contract/key-addresses) for the testnet CBTUSD mint.

    The **mint authority** and **freeze authority** for every custom stablecoin are held by Coinbase. The freeze authority allows specific token accounts to be frozen — parallel to the blocklist on EVM. Check the `isFrozen` field on a token account before transferring; frozen accounts will cause transfers to fail.

    ***

    ## Key accounts

    | Account | Description |
    | - | - |
    | **Mint** | The on-chain record for the stablecoin — stores decimals, total supply, and authorities |
    | **Associated Token Account (ATA)** | A wallet's balance account for a given mint, derived deterministically |

    ### Deriving an ATA address

    ```typescript theme={null}
    import { getAssociatedTokenAddress } from "@solana/spl-token";
    import { PublicKey } from "@solana/web3.js";

    const ataAddress = await getAssociatedTokenAddress(
      mintAddress,      // PublicKey of the stablecoin mint
      walletAddress     // PublicKey of the wallet
    );
    ```

    The ATA address is fully deterministic. You do not need to store it — derive it at runtime.

    ***

    ## SPL Token instructions

    These are the standard SPL Token instructions available for custom stablecoins. All require the SPL Token Program (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`).

    ### Transfer

    Moves tokens from one token account to another.

    | Account | Description |
    | - | - |
    | `source` | Source token account (writable) |
    | `destination` | Destination token account (writable) |
    | `authority` | Owner of the source account (signer) |

    ```typescript theme={null}
    import { createTransferInstruction } from "@solana/spl-token";

    const ix = createTransferInstruction(
      sourceAta,          // source token account
      destinationAta,     // destination token account
      ownerPublicKey,     // owner of source
      amount              // amount in base units (BigInt)
    );
    ```

    ### Create associated token account

    Creates an ATA for a given wallet and mint. Required before transferring to a wallet that has never held the stablecoin.

    | Account | Description |
    | - | - |
    | `payer` | Pays the rent for the new account (signer, writable) |
    | `associatedToken` | ATA address to create (writable) |
    | `owner` | Wallet that will own the ATA |
    | `mint` | Stablecoin mint |

    ```typescript theme={null}
    import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } from "@solana/spl-token";

    const ataAddress = await getAssociatedTokenAddress(mintAddress, ownerPublicKey);
    const ix = createAssociatedTokenAccountInstruction(
      payerPublicKey,   // fee payer
      ataAddress,       // ATA to create
      ownerPublicKey,   // ATA owner
      mintAddress       // mint
    );
    ```

    ### Get or create associated token account

    A convenience function that checks whether an ATA exists and creates it if not, in a single call:

    ```typescript theme={null}
    import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";

    const account = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,          // Keypair — signs and pays if account needs creating
      mintAddress,
      ownerPublicKey
    );
    ```

    ***

    ## Mint data

    Fetched from the stablecoin's mint account using `getMint`:

    | Field | Type | Description |
    | - | - | - |
    | `address` | `PublicKey` | The mint address |
    | `supply` | `bigint` | Total supply in base units |
    | `decimals` | `number` | Number of decimal places |
    | `isInitialized` | `boolean` | Whether the mint has been initialized |

    ```typescript theme={null}
    import { getMint } from "@solana/spl-token";

    const mintInfo = await getMint(connection, mintAddress);
    ```

    ## Token account data

    Fetched from a specific ATA using `getAccount`:

    | Field | Type | Description |
    | - | - | - |
    | `address` | `PublicKey` | The token account address |
    | `mint` | `PublicKey` | The associated mint |
    | `owner` | `PublicKey` | The wallet that owns this account |
    | `amount` | `bigint` | Token balance in base units |
    | `isFrozen` | `boolean` | Whether the account is frozen |

    ```typescript theme={null}
    import { getAccount } from "@solana/spl-token";

    const accountInfo = await getAccount(connection, ataAddress);
    ```

    ***

    ## Program addresses

    | Program | Address |
    | - | - |
    | SPL Token Program | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` |
    | Associated Token Program | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` |
    | System Program | `11111111111111111111111111111111` |
  </Tab>
</Tabs>

***

## What to read next

<CardGroup cols={2}>
  <Card title="Quickstart" icon="rocket" href="/custom-stablecoins/stablecoin-contract/quickstart">
    Get up and running in 10 minutes
  </Card>

  <Card title="Examples" icon="code" href="/custom-stablecoins/stablecoin-contract/examples">
    Code samples for transfers, permit, and ERC-3009
  </Card>

  <Card title="Key Addresses" icon="location-dot" href="/custom-stablecoins/conversions/stableswapper-contract/key-addresses">
    Contract and mint addresses
  </Card>

  <Card title="Overview" icon="info" href="/custom-stablecoins/overview">
    Learn about Custom Stablecoins
  </Card>
</CardGroup>
