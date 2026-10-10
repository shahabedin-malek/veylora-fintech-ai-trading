> Coinbase CDP docs — **wallets** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Sign Transactions & Messages

Sign messages and transactions to prove account ownership or authorize actions without broadcasting to the blockchain.

## EVM

### Sign messages (EIP-191)

EIP-191 signs a plain text message with a standard prefix, proving account ownership without sending a transaction. Common uses: authentication, off-chain agreements, Sign in with Ethereum.

<Tabs>
  <Tab title="React">
    ```tsx theme={null}
    import { useSignEvmMessage, useEvmAddress } from "@coinbase/cdp-hooks";

    function SignMessage() {
      const { signEvmMessage } = useSignEvmMessage();
      const { evmAddress } = useEvmAddress();

      const handleSign = async () => {
        if (!evmAddress) return;
        const result = await signEvmMessage({
          evmAccount: evmAddress,
          message: "Hello World",
        });
        console.log("Signature:", result.signature);
      };

      return <button onClick={handleSign}>Sign Message</button>;
    }
    ```
  </Tab>

  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    const signature = await cdp.evm.signMessage({
      address: account.address,
      message: "Hello, Coinbase Developer Platform!",
    });
    console.log("Signature:", signature);
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    signature = await cdp.evm.sign_message(
        address=account.address,
        message="Hello, Coinbase Developer Platform!",
    )
    print(f"Signature: {signature}")
    ```
  </Tab>
</Tabs>

### Sign typed data (EIP-712)

EIP-712 signs structured data in a human-readable format. Used for permit signatures, order books, and any protocol that requires structured off-chain signing.

<Tabs>
  <Tab title="React">
    ```tsx theme={null}
    import { useSignEvmTypedData, useEvmAddress } from "@coinbase/cdp-hooks";

    function SignTypedData() {
      const { signEvmTypedData } = useSignEvmTypedData();
      const { evmAddress } = useEvmAddress();

      const handleSign = async () => {
        if (!evmAddress) return;
        const result = await signEvmTypedData({
          evmAccount: evmAddress,
          typedData: {
            domain: {
              name: "Example DApp",
              version: "1",
              chainId: 84532,
            },
            types: {
              Person: [
                { name: "name", type: "string" },
                { name: "wallet", type: "address" },
              ],
            },
            primaryType: "Person",
            message: { name: "Bob", wallet: evmAddress },
          },
        });
        console.log("Signature:", result.signature);
      };

      return <button onClick={handleSign}>Sign Typed Data</button>;
    }
    ```
  </Tab>

  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    const signature = await cdp.evm.signTypedData({
      address: account.address,
      domain: {
        name: "MyApp",
        chainId: 1,
        verifyingContract: "0x0000000000000000000000000000000000000000",
      },
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        Person: [
          { name: "name", type: "string" },
          { name: "age", type: "uint256" },
        ],
      },
      primaryType: "Person",
      message: { name: "Alice", age: 25 },
    });
    console.log("Signature:", signature);
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    from cdp.evm_message_types import EIP712Domain

    signature = await account.sign_typed_data(
        domain=EIP712Domain(
            name="MyApp",
            chain_id=1,
            verifying_contract="0x0000000000000000000000000000000000000000",
        ).as_dict(),
        types={
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"},
            ],
            "Person": [
                {"name": "name", "type": "string"},
                {"name": "age", "type": "uint256"},
            ],
        },
        primary_type="Person",
        message={"name": "Alice", "age": 25},
    )
    print(f"Signature: {signature}")
    ```
  </Tab>
</Tabs>

### Sign transactions

For networks other than those supported by the Send Transaction API, you can sign a transaction with the wallet and broadcast it yourself. This example uses the public client from `viem` / `web3` to broadcast the transaction.

Common use cases include [Tempo](/wallets/demos/tempo) (a stablecoin payments blockchain) and other EVM-compatible chains not listed above.

<Tabs>
  <Tab title="React">
    ```tsx theme={null}
    import { useSignEvmTransaction, useEvmAddress } from "@coinbase/cdp-hooks";
    import { createPublicClient, http } from "viem";
    import { tron } from "viem/chains";

    function SignAndBroadcast() {
      const { signEvmTransaction } = useSignEvmTransaction();
      const { evmAddress } = useEvmAddress();

      const handleSign = async () => {
        if (!evmAddress) return;

        const { signedTransaction } = await signEvmTransaction({
          evmAccount: evmAddress,
          transaction: {
            to: evmAddress,
            value: 1000000000000n,
            gas: 21000n,
            chainId: 728126428, // Tron
            type: "eip1559",
          },
        });

        const client = createPublicClient({ chain: tron, transport: http() });
        const hash = await client.sendRawTransaction({
          serializedTransaction: signedTransaction,
        });
        console.log("Transaction hash:", hash);
      };

      return <button onClick={handleSign}>Sign and Broadcast</button>;
    }
    ```
  </Tab>

  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    import { parseEther, serializeTransaction } from "viem";
    import { baseSepolia } from "viem/chains";

    const serializedTx = serializeTransaction({
      chainId: baseSepolia.id,
      to: "0x4252e0c9A3da5A2700e7d91cb50aEf522D0C6Fe8",
      value: parseEther("0.000001"),
      type: "eip1559",
      data: "0x",
    });

    const signature = await cdp.evm.signTransaction({
      address: account.address,
      transaction: serializedTx,
    });
    console.log("Signature:", signature);
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    from web3 import Web3

    signed = await account.sign_transaction({
        "type": 2,
        "to": "0x0000000000000000000000000000000000000000",
        "value": 0,
        "chainId": 84532,
    })
    print(f"Raw transaction: {signed.raw_transaction.hex()}")
    ```
  </Tab>
</Tabs>

### Sign a hash

Sign a raw 32-byte hash directly. Useful for custom signing schemes, off-chain commitments, or protocols that require signing pre-hashed data.

<Tabs>
  <Tab title="React">
    ```tsx theme={null}
    import { useSignEvmHash, useEvmAddress } from "@coinbase/cdp-hooks";

    function SignHash() {
      const { signEvmHash } = useSignEvmHash();
      const { evmAddress } = useEvmAddress();

      const handleSign = async () => {
        if (!evmAddress) return;

        const result = await signEvmHash({
          evmAccount: evmAddress,
          hash: "0x1234567890123456789012345678901234567890123456789012345678901234",
        });

        console.log("Signature:", result.signature);
      };

      return <button onClick={handleSign}>Sign Hash</button>;
    }
    ```
  </Tab>

  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    const cdp = new CdpClient();
    const account = await cdp.evm.createAccount();

    const signature = await cdp.evm.signHash({
      address: account.address,
      hash: "0x1234567890123456789012345678901234567890123456789012345678901234",
    });
    console.log("Signature:", signature);
    ```
  </Tab>
</Tabs>

## Solana

### Sign messages

Sign arbitrary data to prove account ownership without sending anything to the blockchain. The hook takes a base64-encoded message and returns an Ed25519 signature.

<Tabs>
  <Tab title="React">
    ```tsx theme={null}
    import { useSignSolanaMessage, useSolanaAddress } from "@coinbase/cdp-hooks";

    function SignMessage() {
      const { signSolanaMessage } = useSignSolanaMessage();
      const { solanaAddress } = useSolanaAddress();

      const handleSign = async () => {
        if (!solanaAddress) return;
        const result = await signSolanaMessage({
          solanaAccount: solanaAddress,
          message: "base64-encoded-message",
        });
        console.log("Signature:", result.signature);
      };

      return <button onClick={handleSign}>Sign Message</button>;
    }
    ```
  </Tab>

  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    const account = await cdp.solana.getOrCreateAccount({ name: "my-account" });
    const { signature } = await account.signMessage({ message: "Hello, world!" });
    console.log("Signature:", signature);
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    account = await cdp.solana.get_or_create_account(name="my-account")
    response = await account.sign_message(message="Hello, world!")
    print(f"Signature: {response}")
    ```
  </Tab>
</Tabs>

### Sign transactions (without broadcasting)

Sign a transaction locally and broadcast it yourself via a custom RPC endpoint.

<Tabs>
  <Tab title="React">
    ```tsx theme={null}
    import { useSignSolanaTransaction, useSolanaAddress } from "@coinbase/cdp-hooks";

    function SignTransaction() {
      const { signSolanaTransaction } = useSignSolanaTransaction();
      const { solanaAddress } = useSolanaAddress();

      const handleSign = async () => {
        if (!solanaAddress) return;
        const result = await signSolanaTransaction({
          solanaAccount: solanaAddress,
          transaction: "base64-encoded-transaction",
        });
        console.log("Signed transaction:", result.signedTransaction);
        // Broadcast result.signedTransaction via your own RPC
      };

      return <button onClick={handleSign}>Sign Transaction</button>;
    }
    ```
  </Tab>

  <Tab title="Node (TypeScript)">
    ```typescript theme={null}
    const signedTx = await cdp.solana.signTransaction({
      address: account.address,
      transaction: serializedTx, // base64-encoded
    });
    // Broadcast signedTx.signature via your own RPC
    console.log("Signed transaction:", signedTx.signature);
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    response = await cdp.solana.sign_transaction(
        address=account.address,
        transaction=serialized_tx,  # base64-encoded
    )
    # Broadcast response.signed_transaction via your own RPC
    print(f"Signed transaction: {response.signed_transaction}")
    ```
  </Tab>
</Tabs>
