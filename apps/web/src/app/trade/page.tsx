import { redirect } from "next/navigation";
import { getAccountContext } from "@/lib/account";
import { CoinbaseSwapForm } from "@/components/CoinbaseSwapForm";
import { coinbaseSwapConfigured, swapPresetsForChain } from "@/lib/coinbase/trading";
import { startCoinbaseSwapAction } from "@/lib/actions";
import { assessDeskRisk } from "@/lib/risk/assess";
import { RiskBanner } from "@/components/RiskBanner";

/** Reasons the real-swap path can bounce back to this page (fail-closed). */
const COINBASE_NOTICE: Record<string, string> = {
  disabled:
    "Real execution is unavailable on this deployment — it is either switched off (MAINNET_EXECUTION_ENABLED=0) or custody is not configured.",
  unconfigured: "Coinbase swaps are not configured on this deployment.",
  invalid: "That swap pair is not recognised.",
  network:
    "That pair is on a different network than the wallet you signed in with. Switch the pair or the wallet network.",
  price:
    "No live price is available right now, so the spend cap cannot be computed against a real quote. Nothing was submitted.",
  blocked: "Compliance screening refused this swap. Nothing was submitted.",
  risk: "The desk is risk-off: recent news or signals argue for standing aside, so nothing was submitted.",
  error: "Coinbase could not complete the swap. Nothing was submitted.",
};

export default async function TradePage({
  searchParams,
}: {
  searchParams: Promise<{ coinbase?: string }>;
}) {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/login");
  const sp = await searchParams;

  const swapPresets = swapPresetsForChain(ctx.user.chainId);
  const swapConfigured = coinbaseSwapConfigured();
  const coinbaseNotice = sp.coinbase ? COINBASE_NOTICE[sp.coinbase] : undefined;
  // The same gate the swap action enforces, shown here so the desk state is visible
  // before a user submits rather than only after a refusal.
  const risk = await assessDeskRisk();

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <h1 style={{ margin: 0 }}>Trading desk</h1>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          Real, custody-signed Coinbase swaps. Orders are priced and signed through Coinbase, spend
          limits are enforced before anything is signed, and a trade is final — it moves real funds.
        </p>
      </div>

      <RiskBanner assessment={risk} />

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Coinbase swap</h2>
        {!swapConfigured ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Coinbase swaps are not configured on this deployment. They need the CDP API credentials
            and a <span className="mono">coinbase-cdp</span> custody backend.
          </p>
        ) : swapPresets.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            No Coinbase swap pair is available for this network. Connect a mainnet wallet on Base or
            Ethereum to trade.
          </p>
        ) : (
          <div className="grid cols-2" style={{ gap: 16, alignItems: "start" }}>
            <CoinbaseSwapForm presets={[...swapPresets]} action={startCoinbaseSwapAction} />
            <div className="muted" style={{ fontSize: 12 }}>
              <p style={{ marginTop: 0 }}>The taker is the platform&apos;s custody account — the app never holds a key.</p>
              <p>Swaps are Coinbase-only and available on Base, Ethereum, Arbitrum, Optimism and Polygon.</p>
            </div>
          </div>
        )}
        {coinbaseNotice && (
          <p role="status" className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>{coinbaseNotice}</p>
        )}
      </section>
    </div>
  );
}
