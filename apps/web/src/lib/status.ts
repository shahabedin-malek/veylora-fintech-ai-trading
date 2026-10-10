/**
 * Integration status — reports which capabilities are **configured**, by presence only.
 *
 * It exists so an operator (or a reviewer) can see at a glance what is wired up without
 * reading a secret: every item is a boolean decided by presence and shape, and no value is
 * ever returned, rendered or logged. Pure and framework-free, so it is unit-testable.
 *
 * `required: true` items must be present for the app to be sound at all (the datastore and
 * the session signer). Everything else is a capability that **degrades gracefully** when
 * absent: the read-only surfaces keep working on keyless public data, and real money
 * actions fail **closed** rather than falling back.
 */

export type EnvLike = Record<string, string | undefined>;

export interface IntegrationStatus {
  id: string;
  label: string;
  /** True when the capability is configured on this deployment. */
  configured: boolean;
  /** True only for the items the app cannot run sensibly without. */
  required: boolean;
  /** What the item unlocks, or what is missing — never a value. */
  note: string;
}

function present(env: EnvLike, name: string): boolean {
  return (env[name] ?? "").trim().length > 0;
}

function allPresent(env: EnvLike, names: readonly string[]): boolean {
  return names.every((name) => present(env, name));
}

/** Grouped capability list, in display order. */
export function integrationStatuses(env: EnvLike = process.env): IntegrationStatus[] {
  const sessionStrong = (env.SESSION_SECRET ?? "").trim().length >= 16;

  return [
    {
      id: "database",
      label: "Datastore",
      configured: present(env, "DATABASE_URL"),
      required: true,
      note: present(env, "DATABASE_URL")
        ? "A datasource is configured."
        : "No datasource configured — the app cannot persist state.",
    },
    {
      id: "session",
      label: "Session signing",
      configured: sessionStrong,
      required: true,
      note: sessionStrong
        ? "A strong session secret is set."
        : "No strong session secret — production refuses to sign sessions.",
    },
    {
      id: "custody",
      label: "Custody (real on-chain movement)",
      configured: allPresent(env, [
        "CUSTODY_PROVIDER",
        "CUSTODY_KEY_ID",
        "CDP_API_KEY_ID",
        "CDP_API_KEY_SECRET",
        "CDP_WALLET_SECRET",
      ]),
      required: false,
      note: "When unset, every mainnet money action is refused — never replaced by a practice flow.",
    },
    {
      id: "onramp",
      label: "Coinbase Onramp / Offramp",
      configured: allPresent(env, ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET"]),
      required: false,
      note: "Fiat buy/sell hand-off to the user's own wallet. Onramp also needs the CDP project registered for Onramp.",
    },
    {
      id: "venue",
      label: "Venue execution (WunderTrading)",
      configured: allPresent(env, ["WUNDERTRADING_API_KEY", "WUNDERTRADING_SECRET_KEY"]),
      required: false,
      note: "When unset, venue orders are refused (fail closed).",
    },
    {
      id: "coinbase-webhook",
      label: "Coinbase webhooks",
      configured: present(env, "COINBASE_WEBHOOK_SECRET"),
      required: false,
      note: "Without the signing secret the receiver is disabled and accepts nothing.",
    },
    {
      id: "finnhub-webhook",
      label: "Finnhub webhooks",
      configured: present(env, "FINNHUB_WEBHOOK_SECRET"),
      required: false,
      note: "Verifies deliveries; applies no balance change either way.",
    },
    {
      id: "cron",
      label: "Scheduled jobs",
      configured: present(env, "CRON_SECRET"),
      required: false,
      note: "Authorises the /api/cron/* routes (desk sync, reconciliation). Disabled until set.",
    },
    {
      id: "key-pool",
      label: "Provider key pool",
      configured: present(env, "CREDENTIAL_ENCRYPTION_KEY"),
      required: false,
      note: "Encrypts admin-managed provider keys at rest. Env-var keys still work without it.",
    },
    {
      id: "owner",
      label: "Owner controls",
      configured: present(env, "OWNER_WALLET_ADDRESSES"),
      required: false,
      note: "Empty means there is no owner, so every owner-only surface is unreachable.",
    },
    {
      id: "market-keyless",
      label: "Market data (keyless)",
      configured: true,
      required: false,
      note: "A keyless public crypto feed is always available; no key is required.",
    },
    {
      id: "finnhub-market",
      label: "Equities data (Finnhub)",
      configured: present(env, "FINNHUB_API_KEY"),
      required: false,
      note: "Without it, equities fall back to the clearly-labelled offline generator.",
    },
    {
      id: "altfins",
      label: "Signals — AltFins",
      configured: present(env, "ALTFINS_API_KEY"),
      required: false,
      note: "A keyed vendor signal feed; inert without a key.",
    },
    {
      id: "freecryptoapi",
      label: "Signals — FreeCryptoAPI",
      configured: present(env, "FREECRYPTOAPI_API_KEY"),
      required: false,
      note: "Keyed market/TA source; inert without a key.",
    },
    {
      id: "taapi",
      label: "Signals — TAAPI.IO",
      configured: present(env, "TAAPI_API_KEY"),
      required: false,
      note: "Keyed indicator readings; inert without a key.",
    },
    {
      id: "coinmarketcap",
      label: "Signals — CoinMarketCap",
      configured: present(env, "COINMARKETCAP_API_KEY"),
      required: false,
      note: "Optional: the keyless public API is used when no key is set.",
    },
    {
      id: "compliance",
      label: "Sanctions screening",
      configured: present(env, "COMPLIANCE_PROVIDER"),
      required: false,
      note: "Default is an honest no-op that reports screening as off.",
    },
  ];
}

export interface StatusSummary {
  items: IntegrationStatus[];
  ready: number;
  /** Every `required` item is configured. */
  coreReady: boolean;
  /** Required items that are missing. */
  missingRequired: string[];
}

export function statusSummary(env: EnvLike = process.env): StatusSummary {
  const items = integrationStatuses(env);
  return {
    items,
    ready: items.filter((i) => i.configured).length,
    coreReady: items.filter((i) => i.required).every((i) => i.configured),
    missingRequired: items.filter((i) => i.required && !i.configured).map((i) => i.label),
  };
}
