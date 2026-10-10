> Coinbase CDP docs — **onramp-offramp** · [index](../../README.md) · [all pages](../../MANIFEST.md)

# API Reference

Complete API reference for Onramp and Offramp integration.

<Warning>
  **Security Requirements**: Your backend API that generates session tokens must implement proper security measures. See [Security Requirements](/onramp/security-requirements) for complete implementation guidance.
</Warning>

***

## Shared APIs

These APIs are used by both Onramp and Offramp.

### Session Token API

Create secure, single-use session tokens for both Onramp and Offramp.

**Endpoint:** `POST https://api.developer.coinbase.com/onramp/v1/token`

#### Request Parameters

| Name | Type | Required | Description |
| :- | :- | :- | :- |
| `addresses` | Address\[] | Yes | List of wallet addresses. Each entry contains an address and supported blockchains. |
| `clientIp` | String | Yes | The end user's IP address. Required for security validation. Do not trust `X-Forwarded-For` headers. |
| `assets` | String\[] | No | List of asset symbols (e.g., "ETH", "BTC") or UUIDs to filter available options. |

#### Address Object

| Parameter | Required | Type | Description |
| :- | :- | :- | :- |
| `address` | Yes | String | Destination wallet address |
| `blockchains` | Yes | String\[] | Networks enabled for this address (e.g., "ethereum", "base", "solana", "polygon") |

#### Response

| Field | Description |
| :- | :- |
| `token` | Single-use session token (expires after 5 minutes) |
| `channel_id` | Reserved for future use |

#### Example

```bash theme={null}
cdpcurl -X POST 'https://api.developer.coinbase.com/onramp/v1/token' \
  -k ~/Downloads/cdp_api_key.json \
  -d '{
    "addresses": [{
      "address": "0x1234567890abcdef1234567890abcdef12345678",
      "blockchains": ["base", "ethereum"]
    }],
    "clientIp": "192.0.2.1"
  }'
```

**Response:**

```json theme={null}
{
  "token": "abc123xyz789",
  "channel_id": ""
}
```

### Transaction Status API

Track Onramp and Offramp transactions in real-time.

**Onramp Transactions:**\
`GET https://api.developer.coinbase.com/onramp/v1/buy/user/{partnerUserRef}/transactions`

**Offramp Transactions:**\
`GET https://api.developer.coinbase.com/onramp/v1/sell/user/{partnerUserRef}/transactions`

#### Query Parameters

| Name | Type | Description |
| :- | :- | :- |
| `pageKey` | String | Pagination key from previous response |
| `pageSize` | Number | Number of transactions to return (1-1000) |

See [Transaction Status](/onramp/core-features/transaction-status) for detailed response schemas.

### Rate Limits

**Buy Quote API and Sell Quote API** are rate limited to **10 requests per second** per app ID.

Rate limit exceeded responses return HTTP 429 with `rate_limit_exceeded` error.

***

## Onramp

Reference documentation specific to Onramp (buying crypto with fiat).

### Onramp URL Parameters

Format: `https://pay.coinbase.com/buy/select-asset?sessionToken=<token>`

| Parameter | Required | Type | Description |
| :- | :- | :- | :- |
| `sessionToken` | Yes | String | Token from Session Token API |
| `partnerUserRef` | No | String | Unique user identifier for tracking transactions (max 50 chars) |
| `redirectUrl` | No | String | URL to redirect after purchase completion. Production URLs must be added to your domain allowlist (see [Security Requirements](/onramp/security-requirements)). |
| `defaultNetwork` | No | String | Default network when multiple options available |
| `defaultAsset` | No | String | Default asset when multiple options available |
| `presetCryptoAmount` | No | Number | Preset crypto amount |
| `presetFiatAmount` | No | Number | Preset fiat amount (USD, CAD, GBP, EUR only) |
| `defaultExperience` | No | String | Either "send" (transfer from Coinbase) or "buy" (purchase) |
| `defaultPaymentMethod` | No | String | Default payment method |
| `fiatCurrency` | No | String | Fiat currency (e.g., USD, CAD, GBP) |

#### Example

```bash theme={null}
https://pay.coinbase.com/buy/select-asset?sessionToken=abc123&partnerUserRef=user-789&redirectUrl=https://yourapp.com
```

### Buy Quote API

Get a quote for purchasing crypto with fiat.

**Endpoint:** `POST https://api.developer.coinbase.com/onramp/v1/buy/quote`

#### Request Parameters

| Name | Type | Required | Description |
| :- | :- | :- | :- |
| `purchase_currency` | String | Yes | Crypto asset to purchase |
| `payment_amount` | String | Yes | Fiat amount to spend (e.g., "100.00") |
| `payment_currency` | String | Yes | Fiat currency (e.g., "USD") |
| `payment_method` | String | Yes | Payment method type |
| `country` | String | Yes | ISO 3166-1 country code (e.g., "US") |
| `purchase_network` | String | No | Network for purchase (e.g., "base", "ethereum") |
| `subdivision` | String | No | ISO 3166-2 state code (required for US, e.g., "NY") |

#### Payment Methods

`CARD`, `ACH_BANK_ACCOUNT`, `APPLE_PAY`, `FIAT_WALLET`, `CRYPTO_ACCOUNT`, `GUEST_CHECKOUT_CARD`, `PAYPAL`, `RTP`, `GUEST_CHECKOUT_APPLE_PAY`, `GUEST_CHECKOUT_GOOGLE_PAY`

### Buy Config & Options

Get supported countries, currencies, and assets for Onramp.

* **Buy Config:** `GET https://api.developer.coinbase.com/onramp/v1/buy/config`
* **Buy Options:** `GET https://api.developer.coinbase.com/onramp/v1/buy/options?country=<code>&subdivision=<code>`

***

## Offramp

Reference documentation specific to Offramp (selling crypto for fiat).

### Offramp URL Parameters

Format: `https://pay.coinbase.com/v3/sell/input?sessionToken=<token>&partnerUserRef=<id>&redirectUrl=<url>`

| Parameter | Required | Type | Description |
| :- | :- | :- | :- |
| `sessionToken` | Yes | String | Token from Session Token API |
| `partnerUserRef` | Yes | String | Unique user identifier (max 50 chars) |
| `redirectUrl` | Yes | String | URL to redirect after cash out. Must be in domain allowlist for production. |
| `defaultNetwork` | No | String | Default network when multiple options available |
| `defaultAsset` | No | String | Default asset when multiple options available |
| `presetCryptoAmount` | No | Number | Preset crypto amount |
| `presetFiatAmount` | No | Number | Preset fiat amount (USD, CAD, GBP, EUR only) |
| `defaultCashoutMethod` | No | String | Default payment method: "FIAT\_WALLET", "CRYPTO\_ACCOUNT", "ACH\_BANK\_ACCOUNT", "PAYPAL" |
| `fiatCurrency` | No | String | Fiat currency (e.g., USD, CAD, GBP) |
| `disableEdit` | No | Boolean | Prevents users from editing order in One-Click Sell flow (default: false) |

#### Example

```bash theme={null}
https://pay.coinbase.com/v3/sell/input?sessionToken=abc123&partnerUserRef=user-789&redirectUrl=https://yourapp.com
```

<Info>
  Production `redirectUrl` values must be added to your domain allowlist. See [Security Requirements](/onramp/security-requirements).
</Info>

### Sell Quote API

Get a quote for selling crypto to fiat.

**Endpoint:** `POST https://api.developer.coinbase.com/onramp/v1/sell/quote`

#### Request Parameters

| Name | Type | Required | Description |
| :- | :- | :- | :- |
| `sell_currency` | String | Yes | Crypto asset to sell |
| `sell_amount` | String | Yes | Crypto amount to sell |
| `sell_network` | String | Yes | Network of the asset (e.g., "ethereum") |
| `cashout_currency` | String | Yes | Fiat currency to receive (e.g., "USD") |
| `payment_method` | String | Yes | Cashout method |
| `country` | String | Yes | ISO 3166-1 country code |
| `subdivision` | String | No | ISO 3166-2 state code (required for US) |

<Tip>
  Include `source_address`, `redirect_url`, and `partner_user_ref` to receive a ready-to-use `offramp_url` in the response.
</Tip>

### Sell Config & Options

Get supported countries, currencies, and assets for Offramp.

* **Sell Config:** `GET https://api.developer.coinbase.com/onramp/v1/sell/config`
* **Sell Options:** `GET https://api.developer.coinbase.com/onramp/v1/sell/options?country=<code>&subdivision=<code>`

***

## What to read next

* **[Quickstart](/onramp/introduction/quickstart):** Get started with Onramp and Offramp
* **[Security Requirements](/onramp/security-requirements):** Implement CORS and authentication
* **[API Reference (OpenAPI)](/api-reference/rest-api/onramp-offramp/create-session-token):** Full OpenAPI specification
