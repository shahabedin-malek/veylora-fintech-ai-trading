import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";

export async function Nav() {
  const user = await getCurrentUser();
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand" aria-label="Veylora home">
          <span className="dot" aria-hidden />
          Veylora
        </Link>
        <div className="nav-links">
          <Link className="link" href="/markets">Markets</Link>
          {user && <Link className="link" href="/dashboard">Dashboard</Link>}
          {user && <Link className="link" href="/trade">Trade</Link>}
          {user && <Link className="link" href="/wallet">Wallet</Link>}
          {user && <Link className="link" href="/history">History</Link>}
          <Link className="link" href="/faq">FAQ</Link>
          {user?.role === "ADMIN" && <Link className="link" href="/admin">Admin</Link>}
          {!user && (
            <Link className="btn primary" href="/login" style={{ marginLeft: 8 }}>Sign in</Link>
          )}
          {user && (
            <form action={logoutAction} style={{ marginLeft: 8 }}>
              <button className="btn ghost" type="submit" title={user.email}>Sign out</button>
            </form>
          )}
        </div>
      </div>
    </nav>
  );
}
