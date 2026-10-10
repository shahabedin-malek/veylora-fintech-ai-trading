> Coinbase CDP docs — **x402** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Quickstart: pay for an API

This guide takes you from nothing to one successful server-side paid API call. You will pay for a
protected endpoint with test USDC on Base testnet, using a CDP-managed wallet, so there is no
private key to store anywhere.

CDP SDK wallets run on your backend. Use this path when you are:

* Building an agent that autonomously pays for API services.
* Adding x402 payments to an application backend.
* Building a managed wallet or payment flow for your users.

<Info>
  **Building a browser or full-stack payment flow?** Use
  [x402 payments with Embedded Wallets](/wallets/using-wallets/x402-payments) when users should pay
  from their own self-custodial wallets.

  **Want an agent to pay without writing payment code?** Start with
  [Agentic Accounts](/x402/agentic-accounts/overview).
</Info>

New to the protocol? [How x402 works](/x402/how-it-works) explains the
request, the `402` response, and the payment that follows.

<Tip>
  **Using a coding agent?** Install the matching skill and your agent runs this guide in your own
  project:

  ```bash theme={null}
  npx skills add coinbase/cdp-sdk --skill build-x402-client
  ```
</Tip>

## Prerequisites

* A [CDP API key and wallet secret](/wallets/quickstart/api-key-auth). The wallet secret lets
  the SDK sign payments with your CDP wallet.
* Node.js 22 or later.

Set your credentials in the environment before running anything:

```bash theme={null}
export CDP_API_KEY_ID="your-api-key-id"
export CDP_API_KEY_SECRET="your-api-key-secret"
export CDP_WALLET_SECRET="your-wallet-secret"
```

## 1. Install the SDKs

The CDP SDK handles the wallet. The x402 packages handle the protocol.

<Tabs>
  <Tab title="TypeScript">
    ```bash theme={null}
    npm install @coinbase/cdp-sdk @x402/core @x402/evm @x402/svm @x402/extensions @x402/fetch
    ```
  </Tab>

  <Tab title="Python">
    Python 3.10 or later is required.

    ```bash theme={null}
    pip install "cdp-sdk" "x402[evm,svm,httpx]"
    ```
  </Tab>
</Tabs>

## 2. Write the client

The client resolves a CDP-managed wallet, prints the address that pays, and then requests a
protected endpoint. The wrapper handles the `402` response, payment, and retry.

<Tabs>
  <Tab title="TypeScript">
    `CdpX402Client` provisions the wallet and registers payment schemes for you, then plugs
    into `wrapFetchWithPayment` from `@x402/fetch`.

    ```typescript theme={null}
    // client.ts
    import { CdpX402Client } from "@coinbase/cdp-sdk/x402";
    import { wrapFetchWithPayment } from "@x402/fetch";

    // "development" uses the Base testnet. Omit it to use Base mainnet.
    const client = new CdpX402Client({ environment: "development" });

    // The wallet is managed internally, so print its address to know what to fund.
    const { evmAddress } = await client.getAddresses();
    console.log(`Paying from ${evmAddress}`);

    const fetchWithPayment = wrapFetchWithPayment(globalThis.fetch, client);
    const response = await fetchWithPayment("https://x402.vercel.app/protected");

    console.log(`HTTP ${response.status}`);
    ```
  </Tab>

  <Tab title="Python">
    Python has no `CdpX402Client`, so you assemble the same pieces yourself: wrap the CDP
    account with `EvmLocalAccount`, adapt it to the x402 signer protocol with
    `EthAccountSigner`, and register the scheme on a standard `x402Client`.

    ```python theme={null}
    # client.py
    import asyncio

    from cdp import CdpClient
    from cdp.evm_local_account import EvmLocalAccount
    from x402 import x402Client
    from x402.http.clients import x402HttpxClient
    from x402.mechanisms.evm import EthAccountSigner
    from x402.mechanisms.evm.exact import ExactEvmScheme

    async def main() -> None:
        async with CdpClient() as cdp:
            account = await cdp.evm.get_or_create_account(name="x402-client-wallet-1")
            # EthAccountSigner adapts the CDP account to the x402 signer protocol.
            signer = EthAccountSigner(EvmLocalAccount(account))
            print(f"Paying from {signer.address}")

            payment_client = x402Client()
            payment_client.register("eip155:84532", ExactEvmScheme(signer))

            async with x402HttpxClient(payment_client) as http:
                response = await http.get("https://x402.vercel.app/protected")
                await response.aread()

            print(f"HTTP {response.status_code}")

    asyncio.run(main())
    ```

    `EvmLocalAccount` and the x402 signer protocol declare `sign_typed_data` differently, and
    `EthAccountSigner` reconciles them. `ExactEvmScheme` applies the same wrap for you if you pass
    the account directly, so writing it out is a matter of making the adaptation visible.
  </Tab>
</Tabs>

## 3. (Optional) Fund the wallet

Run the client once:

<Tabs>
  <Tab title="TypeScript">
    ```bash theme={null}
    npx tsx client.ts
    ```
  </Tab>

  <Tab title="Python">
    ```bash theme={null}
    python client.py
    ```
  </Tab>
</Tabs>

It prints the address it pays from and then fails, because the wallet holds no USDC yet:

```console theme={null}
Paying from 0x1724a4c282e3f7d8012F9C2d22fE7e1f95B5860E
```

Send test USDC on Base testnet to that address. The fastest route is the
[Faucets quickstart](/faucets/introduction/quickstart), which covers both the CDP Portal and
the API. To claim it in code with the credentials you already exported:

<Tabs>
  <Tab title="TypeScript">
    ```typescript theme={null}
    import { CdpClient } from "@coinbase/cdp-sdk";

    const cdp = new CdpClient();
    await cdp.evm.requestFaucet({
      address: evmAddress,
      network: "base-sepolia",
      token: "usdc",
    });
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    await cdp.evm.request_faucet(
        address=signer.address, network="base-sepolia", token="usdc"
    )
    ```
  </Tab>
</Tabs>

## 4. Make the paid call

Wait for the faucet transaction to confirm, then run the client again:

```console theme={null}
Paying from 0x1724a4c282e3f7d8012F9C2d22fE7e1f95B5860E
HTTP 200
```

An `HTTP 200` means the payment was verified and settled, and you received the protected resource.
You paid for an API without an account, an invoice, or a card.

## Runnable examples

Complete versions of the client include faucet funding and settlement details:

<Tabs>
  <Tab title="TypeScript">
    * [`payForApi.ts`](https://github.com/coinbase/cdp-sdk/blob/main/examples/typescript/x402/clients/payForApi.ts)
    * [`payForApiWithAxios.ts`](https://github.com/coinbase/cdp-sdk/blob/main/examples/typescript/x402/clients/payForApiWithAxios.ts)
  </Tab>

  <Tab title="Python">
    * [`pay_for_api.py`](https://github.com/coinbase/cdp-sdk/blob/main/examples/python/x402/clients/pay_for_api.py)
    * [`pay_for_api_with_requests.py`](https://github.com/coinbase/cdp-sdk/blob/main/examples/python/x402/clients/pay_for_api_with_requests.py)
  </Tab>
</Tabs>

## What to read next

You paid a service you already knew about. To find services you don't, browse the catalog in
[Discover services](/x402/buyer/discover-services).

Where you go next depends on what you are building:

* **Building an app.** Let your users pay from their own wallets with
  [x402 payments in Embedded Wallets](/wallets/using-wallets/x402-payments).
* **Building an agent.** Start with an
  [Agentic Wallet](/x402/agentic-accounts/agentic-wallet), or carry discovery and payment over MCP
  with
  [Discover & pay over MCP](/x402/buyer/mcp-payments).
* **Need spend limits or an existing x402 client?** See
  [Client configuration](/x402/buyer/client-configuration).
