"use client";

import { useState } from "react";

// Type-only import: this is erased at build time, so the server-only swap adapter
// (and the custody boundary it imports) never reaches the browser bundle.
import type { SwapPreset } from "@/lib/coinbase/trading";

/**
 * The real-funds swap form (`PHASE19-004`). Kept as a small client component so the
 * amount label follows the selected pair; the submit is the server action, which is
 * where every safety check actually lives (a client component is never trusted).
 */
export function CoinbaseSwapForm({
  presets,
  action,
}: {
  presets: SwapPreset[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [pairId, setPairId] = useState(presets[0]?.id ?? "");
  // A stable key for this form instance: a retry after a network hiccup re-sends the
  // same key, so it is a no-op rather than a second swap.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const preset = presets.find((p) => p.id === pairId) ?? presets[0];

  return (
    <form action={action} className="grid" style={{ gap: 10 }}>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div>
        <label className="field" htmlFor="coinbase-swap-pair">Pair</label>
        <select
          className="input"
          id="coinbase-swap-pair"
          name="pair"
          value={pairId}
          onChange={(e) => setPairId(e.target.value)}
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="field" htmlFor="coinbase-swap-amount">
          Amount ({preset?.fromSymbol ?? "token"})
        </label>
        <input
          className="input"
          id="coinbase-swap-amount"
          name="amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={preset?.fromDecimals === 6 ? "10.00" : "0.05"}
          required
        />
      </div>
      <label className="muted" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
        <input type="checkbox" name="confirm" required style={{ marginTop: 3 }} />
        <span>I understand this swap moves <b>real funds</b> on-chain and cannot be undone.</span>
      </label>
      <button className="btn primary" type="submit">Swap on Coinbase</button>
    </form>
  );
}
