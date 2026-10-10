import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import AppNav, { type NavLink } from "@/components/AppNav";

/**
 * Resolves the visitor and the account control, then hands both to the client shell.
 *
 * Nothing interactive is decided here: `AppNav` picks the presentation. The one part
 * that must stay on the server is the sign-out control, because it posts to a server
 * action — so it is rendered here and passed down as an already-built element, which
 * is allowed across the server→client boundary (a *function* would not be).
 */
export async function Nav() {
  const user = await getCurrentUser();

  const links: NavLink[] = [
    { label: "Markets", href: "/markets" },
    ...(user
      ? [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Trade", href: "/trade" },
          { label: "Wallet", href: "/wallet" },
          { label: "History", href: "/history" },
        ]
      : []),
    { label: "FAQ", href: "/faq" },
    ...(user?.role === "ADMIN" ? [{ label: "Admin", href: "/admin" }] : []),
  ];

  return (
    <AppNav
      links={links}
      account={
        user ? (
          <form action={logoutAction}>
            <button className="btn ghost" type="submit" title={user.walletAddress}>
              Sign out
            </button>
          </form>
        ) : (
          <Link className="btn primary" href="/login">
            Sign in
          </Link>
        )
      }
    />
  );
}
