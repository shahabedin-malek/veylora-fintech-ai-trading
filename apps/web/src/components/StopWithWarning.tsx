"use client";

import { useState } from "react";

/**
 * When a session is stopped before 5 minutes, show a clear warning and require an
 * explicit Force Stop confirmation instead of stopping immediately.
 */
export function StopWithWarning({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="btn danger" type="button" onClick={() => setOpen(true)}>
        ■ Stop trading
      </button>
    );
  }

  return (
    <div className="card" role="alertdialog" aria-label="Stop trading warning" style={{ padding: 14, maxWidth: 420 }}>
      <strong>You&apos;re stopping after less than 5 minutes.</strong>
      <p className="muted" style={{ margin: "6px 0 10px", fontSize: 13 }}>
        Short sessions are often accidental. Choose <b>Keep trading</b> to continue, or <b>Force Stop</b>
        to end the simulated session now.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Keep trading</button>
        <form action={action}>
          <input type="hidden" name="force" value="1" />
          <button className="btn danger" type="submit">Force Stop</button>
        </form>
      </div>
    </div>
  );
}
