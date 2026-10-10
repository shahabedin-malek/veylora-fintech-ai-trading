> Coinbase CDP docs — **security** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Solana Policies

Solana policy examples for controlling transaction signing, sending, and message signing.

<Tabs>
  <Tab title="User Authentication">
    Operations: `signEndUserSolTransaction`, `sendEndUserSolTransaction`, `signEndUserSolMessage`, `sendEndUserSolAsset`

    ### Address allowlist

    ```json theme={null}
    {
      "scope": "project",
      "description": "Allow end-user SOL transfers only to trusted addresses",
      "rules": [
        {
          "action": "accept",
          "operation": "signEndUserSolTransaction",
          "criteria": [
            {
              "type": "solAddress",
              "addresses": ["9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", "HpabPRRCFbBKSuJr5PdkVvQc85FyxyTWkFM2obBRSvHT"],
              "operator": "in"
            }
          ]
        }
      ]
    }
    ```

    ### SOL value limit

    ```json theme={null}
    {
      "scope": "project",
      "description": "Limit end-user SOL transfers to 2 SOL",
      "rules": [
        {
          "action": "accept",
          "operation": "signEndUserSolTransaction",
          "criteria": [
            { "type": "solValue", "solValue": "2000000000", "operator": "<=" }
          ]
        }
      ]
    }
    ```

    ### SPL token mint restriction

    ```json theme={null}
    {
      "scope": "project",
      "description": "Allow only USDC and USDT transfers",
      "rules": [
        {
          "action": "accept",
          "operation": "signEndUserSolTransaction",
          "criteria": [
            {
              "type": "mintAddress",
              "addresses": ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"],
              "operator": "in"
            }
          ]
        }
      ]
    }
    ```

    ### Network restriction

    ```json theme={null}
    {
      "scope": "project",
      "description": "Restrict end-user Solana sends to mainnet only",
      "rules": [
        {
          "action": "accept",
          "operation": "sendEndUserSolTransaction",
          "criteria": [
            { "type": "solNetwork", "networks": ["solana"], "operator": "in" }
          ]
        }
      ]
    }
    ```

    ### Program allowlist

    ```json theme={null}
    {
      "scope": "project",
      "description": "Allow interactions with System and Token programs only",
      "rules": [
        {
          "action": "accept",
          "operation": "signEndUserSolTransaction",
          "criteria": [
            {
              "type": "programId",
              "programIds": ["11111111111111111111111111111111", "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
              "operator": "in"
            }
          ]
        }
      ]
    }
    ```

    ### Message signing restriction

    ```json theme={null}
    {
      "scope": "project",
      "description": "Only allow signing messages with app prefix",
      "rules": [
        {
          "action": "accept",
          "operation": "signEndUserSolMessage",
          "criteria": [{ "type": "solMessage", "match": "^MyApp:.*" }]
        }
      ]
    }
    ```

    ### Asset send — SPL address allowlist

    ```json theme={null}
    {
      "scope": "project",
      "description": "Allow end-user asset sends only to trusted addresses",
      "rules": [
        {
          "action": "accept",
          "operation": "sendEndUserSolAsset",
          "criteria": [
            {
              "type": "splAddress",
              "addresses": ["9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"],
              "operator": "in"
            }
          ]
        }
      ]
    }
    ```

    ### Asset send — network restriction

    ```json theme={null}
    {
      "scope": "project",
      "description": "Restrict end-user asset sends to mainnet only",
      "rules": [
        {
          "action": "accept",
          "operation": "sendEndUserSolAsset",
          "criteria": [
            { "type": "solNetwork", "networks": ["solana"], "operator": "in" }
          ]
        }
      ]
    }
    ```
  </Tab>

  <Tab title="API Key Authentication">
    Operations: `signSolTransaction`, `sendSolTransaction`, `signSolMessage`

    ### Address allowlist

    ```json theme={null}
    {
      "description": "Allow SOL transfers only to safe addresses",
      "scope": "account",
      "rules": [
        {
          "action": "accept",
          "operation": "signSolTransaction",
          "criteria": [
            {
              "type": "solAddress",
              "addresses": ["11111111111111111111111111111112", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"],
              "operator": "in"
            }
          ]
        }
      ]
    }
    ```

    ### SOL value limit

    ```json theme={null}
    {
      "description": "Block SOL transfers exceeding 1 SOL",
      "scope": "project",
      "rules": [
        {
          "action": "accept",
          "operation": "signSolTransaction",
          "criteria": [
            { "type": "solValue", "solValue": "1000000000", "operator": "<=" }
          ]
        }
      ]
    }
    ```

    ### SPL token mint restriction

    ```json theme={null}
    {
      "description": "Allow only USDC transfers",
      "scope": "project",
      "rules": [
        {
          "action": "accept",
          "operation": "signSolTransaction",
          "criteria": [
            {
              "type": "mintAddress",
              "addresses": ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"],
              "operator": "in"
            }
          ]
        }
      ]
    }
    ```

    ### Network restriction

    ```json theme={null}
    {
      "description": "Restrict sends to mainnet only",
      "scope": "project",
      "rules": [
        {
          "action": "accept",
          "operation": "sendSolTransaction",
          "criteria": [
            { "type": "solNetwork", "networks": ["solana"], "operator": "in" }
          ]
        }
      ]
    }
    ```

    ### Message signing restriction

    ```json theme={null}
    {
      "description": "Only allow signing messages with app prefix",
      "scope": "project",
      "rules": [
        {
          "action": "accept",
          "operation": "signSolMessage",
          "criteria": [{ "type": "solMessage", "match": "^MyApp:.*" }]
        }
      ]
    }
    ```
  </Tab>
</Tabs>

## Token decimals reference

* **SOL**: 9 decimals (1 SOL = 1,000,000,000 lamports)
* **USDC**: 6 decimals (1 USDC = 1,000,000 base units)
* **USDT**: 6 decimals (1 USDT = 1,000,000 base units)

## Common addresses

| Token | Mint address |
| - | - |
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| Wrapped SOL | `So11111111111111111111111111111111111111112` |
| System Program | `11111111111111111111111111111111` |
| Token Program | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` |
