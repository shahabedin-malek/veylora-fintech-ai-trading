> Coinbase CDP docs — **wallets** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Quickstart: API Key Wallet

export const TypeScriptConfigRequirement = () => {
  return <>
      <Note>
        <strong>TypeScript users:</strong> Set <code>moduleResolution: "node16"</code> or <code>"nodenext"</code> in your <code>tsconfig.json</code> (not the legacy <code>"node"</code>) to avoid compilation errors with the CDP SDK.
      </Note>
    </>;
};

export const Tags = ({tags, className}) => {
  if (!tags || !Array.isArray(tags)) {
    return null;
  }
  return <div className={`mt-5 mb-5 flex flex-row flex-wrap gap-2 ${className}`}>
      {tags.map((tag, index) => <span key={index} className="text-sm text-[#733E00] dark:text-yellow-500 bg-[#FFFCF1] dark:bg-yellow-500/10 font-semibold px-2 py-1 rounded-lg">{tag}</span>)}
    </div>;
};

<Tags tags={["API Key Wallet"]} />

## Overview

This guide shows how to create and manage non-custodial wallets programmatically using API key authentication. Your server owns and controls the accounts while CDP secures all private keys inside a Trusted Execution Environment.

In this quickstart, you will:

* Create EVM and Solana accounts
* Fund your accounts with testnet tokens using CDP Faucets
* Send a transaction

<Tip>
  **CDP CLI alternative.** Create and fund an account without project setup:

  ```bash theme={null}
  npm install -g @coinbase/cdp-cli
  cdp env live --key-file ./cdp_api_key.json
  cdp env live --wallet-secret-file ./cdp_wallet_secret.txt
  cdp evm accounts create name=test
  ```

  The CLI uses the same API key and Wallet Secret as the SDK. Use it for setup, validation, and ad-hoc operations; use the SDK below for application code.
</Tip>

## Prerequisites

* [Node.js](https://nodejs.org/en) 22.x+ (TypeScript) or [Python](https://www.python.org/downloads/) 3.10+ (Python)
* A [CDP Portal](https://portal.cdp.coinbase.com) account

### Create keys

Sign in to the [CDP Portal](https://portal.cdp.coinbase.com), [create a CDP API key](https://portal.cdp.coinbase.com/api-keys/secret) and [generate a Wallet Secret](https://portal.cdp.coinbase.com/wallets/non-custodial/security). Keep these values handy for the steps below.

### Project setup

Initialize a new project and instantiate the CDP client.

<Tabs groupId="programming-language">
  <Tab value="Typescript" title="Node (TypeScript)" default>
    Initialize a new TypeScript project:

    ```bash theme={null}
    mkdir cdp-sdk-example && cd cdp-sdk-example && npm init -y && npm pkg set type="module" && touch main.ts && touch .env
    ```

    Add your keys to `.env`:

    ```bash .env theme={null}
    CDP_API_KEY_ID=your-api-key-id
    CDP_API_KEY_SECRET=your-api-key-secret
    CDP_WALLET_SECRET=your-wallet-secret
    ```

    Install the CDP SDK:

    ```bash theme={null}
    npm install @coinbase/cdp-sdk dotenv
    ```

    <TypeScriptConfigRequirement />

    Instantiate the client in `main.ts`:

    ```typescript main.ts theme={null}
    import { CdpClient } from "@coinbase/cdp-sdk";
    import dotenv from "dotenv";

    dotenv.config();

    const cdp = new CdpClient();
    ```

    Run your code with:

    ```bash theme={null}
    npx tsx main.ts
    ```
  </Tab>

  <Tab value="Python" title="Python">
    Initialize a new Python project:

    ```bash theme={null}
    mkdir cdp-sdk-example && cd cdp-sdk-example && python -m venv .venv && source .venv/bin/activate && touch main.py && touch .env
    ```

    Add your keys to `.env`:

    ```bash .env theme={null}
    CDP_API_KEY_ID=your-api-key-id
    CDP_API_KEY_SECRET=your-api-key-secret
    CDP_WALLET_SECRET=your-wallet-secret
    ```

    Install the CDP SDK:

    ```bash theme={null}
    pip install cdp-sdk python-dotenv
    ```

    Instantiate the client in `main.py`:

    ```python main.py theme={null}
    from cdp import CdpClient
    import asyncio
    from dotenv import load_dotenv

    load_dotenv()

    async def main():
        cdp = CdpClient()
        await cdp.close()

    asyncio.run(main())
    ```

    Run your code with:

    ```bash theme={null}
    python main.py
    ```
  </Tab>
</Tabs>

## 1. Create an account

### EVM

<CodeGroup>
  ```typescript main.ts theme={null}
  import { CdpClient } from "@coinbase/cdp-sdk";
  import dotenv from "dotenv";

  dotenv.config();

  const cdp = new CdpClient();
  const account = await cdp.evm.createAccount();
  console.log(`Created EVM account: ${account.address}`);
  ```

  ```python main.py theme={null}
  import asyncio
  from cdp import CdpClient
  from dotenv import load_dotenv

  load_dotenv()

  async def main():
      cdp = CdpClient()
      account = await cdp.evm.create_account()
      print(f"Created EVM account: {account.address}")
      await cdp.close()

  asyncio.run(main())
  ```
</CodeGroup>

```console theme={null}
Created EVM account: 0x3c0D84055994c3062819Ce8730869D0aDeA4c3Bf
```

<Tip>
  You can also create named accounts and retrieve them later with `getOrCreateAccount`. See [Create & Manage Wallets](/wallets/using-wallets/create-and-manage-wallets) for details.
</Tip>

### Solana

<CodeGroup>
  ```typescript main.ts theme={null}
  const account = await cdp.solana.createAccount();
  console.log(`Created Solana account: ${account.address}`);
  ```

  ```python main.py theme={null}
  account = await cdp.solana.create_account()
  print(f"Created Solana account: {account.address}")
  ```
</CodeGroup>

```console theme={null}
Created Solana account: 2XBS6naS1v7pXEg25z43FGHnmEgEad53fmiZ9S6LPgKn
```

## 2. Fund with testnet tokens

<Info>
  Read about [faucet rate limits](/faucets/introduction/welcome#supported-assets) before requesting funds.
</Info>

### EVM

<CodeGroup>
  ```typescript main.ts theme={null}
  const faucetResponse = await cdp.evm.requestFaucet({
    address: account.address,
    network: "base-sepolia",
    token: "eth"
  });
  console.log(`Faucet tx: https://sepolia.basescan.org/tx/${faucetResponse.transactionHash}`);
  ```

  ```python main.py theme={null}
  faucet_hash = await cdp.evm.request_faucet(
      address=account.address,
      network="base-sepolia",
      token="eth"
  )
  print(f"Faucet tx: https://sepolia.basescan.org/tx/{faucet_hash}")
  ```
</CodeGroup>

### Solana

<CodeGroup>
  ```typescript main.ts theme={null}
  const { signature } = await cdp.solana.requestFaucet({
    address: account.address,
    token: "sol"
  });
  console.log(`Faucet tx: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  ```

  ```python main.py theme={null}
  tx = await cdp.solana.request_faucet(address=account.address, token="sol")
  print(f"Faucet tx: https://explorer.solana.com/tx/{tx.transaction_signature}?cluster=devnet")
  ```
</CodeGroup>

## 3. Send a transaction

### EVM

<Tabs groupId="programming-language">
  <Tab value="Typescript" title="Node (TypeScript)" default>
    Install viem to wait for transaction confirmation:

    ```bash theme={null}
    npm install viem
    ```

    ```typescript main.ts lines wrap [expandable] theme={null}
    import { CdpClient } from "@coinbase/cdp-sdk";
    import { http, createPublicClient, parseEther } from "viem";
    import { baseSepolia } from "viem/chains";
    import dotenv from "dotenv";

    dotenv.config();

    const cdp = new CdpClient();
    const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

    const account = await cdp.evm.createAccount();

    const { transactionHash: faucetHash } = await cdp.evm.requestFaucet({
      address: account.address,
      network: "base-sepolia",
      token: "eth",
    });
    await publicClient.waitForTransactionReceipt({ hash: faucetHash });

    const { transactionHash } = await cdp.evm.sendTransaction({
      address: account.address,
      transaction: {
        to: "0x0000000000000000000000000000000000000000",
        value: parseEther("0.000001"),
      },
      network: "base-sepolia",
    });
    await publicClient.waitForTransactionReceipt({ hash: transactionHash });

    console.log(`Transaction sent: https://sepolia.basescan.org/tx/${transactionHash}`);
    ```
  </Tab>

  <Tab value="Python" title="Python">
    Install web3 to wait for transaction confirmation:

    ```bash theme={null}
    pip install web3
    ```

    ```python main.py lines wrap [expandable] theme={null}
    import asyncio
    from cdp import CdpClient
    from cdp.evm_transaction_types import TransactionRequestEIP1559
    from dotenv import load_dotenv
    from web3 import Web3

    load_dotenv()

    w3 = Web3(Web3.HTTPProvider("https://sepolia.base.org"))

    async def main():
        async with CdpClient() as cdp:
            account = await cdp.evm.create_account()

            faucet_hash = await cdp.evm.request_faucet(
                address=account.address, network="base-sepolia", token="eth"
            )
            w3.eth.wait_for_transaction_receipt(faucet_hash)

            tx_hash = await cdp.evm.send_transaction(
                address=account.address,
                transaction=TransactionRequestEIP1559(
                    to="0x0000000000000000000000000000000000000000",
                    value=w3.to_wei(0.000001, "ether"),
                ),
                network="base-sepolia",
            )
            print(f"Transaction sent: https://sepolia.basescan.org/tx/{tx_hash}")

    asyncio.run(main())
    ```
  </Tab>
</Tabs>

### Solana

<Tabs groupId="programming-language">
  <Tab value="Typescript" title="Node (TypeScript)" default>
    Install the Solana web3.js library:

    ```bash theme={null}
    npm install @solana/web3.js@1
    ```

    ```typescript main.ts lines wrap [expandable] theme={null}
    import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
    import { CdpClient } from "@coinbase/cdp-sdk";
    import dotenv from "dotenv";

    dotenv.config();

    const cdp = new CdpClient();
    const connection = new Connection("https://api.devnet.solana.com");

    const account = await cdp.solana.createAccount();
    await cdp.solana.requestFaucet({ address: account.address, token: "sol" });

    // Wait for funds
    let balance = 0;
    while (balance === 0) {
      balance = await connection.getBalance(new PublicKey(account.address));
      if (balance === 0) await new Promise(r => setTimeout(r, 1000));
    }

    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction();
    tx.add(SystemProgram.transfer({
      fromPubkey: new PublicKey(account.address),
      toPubkey: new PublicKey("EeVPcnRE1mhcY85wAh3uPJG1uFiTNya9dCJjNUPABXzo"),
      lamports: 1000,
    }));
    tx.recentBlockhash = blockhash;
    tx.feePayer = new PublicKey(account.address);

    const serialized = Buffer.from(tx.serialize({ requireAllSignatures: false })).toString("base64");
    const { signature: signed } = await cdp.solana.signTransaction({ address: account.address, transaction: serialized });
    const sig = await connection.sendRawTransaction(Buffer.from(signed, "base64"));
    await connection.confirmTransaction(sig);

    console.log(`Transaction sent: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
    ```
  </Tab>

  <Tab value="Python" title="Python">
    Install the Solana library:

    ```bash theme={null}
    pip install solana solders
    ```

    ```python main.py lines wrap [expandable] theme={null}
    import time, base64, asyncio
    from cdp import CdpClient
    from dotenv import load_dotenv
    from solana.rpc.api import Client as SolanaClient
    from solana.rpc.types import TxOpts
    from solders.pubkey import Pubkey as PublicKey
    from solders.system_program import TransferParams, transfer
    from solders.message import Message

    load_dotenv()

    connection = SolanaClient("https://api.devnet.solana.com")

    async def main():
        async with CdpClient() as cdp:
            account = await cdp.solana.create_account()
            await cdp.solana.request_faucet(account.address, token="sol")

            # Wait for funds
            balance = 0
            while balance == 0:
                balance = connection.get_balance(PublicKey.from_string(account.address)).value
                if balance == 0: time.sleep(1)

            from_pk = PublicKey.from_string(account.address)
            to_pk = PublicKey.from_string("EeVPcnRE1mhcY85wAh3uPJG1uFiTNya9dCJjNUPABXzo")
            blockhash = connection.get_latest_blockhash().value.blockhash

            msg = Message.new_with_blockhash([transfer(TransferParams(from_pubkey=from_pk, to_pubkey=to_pk, lamports=1000))], from_pk, blockhash)
            tx_bytes = bytes([1]) + bytes(64) + bytes(msg)
            serialized = base64.b64encode(tx_bytes).decode()

            signed = await cdp.solana.sign_transaction(account.address, transaction=serialized)
            decoded = base64.b64decode(signed.signed_transaction)
            sig = connection.send_raw_transaction(decoded, opts=TxOpts(skip_preflight=False)).value
            connection.confirm_transaction(sig)

            print(f"Transaction sent: https://explorer.solana.com/tx/{sig}?cluster=devnet")

    asyncio.run(main())
    ```
  </Tab>
</Tabs>

## What to read next

<CardGroup cols={2}>
  <Card title="Create & Manage Wallets" icon="wallet" href="/wallets/using-wallets/create-and-manage-wallets">
    Named accounts, listing, updating, and pre-generation
  </Card>

  <Card title="Smart Accounts" icon="star" href="/wallets/using-wallets/smart-accounts">
    Gas sponsorship, batched transactions, and spend permissions
  </Card>

  <Card title="Security" icon="shield" href="/wallets/security-and-policies/security-overview">
    TEE architecture, Wallet Secrets, and OFAC screening
  </Card>

  <Card title="Policy Engine" icon="lock" href="/wallets/security-and-policies/policy-engine/overview">
    Set rules that govern what transactions accounts can sign
  </Card>
</CardGroup>
