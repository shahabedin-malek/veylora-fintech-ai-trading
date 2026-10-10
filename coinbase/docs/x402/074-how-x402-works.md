> Coinbase CDP docs — **x402** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# How x402 works

x402 is an open standard for adding per-request payments to HTTP, so APIs and services can charge
without checkout pages, subscriptions, or separate billing integrations. Payment becomes a
client-server handshake: the server quotes a price in its response, the client pays, and the same
interaction completes with the resource.

## The payment flow

<Frame>
  <img src="https://mintcdn.com/coinbase-prod/-J6KygVa438dtGfZ/images/x402-payment-flow.svg?fit=max&auto=format&n=-J6KygVa438dtGfZ&q=85&s=b7e097682771ca1d22615393d5665270" alt="x402 payment flow between a client, resource server, and facilitator" width="1200" height="930" data-path="images/x402-payment-flow.svg" />
</Frame>

1. The client requests a resource.
2. The server responds that payment is required and includes the price, who should receive it, and
   which payment options it accepts.
3. The client signs a payment and sends the request again with proof of payment attached.
4. The server asks the [CDP Facilitator](/x402/seller/facilitator) to verify the payment.
5. The facilitator returns the verification result.
6. The server performs the requested work.
7. The server asks the facilitator to settle the payment.
8. The facilitator returns the settlement result.
9. The server returns the resource and confirms the payment.

## Flexible by design

x402 defines the payment handshake without prescribing a single payment rail. Sellers can choose
how payment messages travel, where payments settle, which assets they accept, and how they charge:

* **Transport agnostic.** Payment messages can travel over different protocols. These docs focus
  on HTTP, where payment details travel with the request and response.
* **Network agnostic.** The same handshake works across chains, including EVM networks and Solana.
* **Flexible assets.** USDC is the most common asset, but sellers can accept any ERC-20 token
  on EVM networks or SPL token on Solana.
* **Flexible pricing.** Sellers can charge a fixed price, authorize a maximum and settle only what
  was used, or defer settlement for a batch of payments.

The seller advertises the combinations it accepts, and the buyer chooses a supported option. A
facilitator can then verify and settle the payment on the seller's behalf. See the
[CDP Facilitator](/x402/seller/facilitator) for the networks and assets supported by CDP.

For protocol-level detail, see the x402 docs on
[HTTP 402](https://docs.x402.org/core-concepts/http-402) and
[payment schemes](https://docs.x402.org/schemes/overview).

## What to read next

Pick the path that matches your goal:

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
