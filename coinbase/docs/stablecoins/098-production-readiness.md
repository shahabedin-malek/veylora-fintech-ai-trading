> Coinbase CDP docs — **stablecoins** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Production Readiness

Everything you need before going live with your stablecoin integration.

## Best practices

### Handle blocklist and pause

Your stablecoin has two safety controls managed by Coinbase that your integration must handle gracefully.

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    Check both before sending a transaction to avoid unnecessary gas costs on a revert:

    ```typescript theme={null}
    const PAUSE_ABI = ["function paused() view returns (bool)"];
    const pausable  = new ethers.Contract(TOKEN_ADDRESS, PAUSE_ABI, provider);

    const paused      = await pausable.paused();
    const fromBlocked = await token.isBlocklisted(fromAddress);
    const toBlocked   = await token.isBlocklisted(toAddress);

    if (paused)       throw new Error("transfers are paused");
    if (fromBlocked)  throw new Error("sender is blocklisted");
    if (toBlocked)    throw new Error("recipient is blocklisted");
    ```
  </Tab>

  <Tab title="Solana Virtual Machine">
    Check account frozen status before transferring:

    ```typescript theme={null}
    import { getAccount } from "@solana/spl-token";

    async function canTransfer(connection: Connection, ataAddress: PublicKey) {
      const account = await getAccount(connection, ataAddress);
      if (account.isFrozen) {
        throw new Error("Token account is frozen — contact Coinbase support");
      }
    }
    ```
  </Tab>
</Tabs>

***

### Token decimals

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    Always read decimals from the contract rather than hardcoding. Your stablecoin's decimals are set at deployment and can be between 6 and 18.

    ```typescript theme={null}
    const decimals = await token.decimals();
    const amount   = ethers.parseUnits("100", decimals);
    ```
  </Tab>

  <Tab title="Solana Virtual Machine">
    Read decimals from the mint account:

    ```typescript theme={null}
    const mintInfo = await getMint(connection, MINT_ADDRESS);
    const amount   = BigInt(100) * BigInt(10 ** mintInfo.decimals);
    ```
  </Tab>
</Tabs>

***

### ERC-20 approvals (Base only)

When building a contract that pulls tokens from users (for example, a payment processor), prefer `permit` or ERC-3009 over requiring a prior `approve` transaction — this reduces friction and the number of on-chain steps for your users.

If you do use `approve`, avoid approving `MaxUint256` in production:

```typescript theme={null}
// Prefer: approve exact amounts
await token.approve(spenderAddress, exactAmount);

// Avoid in production: unlimited approval
await token.approve(spenderAddress, ethers.MaxUint256);
```

***

### Memo security

<Warning>
  Memo values are permanently visible on the public blockchain. Only store non-sensitive references such as hashed or opaque IDs. If you must attach sensitive data, encrypt it off-chain before encoding as bytes32 and decrypt off-chain when reading the event.
</Warning>

***

### Signed transfer security

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    When accepting signed ERC-3009 authorizations from users:

    1. Always verify `authorizationState(from, nonce)` is `false` before presenting a transaction for signature — do not show users a "sign" prompt for a nonce that is already used
    2. Set a reasonable `validBefore` (minutes to hours, not days) to limit exposure if a signature is compromised
    3. Use `receiveWithAuthorization` instead of `transferWithAuthorization` when only the recipient should be able to submit the transaction
  </Tab>

  <Tab title="Solana Virtual Machine">
    Standard SPL Token transfers are signed directly by the owner — no off-chain authorization flow is required. Use the standard `transfer` instruction with the owner as the signer.
  </Tab>
</Tabs>

***

## Security considerations

<Accordion title="Verify addresses">
  1. **Confirm the contract or mint address** against [Key Addresses](/custom-stablecoins/conversions/stableswapper-contract/key-addresses) before sending transactions
  2. **Validate all user-supplied addresses** before using them as transfer recipients
  3. **Check `isBlocklisted`** on user addresses before building transactions that include them — this prevents predictable reverts
</Accordion>

<Accordion title="Test thoroughly">
  1. **Test on testnet first** with small amounts
  2. **Cover error paths** — blocklisted address, paused contract, expired permit, insufficient balance
  3. **Verify memo encoding/decoding** end-to-end if your integration uses memos
</Accordion>

<Accordion title="Handle failures gracefully">
  1. **Never assume success** — always wait for confirmation and check the transaction receipt
  2. **Distinguish validation errors** (do not retry) from transient network errors (safe to retry with backoff)
  3. **Provide clear error messages** to users — the [Troubleshooting guide](/custom-stablecoins/stablecoin-contract/troubleshooting) maps on-chain errors to user-facing messages
</Accordion>

<Accordion title="Monitor on-chain events">
  Subscribe to relevant events to keep your off-chain systems in sync:

  | Event | Action |
  | - | - |
  | `Transfer` | Update balance records |
  | `Memo` | Correlate with off-chain orders |
  | `Paused` | Halt outgoing transfers, surface status to users |
  | `Unpaused` | Resume transfers |
  | `BlocklistStatusUpdated` | Re-check affected addresses |
</Accordion>

***

## Pre-flight checklist

Before sending a transaction in production, verify:

<Tabs>
  <Tab title="Ethereum Virtual Machine">
    * Sender has sufficient token balance
    * Sender has sufficient ETH for gas
    * Neither the sender nor recipient is blocklisted (`isBlocklisted`)
    * Transfers are not paused
    * If using `transferFrom`: the spender's allowance covers the amount
    * If using `permit`: the nonce matches `nonces(owner)` and the deadline is in the future
    * If using ERC-3009: the nonce has not been used (`authorizationState`) and `validBefore` is in the future
    * Contract address matches [Key Addresses](/custom-stablecoins/conversions/stableswapper-contract/key-addresses)
  </Tab>

  <Tab title="Solana Virtual Machine">
    * Sender has sufficient token balance
    * Sender has sufficient SOL for fees (\~0.000005 SOL per transaction, plus \~0.002 SOL if creating a new token account)
    * Destination token account exists, or ATA creation is prepended to the transaction
    * Source and destination token accounts are not frozen
    * Mint address matches [Key Addresses](/custom-stablecoins/conversions/stableswapper-contract/key-addresses)
  </Tab>
</Tabs>

***

## What to read next

<CardGroup cols={2}>
  <Card title="Troubleshooting" icon="triangle-exclamation" href="/custom-stablecoins/stablecoin-contract/troubleshooting">
    Common errors and solutions
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
