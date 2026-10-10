> Coinbase CDP docs — **stablecoins** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Stablecoin Examples

Code examples for common stablecoin scenarios.

<Note>
  These examples assume you've completed the [Quickstart](/custom-stablecoins/stablecoin-contract/quickstart) setup steps (dependencies and environment variables).
</Note>

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    ## Setup

    ```typescript theme={null}
    import { ethers } from "ethers";

    const TOKEN_ADDRESS = "0x57AB1EFE59b1C7b36b1Dc9315B4782bCcBb83721"; // CBTUSD on Base Sepolia

    const ERC20_ABI = [
      "function balanceOf(address account) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function name() view returns (string)",
      "function transfer(address to, uint256 amount) returns (bool)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function transferFrom(address from, address to, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
    ];

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const signer   = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    const token    = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
    ```

    ***

    ## Transfer with memo

    Attach a 32-byte reference to a transfer for off-chain reconciliation — for example, an order ID or payment reference.

    <Warning>
      Memo values are permanently visible on the public blockchain. Do not include sensitive information such as customer names, account numbers, or PII. Use only non-sensitive references (such as a hashed or opaque order ID). If you need to attach sensitive data, encrypt it off-chain before encoding as bytes32 and decrypt it off-chain when reading the event.
    </Warning>

    ```typescript theme={null}
    const MEMO_ABI = [
      "function transferWithMemo(address to, uint256 amount, bytes32 memo) external",
    ];

    const tokenWithMemo = new ethers.Contract(TOKEN_ADDRESS, MEMO_ABI, signer);

    const decimals = await token.decimals();
    const amount   = ethers.parseUnits("10", decimals);
    const memo     = ethers.encodeBytes32String("order-12345"); // up to 31 characters

    const tx = await tokenWithMemo.transferWithMemo(recipientAddress, amount, memo);
    await tx.wait();
    console.log("Transfer with memo confirmed:", tx.hash);
    ```

    ### Read a memo from a transaction

    ```typescript theme={null}
    const MEMO_EVENT_ABI = [
      "event Transfer(address indexed from, address indexed to, uint256 value)",
      "event Memo(bytes32 indexed memo)",
    ];

    const iface   = new ethers.Interface(MEMO_EVENT_ABI);
    const receipt = await provider.getTransactionReceipt(txHash);

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "Memo") {
          const memoString = ethers.decodeBytes32String(parsed.args.memo);
          console.log("Memo:", memoString);
        }
      } catch {
        // Log belongs to a different contract or event
      }
    }
    ```

    ***

    ## Approve and transferFrom

    Delegate spending to a contract or address, then transfer on the owner's behalf:

    ```typescript theme={null}
    // Owner approves a spender for a specific amount
    const approveTx = await token.approve(spenderAddress, ethers.parseUnits("100", decimals));
    await approveTx.wait();

    // Spender transfers on behalf of the owner
    const spenderToken = token.connect(spenderSigner);
    const transferTx   = await spenderToken.transferFrom(ownerAddress, recipientAddress, amount);
    await transferTx.wait();
    ```

    ***

    ## Gasless approvals (ERC-2612 Permit)

    Allow a spender to be approved without the owner paying gas:

    ```typescript theme={null}
    const PERMIT_ABI = [
      "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
      "function nonces(address owner) view returns (uint256)",
      "function name() view returns (string)",
    ];

    const tokenPermit = new ethers.Contract(TOKEN_ADDRESS, PERMIT_ABI, provider);

    const tokenName = await tokenPermit.name();
    const nonce     = await tokenPermit.nonces(signer.address);
    const deadline  = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    const domain = {
      name: tokenName,
      version: "1",
      chainId: (await provider.getNetwork()).chainId,
      verifyingContract: TOKEN_ADDRESS,
    };

    const types = {
      Permit: [
        { name: "owner",    type: "address" },
        { name: "spender",  type: "address" },
        { name: "value",    type: "uint256" },
        { name: "nonce",    type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const values = {
      owner: signer.address,
      spender: spenderAddress,
      value: amount,
      nonce,
      deadline,
    };

    // Owner signs off-chain — no gas required
    const signature = await signer.signTypedData(domain, types, values);
    const { v, r, s } = ethers.Signature.from(signature);

    // Anyone can submit the permit, often bundled with the spending transaction
    const tokenWithPermit = new ethers.Contract(TOKEN_ADDRESS, PERMIT_ABI, relayerSigner);
    await tokenWithPermit.permit(signer.address, spenderAddress, amount, deadline, v, r, s);
    ```

    ***

    ## Gasless transfers (ERC-3009)

    Allow a token holder to authorize a specific transfer without paying gas:

    ```typescript theme={null}
    const ERC3009_ABI = [
      "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external",
      "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
    ];

    const tokenERC3009 = new ethers.Contract(TOKEN_ADDRESS, ERC3009_ABI, provider);

    const tokenName   = await token.name();
    const nonce       = ethers.hexlify(ethers.randomBytes(32)); // random, not sequential
    const validAfter  = 0n;
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

    const domain = {
      name: tokenName,
      version: "1",
      chainId: (await provider.getNetwork()).chainId,
      verifyingContract: TOKEN_ADDRESS,
    };

    const types = {
      TransferWithAuthorization: [
        { name: "from",        type: "address" },
        { name: "to",          type: "address" },
        { name: "value",       type: "uint256" },
        { name: "validAfter",  type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce",       type: "bytes32" },
      ],
    };

    const values = {
      from: signer.address,
      to: recipientAddress,
      value: amount,
      validAfter,
      validBefore,
      nonce,
    };

    // Token holder signs off-chain — no gas required
    const signature = await signer.signTypedData(domain, types, values);
    const { v, r, s } = ethers.Signature.from(signature);

    // Any relayer can submit the transfer on-chain
    const tx = await tokenERC3009
      .connect(relayerSigner)
      .transferWithAuthorization(signer.address, recipientAddress, amount, validAfter, validBefore, nonce, v, r, s);
    await tx.wait();
    console.log("Gasless transfer confirmed:", tx.hash);
    ```

    ### Restrict submission to the recipient (anti-front-running)

    Use `receiveWithAuthorization` when you want only the intended recipient to be able to submit the transaction:

    ```typescript theme={null}
    const RECEIVE_ABI = [
      "function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external",
    ];

    // Sign the same way but use ReceiveWithAuthorization typehash
    const types = {
      ReceiveWithAuthorization: [
        { name: "from",        type: "address" },
        { name: "to",          type: "address" },
        { name: "value",       type: "uint256" },
        { name: "validAfter",  type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce",       type: "bytes32" },
      ],
    };

    const signature = await signer.signTypedData(domain, types, values);
    const { v, r, s } = ethers.Signature.from(signature);

    // Only `recipientSigner` (the `to` address) can submit this
    const tokenReceive = new ethers.Contract(TOKEN_ADDRESS, RECEIVE_ABI, recipientSigner);
    await tokenReceive.receiveWithAuthorization(
      signer.address, recipientAddress, amount, validAfter, validBefore, nonce, v, r, s
    );
    ```

    ### Cancel a signed authorization

    If a token holder signs an ERC-3009 authorization and changes their mind before any relayer submits it, they can void the nonce by signing a `CancelAuthorization` message:

    ```typescript theme={null}
    const CANCEL_ABI = [
      "function cancelAuthorization(address authorizer, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external",
    ];

    const cancelTypes = {
      CancelAuthorization: [
        { name: "authorizer", type: "address" },
        { name: "nonce",      type: "bytes32" },
      ],
    };

    const cancelValues = { authorizer: signer.address, nonce };

    const cancelSignature = await signer.signTypedData(domain, cancelTypes, cancelValues);
    const { v: cv, r: cr, s: cs } = ethers.Signature.from(cancelSignature);

    const tokenCancel = new ethers.Contract(TOKEN_ADDRESS, CANCEL_ABI, relayerSigner);
    await tokenCancel.cancelAuthorization(signer.address, nonce, cv, cr, cs);
    ```

    ***

    ## Listen for on-chain events

    Real-time event subscriptions are essential for balance tracking, order reconciliation, and detecting safety-control state changes.

    ### Subscribe to live events

    ```typescript theme={null}
    const EVENTS_ABI = [
      "event Transfer(address indexed from, address indexed to, uint256 value)",
      "event Memo(bytes32 indexed memo)",
      "event Paused(address account)",
      "event Unpaused(address account)",
      "event BlocklistStatusUpdated(address indexed account, bool blocklisted)",
    ];

    const eventsToken = new ethers.Contract(TOKEN_ADDRESS, EVENTS_ABI, provider);

    // Transfers involving a specific address — useful for balance tracking
    const filterIn  = eventsToken.filters.Transfer(null, walletAddress);
    const filterOut = eventsToken.filters.Transfer(walletAddress, null);

    eventsToken.on(filterIn, (from, to, value, event) => {
      console.log(`Received ${value} from ${from} at block ${event.log.blockNumber}`);
    });

    eventsToken.on(filterOut, (from, to, value, event) => {
      console.log(`Sent ${value} to ${to} at block ${event.log.blockNumber}`);
    });

    // Safety controls — update your application state when these fire
    eventsToken.on("Paused",   () => console.log("Transfers paused"));
    eventsToken.on("Unpaused", () => console.log("Transfers resumed"));
    eventsToken.on("BlocklistStatusUpdated", (account, blocklisted) => {
      console.log(`Blocklist update: ${account} = ${blocklisted}`);
    });
    ```

    ### Query historical events

    ```typescript theme={null}
    // Fetch all transfers to a wallet in the last ~24 hours (Base: ~2s blocks)
    const currentBlock = await provider.getBlockNumber();
    const fromBlock    = currentBlock - 43200; // ~24h on Base

    const filter = eventsToken.filters.Transfer(null, walletAddress);
    const events = await eventsToken.queryFilter(filter, fromBlock, currentBlock);

    for (const event of events) {
      console.log({
        from:    event.args.from,
        value:   event.args.value.toString(),
        txHash:  event.transactionHash,
        block:   event.blockNumber,
      });
    }
    ```
  </Tab>

  <Tab title="Solana Virtual Machine">
    ## Setup

    ```typescript theme={null}
    import {
      Connection,
      Keypair,
      PublicKey,
      Transaction,
      sendAndConfirmTransaction,
    } from "@solana/web3.js";
    import {
      getMint,
      getAccount,
      getAssociatedTokenAddress,
      getOrCreateAssociatedTokenAccount,
      createTransferInstruction,
      transfer,
    } from "@solana/spl-token";
    import * as fs from "fs";

    const MINT_ADDRESS = new PublicKey("5P6MkoaCd9byPxH4X99kgKtS6SiuCQ67ZPCJzpXGkpCe"); // CBTUSD on devnet

    const connection = new Connection(process.env.RPC_URL!);
    const keyData    = JSON.parse(fs.readFileSync(process.env.WALLET_PATH!, "utf-8"));
    const payer      = Keypair.fromSecretKey(Uint8Array.from(keyData));
    ```

    ***

    ## Transfer to a recipient

    ```typescript theme={null}
    const RECIPIENT_WALLET = new PublicKey("recipient-wallet-address");

    // Ensure the recipient's token account exists before transferring
    const recipientAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      MINT_ADDRESS,
      RECIPIENT_WALLET
    );

    const sourceAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      MINT_ADDRESS,
      payer.publicKey
    );

    const mintInfo = await getMint(connection, MINT_ADDRESS);
    const amount   = BigInt(10) * BigInt(10 ** mintInfo.decimals); // 10 tokens

    const sig = await transfer(
      connection,
      payer,
      sourceAccount.address,
      recipientAccount.address,
      payer,
      amount
    );
    console.log("Transfer confirmed:", sig);
    ```

    ***

    ## Batch transfers in one transaction

    Combine multiple transfers into a single transaction to reduce fees:

    ```typescript theme={null}
    const recipients = [
      { wallet: new PublicKey("recipient-1"), amount: BigInt(1_000_000) },
      { wallet: new PublicKey("recipient-2"), amount: BigInt(2_000_000) },
      { wallet: new PublicKey("recipient-3"), amount: BigInt(500_000) },
    ];

    const sourceAta   = await getAssociatedTokenAddress(MINT_ADDRESS, payer.publicKey);
    const transaction = new Transaction();

    for (const { wallet, amount } of recipients) {
      const destinationAta = await getAssociatedTokenAddress(MINT_ADDRESS, wallet);
      transaction.add(
        createTransferInstruction(
          sourceAta,
          destinationAta,
          payer.publicKey,
          amount
        )
      );
    }

    const sig = await sendAndConfirmTransaction(connection, transaction, [payer]);
    console.log("Batch transfer confirmed:", sig);
    ```

    ***

    ## Read token account info

    ```typescript theme={null}
    const ataAddress = await getAssociatedTokenAddress(MINT_ADDRESS, payer.publicKey);
    const account    = await getAccount(connection, ataAddress);
    const mintInfo   = await getMint(connection, MINT_ADDRESS);

    console.log("Balance:", Number(account.amount) / Math.pow(10, mintInfo.decimals));
    console.log("Is frozen:", account.isFrozen);
    ```

    ***

    ## Subscribe to balance changes

    Solana doesn't emit token-transfer events the way EVM does. Instead, subscribe to token-account changes via the WebSocket RPC:

    ```typescript theme={null}
    import { AccountLayout } from "@solana/spl-token";

    const ataAddress = await getAssociatedTokenAddress(MINT_ADDRESS, payer.publicKey);

    const subscriptionId = connection.onAccountChange(
      ataAddress,
      (accountInfo) => {
        const decoded = AccountLayout.decode(accountInfo.data);
        console.log("Balance changed:", decoded.amount.toString());
        console.log("Is frozen:",       decoded.state === 2); // 2 = frozen
      },
      { commitment: "confirmed" }
    );

    // Later, when you no longer need updates:
    await connection.removeAccountChangeListener(subscriptionId);
    ```
  </Tab>
</Tabs>

***

## What to read next

<CardGroup cols={2}>
  <Card title="Production Readiness" icon="shield-check" href="/custom-stablecoins/stablecoin-contract/production-readiness">
    Best practices for production integrations
  </Card>

  <Card title="Troubleshooting" icon="triangle-exclamation" href="/custom-stablecoins/stablecoin-contract/troubleshooting">
    Common errors and solutions
  </Card>

  <Card title="Reference" icon="book" href="/custom-stablecoins/stablecoin-contract/reference">
    Full function and program reference
  </Card>

  <Card title="Quickstart" icon="rocket" href="/custom-stablecoins/stablecoin-contract/quickstart">
    Back to quickstart
  </Card>
</CardGroup>
