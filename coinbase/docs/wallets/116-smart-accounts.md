> Coinbase CDP docs — **wallets** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Smart Accounts

Smart accounts ([ERC-4337](https://eips.ethereum.org/EIPS/eip-4337)) are programmable wallets that enable advanced features like batching multiple transactions together and sponsoring gas fees for your users.

Key benefits of CDP Smart Accounts include:

<CardGroup cols={3}>
  <Card title="Batch transactions" icon="layer-group" href="#batch-calls">
    Execute multiple calls in a single user operation
  </Card>

  <Card title="Gas sponsorship" icon="gas-pump" href="#gas-sponsorship">
    Optional paymasters for gasless UX
  </Card>

  <Card title="Multi-chain support" icon="network-wired" href="#supported-networks">
    Deploy on 8 mainnets and 2 testnets across EVM chains
  </Card>
</CardGroup>

<Note>
  For keeping the same address, [EIP-7702](/wallets/using-wallets/eip-7702) upgrades an existing EOA with the same smart account capabilities without creating a new contract address.
</Note>

## Create a smart account

<Tabs>
  <Tab title="React">
    Configure `createOnLogin: "smart"` in your provider so new users get a smart account automatically on sign-in.

    ```tsx theme={null}
    import { CDPHooksProvider, useCurrentUser } from "@coinbase/cdp-hooks";

    function App() {
      return (
        <CDPHooksProvider
          config={{
            projectId: "your-project-id",
            ethereum: { createOnLogin: "smart" },
          }}
        >
          <YourApp />
        </CDPHooksProvider>
      );
    }

    function SmartAccountInfo() {
      const { currentUser } = useCurrentUser();
      const smartAccount = currentUser?.evmSmartAccounts?.[0];
      return <p>Smart Account: {smartAccount}</p>;
    }
    ```
  </Tab>

  <Tab title="Node (TypeScript)">
    A smart account requires an EOA as its owner. The contract is not deployed until the first user operation is submitted.

    ```typescript theme={null}
    const owner = await cdp.evm.createAccount();
    const smartAccount = await cdp.evm.createSmartAccount({ owner });
    console.log("Smart Account:", smartAccount.address);
    ```
  </Tab>

  <Tab title="Python">
    A smart account requires an EOA as its owner. The contract is not deployed until the first user operation is submitted.

    ```python theme={null}
    owner = await cdp.evm.create_account()
    smart_account = await cdp.evm.create_smart_account(owner)
    print(f"Smart Account: {smart_account.address}")
    ```
  </Tab>
</Tabs>

## Send a user operation

<Note>
  On Base Sepolia, user operations are subsidized and the smart account does not need to be funded with ETH. On Base mainnet, fund the smart account with ETH before submitting.
</Note>

<Tabs>
  <Tab title="React">
    `useSendUserOperation` tracks `status`, `data`, and `error` through on-chain confirmation.

    ```tsx theme={null}
    import { useSendUserOperation, useCurrentUser } from "@coinbase/cdp-hooks";

    function SendUserOperation() {
      const { sendUserOperation, status, data, error } = useSendUserOperation();
      const { currentUser } = useCurrentUser();

      const handleSend = async () => {
        const smartAccount = currentUser?.evmSmartAccounts?.[0];
        if (!smartAccount) return;

        await sendUserOperation({
          evmSmartAccount: smartAccount,
          network: "base-sepolia",
          calls: [{ to: "0x000...000", value: 0n, data: "0x" }],
        });
      };

      return (
        <div>
          <button onClick={handleSend} disabled={status === "pending"}>
            {status === "pending" ? "Sending..." : "Send"}
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
    import { parseEther } from "viem";

    const result = await cdp.evm.sendUserOperation({
      smartAccount,
      network: "base-sepolia",
      calls: [{ to: "0x000...000", value: parseEther("0"), data: "0x" }],
    });

    const userOperation = await cdp.evm.waitForUserOperation({
      smartAccountAddress: smartAccount.address,
      userOpHash: result.userOpHash,
    });

    if (userOperation.status === "complete") {
      console.log("Tx:", userOperation.transactionHash);
    }
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    from cdp.evm_call_types import EncodedCall

    user_operation = await cdp.evm.send_user_operation(
        smart_account=smart_account,
        calls=[EncodedCall(to="0x000...000", data="0x", value=0)],
        network="base-sepolia",
    )

    user_operation = await cdp.evm.wait_for_user_operation(
        smart_account_address=smart_account.address,
        user_op_hash=user_operation.user_op_hash,
    )

    if user_operation.status == "complete":
        print(f"Tx: {user_operation.transaction_hash}")
    ```
  </Tab>
</Tabs>

## Batch calls

Pass multiple entries in `calls[]` to execute them atomically in a single user operation. Calls run in order and revert together on failure.

<Tabs>
  <Tab title="React">
    ```tsx theme={null}
    await sendUserOperation({
      evmSmartAccount: smartAccount,
      network: "base-sepolia",
      calls: [
        { to: addr1, value: parseEther("0.001"), data: "0x" },
        { to: addr2, value: parseEther("0.001"), data: "0x" },
        { to: addr3, value: parseEther("0.001"), data: "0x" },
      ],
    });
    ```
  </Tab>

  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    import { parseEther } from "viem";

    const destinations = [
      "0xba5f3764f0A714EfaEDC00a5297715Fd75A416B7",
      "0xD84523e4F239190E9553ea59D7e109461752EC3E",
      "0xf1F7Bf05A81dBd5ACBc701c04ce79FbC82fEAD8b",
    ];

    const { userOpHash } = await smartAccount.sendUserOperation({
      network: "base-sepolia",
      calls: destinations.map((to) => ({
        to,
        value: parseEther("0.000001"),
        data: "0x",
      })),
    });

    const result = await smartAccount.waitForUserOperation({ userOpHash });

    if (result.status === "complete") {
      console.log("Tx:", result.transactionHash);
    }
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    from cdp.evm_call_types import EncodedCall

    destinations = [
        "0xba5f3764f0A714EfaEDC00a5297715Fd75A416B7",
        "0xD84523e4F239190E9553ea59D7e109461752EC3E",
        "0xf1F7Bf05A81dBd5ACBc701c04ce79FbC82fEAD8b",
    ]

    user_operation = await cdp.evm.send_user_operation(
        smart_account=smart_account,
        calls=[EncodedCall(to=dest, data="0x", value=1000) for dest in destinations],
        network="base-sepolia",
    )

    user_operation = await cdp.evm.wait_for_user_operation(
        smart_account_address=smart_account.address,
        user_op_hash=user_operation.user_op_hash,
    )

    if user_operation.status == "complete":
        print(f"Tx: {user_operation.transaction_hash}")
    ```
  </Tab>
</Tabs>

## Encode contract calls

To interact with contracts, pass `data` using an ABI-encoded payload. This example encodes an ERC-20 `transfer` using `viem`:

```tsx Node (TypeScript) theme={null}
import { encodeFunctionData } from "viem";

const erc20Abi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

const data = encodeFunctionData({
  abi: erc20Abi as const,
  functionName: "transfer",
  args: [recipient, 1_000_000n], // 1 USDC assuming 6 decimals
});

await sendUserOperation({
  evmSmartAccount: smartAccount,
  network: "base-sepolia",
  calls: [
    {
      to: usdcAddress,
      data,
      value: 0n,
    },
  ],
});
```

## Gas sponsorship

For **CDP Smart Accounts**, pass a `paymasterUrl` to cover gas fees with any [ERC-7677](https://eips.ethereum.org/EIPS/eip-7677)-compatible paymaster, use `useCdpPaymaster` on Base, or configure a custom paymaster in CDP Portal (see [Custom paymaster via CDP Portal](#custom-paymaster) below).

<Tabs>
  <Tab title="React">
    React also supports `useCdpPaymaster: true` to use the CDP Paymaster on Base without providing a URL.

    <Warning>
      `useCdpPaymaster` is only supported on Base. You cannot specify both `useCdpPaymaster` and `paymasterUrl`.
    </Warning>

    ```tsx theme={null}
    await sendUserOperation({
      evmSmartAccount: smartAccount,
      network: "base-sepolia",
      calls: [{ to: recipient, value: 10n ** 15n, data: "0x" }],
      useCdpPaymaster: true,
      // or: paymasterUrl: "https://your-paymaster.example.com"
    });
    ```
  </Tab>

  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    import { parseEther } from "viem";

    const userOperation = await cdp.evm.sendUserOperation({
      smartAccount,
      network: "base-sepolia",
      calls: [
        {
          to: "0x0000000000000000000000000000000000000000",
          value: parseEther("0"),
          data: "0x",
        },
      ],
      paymasterUrl: "https://your-paymaster.example.com",
    });

    const confirmed = await cdp.evm.waitForUserOperation({
      smartAccountAddress: smartAccount.address,
      userOpHash: userOperation.userOpHash,
    });

    if (confirmed.status === "complete") {
      console.log("Tx:", confirmed.transactionHash);
    }
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    from cdp.evm_call_types import EncodedCall
    from decimal import Decimal
    from web3 import Web3

    user_operation = await cdp.evm.send_user_operation(
        smart_account=smart_account,
        calls=[
            EncodedCall(
                to="0x0000000000000000000000000000000000000000",
                data="0x",
                value=Web3.to_wei(Decimal("0"), "ether"),
            )
        ],
        network="base-sepolia",
        paymaster_url="https://your-paymaster.example.com",
    )

    confirmed = await cdp.evm.wait_for_user_operation(
        smart_account_address=smart_account.address,
        user_op_hash=user_operation.user_op_hash,
    )

    if confirmed.status == "complete":
        print(f"Tx: {confirmed.transaction_hash}")
    ```
  </Tab>
</Tabs>

<h3 id="custom-paymaster">
  Custom paymaster via CDP Portal
</h3>

Configure CDP to route gas sponsorship for **CDP Smart Accounts** through your own paymaster infrastructure instead of — or in addition to — the CDP-managed paymaster. The paymaster URL is stored in CDP's backend and **never sent to the client**.

Use a custom paymaster when you:

* Run your own paymaster infrastructure (e.g. a proxy in front of Alchemy, Pimlico, or another provider)
* Need gas sponsorship on EVM chains where [CDP's native paymaster](/paymaster/introduction/welcome#supported-networks) doesn't apply (only Base and Base Sepolia are natively supported)
* Want custom sponsorship rules — per-user caps, business-logic gates, or allow/deny logic — that go beyond CDP's built-in contract allowlists
* Need the paymaster URL kept strictly server-side and never exposed to the frontend

#### How it works

**Custom Paymaster URL** — A per-network URL configured in CDP Portal at the project level. When CDP's backend receives a user operation from a CDP Smart Account that needs sponsorship, it checks whether the project has a custom paymaster configured for that network and routes the request there.

**Paymaster Context** — An arbitrary key-value map (defined by [EIP-7677](https://eips.ethereum.org/EIPS/eip-7677)) configured in Portal and forwarded to your paymaster on every sponsored request. The primary use case is authentication: include a static secret in the context, and your paymaster validates it before processing requests, so a leaked URL alone can't be abused.

```
User operation (CDP Smart Account)
    │
    ▼
CDP backend (cdp-service)
    │  checks project config for custom paymaster URL on this network
    │  forwards Portal context as EIP-7677 context
    ▼
Your paymaster
    │  validates secret from context
    │  applies your custom sponsorship logic
    ▼
Bundler → chain
```

<Note>
  Portal config is **project-level** and stored server-side — your frontend never sees the paymaster URL. When context is configured in Portal, omit paymaster parameters from SDK calls and CDP forwards the Portal context automatically.
</Note>

#### Configure in CDP Portal

<Steps>
  <Step title="Open Paymaster Configuration">
    In [CDP Portal](https://portal.cdp.coinbase.com), go to your non-custodial wallet project and open the **Paymaster Configuration** tab.
  </Step>

  <Step title="Add a network">
    Click **Add network** and select the EVM network you want to configure. You can add one entry per network.
  </Step>

  <Step title="Set your paymaster URL">
    Enter your paymaster's HTTPS endpoint. This must be an [ERC-7677](https://eips.ethereum.org/EIPS/eip-7677)-compatible paymaster URL.

    ```
    https://paymaster.example.com/api/v1/sponsor
    ```
  </Step>

  <Step title="Add context key-value pairs (recommended)">
    Under **Context**, add one or more key-value pairs. CDP forwards these to your paymaster on every sponsored request.

    For the static-secret authentication pattern:

    | Key | Value |
    | - | - |
    | `x-cdp-secret` | `a-long-random-secret-you-generate` |

    <Warning>
      Context values are **write-only** in the Portal UI — once saved, they cannot be read back, only overwritten. Treat them like secrets: store the value somewhere safe before saving.
    </Warning>
  </Step>
</Steps>

#### Validate the secret in your paymaster

Your paymaster receives the context as part of the standard EIP-7677 `pm_getPaymasterStubData` / `pm_getPaymasterData` request, under the `context` field. Reject requests that don't include the expected secret.

<Tabs>
  <Tab title="TypeScript">
    ```typescript title="paymaster.ts" theme={null}
    import { createServer, type IncomingMessage } from "http";

    const CDP_SECRET = process.env.CDP_PAYMASTER_SECRET; // same value you set in Portal

    async function readJson(req: IncomingMessage) {
      const buffers: Buffer[] = [];
      for await (const chunk of req) buffers.push(chunk as Buffer);
      return JSON.parse(Buffer.concat(buffers).toString());
    }

    createServer(async (req, res) => {
      const body = await readJson(req);

      if (body.method === "pm_getPaymasterStubData" || body.method === "pm_getPaymasterData") {
        const context = body.params?.[2] ?? {};

        // Reject if the secret is missing or wrong
        if (context["x-cdp-secret"] !== CDP_SECRET) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }

        // Your sponsorship logic here
        // ...
      }
    }).listen(3000);
    ```
  </Tab>

  <Tab title="Python">
    ```python title="paymaster.py" theme={null}
    import os
    from flask import Flask, request, jsonify

    app = Flask(__name__)
    CDP_SECRET = os.environ["CDP_PAYMASTER_SECRET"]

    @app.post("/")
    def paymaster():
        body = request.get_json()
        method = body.get("method", "")

        if method in ("pm_getPaymasterStubData", "pm_getPaymasterData"):
            context = body.get("params", [None, None, {}])[2] or {}

            if context.get("x-cdp-secret") != CDP_SECRET:
                return jsonify({"error": "Unauthorized"}), 401

            # Your sponsorship logic here
            # ...
    ```
  </Tab>
</Tabs>

#### Send user operations with Portal config

Once your paymaster URL is configured in Portal, CDP's backend applies it automatically — you do **not** pass `paymasterUrl` in SDK calls. If context (including authentication secrets) is configured in Portal, no paymaster parameters are required in SDK calls.

<Tabs>
  <Tab title="TypeScript SDK">
    ```typescript theme={null}
    import { CdpClient } from "@coinbase/cdp-sdk";

    const cdp = new CdpClient();
    const owner = await cdp.evm.getOrCreateAccount({ name: "my-account" });
    const smartAccount = await cdp.evm.getOrCreateSmartAccount({ owner });

    const userOperation = await cdp.evm.sendUserOperation({
      smartAccount,
      network: "arbitrum", // Arbitrum — CDP doesn't natively sponsor here
      calls: [
        {
          to: "0xRecipient",
          value: 0n,
          data: "0x",
        },
      ],
    });
    ```
  </Tab>

  <Tab title="Python SDK">
    ```python theme={null}
    from cdp import CdpClient
    from cdp.evm_call_types import EncodedCall

    async with CdpClient() as cdp:
        owner = await cdp.evm.get_or_create_account(name="my-account")
        smart_account = await cdp.evm.get_or_create_smart_account(owner=owner)

        user_operation = await cdp.evm.send_user_operation(
            smart_account=smart_account,
            calls=[EncodedCall(to="0xRecipient", data="0x", value=0)],
            network="arbitrum",
        )
    ```
  </Tab>
</Tabs>

#### Security: why server-side storage matters

Storing the paymaster URL and secret in CDP Portal is more secure than passing them from the frontend:

| | CDP Portal config | Client-side `paymasterUrl` |
| - | - | - |
| **URL visibility** | Server-side only — never in JS bundle or network traffic | Exposed in browser and network traffic |
| **Secret visibility** | Server-side only | Must be passed from client if required for auth |
| **Abuse surface** | URL + valid secret required | Leaked URL can be abused without Portal context |
| **Config change** | Portal UI or API — no code deploy needed | Requires code change and redeploy |

A leaked paymaster URL without the secret is useless when your paymaster validates the context secret.

#### Chain scope

Custom paymasters are most valuable for **chains where CDP doesn't natively sponsor gas**:

| Chain | CDP native paymaster | Custom paymaster |
| - | - | - |
| Base Mainnet | ✅ | ✅ (overrides CDP's) |
| Base Sepolia | ✅ | ✅ (overrides CDP's) |
| Arbitrum, Optimism, Polygon, etc. | ❌ | ✅ |
| Any ERC-7677 chain | ❌ | ✅ |

On Base, a custom paymaster configured in Portal overrides CDP's built-in paymaster for that project. On other chains, it's the only path to gas sponsorship through CDP Smart Accounts.

See also: [Paymaster Proxy](/paymaster/guides/paymaster-proxy) · [Paymaster Security](/paymaster/reference-troubleshooting/security) · [EIP-7677](https://eips.ethereum.org/EIPS/eip-7677)

## Builder Codes

[Base Builder Codes](https://docs.base.org/base-chain/builder-codes/builder-codes) attribute onchain activity back to your app for rewards and analytics. Pass `dataSuffix` on any user operation — no contract changes needed.

First, register at [base.dev](https://base.dev) and generate your suffix:

```typescript theme={null}
import { Attribution } from "ox/erc8021";

const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: ["YOUR-BUILDER-CODE"],
});
```

Then pass it to `sendUserOperation`:

<Tabs>
  <Tab title="React">
    ```tsx theme={null}
    import { useSendUserOperation, useCurrentUser } from "@coinbase/cdp-hooks";

    await sendUserOperation({
      evmSmartAccount: smartAccount,
      network: "base",
      calls: [{ to: "0xYourContract", value: 0n, data: "0x" }],
      dataSuffix: DATA_SUFFIX,
    });
    ```
  </Tab>

  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    await cdp.evm.sendUserOperation({
      smartAccount,
      network: "base",
      calls: [{ to: "0xYourContract", value: parseEther("0"), data: "0x" }],
      dataSuffix: DATA_SUFFIX,
    });
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    await smart_account.send_user_operation(
        calls=[EncodedCall(to="0xYourContract", value=0, data="0x")],
        network="base",
        data_suffix=DATA_SUFFIX,
    )
    ```
  </Tab>
</Tabs>

## Supported networks

| Network | Mainnet | Testnet |
| - | - | - |
| Base | ✓ | ✓ (Base Sepolia) |
| Arbitrum | ✓ | |
| Optimism | ✓ | |
| Zora | ✓ | |
| Polygon | ✓ | |
| BNB Chain | ✓ | |
| Avalanche | ✓ | |
| Ethereum | ✓ | ✓ (Sepolia) |

## Debugging

When a user operation reverts, the revert reason is included in its receipts if it can be decoded:

<Tabs>
  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    const userOp = await cdp.evm.getUserOperation({
      userOpHash: result.userOpHash,
      smartAccount,
    });
    console.log(userOp.receipts);
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    user_op = await cdp.evm.get_user_operation(
        smart_account.address,
        user_operation.user_op_hash,
    )
    print(user_op.receipts)
    ```
  </Tab>
</Tabs>
