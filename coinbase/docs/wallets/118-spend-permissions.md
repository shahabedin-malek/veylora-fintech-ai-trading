> Coinbase CDP docs — **wallets** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Spend Permissions

Spend Permissions let you designate a trusted spender that can spend tokens on behalf of your Smart Account. After you sign the permission, the spender can initiate token spending within the limits you define. You can define limits based on token, time period, and amount.

Spend Permissions utilize the [Spend Permission Manager contract](https://github.com/coinbase/spend-permissions) deployed on Base and [other networks](#supported-networks).

Some use cases this feature enables:

* **Subscription payments** - Enable recurring payments for SaaS, content subscriptions, or membership fees
* **Agentic payments** - Control your agent's spending limits for autonomous operations
* **Algorithmic trading** - Allow trading bots to execute trades within predefined limits
* **Automated payouts** - Schedule regular distributions or reward payments
* **Allowance management** - Give team members or family controlled access to funds
* **Dollar-cost averaging** - Automate periodic investment purchases

## How it works

There are two parties involved in a Spend Permission:

* **Account** - The smart account that creates the Spend Permission and approves it onchain.
* **Spender** - The entity that can spend tokens on behalf of the account within the limits defined by a Spend Permission. Can be a Smart Account or a regular account.

## Anatomy of a spend permission

* **Spender** - The entity that can spend tokens on behalf of the account.
* **Token** - The token that the Spend Permission is for. Use `"eth"` or `"usdc"` as shortcuts (Base and Base Sepolia only), or provide an ERC-20 contract address for other tokens.
* **Allowance** - The amount of the token the spender is allowed to spend, in the token's smallest unit (e.g. wei for ETH, 6-decimal units for USDC).
* **Time period** - Use `periodInDays` for simple daily/weekly limits, or `period`, `start`, and `end` for advanced rolling windows and fixed time ranges.
* **Salt** - A random value to differentiate between permissions with the same parameters. Generated automatically by the SDK.
* **Extra Data** - Arbitrary data for additional information about the permission.

## Enable spend permissions

### Enable at account creation

<Tabs>
  <Tab title="React">
    Set `enableSpendPermissions: true` in your `CDPHooksProvider` config:

    ```tsx theme={null}
    import { CDPHooksProvider } from "@coinbase/cdp-hooks";

    function App() {
      return (
        <CDPHooksProvider
          config={{
            projectId: "your-project-id",
            ethereum: {
              createOnLogin: "smart",
              enableSpendPermissions: true,
            },
          }}
        >
          <YourApp />
        </CDPHooksProvider>
      );
    }
    ```
  </Tab>

  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    const smartAccount = await cdp.evm.getOrCreateSmartAccount({
      name: "SmartAccount",
      owner: await cdp.evm.getOrCreateAccount({ name: "Owner" }),
      enableSpendPermissions: true,
    });
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    smart_account = await cdp.evm.get_or_create_smart_account(
        name="SmartAccount",
        owner=await cdp.evm.get_or_create_account(name="Owner"),
        enable_spend_permissions=True,
    )
    ```
  </Tab>
</Tabs>

### Enable on an existing account

<Info>
  This is currently only supported for User Wallets.
</Info>

If a Smart Account was created without spend permissions, use `useEnableSpendPermissions` to enable them retroactively.

<Tabs>
  <Tab title="React">
    ```tsx theme={null}
    import { useEnableSpendPermissions } from "@coinbase/cdp-hooks";

    function EnableSpendPermissions() {
      const { enableSpendPermissions, status, data, error } = useEnableSpendPermissions();

      const handleEnable = async () => {
        await enableSpendPermissions({ network: "base-sepolia" });
      };

      return (
        <div>
          <button onClick={handleEnable} disabled={status === "pending"}>
            {status === "pending" ? "Enabling..." : "Enable Spend Permissions"}
          </button>
          {status === "success" && data && <p>Enabled! Tx: {data.transactionHash}</p>}
          {error && <p>Error: {error.message}</p>}
        </div>
      );
    }
    ```

    `evmSmartAccount` is optional. The hook auto-resolves it from the authenticated user's primary smart account. Pass it explicitly only if the user has multiple smart accounts and you need to target a specific one.
  </Tab>
</Tabs>

<Info>
  Before enabling spend permissions on an existing account, make sure the Smart Account:

  * Has completed at least one user operation on the network where you'll enable spend permissions.
  * Holds enough of that network's native token to cover gas, unless the enable operation is sponsored (for example, via a paymaster).
</Info>

## Create a spend permission

<Tabs>
  <Tab title="React">
    Use `useCreateSpendPermission` to create a permission. Creating a permission is a user operation that requires gas — use `useCdpPaymaster: true` on Base or provide a `paymasterUrl`.

    ```tsx theme={null}
    import { useCreateSpendPermission } from "@coinbase/cdp-hooks";
    import { parseUnits } from "viem";

    function CreateSpendPermission() {
      const { createSpendPermission, status, data, error } = useCreateSpendPermission();

      const handleCreate = async () => {
        await createSpendPermission({
          network: "base-sepolia",
          spender: "0x1399BE2B2E4186C209617053822C67173E8DFe5c",
          token: "usdc",
          allowance: parseUnits("10", 6), // 10 USDC
          periodInDays: 7,
          useCdpPaymaster: true,
        });
      };

      return (
        <div>
          <button onClick={handleCreate} disabled={status === "pending"}>
            {status === "pending" ? "Creating..." : "Create Permission"}
          </button>
          {status === "success" && data && <p>Tx: {data.transactionHash}</p>}
          {error && <p>Error: {error.message}</p>}
        </div>
      );
    }
    ```
  </Tab>

  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    import { parseUnits, type SpendPermissionInput } from "@coinbase/cdp-sdk";

    const spendPermission: SpendPermissionInput = {
      account: smartAccount.address,
      spender: spender.address,
      token: "usdc",
      allowance: parseUnits("0.01", 6), // 0.01 USDC per day
      periodInDays: 1,
    };

    const { userOpHash } = await cdp.evm.createSpendPermission({
      network: "base-sepolia",
      spendPermission,
    });

    const result = await smartAccount.waitForUserOperation({ userOpHash });
    console.log("Spend permission created:", result);
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    from cdp import SpendPermission
    from cdp.utils import parse_units

    result = await cdp.evm.create_spend_permission(
        network="base-sepolia",
        spend_permission=SpendPermission(
            account=smart_account.address,
            spender=spender.address,
            token="usdc",
            allowance=parse_units("0.01", 6),  # 0.01 USDC per day
            period_in_days=1,
        ),
    )

    user_operation_result = await cdp.evm.wait_for_user_operation(
        smart_account_address=smart_account.address,
        user_op_hash=result.user_op_hash,
    )
    print(f"Spend permission created: {user_operation_result}")
    ```
  </Tab>
</Tabs>

## Use a spend permission (spender side)

Once a permission is created, the designated spender lists the account's permissions to find theirs, then calls `useSpendPermission` to spend within the defined limits.

<Tabs>
  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    import { parseUnits } from "@coinbase/cdp-sdk";

    const allPermissions = await cdp.evm.listSpendPermissions({
      address: smartAccount.address,
    });

    const permissions = allPermissions.spendPermissions.filter(
      (p) => p.permission.spender.toLowerCase() === spender.address.toLowerCase()
    );

    if (permissions.length === 0) {
      console.log("No spend permissions found for this spender");
      process.exit(1);
    }

    const spend = await spender.useSpendPermission({
      spendPermission: permissions[0].permission,
      value: parseUnits("0.005", 6),
      network: "base-sepolia",
    });

    const receipt = await spender.waitForUserOperation(spend);
    console.log("Spend completed:", receipt);
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    all_permissions = await cdp.evm.list_spend_permissions(
        address=smart_account.address,
    )

    permissions = [
        p for p in all_permissions.spend_permissions
        if p.permission.spender.lower() == spender.address.lower()
    ]

    if not permissions:
        print("No spend permissions found for this spender")
        exit(1)

    spend = await spender.use_spend_permission(
        spend_permission=permissions[0].permission,
        value=parse_units("0.005", 6),
        network="base-sepolia",
    )

    receipt = await spender.wait_for_user_operation(spend)
    print(f"Spend completed: {receipt}")
    ```
  </Tab>
</Tabs>

## List spend permissions

<Tabs>
  <Tab title="React">
    `useListSpendPermissions` automatically lists permissions for the authenticated user's smart account.

    ```tsx theme={null}
    import { useListSpendPermissions } from "@coinbase/cdp-hooks";

    function ListPermissions() {
      const { refetch, data, status, error } = useListSpendPermissions();

      return (
        <div>
          <button onClick={refetch} disabled={status === "pending"}>
            Refresh
          </button>
          {data?.spendPermissions?.map((sp) => (
            <div key={sp.permissionHash}>
              <p>Spender: {sp.permission.spender}</p>
              <p>Token: {sp.permission.token}</p>
              <p>Allowance: {sp.permission.allowance}</p>
              <p>Revoked: {sp.revoked ? "Yes" : "No"}</p>
            </div>
          ))}
          {error && <p>Error: {error.message}</p>}
        </div>
      );
    }
    ```
  </Tab>

  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    // As the account: see all permissions you've granted
    const permissions = await cdp.evm.listSpendPermissions({
      address: smartAccount.address,
    });
    console.log("Permissions granted:", permissions);

    // As the spender: query the account's permissions and filter by your address
    const allPermissions = await cdp.evm.listSpendPermissions({
      address: "0xAccountAddress",
    });
    const myPermissions = allPermissions.spendPermissions.filter(
      (p) => p.permission.spender.toLowerCase() === spender.address.toLowerCase()
    );
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    # As the account: see all permissions you've granted
    permissions = await cdp.evm.list_spend_permissions(
        address=smart_account.address,
    )
    print("Permissions granted:", permissions)

    # As the spender: query the account's permissions and filter by your address
    all_permissions = await cdp.evm.list_spend_permissions(
        address="0xAccountAddress",
    )
    my_permissions = [
        p for p in all_permissions.spend_permissions
        if p.permission.spender.lower() == spender.address.lower()
    ]
    ```
  </Tab>
</Tabs>

## Revoke a spend permission

<Tabs>
  <Tab title="React">
    ```tsx theme={null}
    import { useRevokeSpendPermission } from "@coinbase/cdp-hooks";

    function RevokePermission({ permissionHash }: { permissionHash: string }) {
      const { revokeSpendPermission, status, data, error } = useRevokeSpendPermission();

      const handleRevoke = async () => {
        await revokeSpendPermission({
          network: "base-sepolia",
          permissionHash,
          useCdpPaymaster: true,
        });
      };

      return (
        <div>
          <button onClick={handleRevoke} disabled={status === "pending"}>
            {status === "pending" ? "Revoking..." : "Revoke"}
          </button>
          {status === "success" && data && <p>Revoked. Tx: {data.transactionHash}</p>}
          {error && <p>Error: {error.message}</p>}
        </div>
      );
    }
    ```
  </Tab>

  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    const permissions = await cdp.evm.listSpendPermissions({
      address: smartAccount.address,
    });
    const permissionHash = permissions.spendPermissions[0].permissionHash;

    const { userOpHash } = await cdp.evm.revokeSpendPermission({
      address: smartAccount.address,
      permissionHash,
      network: "base-sepolia",
    });

    const result = await cdp.evm.waitForUserOperation({
      smartAccountAddress: smartAccount.address,
      userOpHash,
    });
    console.log("Revoke result:", result);
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    all_permissions = await cdp.evm.list_spend_permissions(
        address=smart_account.address,
    )
    permission_hash = all_permissions.spend_permissions[0].permission_hash

    revoke_result = await cdp.evm.revoke_spend_permission(
        address=smart_account.address,
        permission_hash=permission_hash,
        network="base-sepolia",
    )

    result = await cdp.evm.wait_for_user_operation(
        smart_account_address=smart_account.address,
        user_op_hash=revoke_result.user_op_hash,
    )
    print(f"Revoke result: {result}")
    ```
  </Tab>
</Tabs>

## Check remaining allowance

Query the `getCurrentPeriod` function on the Spend Permission Manager contract to see how much of an allowance remains in the current period.

```typescript Node (TypeScript) [expandable] theme={null}
import { createPublicClient, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";

const SPEND_PERMISSION_MANAGER_ADDRESS = "0xf85210B21cC50302F477BA56686d2019dC9b67Ad";

const SPEND_PERMISSION_MANAGER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "account", type: "address" },
          { name: "spender", type: "address" },
          { name: "token", type: "address" },
          { name: "allowance", type: "uint160" },
          { name: "period", type: "uint48" },
          { name: "start", type: "uint48" },
          { name: "end", type: "uint48" },
          { name: "salt", type: "uint256" },
          { name: "extraData", type: "bytes" },
        ],
        name: "spendPermission",
        type: "tuple",
      },
    ],
    name: "getCurrentPeriod",
    outputs: [
      { name: "start", type: "uint48" },
      { name: "end", type: "uint48" },
      { name: "spend", type: "uint160" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const client = createPublicClient({ chain: baseSepolia, transport: http() });

const permissions = await cdp.evm.listSpendPermissions({ address: smartAccount.address });
const permission = permissions.spendPermissions[0].permission;

const [, , amountSpent] = await client.readContract({
  address: SPEND_PERMISSION_MANAGER_ADDRESS,
  abi: SPEND_PERMISSION_MANAGER_ABI,
  functionName: "getCurrentPeriod",
  args: [permission],
});

const remaining = BigInt(permission.allowance) - amountSpent;
console.log(`Spent: ${amountSpent}, Remaining: ${remaining}`);
```

## Spend Permissions vs Policies

| | Spend Permissions | Policies |
| - | - | - |
| **Evaluation** | Onchain via smart contracts | Off-chain via Coinbase TEE infrastructure |
| **Scope** | Token spending on EVM | Any transaction type |
| **Platform** | EVM only | EVM and Solana |
| **Account scope** | Any onchain account, including outside your CDP project | Accounts within your CDP project only |

## Supported networks

<CardGroup cols={2}>
  <Card title="Mainnets" icon="globe">
    Arbitrum, Avalanche, Base, Ethereum, Optimism, Polygon
  </Card>

  <Card title="Testnets" icon="flask">
    Base Sepolia, Ethereum Sepolia
  </Card>
</CardGroup>

<Info>
  The Spend Permission Manager contract is deployed at `0xf85210B21cC50302F477BA56686d2019dC9b67Ad` on all supported networks.
</Info>
