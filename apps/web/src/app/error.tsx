"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card" role="alert" style={{ maxWidth: 640, margin: "40px auto" }}>
      <h1 style={{ marginTop: 0 }}>Something went wrong</h1>
      <p className="muted">
        An unexpected error occurred while rendering this page. You can retry, or head back to the dashboard.
      </p>
      <p className="mono muted" style={{ fontSize: 12 }}>{error.digest ?? error.message}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn primary" onClick={reset}>Try again</button>
        <a className="btn" href="/dashboard">Go to dashboard</a>
      </div>
    </div>
  );
}
