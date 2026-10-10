> Coinbase CDP docs — **stablecoins** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Core Concepts

> How Custom Stablecoins stay backed 1:1 by USDC, from reserves and proof of reserves to supply controls, redemptions, rewards, and distribution.

Custom Stablecoins are branded tokens backed 1:1 by USDC, with Coinbase managing the infrastructure behind issuance, redemption, conversions, and reserves. The concepts below explain how that model works end to end: how reserves keep every token backed, how anyone can verify that backing, how supply is controlled and redeemed, and how rewards and distribution turn circulation into reach and revenue.

<CardGroup cols={3}>
  <Card title="Reserve management" icon="building-columns" href="#reserve-management" horizontal />

  <Card title="Proof of reserves" icon="shield-check" href="#proof-of-reserves" horizontal />

  <Card title="Mint and burn" icon="coins" href="#mint-and-burn" horizontal />

  <Card title="Verified redemptions" icon="rotate-left" href="#verified-redemptions" horizontal />

  <Card title="Rewards" icon="gift" href="#rewards" horizontal />

  <Card title="Distribution" icon="globe" href="#distribution" horizontal />
</CardGroup>

## Reserve management

Custom Stablecoins run on the same reserve management infrastructure that powers [Coinbase Wrapped Assets](https://www.coinbase.com/campaigns/wrapped-assets), including cbBTC and cbETH.

Each custom stablecoin is backed 1:1 by USDC held with Coinbase. Reserve operations are managed by Coinbase to keep circulating supply and reserves aligned as volume grows, with robust reconciliation and liquidity management.

<Tip>
  Partners do not need to build reserve infrastructure from scratch. Reserves utilize battle-tested Coinbase systems already supporting some of the largest wrapped assets.
</Tip>

## Proof of reserves

Custom Stablecoins include proof of reserves so partners and end users can verify the asset is backed 1:1 by USDC held with Coinbase.

Coinbase publishes reserve data refreshed nearly every minute, giving a near real-time view of reserves backing the asset. Anyone can view this reserve data publicly. For a live example, see Coinbase's [cbBTC proof of reserves page](https://www.coinbase.com/cbbtc/proof-of-reserves).

<Tip>
  Proof of reserves gives partners and end users strong transparency from day one. It makes it easier to build trust with users, regulators, and counterparties.
</Tip>

## Mint and burn

Mint and burn are supply controls for your custom stablecoin. Minting issues new supply while burning removes existing supply from circulation. Every mint and burn is paired with reserve movement so the asset remains backed 1:1 by USDC.

Coinbase manages mint and burn as part of the Custom Stablecoin operating model. Mint and burn are separate from day-to-day conversions: conversions allow the exchange of USDC for your custom stablecoin, while mint and burn change total supply.

<CardGroup cols={2}>
  <Card title="When mint is used" icon="coins">
    * Issuing new supply for a launch
    * Adding supply for partner distribution
    * Replenishing Coinbase-managed operating liquidity
  </Card>

  <Card title="When burn is used" icon="fire">
    * Removing excess supply from circulation
    * Retiring excess Coinbase-managed operating liquidity
    * Completing redemption flows back to USDC
  </Card>
</CardGroup>

When your custom stablecoin is burned directly onchain by an approved source, [Verified Redemptions](#verified-redemptions) returns the equivalent USDC from reserves.

## Verified redemptions

Some platforms and integrations may choose to burn their stablecoin directly onchain by design, outside the standard conversion and redemption flow. Verified Redemptions catches those burns, releases the matching USDC from reserves, and keeps your stablecoin backed 1:1 automatically.

Each custom stablecoin is backed 1:1 by USDC in Coinbase reserves. Burning tokens onchain removes them from circulation, which frees up the USDC that was backing them. Until that USDC is released, reserves hold more than the supply requires. Verified Redemptions releases it automatically and keeps reserves matched to supply, without the manual work each burn would otherwise take.

### How it works

<Steps>
  <Step title="Detect" icon="magnifying-glass">
    Coinbase monitors onchain activity for burns of your custom stablecoin.
  </Step>

  <Step title="Verify" icon="circle-check">
    Only burns from a pre-approved, partner-controlled source are eligible. Coinbase's own burns are excluded to avoid double-counting.
  </Step>

  <Step title="Release" icon="lock-open">
    The matching USDC is unlocked from the reserve pool.
  </Step>

  <Step title="Deliver" icon="paper-plane">
    The USDC is returned to your Coinbase account, the same one associated with your custom stablecoin.
  </Step>

  <Step title="Record" icon="list-check">
    The burn and matching USDC release are recorded so reserves stay matched to circulating supply.
  </Step>
</Steps>

### Security and controls

<Note>
  The approved burn source and the destination account are set by Coinbase during onboarding and cannot be changed at runtime. Burn amounts are fixed onchain, so released USDC always matches the amount burned, and burns from any other source never trigger a redemption.
</Note>

### Availability

Verified Redemptions are supported on Solana, where any holder can burn the SPL tokens they own directly onchain. This makes onchain burns a common way to remove supply.

To enable it for your custom stablecoin, reach out to your Coinbase contact.

## Rewards

Custom Stablecoins let partners earn rewards on balances holding their stablecoin. As circulation grows, rewards can become a meaningful new revenue stream tied directly to adoption.

Rewards are calculated from reserves backing eligible circulating supply of your custom stablecoin. Coinbase tracks reserve balances associated with tokens in circulation, accrues rewards daily, and pays them out weekly.

For the current rate, see [Coinbase USDC Rewards](https://docs.cdp.coinbase.com/wallets/usdc-rewards).

<Tip>
  Rewards give issuers an economic model beyond transaction activity alone. As more users and businesses hold your custom stablecoin, eligible backing balances grow with them.
</Tip>

## Distribution

Your custom stablecoin can launch globally across eligible Coinbase products from day 1. Availability depends on asset eligibility, jurisdiction, and product-specific onboarding requirements.

<CardGroup cols={1}>
  <Card title="Coinbase platform" icon="building-columns" horizontal>
    Your custom stablecoin can be available across Coinbase Retail, Exchange, and Prime in eligible regions. This gives you immediate access to global users and institutions through trusted Coinbase infrastructure that powers USDC and other stablecoins.
  </Card>

  <Card title="Onramp and Offramp" icon="money-bill-transfer" href="/onramp/introduction/welcome" horizontal>
    [Coinbase Onramp and Offramp](/onramp/introduction/welcome) allow you to integrate fiat-to-crypto and crypto-to-fiat flows into your product, so users can move between supported fiat currencies and your custom stablecoin.
  </Card>

  <Card title="Stableswapper" icon="arrows-rotate" href="/custom-stablecoins/conversions/stableswapper-contract/quickstart" horizontal>
    [Stableswapper](/custom-stablecoins/conversions/stableswapper-contract/quickstart) allows you to integrate permissionless onchain swaps into your product, so users can move 1:1 between USDC and your custom stablecoin from self-custodial wallets.
  </Card>
</CardGroup>

## What to read next

* [Stablecoin Contract quickstart](/custom-stablecoins/stablecoin-contract/quickstart): deploy and configure your custom stablecoin contract.
* [Conversions overview](/custom-stablecoins/conversions/overview): convert between USDC and your stablecoin via the Stableswapper contract or the Transfers API.
