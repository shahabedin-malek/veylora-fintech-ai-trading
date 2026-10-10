> Coinbase CDP docs — **security** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Policy Engine

> Define rules that accept or reject wallet signing operations based on transaction parameters like destination and value.

Policies let you govern wallet behavior by defining rules that accept or reject operations based on transaction parameters like destination address, value, and network.

## Policy fields

| Field | Description | Valid values |
| - | - | - |
| `scope` | Level at which the policy applies | `project` or `account` (API key auth only) |
| `rules` | List of rules | Array of rules |
| `action` | What to do when criteria match | `accept` or `reject` |
| `operation` | The wallet operation being governed | See [Supported operations](#supported-operations) |
| `criteria` | Logical expressions evaluated against the operation | Array of criteria |

## Evaluation

Within a policy, any matching `reject` rule for an operation rejects the request, even if an `accept` rule also matches. Otherwise, any matching `accept` rule accepts it. This precedence does not depend on rule order. Among matching rules with the same action, the first in the policy applies.

For API key auth wallets, the `project`-level policy takes precedence when any of its rules match, so an `account`-level `reject` rule does not override a matching `project`-level `accept` rule. Otherwise, the `account`-level policy is evaluated. If neither policy has a matching rule, the request is rejected when either policy has rules targeting the operation and accepted when neither does.

For example, this policy accepts `signEvmTransaction` requests of up to 1 ETH unless the destination address is on the denylist. A request for 1 ETH or less to the listed address matches both rules and is rejected.

```json theme={null}
{
  "scope": "project",
  "rules": [
    {
      "action": "accept",
      "operation": "signEvmTransaction",
      "criteria": [
        {
          "type": "ethValue",
          "ethValue": "1000000000000000000",
          "operator": "<="
        }
      ]
    },
    {
      "action": "reject",
      "operation": "signEvmTransaction",
      "criteria": [
        {
          "type": "evmAddress",
          "addresses": ["0x000000000000000000000000000000000000dEaD"],
          "operator": "in"
        }
      ]
    }
  ]
}
```

## API key configuration

To manage policies via SDK or API, your API key must have the **Non-custodial > Manage (modify policies)** scope enabled under **API restrictions > API-specific restrictions**.

## Create a policy

Policies can be created from the CDP Portal or via the SDK.

### CDP Portal

In the Portal, navigate to [Non-custodial Wallet > Security](https://portal.cdp.coinbase.com/wallets/non-custodial/security) and click **Create project policy** to open the JSON editor.

### SDK

<Tabs>
  <Tab title="User Authentication">
    User authentication wallets support **project-scope** policies only.

    <Tabs>
      <Tab title="Node (TypeScript)">
        ```typescript theme={null}
        const policy = await cdp.policies.createPolicy({
          policy: {
            scope: "project",
            description: "Accept EVM txs to allowlisted addresses",
            rules: [
              {
                action: "accept",
                operation: "signEndUserEvmTransaction",
                criteria: [
                  {
                    type: "evmAddress",
                    addresses: ["0x000000000000000000000000000000000000dEaD"],
                    operator: "in",
                  },
                ],
              },
            ],
          },
        });
        console.log("Created policy:", policy.id);
        ```
      </Tab>

      <Tab title="Python">
        ```python theme={null}
        from cdp.policies.types import CreatePolicyOptions, EvmAddressCriterion, SignEndUserEvmTransactionRule

        policy = await cdp.policies.create_policy(
            policy=CreatePolicyOptions(
                scope="project",
                description="Accept EVM txs to allowlisted addresses",
                rules=[
                    SignEndUserEvmTransactionRule(
                        action="accept",
                        criteria=[
                            EvmAddressCriterion(
                                addresses=["0x000000000000000000000000000000000000dEaD"],
                                operator="in",
                            ),
                        ],
                    )
                ],
            )
        )
        print(f"Created policy: {policy.id}")
        ```
      </Tab>
    </Tabs>
  </Tab>

  <Tab title="API Key Authentication">
    API key auth wallets support both **project-scope** and **account-scope** policies.

    <Tabs>
      <Tab title="Node (TypeScript)">
        ```typescript theme={null}
        const account = await cdp.evm.getOrCreateAccount({ name: "PolicyAccount" });

        // Create an account-level policy
        const policy = await cdp.policies.createPolicy({
          policy: {
            scope: "account",
            description: "Account Allowlist Example",
            rules: [
              {
                action: "accept",
                operation: "signEvmTransaction",
                criteria: [
                  {
                    type: "ethValue",
                    ethValue: "1000000000000000000", // 1 ETH in wei
                    operator: "<=",
                  },
                  {
                    type: "evmAddress",
                    addresses: ["0x000000000000000000000000000000000000dEaD"],
                    operator: "in",
                  },
                ],
              },
            ],
          },
        });

        // Apply the policy to the account
        await cdp.evm.updateAccount({
          address: account.address,
          update: { accountPolicy: policy.id },
        });
        console.log("Applied policy:", policy.id);
        ```
      </Tab>

      <Tab title="Python">
        ```python theme={null}
        from cdp.policies.types import CreatePolicyOptions, EthValueCriterion, EvmAddressCriterion, SignEvmTransactionRule
        from cdp.update_account_types import UpdateAccountOptions

        account = await cdp.evm.get_or_create_account(name="PolicyAccount")

        policy = await cdp.policies.create_policy(
            policy=CreatePolicyOptions(
                scope="account",
                description="Account Allowlist Example",
                rules=[
                    SignEvmTransactionRule(
                        action="accept",
                        criteria=[
                            EthValueCriterion(ethValue="1000000000000000000", operator="<="),
                            EvmAddressCriterion(
                                addresses=["0x000000000000000000000000000000000000dEaD"],
                                operator="in",
                            ),
                        ],
                    )
                ],
            )
        )

        await cdp.evm.update_account(
            address=account.address,
            update=UpdateAccountOptions(account_policy=policy.id),
        )
        print(f"Applied policy: {policy.id}")
        ```
      </Tab>
    </Tabs>
  </Tab>
</Tabs>

## Supported operations

### User authentication

| Operation | Description |
| - | - |
| `signEndUserEvmTransaction` | End-user EVM transaction signing |
| `sendEndUserEvmTransaction` | End-user EVM transaction signing and sending |
| `signEndUserEvmMessage` | End-user EIP-191 message signing |
| `signEndUserEvmTypedData` | End-user EIP-712 typed data signing |
| `signEndUserEvmHash` | End-user EVM hash signing (no criteria) |
| `signEndUserSolTransaction` | End-user Solana transaction signing |
| `sendEndUserSolTransaction` | End-user Solana transaction signing and broadcast |
| `signEndUserSolMessage` | End-user Solana message signing |
| `sendEndUserOperation` | End-user smart wallet user operation sending |
| `sendEndUserEvmAsset` | End-user EVM asset send |
| `sendEndUserSolAsset` | End-user Solana asset send |
| `createEndUserEvmSwap` | End-user EVM swap creation |

### API key authentication

| Operation | Description |
| - | - |
| `signEvmTransaction` | EVM transaction signing |
| `sendEvmTransaction` | EVM transaction signing and sending |
| `signEvmMessage` | EIP-191 message signing |
| `signEvmTypedData` | EIP-712 typed data signing |
| `signEvmHash` | Hash signing |
| `prepareUserOperation` | Smart account user operation preparation |
| `sendUserOperation` | Smart account user operation sending |
| `signSolTransaction` | Solana transaction signing |
| `sendSolTransaction` | Solana transaction signing and sending |
| `signSolMessage` | Solana message signing |
