import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { WalletSignIn } from "@/components/WalletSignIn";
import { CoinbaseSignIn } from "@/components/CoinbaseSignIn";
import { coinbaseLoginEnabled } from "@/lib/coinbase/login";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");

  return (
    <div className="card" style={{ maxWidth: 560, margin: "20px auto" }}>
      <h1 style={{ marginTop: 0, fontSize: 26 }}>Sign in with your wallet</h1>
      <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
        No password and no email — your wallet is your account. Connecting is free; signing the
        message costs no gas and moves no funds.
      </p>

      {/* A one-click Coinbase entry point, alongside the generic wallet connect. */}
      {coinbaseLoginEnabled() && (
        <>
          <CoinbaseSignIn />
          <div
            className="muted"
            style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0", fontSize: 12 }}
          >
            <span style={{ flex: 1, height: 1, background: "var(--border, #223)" }} />
            or connect another wallet
            <span style={{ flex: 1, height: 1, background: "var(--border, #223)" }} />
          </div>
        </>
      )}

      <WalletSignIn />
      <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
        Signing in runs real, custody-signed execution that moves real funds and cannot be
        undone — it is refused when the deployment has no custody configured. Coinbase sign-in
        uses the same wallet session — it does not create a separate account.
      </p>
    </div>
  );
}
