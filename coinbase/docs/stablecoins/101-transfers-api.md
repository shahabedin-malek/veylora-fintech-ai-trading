> Coinbase CDP docs — **stablecoins** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Transfers API

Use the Transfers API when you want to programmatically convert between USDC and your custom stablecoin in your app or backend workflow.

This flow supports both directions:

* USDC to your custom stablecoin
* Your custom stablecoin to USDC

## API flow at a glance

1. Create a transfer quote and save the `transferId`.
2. Execute the quote using the `transferId`.
3. Track transfer status to completion.

## Prerequisites

* A CDP API key with access to Payments APIs
* Source and target rails configured for your transfer
* Asset and amount details for the conversion

## API-driven conversions (overview)

Use this as a high-level flow for quoting, executing, and tracking a conversion.

```bash theme={null}
# 1) Create transfer (quote + optional execution)
curl --request POST "https://api.cdp.coinbase.com/platform/v2/transfers" \
  --header "Authorization: Bearer $CDP_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "source": { "accountId": "account_id_here", "asset": "usdc" },
    "target": { "network": "base", "address": "0x_target_address_here", "asset": "custom_stablecoin_symbol" },
    "amount": "100.00",
    "asset": "usdc",
    "execute": false
  }'

# 2) Execute when ready
curl --request POST "https://api.cdp.coinbase.com/platform/v2/transfers/$TRANSFER_ID/execute" \
  --header "Authorization: Bearer $CDP_API_KEY"

# 3) Fetch transfer status
curl --request GET "https://api.cdp.coinbase.com/platform/v2/transfers/$TRANSFER_ID" \
  --header "Authorization: Bearer $CDP_API_KEY"
```

<Note>
  This is an overview example for custom stablecoin conversions. For exact request and response fields, use the [Transfers API reference](/api-reference/v2/rest-api/transfers/transfers).
</Note>

## Learn more

For full request and response schemas, see:

* [Transfers overview](/api-reference/v2/rest-api/transfers/transfers)
* [Create a transfer](/api-reference/v2/rest-api/transfers/create-transfer)
* [Execute a transfer](/api-reference/v2/rest-api/transfers/execute-transfer)
* [Get a transfer](/api-reference/v2/rest-api/transfers/get-transfer)
