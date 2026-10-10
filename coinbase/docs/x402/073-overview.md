> Coinbase CDP docs — **x402** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Overview

x402 turns an API or digital service into a paid resource. A buyer sees the price, pays, and gets
access without leaving the request flow. There is no checkout page, card form, or signup flow.

Whether the buyer is a human or a machine, x402 covers both: a user unlocking premium content, a
backend consuming metered data, or an agent purchasing a tool call mid-task.

With CDP, you can build x402 products without building crypto infrastructure. The
[CDP Facilitator](/x402/seller/facilitator) verifies and settles payments. Sellers receive at
any address they control — including CDP custodial wallets, Coinbase Business, Prime, or a self-custody wallet —
and buyers can pay from a CDP wallet or another signer. CDP has processed more than 100
million x402 payments across Base and Solana.

Pick the path below that matches your product; follow the linked quickstarts to build, or read
[How x402 works](/x402/how-it-works) for the payment flow.

<CardGroup cols={2}>
  <Card title="Seller (SDK)" icon="store" href="/x402/seller/quickstart">
    Charge for your endpoints with x402 and the CDP SDK.
  </Card>

  <Card title="Buyer (SDK)" icon="credit-card" href="/x402/buyer/quickstart">
    Pay for an API or resource with x402 and the CDP SDK.
  </Card>

  <Card title="Agentic Accounts" icon="robot" href="/x402/agentic-accounts/overview">
    Give your own agent an account it can use to pay for x402 services.
  </Card>

  <Card title="Integrations" icon="plug" href="/x402/integrations/overview">
    Connect x402 to a supported platform where you build and run agents.
  </Card>
</CardGroup>

## What to read next

* [How x402 works](/x402/how-it-works), the payment loop in one place
* [CDP Facilitator](/x402/seller/facilitator), networks, pricing, and production readiness
* [Quickstart: pay for an API](/x402/buyer/quickstart) or
  [Quickstart: charge for an endpoint](/x402/seller/quickstart), depending on your role
