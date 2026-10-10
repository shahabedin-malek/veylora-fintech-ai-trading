> Coinbase CDP docs — **x402** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Discover services (Bazaar)

The x402 Bazaar is a catalog of payment-gated services discovered by the CDP Facilitator. You
can search the catalog by intent, browse all indexed resources, or find every resource that
pays a particular merchant address.

<Info>
  Bazaar discovery is public. You do not need a CDP API key to use the discovery APIs or the
  corresponding TypeScript SDK functions.
</Info>

## Choose a discovery interface

<CardGroup cols={3}>
  <Card title="CDP SDKs" icon="code" href="/sdks/index">
    Search and list resources with a generated OpenAPI client.
  </Card>

  <Card title="CDP APIs" icon="brackets-curly" href="https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/search-x402-resources">
    Query the Bazaar directly over HTTP.
  </Card>

  <Card title="Bazaar MCP" icon="magnifying-glass" href="/x402/buyer/mcp-payments">
    Let an MCP-compatible agent discover services with tool calls.
  </Card>
</CardGroup>

## Discover with the CDP SDK

The discovery operations are part of the CDP OpenAPI specification and are available in every
generated OpenAPI client. See the [CDP SDK overview](/sdks/index) for documented clients. The
examples below use TypeScript; use the equivalent generated methods when working in another
supported language.

Install the TypeScript CDP SDK:

```bash theme={null}
npm install @coinbase/cdp-sdk
```

The TypeScript SDK exports three discovery functions from `@coinbase/cdp-sdk`:

* [`searchX402Resources`](https://github.com/coinbase/cdp-sdk/blob/main/typescript/packages/cdp-sdk/src/openapi-client/generated/x402-facilitator/x402-facilitator.ts#L109-L124)
  returns relevance-ranked text or semantic matches. Filter by network, asset, payment scheme,
  `payTo` address, URL, maximum USD price, or protocol extension.
* [`listX402DiscoveryResources`](https://github.com/coinbase/cdp-sdk/blob/main/typescript/packages/cdp-sdk/src/openapi-client/generated/x402-facilitator/x402-facilitator.ts#L78-L92)
  browses active resources with offset pagination and an optional protocol type filter.
* [`listX402DiscoveryMerchant`](https://github.com/coinbase/cdp-sdk/blob/main/typescript/packages/cdp-sdk/src/openapi-client/generated/x402-facilitator/x402-facilitator.ts#L93-L108)
  lists active resources for a specific `payTo` address with offset pagination.

See the [CDP TypeScript SDK reference](/sdks/cdp-sdks-v2/typescript/index) for SDK setup and
configuration.

### Search for a service

Use a natural-language query and add filters when you know the required network, asset,
payment scheme, maximum price, merchant, URL, or protocol extension:

```typescript theme={null}
import { searchX402Resources } from "@coinbase/cdp-sdk";

const result = await searchX402Resources({
  query: "weather forecast for a city",
  network: "eip155:8453",
  maxUsdPrice: "0.05",
  limit: 10,
});

for (const resource of result.resources) {
  console.log(resource.resource);
}
```

Search returns at most 20 resources, ranked by a blend of query relevance and quality. Quality
considers recent call volume and unique payers alongside the completeness of the description,
output schema, and service metadata. Each result's `quality` field reports its call count and
unique payer count over the last 30 days, plus when it was last called.

If `partialResults` is `true`, narrow the query or add filters to reduce the result set. Legacy
network names such as `base`, `base-sepolia`, and `solana` are also accepted and normalized to
CAIP-2 network identifiers.

For every filter and the response schema, see
[Search x402 resources](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/search-x402-resources).

### Browse all resources

Use the list function when you do not need relevance-ranked search:

```typescript theme={null}
import { listX402DiscoveryResources } from "@coinbase/cdp-sdk";

const page = await listX402DiscoveryResources({
  type: "http",
  limit: 100,
  offset: 0,
});

for (const resource of page.items) {
  console.log(resource.resource);
}
```

Use the response's pagination values to request subsequent pages. For complete pagination and
response details, see
[List x402 resources](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/list-x402-resources).

### Find a merchant's services

If you know the address receiving payment, list all active resources that route payment to it:

```typescript theme={null}
import { listX402DiscoveryMerchant } from "@coinbase/cdp-sdk";

const page = await listX402DiscoveryMerchant({
  payTo: "0x1234567890123456789012345678901234567890",
  limit: 20,
  offset: 0,
});
```

An unknown address returns an empty `resources` list. For the complete request and response
schema, see
[List merchant discovery info](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/list-merchant-discovery-info).

## Discover with the REST APIs

You can call the same public catalog without an SDK:

* [Search x402 resources](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/search-x402-resources)
* [List x402 resources](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/list-x402-resources)
* [List merchant discovery info](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/x402-facilitator/list-merchant-discovery-info)

## Discover with Bazaar MCP

If your agent supports MCP, it can search the same catalog with tool calls instead of SDK or
REST code, and pay for what it finds through the same client. See
[Discover & pay over MCP](/x402/buyer/mcp-payments).

## What to read next

After discovering a service, pay for it over HTTP with the
[buyer quickstart](/x402/buyer/quickstart), or do both as tool calls with
[Discover & pay over MCP](/x402/buyer/mcp-payments). Publishing a service instead?
[Get discovered](/x402/seller/get-discovered).
