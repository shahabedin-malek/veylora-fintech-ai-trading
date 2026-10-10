import Link from "next/link";
import { redirect } from "next/navigation";

import {
  addProviderCredentialAction,
  deleteProviderCredentialAction,
  smokeProviderKeysAction,
  toggleProviderCredentialAction,
} from "@/lib/credentials/actions";
import { credentialEncryptionAvailable } from "@/lib/credentials/crypto";
import { providerHealth, providerHealthHistory } from "@/lib/credentials/health";
import { providerPoolAlerts, warmCredentialCache } from "@/lib/credentials/pool";
import { PROVIDER_DEFS } from "@/lib/credentials/providers";
import { auditCoinbaseCredentials } from "@/lib/coinbase/credentials";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Credential console: the **provider key pool** plus the Coinbase credential audit.
 *
 * An operator can add several keys per provider so that when one is rate-limited,
 * exhausted or revoked the resolver rotates to the next — keeping the signals, quotes
 * and graphs alive. A key is encrypted the moment it is submitted; it is **never**
 * read back, rendered or logged, and only a non-reversible fingerprint is shown.
 */

const NOTICE: Record<string, string> = {
  added: "Key added and encrypted. It joins the rotation for its provider.",
  toggled: "Key updated.",
  deleted: "Key removed.",
  smoked: "Smoke test complete — see provider health below.",
  "badprovider": "Unknown provider.",
  "missing": "A required field was empty — nothing was saved.",
  "missing-row": "That key no longer exists.",
  "no-key":
    "Cannot store keys: CREDENTIAL_ENCRYPTION_KEY is not set, so the encrypted pool is disabled. Env-var keys still work.",
};

const STATUS_TONE: Record<string, string> = {
  ok: "good",
  ACTIVE: "good",
  "upgrade-required": "warn",
  COOLDOWN: "warn",
  DISABLED: "",
  rejected: "neg",
  error: "neg",
  unconfigured: "",
  "presence-only": "",
};

function fieldInputType(key: string): string {
  return /secret|key|password/i.test(key) && !/id$/i.test(key) ? "password" : "text";
}

export default async function AdminCredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ keys?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const notice = sp.keys ? NOTICE[sp.keys] : undefined;

  // Warm the presence cache so the pool is reflected in synchronous gates, and load the
  // pool rows — projected without `secret` so no ciphertext (let alone plaintext)
  // reaches the render.
  await warmCredentialCache(PROVIDER_DEFS.map((d) => d.id));
  const [rows, health, audit, poolAlerts, history] = await Promise.all([
    prisma.providerCredential.findMany({
      orderBy: [{ provider: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        provider: true,
        label: true,
        fingerprint: true,
        priority: true,
        enabled: true,
        status: true,
        lastError: true,
        successCount: true,
        failureCount: true,
        cooldownUntil: true,
        lastUsedAt: true,
      },
    }),
    providerHealth(),
    Promise.resolve(auditCoinbaseCredentials()),
    providerPoolAlerts(),
    providerHealthHistory(),
  ]);

  const encryptionReady = credentialEncryptionAvailable();
  const healthEntries = PROVIDER_DEFS.map((def) => health[def.id]).filter(Boolean);

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <h1 style={{ margin: 0 }}>Provider keys</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          Add several keys per provider; when one is rate-limited, exhausted or revoked the desk
          rotates to the next automatically. Keys are encrypted at rest and never shown again.{" "}
          <Link className="link" href="/admin">
            Back to CRM console
          </Link>
        </p>
      </div>

      {notice && (
        <p className="card" role="status" style={{ margin: 0, fontSize: 13 }}>{notice}</p>
      )}

      {!encryptionReady && (
        <p className="card" role="status" style={{ margin: 0, fontSize: 13 }}>
          <b>Key pool disabled.</b> Set{" "}
          <span className="mono">CREDENTIAL_ENCRYPTION_KEY</span> to a 32-byte value (e.g.{" "}
          <span className="mono">openssl rand -base64 32</span>) to store keys securely. Until then
          the app uses env-var keys only; keys cannot be added here.
        </p>
      )}

      {poolAlerts.length > 0 && (
        <section className="card" data-provider-alerts="" style={{ borderColor: "var(--warn, #b8860b)" }}>
          <h2 style={{ marginTop: 0 }}>⚠ Attention needed</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            A provider with no usable key will stop producing signals or quotes. Add a backup key
            or clear the cooldown.
          </p>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {poolAlerts.map((alert) => (
              <li key={alert.provider}>
                <span className="mono">{alert.provider}</span> —{" "}
                {alert.state === "unconfigured"
                  ? "no key configured (no env var and no pool key)"
                  : `all ${alert.poolEnabled} pool key(s) are cooling down`}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid cols-3">
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Pool keys</div>
          <div className="mono" style={{ fontSize: 26 }}>{rows.length}</div>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Enabled</div>
          <div className="mono" style={{ fontSize: 26 }}>{rows.filter((r) => r.enabled).length}</div>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Cooling down</div>
          <div className="mono" style={{ fontSize: 26 }}>
            {rows.filter((r) => r.cooldownUntil && r.cooldownUntil.getTime() > Date.now()).length}
          </div>
        </div>
      </div>

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Provider health</h2>
          <form action={smokeProviderKeysAction}>
            <button className="btn" type="submit">Run smoke test</button>
          </form>
        </div>
        <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          Read-only probes of each provider&apos;s cheapest endpoint. A gated but working key shows as{" "}
          <span className="mono">upgrade-required</span>; a revoked key shows as{" "}
          <span className="mono">rejected</span>.
        </p>
        {healthEntries.length === 0 ? (
          <p className="muted">No smoke test has run yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr><th>Provider</th><th>Status</th><th>Latency</th><th>Detail</th><th>Checked</th></tr>
            </thead>
            <tbody>
              {healthEntries.map((h) => (
                <tr key={h.provider}>
                  <td className="mono">{h.provider}</td>
                  <td><span className={`badge ${STATUS_TONE[h.status] ?? ""}`}>{h.status}</span></td>
                  <td className="mono muted">{h.latencyMs != null ? `${h.latencyMs}ms` : "—"}</td>
                  <td className="muted" style={{ fontSize: 12, overflowWrap: "anywhere" }}>{h.error ?? "—"}</td>
                  <td className="mono muted">{new Date(h.checkedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card table-wrap">
        <h2 style={{ marginTop: 0 }}>Provider health history</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          The most recent smoke checks per provider (newest first). A drifting status — e.g. `ok`
          becoming `rejected` — is visible here before it becomes an outage.
        </p>
        {!Object.keys(history).length ? (
          <p className="muted">No checks recorded yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr><th>Provider</th><th>Recent checks</th></tr>
            </thead>
            <tbody>
              {PROVIDER_DEFS.map((def) => {
                const series = [...(history[def.id] ?? [])].slice(-8).reverse();
                return (
                  <tr key={def.id}>
                    <td className="mono">{def.id}</td>
                    <td>
                      {series.length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {series.map((entry, index) => (
                            <span key={`${entry.checkedAt}-${index}`} className="muted" style={{ fontSize: 12 }}>
                              <span className={`badge ${STATUS_TONE[entry.status] ?? ""}`}>{entry.status}</span>{" "}
                              <span className="mono">{new Date(entry.checkedAt).toLocaleTimeString()}</span>
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {PROVIDER_DEFS.map((def) => {
        const keys = rows.filter((r) => r.provider === def.id);
        return (
          <section className="card" key={def.id}>
            <h2 style={{ marginTop: 0 }}>
              {def.name}{" "}
              <span className="muted mono" style={{ fontSize: 12, fontWeight: 400 }}>
                {def.id} · {def.kind}{def.moneyMoving ? " · can move funds" : ""}
              </span>
            </h2>

            {keys.length === 0 ? (
              <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
                No pool key — the provider uses its env var(s) only.
              </p>
            ) : (
              <table className="data" style={{ marginBottom: 14 }}>
                <thead>
                  <tr><th>Label</th><th>Fingerprint</th><th>Priority</th><th>Status</th><th>Uses</th><th>Fails</th><th>Cooling until</th><th>Last used</th><th /></tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id}>
                      <td>{k.label}</td>
                      <td className="mono muted">{k.fingerprint}</td>
                      <td className="mono">{k.priority}</td>
                      <td>
                        <span className={`badge ${STATUS_TONE[k.status] ?? ""}`}>{k.status}</span>
                        {!k.enabled && <span className="badge" style={{ marginLeft: 6 }}>off</span>}
                        {k.lastError && (
                          <div className="muted" style={{ fontSize: 11, overflowWrap: "anywhere" }}>{k.lastError}</div>
                        )}
                      </td>
                      <td className="mono">{k.successCount}</td>
                      <td className="mono">{k.failureCount > 0 ? <span className="neg">{k.failureCount}</span> : 0}</td>
                      <td className="mono muted">
                        {k.cooldownUntil && k.cooldownUntil.getTime() > Date.now()
                          ? k.cooldownUntil.toLocaleTimeString()
                          : "—"}
                      </td>
                      <td className="mono muted">{k.lastUsedAt ? k.lastUsedAt.toLocaleString() : "—"}</td>
                      <td style={{ display: "flex", gap: 8 }}>
                        <form action={toggleProviderCredentialAction}>
                          <input type="hidden" name="id" value={k.id} />
                          <button className="btn" type="submit" style={{ padding: "2px 10px" }}>
                            {k.enabled ? "Disable" : "Enable"}
                          </button>
                        </form>
                        <form action={deleteProviderCredentialAction}>
                          <input type="hidden" name="id" value={k.id} />
                          <button className="btn" type="submit" style={{ padding: "2px 10px" }}>Delete</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <form action={addProviderCredentialAction} className="grid" style={{ gap: 8, maxWidth: 420 }}>
              <input type="hidden" name="provider" value={def.id} />
              <div>
                <label className="field" htmlFor={`${def.id}-label`}>Label</label>
                <input className="input" id={`${def.id}-label`} name="label" placeholder="e.g. primary or backup-1" autoComplete="off" />
              </div>
              {def.fields.map((field) => (
                <div key={field.key}>
                  <label className="field" htmlFor={`${def.id}-${field.key}`}>
                    {field.label}{field.optional ? " (optional)" : ""}
                  </label>
                  <input
                    className="input"
                    id={`${def.id}-${field.key}`}
                    name={`field:${field.key}`}
                    type={fieldInputType(field.key)}
                    placeholder={field.env}
                    autoComplete="off"
                    required={!field.optional}
                  />
                </div>
              ))}
              <div>
                <label className="field" htmlFor={`${def.id}-priority`}>Priority (lower is tried first)</label>
                <input className="input" id={`${def.id}-priority`} name="priority" type="number" defaultValue={100} min={1} step={1} />
              </div>
              <button className="btn primary" type="submit" disabled={!encryptionReady}>
                Add key
              </button>
            </form>
          </section>
        );
      })}

      <section className="card table-wrap">
        <h2 style={{ marginTop: 0 }}>Coinbase credential hygiene</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Presence and shape only — no credential value is ever read, rendered or logged.
        </p>
        <table className="data">
          <thead>
            <tr><th>Name</th><th>Kind</th><th>Present</th><th>Surfaces</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {audit.statuses.map((s) => (
              <tr key={s.name}>
                <td className="mono">{s.name}</td>
                <td>{s.secret ? "secret" : "reference"}</td>
                <td>
                  <span className={`badge ${s.present ? (s.warnings.length ? "warn" : "good") : ""}`}>
                    {s.present ? "set" : "unset"}
                  </span>
                </td>
                <td className="muted">{s.surfaces.join(", ")}</td>
                <td className="muted" style={{ fontSize: 13 }}>
                  {s.warnings.length ? s.warnings.join("; ") : s.purpose}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
