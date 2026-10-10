> Coinbase CDP docs — **x402** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Amazon Bedrock AgentCore

Amazon Bedrock AgentCore is AWS's managed platform for deploying and operating AI agents.
AgentCore Gateway connects agents to tools and services, while AgentCore Payments gives them
controlled access to payment instruments. The Coinbase integration connects that payment layer to
a CDP wallet and the x402 Bazaar, allowing agents to discover and pay for x402 services
autonomously.

## Set up on AWS first

Every x402 payment made through the CoinbaseCDP connector is verified and settled by the
[CDP Facilitator](/x402/seller/facilitator), including both the `exact` and `upto` schemes. No separate facilitator is required,
regardless of which setup path you choose below.

### Quick Create on the AWS Console (Recommended)

**Quick Create**, available in the AgentCore console, provisions the CoinbaseCDP connector and a
CDP wallet in one flow, without leaving AgentCore. Watch it in action below.

<Frame>
  <video controls className="w-full aspect-video" src="https://mintcdn.com/coinbase-prod/CMyKPKU5Fyb39C8-/x402/integrations/videos/agentcore-quick-create.mp4?fit=max&auto=format&n=CMyKPKU5Fyb39C8-&q=85&s=cddce54c323ebbb41761752162b6a9ac" data-path="x402/integrations/videos/agentcore-quick-create.mp4" />
</Frame>

Then add the
[Coinbase x402 Bazaar Gateway target](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/payments-connect-bazaar.html)
to finish setup.

### Manual setup

If you'd rather configure things yourself (for example, to reuse an existing CDP wallet), create
an AgentCore
[Payment Manager and CoinbaseCDP connector](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/payments-create-manager.html)
manually, using your CDP credentials, then add the
[Coinbase x402 Bazaar Gateway target](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/payments-connect-bazaar.html).

## What "Coinbase x402 Bazaar" actually is

The Gateway target named "Coinbase x402 Bazaar" is CDP's x402 discovery service: a
semantic-search catalog of more than 23,000 x402 resources, exposed as three MCP tools:
`search_resources`, `proxy_tool_call`, and `validate_endpoint`. AWS's console shows you how to
wire it in; it doesn't say what it actually is or what it guarantees.

It's a discovery layer of hosted listings; Coinbase can't guarantee the uptime or correctness
of any individual listing. A [curated](/x402/seller/get-discovered#staying-curated) subset —
endpoints that have been hand-reviewed for quality — ranks above the rest of the catalog in
search results.

Want to query the same catalog directly, or the buyer-side detail on reading a result? See
[Discover services](/x402/buyer/discover-services).

## Reaching the wallet directly

The wallet behind a `PaymentInstrument` created through your CoinbaseCDP connector is a real CDP
end-user wallet, and everything that happens to it runs through CDP APIs.

Two things follow from that:

**Funding and granting permission already happen outside AgentCore.** When you create the
instrument, the response includes a `redirectUrl` to Coinbase's hosted WalletHub — that's where
your end user funds the wallet and grants your agent delegated-signing permission. There's no
API for either step; WalletHub is the only activation path, by design. If you'd rather host that
flow yourself instead of redirecting to Coinbase's, fork
[`coinbase/cdp-agentcore-template`](https://github.com/coinbase/cdp-agentcore-template), a
reference Next.js app built on the same self-custodial wallet packages (`@coinbase/cdp-core`,
`@coinbase/cdp-hooks`, `@coinbase/cdp-react`) plus the CDP SDK on the backend.

**You can also operate on that wallet yourself, outside the agent.** The same CDP API key and
Wallet Secret already sitting in your PaymentCredentialProvider work directly against the CDP
SDK — check a live balance, send or receive outside the x402 flow, or pull transaction history.
See [Delegated signing](/wallets/using-wallets/delegated-signing),
[managing end-user accounts](/wallets/using-wallets/create-and-manage-wallets), and the
[end-user accounts REST API](/api-reference/v2/rest-api/end-user-accounts/end-user-accounts).
