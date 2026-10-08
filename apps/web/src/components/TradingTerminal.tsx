"use client";

import { useEffect, useRef, useState } from "react";

export interface TerminalLine {
  ts: string;
  message: string;
}

interface Props {
  initial: TerminalLine[];
  active: boolean;
  templates: string[];
  minMs?: number;
  maxMs?: number;
  startPnlCents?: number;
}

/**
 * Simulated AI trading terminal. Appends clearly-labelled simulated events on a
 * deterministic, configurable cadence (default 3–30s). The tick delay cycles
 * deterministically rather than randomly, and the P/L wobble is bounded and
 * labelled simulated — nothing here implies real trading performance.
 */
export function TradingTerminal({ initial, active, templates, minMs = 3000, maxMs = 30000, startPnlCents = 0 }: Props) {
  const [lines, setLines] = useState<TerminalLine[]>(initial);
  const [pnl, setPnl] = useState(startPnlCents);
  const step = useRef(initial.length);

  useEffect(() => {
    setLines(initial);
  }, [initial]);

  useEffect(() => {
    if (!active) return;
    const span = Math.max(1, maxMs - minMs);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      // Deterministic delay: cycles through the range as the step counter grows.
      const delay = minMs + ((step.current * 3701) % span);
      timer = setTimeout(() => {
        if (cancelled) return;
        step.current += 1;
        const message = templates[step.current % templates.length] ?? "Simulated activity…";
        setLines((prev) => [...prev.slice(-200), { ts: new Date().toISOString(), message }]);
        setPnl((p) => p + (step.current % 7) - 3); // bounded, deterministic wobble (cents)
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, minMs, maxMs, templates]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>Simulated activity stream</strong>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`badge ${active ? "live" : "sim"}`}>{active ? "running" : "idle"}</span>
          <span className="badge sim">simulated P/L {pnl >= 0 ? "+" : ""}{(pnl / 100).toFixed(2)} USD</span>
        </div>
      </div>
      <div className="terminal" role="log" aria-live="polite">
        {lines.length === 0 ? (
          <div className="line muted">No activity yet — start the simulated desk to see events.</div>
        ) : (
          lines.map((l, i) => (
            <div className="line" key={`${l.ts}-${i}`}>
              <span className="ts">{l.ts.slice(11, 19)}</span>
              {l.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
