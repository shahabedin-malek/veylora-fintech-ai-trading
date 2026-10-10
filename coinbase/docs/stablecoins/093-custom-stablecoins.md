> Coinbase CDP docs — **stablecoins** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Custom Stablecoins

> Issue your own branded stablecoin backed 1:1 by USDC, with Coinbase managing issuance, redemption, and reserves.

<Note>
  Custom Stablecoin access is provided to partners during onboarding. If you're interested in launching a custom stablecoin, [get in touch](https://www.coinbase.com/developer-platform/developer-interest) and our team will follow up to discuss fit.
</Note>

Custom Stablecoins allow companies to hold customer or corporate balances in their own branded token and earn revenue on every dollar in circulation.

Each token is backed 1:1 by USDC on Coinbase, fully interoperable with USDC, and available on day 1 across Coinbase Retail, Exchange, Prime, and Onramp.

The infrastructure behind each stablecoin is managed by Coinbase, including issuance, redemption, conversions, reserve operations, liquidity management, and proof of reserves.

## Use cases

<CardGroup cols={2}>
  <Card title="Payments" icon="money-bill-wave">
    Power branded payments across your app, platform, or merchant network. Fully backed and instantly redeemable for USDC.
  </Card>

  <Card title="Treasury" icon="building-columns">
    Run internal settlements and B2B payments while generating revenue on your circulating supply.
  </Card>

  <Card title="Loyalty and rewards" icon="gift">
    Hold customer balances in your branded stablecoin, earn rewards on circulating supply and put that revenue back into user incentives or cashback.
  </Card>

  <Card title="DeFi protocols" icon="chart-line">
    Integrate a custom stablecoin into your protocol with instant USDC liquidity for users.
  </Card>
</CardGroup>

## Key features

| Feature | What it enables |
| - | - |
| 1:1 USDC backing | Fully backed reserves held on Coinbase |
| Managed infrastructure | Launch a branded stablecoin without building issuer infrastructure |
| Coinbase liquidity | Seamless conversions at scale onchain and across eligible Coinbase surfaces |
| Permissionless swaps | Fee-free 1:1 onchain swaps with USDC |
| Weekly rewards | Rewards paid on your stablecoin's circulating supply |
| Transparent reserves | Proof of reserves updated in near real-time |
| Multi-chain support | Base and Solana today, with additional chain support available on request |
| Global distribution | Available across eligible Coinbase Retail, Exchange, Prime, and Onramp surfaces |

## Supported networks

<CardGroup cols={2}>
  <Card title="EVM Networks" icon="ethereum">
    Base Mainnet and Base Sepolia are supported today.
  </Card>

  <Card title="Solana" icon={<img src="https://mintcdn.com/coinbase-prod/cCGVQ8zMGF76EFDn/icons/solana-blue.svg?fit=max&auto=format&n=cCGVQ8zMGF76EFDn&q=85&s=a06e8b9f0a9c686cf815de662b85b691" alt="Solana" className="block w-6 h-6 -mt-1" />}>
    Solana Mainnet and Solana Devnet are supported today.
  </Card>
</CardGroup>

Additional EVM and SVM chains are available on request.

## Key stablecoin features

<CardGroup cols={2}>
  <Card title="Rewards" icon="gift" href="/custom-stablecoins/core-concepts#rewards">
    Learn how weekly rewards are calculated and paid out.
  </Card>

  <Card title="Mint and Burn" icon="coins" href="/custom-stablecoins/core-concepts#mint-and-burn">
    Understand supply controls and when minting or burning is used.
  </Card>

  <Card title="Reserve Management" icon="building-columns" href="/custom-stablecoins/core-concepts#reserve-management">
    See how reserves are managed to keep every token backed 1:1 by USDC.
  </Card>

  <Card title="Verified Redemptions" icon="rotate-left" href="/custom-stablecoins/core-concepts#verified-redemptions">
    See how onchain burns are redeemed for the equivalent USDC.
  </Card>

  <Card title="Proof of Reserves" icon="shield-check" href="/custom-stablecoins/core-concepts#proof-of-reserves">
    Verify transparency and real-time reserve backing updates.
  </Card>

  <Card title="Conversions" icon="arrows-rotate" href="/custom-stablecoins/conversions/overview">
    Convert between USDC and your stablecoin via the Stableswapper contract or the Transfers API.
  </Card>
</CardGroup>
