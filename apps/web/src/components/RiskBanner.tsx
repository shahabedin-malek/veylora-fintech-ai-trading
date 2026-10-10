import type { RiskAssessment } from "@/lib/risk/assess";

/**
 * Shows the desk risk state — the same assessment the trade path enforces, so the state
 * is visible before a user submits rather than only after a refusal.
 *
 * A server component on purpose: it renders a decision made from stored inputs and has
 * no interactive state. `data-risk-level` is exposed so a UI test can assert the level.
 */
export function RiskBanner({ assessment }: { assessment: RiskAssessment }) {
  const tone = assessment.level === "off" ? "neg" : assessment.level === "elevated" ? "warn" : "good";
  const title =
    assessment.level === "off"
      ? "Risk-off — new trades are refused"
      : assessment.level === "elevated"
        ? "Elevated risk"
        : "Desk risk: normal";

  return (
    <section className="card" role="status" data-risk-level={assessment.level}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
        <span className={`badge ${tone}`}>{assessment.level}</span>
      </div>

      {assessment.level === "normal" ? (
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
          No recent news or stored signal is flagging caution
          {assessment.counts.signals === 0 ? " (no signals are stored yet)" : ""}.
        </p>
      ) : (
        <>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
            The desk combines recent news and stored signals before a trade. It is a rule set, not
            advice, and it can only refuse a trade — it never opens one.
          </p>
          {assessment.reasons.length > 0 && (
            <ul className="muted" style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>
              {assessment.reasons.slice(0, 6).map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
