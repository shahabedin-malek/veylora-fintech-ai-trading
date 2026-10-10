> Coinbase CDP docs — **stablecoins** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Key Addresses

This page lists all deployed addresses for the Stableswapper program. Reference these when constructing transactions or integrating with the contract.

<Warning>
  These docs currently show **devnet/testnet addresses only**. Do not use these addresses on mainnet. Mainnet addresses will be provided during your production onboarding.
</Warning>

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    ## Contract

    | Network | Contract Address |
    | - | - |
    | Base Sepolia | `0x57AB1E2c6289aCe985Bd5c5571EbF6d98CD41Ab7` |

    ## Token Addresses

    | Network | Token | Address |
    | - | - | - |
    | Base Sepolia | USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
    | Base Sepolia | CBTUSD | `0x57AB1EFE59b1C7b36b1Dc9315B4782bCcBb83721` |

    <Note>
      CBTUSD is a testnet custom stablecoin on Base Sepolia, used as the example token throughout this documentation.
      Your custom stablecoin address will be provided separately during onboarding.
    </Note>
  </Tab>

  <Tab title="Solana Virtual Machine">
    ## Program

    | Network | Program ID |
    | - | - |
    | Solana Devnet | `9vDwZVJXw5nxymWmUcgmNpemDH5EBcJwLNhtsznrgJDH` |

    ## Token Mints

    | Network | Token | Mint Address |
    | - | - | - |
    | Solana Devnet | USDC | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
    | Solana Devnet | CBTUSD | `5P6MkoaCd9byPxH4X99kgKtS6SiuCQ67ZPCJzpXGkpCe` |

    <Note>
      CBTUSD is a testnet custom stablecoin, used as the example token throughout this documentation.
      Your custom stablecoin mint address will be provided separately during onboarding.
    </Note>

    ## Program Derived Addresses (PDAs)

    These accounts are deterministically derived from the program ID using the seeds shown. You do not need to store them — derive them at runtime using `PublicKey.findProgramAddressSync`.

    | Account | Address | Seeds | Role |
    | - | - | - | - |
    | Pool | `68xwTJYRyUdULbb5ve4JMWTc2xvw9wQmtEj9GRoHSenF` | `["liquidity_pool"]` | Central pool state — holds fee rate, fee recipient, and supported vault list |

    Token vaults and vault token accounts are derived per-mint at runtime:

    ```typescript theme={null}
    // Vault PDA (logical owner for a token's reserves)
    const [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_vault"), pool.toBuffer(), mintAddress.toBuffer()],
      programId
    );

    // Vault Token Account (where reserves actually live)
    const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_token_account"), vault.toBuffer()],
      programId
    );
    ```

    ## Constant Program Addresses

    These well-known Solana program addresses are required as accounts in every swap instruction.

    | Program | Address |
    | - | - |
    | SPL Token Program | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` |
    | Associated Token Program | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` |
    | System Program | `11111111111111111111111111111111` |
  </Tab>
</Tabs>

<Warning>
  **Privacy notice:** All transactions on devnet and testnet blockchains are publicly visible. To protect your privacy during testing, we recommend using a dedicated test wallet rather than a personal wallet, as your wallet address and transaction history may be viewable by anyone on the blockchain.
</Warning>
