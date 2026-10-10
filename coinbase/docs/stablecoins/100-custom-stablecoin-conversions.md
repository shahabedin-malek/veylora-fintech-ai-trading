> Coinbase CDP docs — **stablecoins** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Custom Stablecoin Conversions

> Convert between USDC and your custom stablecoin 1:1, both onchain and across Coinbase surfaces.

Coinbase manages liquidity to enable seamless 1:1 conversions between USDC and your custom stablecoin at scale, both onchain and across Coinbase surfaces.

You can convert between USDC and your custom stablecoin using one of two methods.

<CardGroup cols={2}>
  <Card title="Onchain conversions" icon="bolt" href="/custom-stablecoins/conversions/stableswapper-contract/quickstart">
    Use Stableswapper for fee-free, permissionless 1:1 swaps directly onchain.
  </Card>

  <Card title="API-driven conversions" icon="code" href="/custom-stablecoins/conversions/transfers-api">
    Use Transfers APIs to quote, execute, and track conversions in your application workflow.
  </Card>
</CardGroup>

## Supported conversion flows

* USDC to custom stablecoin
* Custom stablecoin to USDC

## Choose your conversion path

* Use [Transfers API overview](/custom-stablecoins/conversions/transfers-api) for quote-and-execute workflows in your application.
* Use [Stableswapper quickstart](/custom-stablecoins/conversions/stableswapper-contract/quickstart) for direct onchain swaps.
