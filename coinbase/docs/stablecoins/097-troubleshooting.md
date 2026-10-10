> Coinbase CDP docs — **stablecoins** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Troubleshooting

Common errors when integrating with your custom stablecoin and how to resolve them.

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    ## Common errors

    ### AddressBlocklisted

    **Error:** Transaction reverts with `AddressBlocklisted(address)`

    **Solution:** The sender, recipient, or caller address is on the blocklist. Use `isBlocklisted(address)` to check status before sending. If you believe this is an error, contact Coinbase support.

    ```typescript theme={null}
    const isBlocked = await token.isBlocklisted(walletAddress);
    if (isBlocked) {
      throw new Error("Address is blocked from transfers");
    }
    ```

    ***

    ### EnforcedPause

    **Error:** Transaction reverts with `EnforcedPause()`

    **Solution:** All transfers on this stablecoin are currently paused. Monitor the `Unpaused` event to detect when transfers resume. Do not retry until the contract is unpaused.

    ```typescript theme={null}
    // Listen for the Unpaused event
    token.once("Unpaused", () => {
      console.log("Transfers resumed");
    });
    ```

    ***

    ### ERC20InsufficientBalance

    **Error:** Transaction reverts with `ERC20InsufficientBalance`

    **Solution:** The sender does not have enough tokens. Check the balance before sending:

    ```typescript theme={null}
    const balance = await token.balanceOf(signer.address);
    if (balance < amount) {
      throw new Error(`Insufficient balance: have ${balance}, need ${amount}`);
    }
    ```

    ***

    ### ERC20InsufficientAllowance

    **Error:** Transaction reverts with `ERC20InsufficientAllowance`

    **Solution:** The caller's spending allowance is insufficient for `transferFrom`. Call `approve` on the token contract first:

    ```typescript theme={null}
    const allowance = await token.allowance(ownerAddress, spenderAddress);
    if (allowance < amount) {
      await token.approve(spenderAddress, amount);
    }
    ```

    ***

    ### ERC2612ExpiredSignature

    **Error:** `permit` call reverts with `ERC2612ExpiredSignature`

    **Solution:** The permit deadline has passed. Generate a new signature with a future deadline:

    ```typescript theme={null}
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    ```

    ***

    ### ERC2612InvalidSigner

    **Error:** `permit` call reverts with `ERC2612InvalidSigner`

    **Solution:** The signature does not match the `owner` address, or the nonce is stale. Ensure you are:

    1. Signing with the correct wallet (the token owner)
    2. Reading the current nonce with `nonces(owner)` immediately before signing
    3. Using the correct `verifyingContract` (the token address, not the spender)
    4. Setting the EIP-712 domain `name` to the exact value returned by `token.name()` and `version` to `"1"` — a mismatch in either field produces an invalid signature

    The same domain rules apply to ERC-3009 `transferWithAuthorization` signatures.

    ***

    ### AuthorizationAlreadyUsed

    **Error:** ERC-3009 call reverts with `AuthorizationAlreadyUsed(authorizer, nonce)`

    **Solution:** The nonce has already been consumed or canceled. Generate a new random nonce for each authorization:

    ```typescript theme={null}
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    ```

    Check whether a nonce has been used before submitting:

    ```typescript theme={null}
    const used = await token.authorizationState(fromAddress, nonce);
    if (used) throw new Error("Authorization nonce already used");
    ```

    ***

    ### AuthorizationExpired

    **Error:** ERC-3009 call reverts with `AuthorizationExpired(validBefore)`

    **Solution:** The authorization's `validBefore` timestamp has passed. Have the token holder sign a new authorization with a future `validBefore`.

    ***

    ### AuthorizationNotYetValid

    **Error:** ERC-3009 call reverts with `AuthorizationNotYetValid(validAfter)`

    **Solution:** The authorization cannot be submitted yet. Either wait until after `validAfter`, or set `validAfter` to `0` for authorizations that should be valid immediately.

    ***

    ### CallerMustBePayee

    **Error:** `receiveWithAuthorization` reverts with `CallerMustBePayee(caller, payee)`

    **Solution:** `receiveWithAuthorization` can only be submitted by the `to` address. Ensure the transaction is signed and sent by the intended recipient, or use `transferWithAuthorization` if any relayer should be able to submit.

    ***

    ### Insufficient gas

    **Error:** Transaction fails with `insufficient funds for gas`

    **Solution:** You need Base Sepolia ETH for gas. Get testnet ETH from [CDP Faucet](/faucets/introduction/quickstart).
  </Tab>

  <Tab title="Solana Virtual Machine">
    ## Common errors

    ### AccountNotInitialized

    **Error:** `Account not initialized` or `Invalid account data for instruction`

    **Solution:** The destination token account does not exist. Use `getOrCreateAssociatedTokenAccount` before transferring to ensure the account is created:

    ```typescript theme={null}
    const recipientAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,          // pays rent if account needs creating
      MINT_ADDRESS,
      recipientWallet
    );
    ```

    ***

    ### TokenAccountNotFound

    **Error:** `TokenAccountNotFound`

    **Solution:** You are trying to read or transfer from a token account that doesn't exist for your wallet. Create the ATA first:

    ```typescript theme={null}
    import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";

    const account = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      MINT_ADDRESS,
      payer.publicKey
    );
    ```

    ***

    ### Insufficient lamports

    **Error:** `insufficient lamports` or `insufficient funds for rent`

    **Solution:** You need more SOL. A typical transfer costs \~0.000005 SOL in fees, plus \~0.002 SOL rent if creating a new token account. Get devnet SOL from [CDP Faucet](/faucets/introduction/quickstart).

    ***

    ### InsufficientFunds

    **Error:** Transfer fails with insufficient token balance

    **Solution:** Check the token balance before sending:

    ```typescript theme={null}
    const account  = await getAccount(connection, sourceAta);
    const mintInfo = await getMint(connection, MINT_ADDRESS);
    const balance  = Number(account.amount) / Math.pow(10, mintInfo.decimals);
    if (balance < transferAmount) {
      throw new Error(`Insufficient balance: ${balance}`);
    }
    ```

    ***

    ### Account is frozen

    **Error:** Transfer fails because the token account is frozen

    **Solution:** The token account has been frozen by Coinbase. Check the `isFrozen` field on the account:

    ```typescript theme={null}
    const account = await getAccount(connection, ataAddress);
    if (account.isFrozen) {
      throw new Error("Token account is frozen — contact Coinbase support");
    }
    ```
  </Tab>
</Tabs>

***

## What to read next

<CardGroup cols={2}>
  <Card title="Production Readiness" icon="shield-check" href="/custom-stablecoins/stablecoin-contract/production-readiness">
    Best practices for production integrations
  </Card>

  <Card title="Examples" icon="code" href="/custom-stablecoins/stablecoin-contract/examples">
    Code samples for common scenarios
  </Card>

  <Card title="Reference" icon="book" href="/custom-stablecoins/stablecoin-contract/reference">
    Full function and program reference
  </Card>

  <Card title="Quickstart" icon="rocket" href="/custom-stablecoins/stablecoin-contract/quickstart">
    Back to quickstart
  </Card>
</CardGroup>
