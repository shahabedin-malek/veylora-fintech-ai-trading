> Coinbase CDP docs — **onramp-offramp** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# Generating Offramp Quotes

## Offramp Quote

The Offramp Quote API provides clients with a quote based on the asset the user would like to sell, the network of the asset is on, the crypto amount of the asset, the cashout fiat currency, the payment method, and country of the user.

<Info>
  Limitations

  The quote provided by this API is an estimate only. It does not guarantee that the user will be able to complete their purchase using the returned quote. Depending on fluctuations in exchange rates, the actual fees charged may be different.
</Info>

<Tip>
  The Sell Quote API can now return a ready-to-use one-click-sell offramp URL. Include `source_address`, `redirect_url`, and `partner_user_ref` parameters in your request to receive a complete `offramp_url` in the response. See the [example with offramp URL](#example-requestresponse-with-offramp-url) below.
</Tip>

<Tip>
  Full API endpoint list

  For a complete list of all API endpoints supported by Onramp/Offramp, visit our [API Reference section](/api-reference/rest-api/onramp-offramp/create-sell-quote).
</Tip>

### Method

```
POST
```

### URL

```
https://api.developer.coinbase.com/onramp/v1/sell/quote
```

### Request Parameters

The Offramp Quote API is an RPC endpoint that accepts parameters as JSON in the request body.

| Name | Type | Req | Description |
| :- | :- | :- | :- |
| `sell_currency` | | Y | ID of the crypto asset the user wants to offramp. Retrieved from the Offramp Options API. |
| `sell_network` | | N | Name of the network that the sell currency is on. Retrieved from the Offramp Options API. If omitted, the default network for the crypto currency is used. |
| `sell_amount` | String | Y | Crypto amount the user wants to offramp, exclusive of network fees |
| `cashout_currency` | String | Y | Fiat currency of the cashout amount, e.g., `USD`. |
| `payment_method` | | Y | ID of payment method used to cashout the sell. Retrieved from the options API. |
| `country` | | Y | [ISO 3166-1](https://en.wikipedia.org/wiki/ISO_3166-1) two-digit country code string representing the user’s country of residence, e.g., `US`. |
| `subdivision` | | N | [ISO 3166-2](https://en.wikipedia.org/wiki/ISO_3166-2) two-digit country subdivision code representing the user’s subdivision of residence within their country, e.g. `NY`. Required if the `country="US"` because certain states (e.g., `NY`) have state specific asset restrictions. |
| `source_address` | | N | Source address for the asset to sell. Optional field for quote, required for generating a ready-to-use one-click-sell URL. |
| `redirect_url` | | N | URL to redirect after transaction completion. Optional field for quote, required for generating a ready-to-use one-click-sell URL. Production URLs must be added to your domain allowlist (see [Security Requirements](/onramp/security-requirements)). |
| `partner_user_ref` | | N | Partner's user identifier. Optional field for quote, required for generating a ready-to-use one-click-sell URL. |

### Response Fields

The Offramp Quote API returns a JSON response including the following fields.

| Name | Description |
| :- | :- |
| `cashout_total` | Object with amount and currency of the fiat amount of crypto asset to be received, fees deducted. The currency will match the `cashout_currency` in the request if it is supported, otherwise it falls back to `USD`. |
| `cashout_subtotal` | Object with amount and currency of the total fiat cost of the crypto asset, fees not deducted. The currency will match the `cashout_currency`. |
| `sell_amount` | Object with amount and currency of the crypto that to be sold. The currency will match the `sell_currency` in the request. The number of decimals will be based on the crypto asset. |
| `coinbase_fee` | Object with amount and currency of the fee changed by the Coinbase exchange to complete the transaction. The currency will match the `cashout_currency`. |
| `quote_id` | Reference to the quote that should be passed into the initialization parameters when launching the Coinbase Onramp widget via the SDK or URL generator. |
| `offramp_url` | Ready-to-use offramp URL. Only returned when `source_address`, `redirect_url`, and `partner_user_ref` are ALL provided in the request. |

### Example Request/Response

<Tabs>
  <Tab value="bash" title="Request (cURL)">
    ```bash lines wrap theme={null}
    cdpcurl -X POST 'https://api.developer.coinbase.com/onramp/v1/sell/quote' \
      -k /tmp/cdp_api_key.json \
      -d '{"sell_currency": "BTC", "sell_amount": "0.01", "cashout_currency": "USD", "payment_method": "FIAT_WALLET", "country": "US", "subdivision": "NY"}'
    ```
  </Tab>

  <Tab value="jsonResponse" title="Response 200 (JSON)">
    ```json lines wrap theme={null}
    {
      "data": {
        "cashout_total": {
          "amount": "98.50",
          "currency": "USD"
        },
        "cashout_subtotal": {
          "amount": "100.00",
          "currency": "USD"
        },
        "sell_amount": {
          "amount": "0.00100000",
          "currency": "BTC"
        },
        "coinbase_fee": {
          "amount": "1.50",
          "currency": "USD"
        },
        "quote_id": "46da84dc-b6d7-11ed-afa1-0242ac120002"
      }
    }
    ```
  </Tab>
</Tabs>

### Example Request/Response with Offramp URL

<Tabs>
  <Tab value="bash" title="Request with URL parameters (cURL)">
    ```bash lines wrap theme={null}
    cdpcurl -X POST 'https://api.developer.coinbase.com/onramp/v1/sell/quote' \
      -k /tmp/cdp_api_key.json \
      -d '{"sell_currency": "BTC", "sell_amount": "0.01", "cashout_currency": "USD", "payment_method": "FIAT_WALLET", "country": "US", "subdivision": "NY", "source_address": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", "redirect_url": "https://www.example.com/redirect", "partner_user_ref": "user123"}'
    ```
  </Tab>

  <Tab value="jsonResponseWithUrl" title="Response 200 with offramp_url (JSON)">
    ```json lines wrap theme={null}
    {
      "data": {
        "cashout_total": {
          "amount": "98.50",
          "currency": "USD"
        },
        "cashout_subtotal": {
          "amount": "100.00",
          "currency": "USD"
        },
        "sell_amount": {
          "amount": "0.00100000",
          "currency": "BTC"
        },
        "coinbase_fee": {
          "amount": "1.50",
          "currency": "USD"
        },
        "quote_id": "46da84dc-b6d7-11ed-afa1-0242ac120002",
        "offramp_url": "https://pay.coinbase.com/v3/sell/input?sessionToken=ZWJlNDgwYmItNjBkMi00ZmFiLWIxYTQtMTM3MGI2YjJiNjFh&quoteId=46da84dc-b6d7-11ed-afa1-0242ac120002&defaultAsset=BTC&defaultCashoutMethod=FIAT_WALLET&presetCryptoAmount=0.01&redirectUrl=https%3A%2F%2Fwww.example.com%2Fredirect&partnerUserRef=user123"
      }
    }
    ```
  </Tab>
</Tabs>
