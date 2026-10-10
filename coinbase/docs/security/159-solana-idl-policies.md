> Coinbase CDP docs — **security** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Solana IDL Policies

export const Tags = ({tags, className}) => {
  if (!tags || !Array.isArray(tags)) {
    return null;
  }
  return <div className={`mt-5 mb-5 flex flex-row flex-wrap gap-2 ${className}`}>
      {tags.map((tag, index) => <span key={index} className="text-sm text-[#733E00] dark:text-yellow-500 bg-[#FFFCF1] dark:bg-yellow-500/10 font-semibold px-2 py-1 rounded-lg">{tag}</span>)}
    </div>;
};

<Tags tags={["Solana", "API Key Wallet"]} />

The `solData` criterion provides advanced validation of Solana transaction instruction data using Interface Definition Language (IDL) specifications. It decodes and validates instruction parameters against specific rules before signing, and applies to **API key authentication** wallets only.

For general policy setup, see the [Policy Engine Overview](/wallets/security-and-policies/policy-engine/overview). For common Solana policy patterns, see [Solana Policies](/wallets/security-and-policies/policy-engine/solana-policies).

## How solData works

A `solData` criterion specifies which Solana programs to validate via the `idls` field, then defines instruction-level validation rules via the `conditions` field.

The `idls` field accepts either:

* [Known program shortcuts](/wallets/security-and-policies/policy-engine/solana-idl-policies#known-program-shortcuts) — `"SystemProgram"`, `"TokenProgram"`, `"AssociatedTokenProgram"`
* [Custom IDL objects](/wallets/security-and-policies/policy-engine/solana-idl-policies#custom-idl-objects) for any other program

## IDL specifications

### Anchor IDL format

IDL specifications must follow Anchor's IDL format v0.30+. To convert older formats:

<Note>Requires the Anchor CLI. See the [Anchor installation guide](https://www.anchor-lang.com/docs/installation) if you haven't installed it yet.</Note>

```bash theme={null}
anchor idl convert path/to/idl.json -o path/to/idl.json
```

### Supported argument types

Primitive types supported: `bool`, `string`, `pubkey`, `u8`–`u256`, `i8`–`i256`, `f32`, `f64`.

Complex types (user-defined types, arrays, vectors, optionals) are not currently supported. Reach out on [CDP Discord](https://discord.com/invite/cdp) if you need them.

## Instruction discriminators

Discriminators are unique byte sequences that identify instructions within a program:

| Program Type | Format | Size | Example |
| - | - | - | - |
| Known program shortcuts (`"SystemProgram"`, `"TokenProgram"`, `"AssociatedTokenProgram"`) | 8-byte SHA256 of `"global:instruction_name"` (Anchor-style) | 8 bytes | SystemProgram `transfer` = `[163,52,200,231,140,3,69,186]` |
| Custom Anchor programs | 8-byte SHA256 of `"global:instruction_name"` (Anchor-style) | 8 bytes | — |

<Warning>
  The known program shortcuts use the 8-byte Anchor-style discriminator above, **not** each program's real native format (e.g. SystemProgram's 4-byte u32, SPL Token's 1-byte enum). A `solData` policy built with a known program shortcut will **not** match a genuine on-chain transaction from a wallet or other native tooling — only instruction data built with the 8-byte discriminator, as in the decoder-only test fixtures below.
</Warning>

## IDL configuration

### Known program shortcuts

Use predefined names for common programs instead of providing full IDL objects:

* `"SystemProgram"` — Native Solana system program
* `"TokenProgram"` — SPL Token program
* `"AssociatedTokenProgram"` — Associated Token Account program

### Custom IDL objects

For custom programs, provide IDL objects with:

* **address** — The program's public key
* **instructions** — Array of instruction definitions, each with `name`, `discriminator`, and `args`

## Conditions

### Evaluation logic

* Multiple conditions in a `solData` criterion are evaluated with **OR** logic — any matching condition passes
* Parameters within a condition are evaluated with **AND** logic — all must match

### Condition structure

Each condition includes:

* **instruction** — Name matching an instruction in one of the provided IDLs
* **params** (optional) — Array of parameter validations, each with `name`, `operator` (`==`, `<=`, `>=`, `<`, `>`, `!=`, `in`, `not in`), and `value` or `values`

## Examples

### Using known program shortcuts

<CodeGroup>
  ```typescript Node (TypeScript) theme={null}
  import { CdpClient } from "@coinbase/cdp-sdk";
  import "dotenv/config";

  const cdp = new CdpClient();

  const policy = await cdp.policies.createPolicy({
    policy: {
      scope: "account",
      description: "solData policy using known IDLs",
      rules: [
        {
          action: "accept",
          operation: "signSolTransaction",
          criteria: [
            {
              type: "solData",
              idls: ["SystemProgram", "TokenProgram", "AssociatedTokenProgram"],
              conditions: [
                {
                  instruction: "transfer",
                  params: [{ name: "lamports", operator: "<=", value: "1000000" }],
                },
                {
                  instruction: "transfer_checked",
                  params: [
                    { name: "amount", operator: "<=", value: "100000" },
                    { name: "decimals", operator: "==", value: "6" },
                  ],
                },
                { instruction: "create" },
              ],
            },
          ],
        },
      ],
    },
  });

  console.log("Created solData policy:", policy.id);

  const account = await cdp.solana.getOrCreateAccount({ name: "MyAccount" });
  await cdp.solana.updateAccount({
    address: account.address,
    update: { accountPolicy: policy.id },
  });
  ```

  ```python Python theme={null}
  import asyncio
  from cdp import CdpClient
  from cdp.update_account_types import UpdateAccountOptions
  from cdp.policies.types import (
      CreatePolicyOptions,
      SignSolanaTransactionRule,
      SolDataCriterion,
      SolDataCondition,
      SolDataParameterCondition,
  )
  from dotenv import load_dotenv

  load_dotenv()

  async def main():
      async with CdpClient() as cdp:
          policy = await cdp.policies.create_policy(
              policy=CreatePolicyOptions(
                  scope="account",
                  description="solData policy using known IDLs",
                  rules=[
                      SignSolanaTransactionRule(
                          action="accept",
                          operation="signSolTransaction",
                          criteria=[
                              SolDataCriterion(
                                  type="solData",
                                  idls=["SystemProgram", "TokenProgram", "AssociatedTokenProgram"],
                                  conditions=[
                                      SolDataCondition(
                                          instruction="transfer",
                                          params=[SolDataParameterCondition(name="lamports", operator="<=", value="1000000")],
                                      ),
                                      SolDataCondition(
                                          instruction="transfer_checked",
                                          params=[
                                              SolDataParameterCondition(name="amount", operator="<=", value="100000"),
                                              SolDataParameterCondition(name="decimals", operator="==", value="6"),
                                          ],
                                      ),
                                      SolDataCondition(instruction="create"),
                                  ],
                              )
                          ],
                      )
                  ],
              )
          )
          print(f"Created solData policy: {policy.id}")

          account = await cdp.solana.get_or_create_account(name="MyAccount")
          await cdp.solana.update_account(
              address=account.address,
              update=UpdateAccountOptions(account_policy=policy.id),
          )

  asyncio.run(main())
  ```
</CodeGroup>

### Using custom IDL objects

<CodeGroup>
  ```typescript Node (TypeScript) theme={null}
  import { CdpClient } from "@coinbase/cdp-sdk";

  const cdp = new CdpClient();

  const policy = await cdp.policies.createPolicy({
    policy: {
      scope: "account",
      description: "solData policy with custom IDLs",
      rules: [
        {
          action: "accept",
          operation: "signSolTransaction",
          criteria: [
            {
              type: "solData",
              idls: [
                {
                  address: "11111111111111111111111111111111",
                  instructions: [
                    {
                      name: "transfer",
                      discriminator: [163, 52, 200, 231, 140, 3, 69, 186],
                      args: [{ name: "lamports", type: "u64" }],
                    },
                  ],
                },
                {
                  address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                  instructions: [
                    {
                      name: "transfer_checked",
                      discriminator: [119, 250, 202, 24, 253, 135, 244, 121],
                      args: [
                        { name: "amount", type: "u64" },
                        { name: "decimals", type: "u8" },
                      ],
                    },
                  ],
                },
              ],
              conditions: [
                {
                  instruction: "transfer",
                  params: [{ name: "lamports", operator: "<=", value: "1000000" }],
                },
                {
                  instruction: "transfer_checked",
                  params: [
                    { name: "amount", operator: "<=", value: "100000" },
                    { name: "decimals", operator: "==", value: "6" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });

  console.log("Created custom IDL solData policy:", policy.id);
  ```

  ```python Python theme={null}
  import asyncio
  from cdp import CdpClient
  from cdp.openapi_client.models.idl import Idl
  from cdp.policies.types import (
      CreatePolicyOptions,
      SignSolanaTransactionRule,
      SolDataCriterion,
      SolDataCondition,
      SolDataParameterCondition,
  )

  async def main():
      async with CdpClient() as cdp:
          policy = await cdp.policies.create_policy(
              policy=CreatePolicyOptions(
                  scope="account",
                  description="solData policy with custom IDLs",
                  rules=[
                      SignSolanaTransactionRule(
                          action="accept",
                          operation="signSolTransaction",
                          criteria=[
                              SolDataCriterion(
                                  type="solData",
                                  idls=[
                                      Idl(
                                          address="11111111111111111111111111111111",
                                          instructions=[{
                                              "name": "transfer",
                                              "discriminator": [163, 52, 200, 231, 140, 3, 69, 186],
                                              "args": [{"name": "lamports", "type": "u64"}],
                                          }],
                                      ),
                                      Idl(
                                          address="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
                                          instructions=[{
                                              "name": "transfer_checked",
                                              "discriminator": [119, 250, 202, 24, 253, 135, 244, 121],
                                              "args": [
                                                  {"name": "amount", "type": "u64"},
                                                  {"name": "decimals", "type": "u8"},
                                              ],
                                          }],
                                      ),
                                  ],
                                  conditions=[
                                      SolDataCondition(
                                          instruction="transfer",
                                          params=[SolDataParameterCondition(name="lamports", operator="<=", value="1000000")],
                                      ),
                                      SolDataCondition(
                                          instruction="transfer_checked",
                                          params=[
                                              SolDataParameterCondition(name="amount", operator="<=", value="100000"),
                                              SolDataParameterCondition(name="decimals", operator="==", value="6"),
                                          ],
                                      ),
                                  ],
                              )
                          ],
                      )
                  ],
              )
          )
          print(f"Created custom IDL solData policy: {policy.id}")

  asyncio.run(main())
  ```
</CodeGroup>

<Accordion title="Building Anchor-formatted instructions for the above examples">
  <Note>
    These snippets build instruction data in the format the policy decoder expects, not the format the target native program expects. Each function targets a real native program ID (SystemProgram, SPL Token, etc.) but prepends the synthetic 8-byte discriminator instead of that program's real native format. If signed and sent, the native program would reject them at execution. Use them only to construct test data for exercising a `solData` policy.
  </Note>

  <CodeGroup>
    ```typescript Node (TypeScript) theme={null}
    import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
    import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

    function createAnchorSystemTransferInstruction(amount: bigint): TransactionInstruction {
      const testAccount = Keypair.generate().publicKey;
      const data = Buffer.concat([
        Buffer.from([163, 52, 200, 231, 140, 3, 69, 186]),
        (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(amount); return b; })(),
      ]);
      return new TransactionInstruction({
        keys: [
          { pubkey: testAccount, isSigner: true, isWritable: true },
          { pubkey: testAccount, isSigner: false, isWritable: true },
        ],
        programId: new PublicKey("11111111111111111111111111111111"),
        data,
      });
    }

    function createAnchorSPLTransferCheckedInstruction(amount: number, decimals: number): TransactionInstruction {
      const testAccount = Keypair.generate().publicKey;
      const amountBuf = Buffer.alloc(8); amountBuf.writeBigUInt64LE(BigInt(amount));
      const decimalsBuf = Buffer.alloc(1); decimalsBuf.writeUInt8(decimals);
      const data = Buffer.concat([Buffer.from([119, 250, 202, 24, 253, 135, 244, 121]), amountBuf, decimalsBuf]);
      return new TransactionInstruction({
        keys: [
          { pubkey: testAccount, isSigner: false, isWritable: true },
          { pubkey: testAccount, isSigner: false, isWritable: false },
          { pubkey: testAccount, isSigner: false, isWritable: true },
          { pubkey: testAccount, isSigner: true, isWritable: false },
        ],
        programId: TOKEN_PROGRAM_ID,
        data,
      });
    }

    function createAnchorAssociatedTokenAccountCreateInstruction(): TransactionInstruction {
      const testAccount = Keypair.generate().publicKey;
      return new TransactionInstruction({
        keys: Array(6).fill({ pubkey: testAccount, isSigner: false, isWritable: false }),
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        data: Buffer.from([24, 30, 200, 40, 5, 28, 7, 119]),
      });
    }
    ```

    ```python Python theme={null}
    import struct
    from solders.keypair import Keypair
    from solders.pubkey import Pubkey
    from solders.system_program import ID as SYSTEM_PROGRAM_ID
    from solders.instruction import Instruction, AccountMeta

    def create_anchor_system_transfer_instruction(amount: int) -> Instruction:
        test_account = Keypair().pubkey()
        data = bytes([163, 52, 200, 231, 140, 3, 69, 186]) + struct.pack("<Q", amount)
        return Instruction(
            program_id=SYSTEM_PROGRAM_ID,
            data=data,
            accounts=[
                AccountMeta(pubkey=test_account, is_signer=True, is_writable=True),
                AccountMeta(pubkey=test_account, is_signer=False, is_writable=True),
            ],
        )

    def create_anchor_spl_transfer_checked_instruction(amount: int, decimals: int) -> Instruction:
        test_account = Keypair().pubkey()
        data = bytes([119, 250, 202, 24, 253, 135, 244, 121]) + struct.pack("<Q", amount) + struct.pack("<B", decimals)
        return Instruction(
            program_id=Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
            data=data,
            accounts=[
                AccountMeta(pubkey=test_account, is_signer=False, is_writable=True),
                AccountMeta(pubkey=test_account, is_signer=False, is_writable=False),
                AccountMeta(pubkey=test_account, is_signer=False, is_writable=True),
                AccountMeta(pubkey=test_account, is_signer=True, is_writable=False),
            ],
        )
    ```
  </CodeGroup>
</Accordion>

<Tip>
  For TypeScript projects using custom Anchor programs, the [`@coral-xyz/anchor`](https://github.com/solana-foundation/anchor) SDK provides type-safe instruction builders and IDL utilities that simplify constructing properly formatted transactions.
</Tip>

## Ecosystem program examples

The `solData` criterion works with any Solana program. Common use cases by category:

| Category | Programs |
| - | - |
| DeFi / Trading | Jupiter (slippage limits), Raydium (liquidity constraints) |
| Staking | Jito (validator selection), Marinade (deposit/withdrawal limits) |
| NFTs | Metaplex (mint parameters), Magic Eden (bid validation) |

## Key considerations

* Always use Anchor IDL format v0.30+
* Discriminator bytes must exactly match the program's instruction identifiers
* Convert older IDL formats with `anchor idl convert` before use
