/**
 * Live provider smoke test.
 *
 * Probes each provider's **cheapest** endpoint with its resolved key(s) — exercising the
 * same failover the adapters use — and reports a key-free verdict. It is read-only: no
 * order is placed, no money moves. A provider whose key has no entitlement (FreeCryptoAPI
 * TA endpoints, an un-upgraded plan) is reported as `upgrade-required` rather than
 * `error`, so the operator knows the difference between a broken key and a missing plan.
 *
 * Money-moving providers (WunderTrading, Coinbase CDP) are **presence-only** here: a
 * harmless GET is still an authenticated request against a signing credential, and the
 * venue-order path test (`tests/wundertrading.test.ts`) already covers its wire shape.
 */

import { ProviderRequestError, credentialCandidates, withCredential } from "@/lib/credentials/pool";
import { PROVIDER_DEFS, type ProviderDef } from "@/lib/credentials/providers";
import { recordProviderHealth, type ProviderHealthEntry } from "@/lib/credentials/health";

const TIMEOUT_MS = 6000;

interface ProbeResult {
  ok: boolean;
  status: ProviderHealthEntry["status"];
  error?: string;
}

function withTimeout(): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

/** FreeCryptoAPI answers 200 with `{status:false,error:"No access…"}` for a gated endpoint. */
function freecryptoEntitlement(payload: unknown): ProbeResult | null {
  if (payload && typeof payload === "object" && (payload as { status?: unknown }).status === false) {
    const message = String((payload as { error?: unknown }).error ?? "no access");
    return { ok: false, status: "upgrade-required", error: message };
  }
  return null;
}

async function fetchOk(url: string, init: RequestInit): Promise<{ res: Response; payload: unknown }> {
  const res = await fetch(url, init);
  let payload: unknown = null;
  try {
    payload = await res.clone().json();
  } catch {
    payload = null;
  }
  return { res, payload };
}

/** One provider probe, using the resolved candidate values. Returns a probe result. */
async function probeWith(def: ProviderDef, values: Record<string, string>): Promise<ProbeResult> {
  const t = withTimeout();
  try {
    switch (def.id) {
      case "altfins": {
        const { res } = await fetchOk("https://altfins.com/api/v2/public/signals-feed/signal-keys", {
          method: "GET",
          signal: t.signal,
          headers: { accept: "application/json", "X-API-KEY": values.apiKey },
        });
        return res.ok ? { ok: true, status: "ok" } : { ok: false, status: "rejected", error: `HTTP ${res.status}` };
      }
      case "freecryptoapi": {
        const { res, payload } = await fetchOk("https://api.freecryptoapi.com/v1/getData?symbol=BTC", {
          signal: t.signal,
          headers: { accept: "application/json", Authorization: `Bearer ${values.apiKey}` },
        });
        if (!res.ok) return { ok: false, status: "rejected", error: `HTTP ${res.status}` };
        return freecryptoEntitlement(payload) ?? { ok: true, status: "ok" };
      }
      case "taapi": {
        const { res, payload } = await fetchOk(
          "https://v2.taapi.io/indicator/rsi?exchange=binance&symbol=BTCUSDT&timeframe=1h",
          { signal: t.signal, headers: { accept: "application/json", Authorization: `Bearer ${values.apiKey}` } }
        );
        if (!res.ok) return { ok: false, status: "rejected", error: `HTTP ${res.status}` };
        // TAAPI answers 200 with an `error` field for an inactive token.
        const err = payload && typeof payload === "object" ? (payload as { error?: unknown }).error : undefined;
        if (typeof err === "string" && err) return { ok: false, status: "rejected", error: err };
        return { ok: true, status: "ok" };
      }
      case "coinmarketcap": {
        const base = `${values.apiKey ? "https://pro-api.coinmarketcap.com" : "https://pro-api.coinmarketcap.com/public-api"}`;
        const { res } = await fetchOk(`${base}/v3/cryptocurrency/listings/latest?start=1&limit=1&convert=USD`, {
          signal: t.signal,
          headers: { accept: "application/json", ...(values.apiKey ? { "X-CMC_PRO_API_KEY": values.apiKey } : {}) },
        });
        return res.ok ? { ok: true, status: "ok" } : { ok: false, status: "rejected", error: `HTTP ${res.status}` };
      }
      case "finnhub": {
        const { res } = await fetchOk("https://finnhub.io/api/v1/quote?symbol=AAPL", {
          signal: t.signal,
          headers: { accept: "application/json", "X-Finnhub-Token": values.apiKey },
        });
        return res.ok ? { ok: true, status: "ok" } : { ok: false, status: "rejected", error: `HTTP ${res.status}` };
      }
      default:
        return { ok: true, status: "presence-only" };
    }
  } finally {
    t.done();
  }
}

/** Probe a single provider. Never throws. */
export async function smokeProvider(def: ProviderDef): Promise<ProviderHealthEntry> {
  const checkedAt = new Date().toISOString();
  const candidates = await credentialCandidates(def.id);
  if (!candidates.length) return { provider: def.id, ok: false, status: "unconfigured", checkedAt };

  const started = Date.now();
  try {
    const result = await withCredential(def.id, (values) => probeWith(def, values));
    return { provider: def.id, ...result, latencyMs: Date.now() - started, checkedAt };
  } catch (error) {
    const isRejected = error instanceof ProviderRequestError && error.status !== undefined;
    return {
      provider: def.id,
      ok: false,
      status: isRejected ? "rejected" : "error",
      error: error instanceof Error ? error.message : "unknown error",
      latencyMs: Date.now() - started,
      checkedAt,
    };
  }
}

/** Probe every known provider and record the results. Read-only. */
export async function smokeProviders(): Promise<ProviderHealthEntry[]> {
  const results = await Promise.all(PROVIDER_DEFS.map((def) => smokeProvider(def)));
  await recordProviderHealth(results);
  return results;
}
