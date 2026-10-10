import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { distribution } from "@/lib/signals/evaluate";
import { loadBacktestInput } from "@/lib/signals/backtest";

/**
 * Backtest lab — a **read-only** screen that forward-tests the stored signal history
 * (`docs/signals/IMPLEMENTATION.md` §8). It shows, per provider signal key and horizon,
 * the forward-return distribution, hit rate and coverage, split out-of-sample and by
 * regime. It computes nothing the money paths read and offers no action: signals remain a
 * read-only input, and there is no position sizing anywhere.
 */

function pct(value: number, dp = 1): string {
  return `${value.toFixed(dp)}%`;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function rate(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(0)}%`;
}

function coverage(scored: number, eligible: number): string {
  return eligible > 0 ? `${((scored / eligible) * 100).toFixed(0)}%` : "—";
}

export default async function BacktestPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const { result, windowDays, generatedAt, symbols, signalKeys } = await loadBacktestInput();
  const { totals, summaries, inSample, outOfSample, byRegime } = result;

  const histogram = distribution(result.returns.filter((r) => r.horizon === "24h"));
  const maxBucket = Math.max(1, ...histogram.map((b) => b.count));

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <h1 style={{ margin: 0 }}>Backtest lab</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          Forward-test of stored signals over the last {windowDays} days. Read-only — it scores
          history, it does not size or place anything.{" "}
          <Link className="link" href="/admin">Back to CRM console</Link>
        </p>
      </div>

      <section className="card" data-backtest-caveats="">
        <h2 style={{ marginTop: 0 }}>How to read this</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          <li>
            A forward return is measured from the price a signal fired at to the first{" "}
            <b>stored</b> reading of the same instrument at or after the horizon. Nothing before the
            signal is used, so there is no lookahead.
          </li>
          <li>
            The app keeps no OHLC price history — the only real prices are the ones a provider
            attached to a signal. That makes coverage the number to watch: a low coverage means most
            samples could not be scored, not that the signal is bad.
          </li>
          <li>
            <b>Neutral</b> events (every derived market-move and every TA reading) are scored for
            return but contribute no hit/miss, so they can never look prescient by construction.
          </li>
          <li>
            Nothing here is a return, a recommendation or a strategy. There is no position sizing;
            the desk risk gate can only refuse.
          </li>
        </ul>
      </section>

      <div className="grid cols-3">
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Samples</div>
          <div className="mono" style={{ fontSize: 26 }}>{totals.samples}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{signalKeys} signal key(s), {symbols} instrument(s)</div>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>With a usable price</div>
          <div className="mono" style={{ fontSize: 26 }}>{totals.eligible}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {totals.samples ? `${((totals.eligible / totals.samples) * 100).toFixed(0)}% of samples` : "—"}
          </div>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 13 }}>Scored (sample × horizon)</div>
          <div className="mono" style={{ fontSize: 26 }}>{totals.scoredPairs}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>as of {new Date(generatedAt).toLocaleString()}</div>
        </div>
      </div>

      {totals.samples === 0 ? (
        <section className="card">
          <p className="muted" style={{ margin: 0 }}>
            No stored signals in the window yet. Run the desk sync (or wait for the cron) and this
            fills in. Nothing is fabricated to fill the gap.
          </p>
        </section>
      ) : (
        <>
          <section className="card table-wrap">
            <h2 style={{ marginTop: 0 }}>Per signal key</h2>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
              Sorted by how much could be scored. Claimed → matches the signal&apos;s own direction
              (bullish/bearish only; neutral is excluded from the rate).
            </p>
            <table className="data">
              <thead>
                <tr>
                  <th>Signal key</th><th>Horizon</th><th>Eligible</th><th>Scored</th>
                  <th>Coverage</th><th>Claimed</th><th>Hit rate</th><th>Mean</th><th>Median</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={`${s.signalKey}-${s.horizon}`}>
                    <td className="mono" style={{ fontSize: 12 }}>{s.signalKey}</td>
                    <td>{s.horizon}</td>
                    <td className="mono muted">{s.eligible}</td>
                    <td className="mono">{s.scored}</td>
                    <td className="mono muted">{coverage(s.scored, s.eligible)}</td>
                    <td className="mono muted">{s.directional}</td>
                    <td className="mono"><span className={`badge ${s.hitRate !== null && s.hitRate >= 0.5 ? "good" : ""}`}>{rate(s.hitRate)}</span></td>
                    <td className={`mono ${(s.meanReturnPct ?? 0) >= 0 ? "pos" : "neg"}`}>{s.meanReturnPct === null ? "—" : signed(s.meanReturnPct)}</td>
                    <td className={`mono ${(s.medianReturnPct ?? 0) >= 0 ? "pos" : "neg"}`}>{s.medianReturnPct === null ? "—" : signed(s.medianReturnPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card table-wrap">
            <h2 style={{ marginTop: 0 }}>Out-of-sample split</h2>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
              Samples are split by time ({inSample[0] ? "earlier 70% vs later 30%" : "by timestamp"}). The tail is
              never used to fit anything — nothing here fits.
            </p>
            <table className="data">
              <thead>
                <tr><th>Horizon</th><th>In-sample scored</th><th>In hit rate</th><th>Out-of-sample scored</th><th>Out hit rate</th></tr>
              </thead>
              <tbody>
                {inSample.map((row, i) => (
                  <tr key={row.horizon}>
                    <td>{row.horizon}</td>
                    <td className="mono muted">{row.scored}</td>
                    <td className="mono">{rate(row.hitRate)}</td>
                    <td className="mono muted">{outOfSample[i]?.scored ?? 0}</td>
                    <td className="mono">{rate(outOfSample[i]?.hitRate ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card table-wrap">
            <h2 style={{ marginTop: 0 }}>By regime</h2>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
              The regime in force when the signal fired (from the provider&apos;s own trend signals);
              `unknown` means no marking preceded the sample.
            </p>
            <table className="data">
              <thead>
                <tr><th>Regime</th><th>Horizon</th><th>Scored</th><th>Hit rate</th><th>Mean</th></tr>
              </thead>
              <tbody>
                {byRegime.flatMap((r) =>
                  r.stats.map((stat) => (
                    <tr key={`${r.regime}-${stat.horizon}`}>
                      <td>{r.regime}</td>
                      <td>{stat.horizon}</td>
                      <td className="mono muted">{stat.scored}</td>
                      <td className="mono">{rate(stat.hitRate)}</td>
                      <td className={`mono ${(stat.meanReturnPct ?? 0) >= 0 ? "pos" : "neg"}`}>
                        {stat.meanReturnPct === null ? "—" : signed(stat.meanReturnPct)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="card table-wrap">
            <h2 style={{ marginTop: 0 }}>24h forward-return distribution</h2>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
              Every scored 24h forward return, bucketed. A wide, centred spread is what an
              uninformative signal looks like.
            </p>
            <table className="data">
              <thead><tr><th>Bucket</th><th>Count</th><th /></tr></thead>
              <tbody>
                {histogram.map((bucket) => (
                  <tr key={bucket.label}>
                    <td className="mono muted">{bucket.label}</td>
                    <td className="mono">{bucket.count}</td>
                    <td style={{ width: "60%" }}>
                      <span
                        aria-hidden="true"
                        style={{
                          display: "inline-block",
                          height: 10,
                          width: `${(bucket.count / maxBucket) * 100}%`,
                          background: "var(--accent, #4c8dff)",
                          borderRadius: 6,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
