/**
 * The catalog of providers whose keys the desk can pool (`src/lib/credentials/`).
 *
 * Every provider declares the fields it needs and the env var each falls back to, so the
 * admin console, the resolver and the smoke test all agree on one shape. The env var is
 * always a valid candidate (and stays the primary), which means a deployment that only
 * sets env keys behaves exactly as before — the pool is additive.
 */

/** Where a provider sits in the desk. `moneyMoving` providers can move funds. */
export type ProviderKind = "signal" | "market" | "venue" | "custody";

export interface ProviderField {
  /** Field name inside the encrypted payload, e.g. `apiKey`. */
  key: string;
  /** Human label. */
  label: string;
  /** The env var that supplies this field when no pool key is used. */
  env: string;
  /** Optional fields may be absent (e.g. an account name). */
  optional?: boolean;
}

export interface ProviderDef {
  id: string;
  name: string;
  kind: ProviderKind;
  /** Whether a leak of this credential could move funds. */
  moneyMoving: boolean;
  fields: ProviderField[];
  docsUrl?: string;
}

export const PROVIDER_DEFS: ProviderDef[] = [
  {
    id: "altfins",
    name: "AltFins",
    kind: "signal",
    moneyMoving: false,
    fields: [{ key: "apiKey", label: "API key", env: "ALTFINS_API_KEY" }],
    docsUrl: "https://altfins.com/api/",
  },
  {
    id: "freecryptoapi",
    name: "FreeCryptoAPI",
    kind: "market",
    moneyMoving: false,
    fields: [{ key: "apiKey", label: "API key", env: "FREECRYPTOAPI_API_KEY" }],
    docsUrl: "https://freecryptoapi.com/panel/dashboard",
  },
  {
    id: "taapi",
    name: "TAAPI.IO",
    kind: "signal",
    moneyMoving: false,
    fields: [{ key: "apiKey", label: "API key", env: "TAAPI_API_KEY" }],
    docsUrl: "https://taapi.io/dashboard/",
  },
  {
    id: "coinmarketcap",
    name: "CoinMarketCap",
    kind: "market",
    moneyMoving: false,
    fields: [{ key: "apiKey", label: "API key", env: "COINMARKETCAP_API_KEY" }],
    docsUrl: "https://coinmarketcap.com/api/dashboard/api-keys/",
  },
  {
    id: "finnhub",
    name: "Finnhub",
    kind: "market",
    moneyMoving: false,
    fields: [{ key: "apiKey", label: "API key", env: "FINNHUB_API_KEY" }],
    docsUrl: "https://finnhub.io/dashboard",
  },
  {
    id: "wundertrading",
    name: "WunderTrading",
    kind: "venue",
    moneyMoving: true,
    fields: [
      { key: "apiKey", label: "API key", env: "WUNDERTRADING_API_KEY" },
      { key: "secretKey", label: "Secret key (HMAC signing)", env: "WUNDERTRADING_SECRET_KEY" },
    ],
    docsUrl: "https://wundertrading.com/en/trader/open_api",
  },
  {
    id: "coinbase-cdp",
    name: "Coinbase CDP (custody)",
    kind: "custody",
    moneyMoving: true,
    fields: [
      { key: "apiKeyId", label: "API key id", env: "CDP_API_KEY_ID" },
      { key: "apiKeySecret", label: "API key secret", env: "CDP_API_KEY_SECRET" },
      { key: "walletSecret", label: "Wallet secret", env: "CDP_WALLET_SECRET" },
      { key: "keyId", label: "Account name", env: "CUSTODY_KEY_ID", optional: true },
    ],
    docsUrl: "https://portal.cdp.coinbase.com/api-keys/secret",
  },
];

export function providerDef(id: string): ProviderDef | undefined {
  return PROVIDER_DEFS.find((p) => p.id === id);
}

/** Providers whose keys only read data (safe to fail over aggressively). */
export function isReadOnly(provider: string): boolean {
  return providerDef(provider)?.moneyMoving === false;
}
