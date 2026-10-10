> Coinbase CDP docs — **x402** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Configure Your x402 Client

Configure x402 payments for your application after completing the
[buyer quickstart](/x402/buyer/quickstart). Connect an existing client, choose payment
schemes, enforce spend limits, and respond to payment lifecycle events.

## Use CDP with an existing x402 client

<Tabs>
  <Tab title="TypeScript">
    Already have an `x402Client` built on `@x402/core` with your own key? Add a CDP-managed signer
    without migrating to `CdpX402Client`:

    ```typescript theme={null}
    import { CdpClient } from "@coinbase/cdp-sdk";
    import { fromCdpEvmAccount } from "@coinbase/cdp-sdk/x402";
    import { x402Client } from "@x402/core/client";
    import { registerExactEvmScheme } from "@x402/evm/exact/client";

    const cdp = new CdpClient();
    const account = await cdp.evm.getOrCreateAccount({ name: "my-x402-signer" });

    const client = new x402Client();
    registerExactEvmScheme(client, { signer: fromCdpEvmAccount(account) });
    ```

    `fromCdpEvmAccount` has counterparts for other account types: `fromCdpSmartWallet` for a Smart
    Contract Wallet, and `cdpSolanaAccountToSvmSigner` for Solana. See
    [`x402DevMigration.ts`](https://github.com/coinbase/cdp-sdk/blob/main/examples/typescript/x402/clients/x402DevMigration.ts)
    for a runnable example.
  </Tab>

  <Tab title="Python">
    The Python buyer quickstart already uses the standard x402 client with a CDP-managed account.
    Follow its [Python setup](/x402/buyer/quickstart#2-write-the-client) to add CDP signing to an
    existing client.
  </Tab>
</Tabs>

## Payment schemes

A scheme is the payment behavior a server asks for, such as charging a fixed amount. The server
advertises what it accepts, and your client picks a matching registered scheme.

<Tabs>
  <Tab title="TypeScript">
    `CdpX402Client` registers Base `exact`, Permit2-based EVM `upto`, and EVM-only `auth-capture` by
    default. Add other EVM networks, Solana (`exact` and `upto`), and EVM `batch-settlement` through
    its `networkSchemes` option:

    ```typescript theme={null}
    const client = new CdpX402Client({
      networkSchemes: [
        { network: "solana", scheme: { exact: true, upto: true } },
      ],
    });
    ```

    The CDP Facilitator sponsors the Permit2 approval, so the buyer does not need to pay a network
    fee. Solana `upto` uses an escrow payment channel instead of Permit2.

    For exact signatures and configuration, see the
    [CDP SDK x402 reference](/sdks/cdp-sdks-v2/typescript/x402/index).
  </Tab>

  <Tab title="Python">
    Python clients register schemes explicitly. See the
    [Python buyer setup](/x402/buyer/quickstart#2-write-the-client) for the recommended `exact`
    scheme configuration.
  </Tab>
</Tabs>

## Set spend limits

Spend controls enforce a client-side budget on top of what the server charges.

<Tabs>
  <Tab title="TypeScript">
    ```typescript theme={null}
    const USDC_BASE_TESTNET = "0x036cbd53842c5426634e7929541ec2318f3dcf7e";

    const client = new CdpX402Client({
      environment: "development",
      spendControls: {
        maxAmountPerPayment: { atomic: 10_000n, asset: USDC_BASE_TESTNET },
        maxCumulativeSpend: { atomic: 50_000n, asset: USDC_BASE_TESTNET },
        maxCumulativeSpendWindow: "24h",
        allowedNetworks: ["eip155:84532"],
      },
    });
    ```

    Spend is reserved before paying, then confirmed or rolled back once settlement is known. An
    ambiguous outcome remains reserved so the guardrail fails toward under-spending rather than
    over-spending. Blocked payments throw `SpendControlError` with a machine-readable `code`.

    See the full runnable version in
    [`payForApiWithSpendControls.ts`](https://github.com/coinbase/cdp-sdk/blob/main/examples/typescript/x402/clients/payForApiWithSpendControls.ts).
  </Tab>

  <Tab title="Python">
    The CDP SDK does not currently provide x402 spend controls for Python.
  </Tab>
</Tabs>

## Add onchain attribution

[Builder Codes](https://docs.base.org/apps/builder-codes/builder-codes) attribute the clients and
intermediaries that create x402 payments. The CDP Facilitator records these codes in ERC-8021
Schema 2 calldata when it settles an EVM payment.

<Tabs>
  <Tab title="TypeScript">
    Pass your Builder Code to `CdpX402Client`:

    ```typescript theme={null}
    const client = new CdpX402Client({
      builderCode: "my_client",
    });
    ```

    Composite applications can pass an array to attribute multiple clients or middleware layers.
  </Tab>

  <Tab title="Python">
    Register the standard x402 Builder Code extension on your client:

    ```python theme={null}
    from x402.extensions.builder_code import BuilderCodeClientExtension

    client.register_extension(BuilderCodeClientExtension("my_client"))
    ```
  </Tab>
</Tabs>

Each code must contain 1–32 lowercase letters, numbers, or underscores. Omit the option or
extension to leave client attribution unset. See the
[builder-code specification](https://github.com/x402-foundation/x402/blob/main/specs/extensions/builder_code.md)
for the attribution fields and protocol flow.

## Lifecycle hooks

<Tabs>
  <Tab title="TypeScript">
    `x402HTTPClient` provides `onPaymentRequired`. Its underlying `x402Client` provides
    `onBeforePaymentCreation`, `onAfterPaymentCreation`, `onPaymentCreationFailure`, and
    `onPaymentResponse`. `CdpX402Client` inherits these hooks.

    ```typescript theme={null}
    client.onPaymentResponse(async ({ settleResponse }) => {
      if (settleResponse?.success) {
        console.info("Payment settled", {
          network: settleResponse.network,
          transaction: settleResponse.transaction,
        });
      }
    });
    ```
  </Tab>

  <Tab title="Python">
    `x402HTTPClient` provides `on_payment_required`. Its underlying `x402Client` provides
    `on_before_payment_creation`, `on_after_payment_creation`, `on_payment_creation_failure`, and
    `on_payment_response`.

    ```python theme={null}
    def log_payment(context) -> None:
        if context.settle_response and context.settle_response.success:
            print(
                "Payment settled",
                {
                    "network": context.settle_response.network,
                    "transaction": context.settle_response.transaction,
                },
            )

    payment_client.on_payment_response(log_payment)
    ```
  </Tab>
</Tabs>

## What to read next

* [Discover services](./discover-services.mdx) to find x402 endpoints.
* [Discover and pay over MCP](./mcp-payments.mdx) to use the same payment flow with MCP tools.
