> Coinbase CDP docs — **security** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# EVM Policies

EVM policy examples for controlling transaction signing, sending, message signing, and typed data signing.

<Tabs>
  <Tab title="User Authentication">
    Operations: `signEndUserEvmTransaction`, `sendEndUserEvmTransaction`, `signEndUserEvmMessage`, `signEndUserEvmTypedData`, `sendEndUserEvmAsset`, `createEndUserEvmSwap`, `sendEndUserOperation`, `signEndUserEvmHash`

    ### Allowlist

    ```json theme={null}
    {
      "scope": "project",
      "description": "Allow end-user signing only to approved addresses",
      "rules": [
        {
          "action": "accept",
          "operation": "signEndUserEvmTransaction",
          "criteria": [
            {
              "type": "evmAddress",
              "addresses": ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "0x000000000000000000000000000000000000dEaD"],
              "operator": "in"
            }
          ]
        }
      ]
    }
    ```

    ### Denylist

    ```json theme={null}
    {
      "scope": "project",
      "description": "Block end-user signing to known risky addresses",
      "rules": [
        {
          "action": "accept",
          "operation": "signEndUserEvmTransaction",
          "criteria": [
            {
              "type": "evmAddress",
              "addresses": ["0xffffffffffffffffffffffffffffffffffffffff"],
              "operator": "not in"
            }
          ]
        }
      ]
    }
    ```

    ### Transaction value limit

    ```json theme={null}
    {
      "scope": "project",
      "description": "Limit end-user transactions to 1 ETH",
      "rules": [
        {
          "action": "accept",
          "operation": "signEndUserEvmTransaction",
          "criteria": [
            {
              "type": "ethValue",
              "ethValue": "1000000000000000000",
              "operator": "<="
            }
          ]
        }
      ]
    }
    ```

    ### USD spend limit

    <Note>The `netUSDChange` criterion is only evaluated for mainnet transactions.</Note>

    ```json theme={null}
    {
      "scope": "project",
      "description": "Limit end-user transactions to $100 USD",
      "rules": [
        {
          "action": "accept",
          "operation": "signEndUserEvmTransaction",
          "criteria": [{ "type": "netUSDChange", "changeCents": 10000, "operator": "<=" }]
        },
        {
          "action": "accept",
          "operation": "sendEndUserEvmTransaction",
          "criteria": [{ "type": "netUSDChange", "changeCents": 10000, "operator": "<=" }]
        }
      ]
    }
    ```

    ### Network restriction

    ```json theme={null}
    {
      "scope": "project",
      "description": "Restrict end-user sends to Base and Ethereum only",
      "rules": [
        {
          "action": "accept",
          "operation": "sendEndUserEvmTransaction",
          "criteria": [
            {
              "type": "evmNetwork",
              "networks": ["base", "ethereum"],
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
          "operation": "signEndUserEvmMessage",
          "criteria": [{ "type": "evmMessage", "match": "^MyApp:.*" }]
        }
      ]
    }
    ```

    ### Typed data — restrict verifying contract

    ```json theme={null}
    {
      "scope": "project",
      "description": "Only allow typed data signing for approved contracts",
      "rules": [
        {
          "action": "accept",
          "operation": "signEndUserEvmTypedData",
          "criteria": [
            {
              "type": "evmTypedDataVerifyingContract",
              "addresses": ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"],
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
      "description": "Restrict end-user asset sends to Base only",
      "rules": [
        {
          "action": "accept",
          "operation": "sendEndUserEvmAsset",
          "criteria": [
            {
              "type": "evmNetwork",
              "networks": ["base"],
              "operator": "in"
            }
          ]
        }
      ]
    }
    ```

    ### Asset send — USD limit

    <Note>The `netUSDChange` criterion is only evaluated for mainnet transactions.</Note>

    ```json theme={null}
    {
      "scope": "project",
      "description": "Limit end-user asset sends to $50 USD",
      "rules": [
        {
          "action": "accept",
          "operation": "sendEndUserEvmAsset",
          "criteria": [{ "type": "netUSDChange", "changeCents": 5000, "operator": "<=" }]
        }
      ]
    }
    ```

    ### Swap — network restriction

    ```json theme={null}
    {
      "scope": "project",
      "description": "Restrict end-user swaps to Base and Ethereum",
      "rules": [
        {
          "action": "accept",
          "operation": "createEndUserEvmSwap",
          "criteria": [
            {
              "type": "evmNetwork",
              "networks": ["base", "ethereum"],
              "operator": "in"
            }
          ]
        }
      ]
    }
    ```

    ### Swap — USD limit

    <Note>The `netUSDChange` criterion is only evaluated for mainnet transactions.</Note>

    ```json theme={null}
    {
      "scope": "project",
      "description": "Limit end-user swaps to $100 USD",
      "rules": [
        {
          "action": "accept",
          "operation": "createEndUserEvmSwap",
          "criteria": [{ "type": "netUSDChange", "changeCents": 10000, "operator": "<=" }]
        }
      ]
    }
    ```

    ### User operation — allowlist

    ```json theme={null}
    {
      "scope": "project",
      "description": "Restrict end-user ops to known contracts",
      "rules": [
        {
          "action": "accept",
          "operation": "sendEndUserOperation",
          "criteria": [{ "type": "evmAddress", "addresses": ["0xABC..."], "operator": "in" }]
        }
      ]
    }
    ```

    ### User operation — network restriction

    ```json theme={null}
    {
      "scope": "project",
      "description": "Limit end-user ops to Base",
      "rules": [
        {
          "action": "accept",
          "operation": "sendEndUserOperation",
          "criteria": [{ "type": "evmNetwork", "networkIds": ["base-mainnet"], "operator": "in" }]
        }
      ]
    }
    ```

    ### User operation — USD limit

    <Note>The `netUSDChange` criterion is only evaluated for mainnet transactions.</Note>

    ```json theme={null}
    {
      "scope": "project",
      "description": "Limit end-user ops to 50 USD",
      "rules": [
        {
          "action": "accept",
          "operation": "sendEndUserOperation",
          "criteria": [{ "type": "netUSDChange", "changeCents": 5000, "operator": "<=" }]
        }
      ]
    }
    ```

    ### Hash signing — reject all

    The `signEndUserEvmHash` operation does not support criteria. Rules accept or reject all hash signing attempts.

    ```json theme={null}
    {
      "scope": "project",
      "description": "Reject all end-user hash signing",
      "rules": [
        {
          "action": "reject",
          "operation": "signEndUserEvmHash"
        }
      ]
    }
    ```

    ### Hash signing — accept all

    ```json theme={null}
    {
      "scope": "project",
      "description": "Accept all end-user hash signing",
      "rules": [
        {
          "action": "accept",
          "operation": "signEndUserEvmHash"
        }
      ]
    }
    ```
  </Tab>

  <Tab title="API Key Authentication">
    Operations: `signEvmTransaction`, `sendEvmTransaction`, `signEvmMessage`, `signEvmTypedData`, `signEvmHash`, `prepareUserOperation`, `sendUserOperation`

    ### Allowlist

    ```json theme={null}
    {
      "description": "Allowlist policy example",
      "scope": "project",
      "rules": [
        {
          "action": "accept",
          "operation": "signEvmTransaction",
          "criteria": [
            {
              "type": "evmAddress",
              "addresses": ["0xffffffffffffffffffffffffffffffffffffffff", "0x1111111111111111111111111111111111111111"],
              "operator": "in"
            }
          ]
        }
      ]
    }
    ```

    ### Denylist

    ```json theme={null}
    {
      "description": "Denylist policy example",
      "scope": "project",
      "rules": [
        {
          "action": "accept",
          "operation": "signEvmTransaction",
          "criteria": [
            {
              "type": "evmAddress",
              "addresses": ["0xffffffffffffffffffffffffffffffffffffffff", "0x1111111111111111111111111111111111111111"],
              "operator": "not in"
            }
          ]
        }
      ]
    }
    ```

    ### Transaction value limit

    ```json theme={null}
    {
      "description": "Limit transactions to 2 ETH",
      "scope": "project",
      "rules": [
        {
          "action": "accept",
          "operation": "signEvmTransaction",
          "criteria": [
            {
              "type": "ethValue",
              "ethValue": "2000000000000000000",
              "operator": "<="
            }
          ]
        }
      ]
    }
    ```

    ### Network restriction

    ```json theme={null}
    {
      "description": "Restrict sends to Base only",
      "scope": "project",
      "rules": [
        {
          "action": "accept",
          "operation": "sendEvmTransaction",
          "criteria": [
            {
              "type": "evmNetwork",
              "networks": ["base"],
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
      "description": "Only allow signing messages with app prefix",
      "scope": "project",
      "rules": [
        {
          "action": "accept",
          "operation": "signEvmMessage",
          "criteria": [{ "type": "evmMessage", "match": "^MyApp:.*" }]
        }
      ]
    }
    ```
  </Tab>
</Tabs>
