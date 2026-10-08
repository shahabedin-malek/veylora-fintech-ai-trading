import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

/** Bottom-right support launcher. Opening it leads to the ticket conversation,
 * which creates a CRM ticket on first message. Styles live in globals.css so the
 * launcher stays clear of content and respects the device safe-area inset. */
export async function SupportWidget() {
  const user = await getCurrentUser();
  return (
    <Link className="support-fab" href={user ? "/support" : "/login"} aria-label="Open support chat">
      <span aria-hidden>💬</span> Support
    </Link>
  );
}
