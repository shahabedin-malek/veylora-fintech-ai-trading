import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card" style={{ maxWidth: 560, margin: "60px auto", textAlign: "center" }}>
      <h1 style={{ marginTop: 0 }}>Page not found</h1>
      <p className="muted">That route doesn&apos;t exist. Try the markets or your dashboard.</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <Link className="btn primary" href="/markets">Markets</Link>
        <Link className="btn" href="/dashboard">Dashboard</Link>
      </div>
    </div>
  );
}
