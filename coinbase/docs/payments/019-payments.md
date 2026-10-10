> Coinbase CDP docs — **payments** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Payments

> Choose the right CDP payments product for your use case.

CDP offers multiple payments products depending on whether you need to accept payments, send payments, or move users from fiat into crypto. Use the tables below to find the right product for your use case.

## Products at a glance

### Available through a business account

| Product | Direction | Value |
| :- | :- | :- |
| [Deposit Destinations](/payments/deposit-destinations/overview) | Inbound crypto | Provision stable onchain addresses that auto-credit a custodial account, with optional auto-liquidation |
| [Payment Methods](/payments/payment-methods/overview) | Outbound fiat | Send fiat out of a custodial account using ACH, Fedwire, Swift, or SEPA rails |
| [Transfers](/payments/transfers/overview) | Outbound | Send payouts and disbursements in fiat or crypto from a custodial account |
| [Acceptance](/payments/payment-acceptance/overview) | Inbound | Accept stablecoin payments at checkout with a two-step auth and capture flow, without onchain complexity |

### No business account needed

| Product | Direction | Value |
| :- | :- | :- |
| [Onramp](/onramp/onramp-overview) | Inbound (fiat to crypto) | Let users buy crypto with a card, Apple Pay, Google Pay, or a Coinbase account, delivered directly to their wallet |
| [x402](/x402/welcome) | Inbound | Monetize APIs and digital content with payments over HTTP, designed for AI agents and programmatic commerce |
| [Onchain transfers via Non-custodial Wallets](/wallets/using-wallets/send-transactions) | Outbound crypto | Send crypto onchain from a non-custodial wallet where CDP handles signing and broadcasting |

## How the products fit together

**Custodial-account stack.** Deposit Destinations, Payment Methods, and Transfers all operate against a custodial account at Coinbase. Funds flow in through Deposit Destinations (crypto), are held in the custodial account, and flow out through Transfers (fiat or crypto) or Payment Methods (fiat). This stack is the right fit when funds need to be held, reconciled, or rebalanced before they leave. The custodial stack also supports private onchain transactions via smart-contract based deposits and withdrawals from Base, using [Base Ledgers](https://base.org/ledgers).

**Acceptance, with optional fiat settlement.** Acceptance handles merchant checkout in stablecoins on its own. If the merchant wants to settle in fiat instead of holding the stablecoin, Acceptance settles into a custodial account, which can then send fiat out via Payment Methods or Transfers.

**Standalone products.** Onramp, x402, and onchain transfers via Non-custodial Wallets do not require a custodial account. Onramp and x402 also do not require a CDP business account: Onramp delivers crypto directly to an end-user wallet, and x402 settles peer-to-peer over HTTP. Non-custodial Wallets are owned and signed by the CDP client.

## Choosing the right product

**Receive crypto into a custodial account.** Use [Deposit Destinations](/payments/deposit-destinations/overview).

**Pay out a custodial account in fiat.** Use [Payment Methods](/payments/payment-methods/overview).

**Pay out from a custodial account (fiat or crypto).** Use [Transfers](/payments/transfers/overview).

**Accept stablecoin payments at checkout.** Use [Acceptance](/payments/payment-acceptance/overview). Add Payment Methods or Transfers if fiat settlement is needed.

**Let end users buy crypto with fiat.** Use [Onramp](/onramp/onramp-overview).

**Charge per HTTP request for an API or AI agent.** Use [x402](/x402/welcome).

**Send crypto onchain from a non-custodial wallet.** Use [Non-custodial Wallets](/wallets/non-custodial-wallets/overview) and [onchain transfers](/wallets/using-wallets/send-transactions).

## What to read next

* [Deposit Destinations](/payments/deposit-destinations/overview), receive onchain crypto into a custodial account
* [Payment Methods](/payments/payment-methods/overview), send fiat out of a custodial account via fiat rails
* [Transfers](/payments/transfers/overview), send payouts and disbursements in fiat or crypto
* [Acceptance](/payments/payment-acceptance/overview), accept crypto at merchant checkout with auth and capture
* [x402 Overview](/x402/welcome), monetize APIs with payments over HTTP
* [Onchain Transfers](/wallets/using-wallets/send-transactions), send crypto onchain using Non-custodial Wallets
* [Onramp Overview](/onramp/onramp-overview), let users buy crypto with fiat
