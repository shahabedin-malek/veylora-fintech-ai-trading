import Link from "next/link";
import type { TradingControls as Controls } from "@/lib/domain/trading";
import { startTradingAction, stopTradingAction, withdrawAction } from "@/lib/actions";
import { StopWithWarning } from "@/components/StopWithWarning";

/** Renders the deposit / start / stop / withdraw controls strictly according to
 * the deterministic trading state machine. Disabled controls are truly disabled. */
export function TradeControls({ controls }: { controls: Controls }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
      {controls.deposit ? (
        <Link className="btn" href="/wallet">
          Deposit funds
        </Link>
      ) : (
        // A truly disabled control: not focusable, and announced as disabled.
        <button className="btn" type="button" disabled aria-disabled="true">
          Deposit funds
        </button>
      )}

      {controls.start && (
        <form action={startTradingAction}>
          <button className="btn good" type="submit">▶ Start trading</button>
        </form>
      )}

      {controls.stop && controls.stopNeedsWarning && (
        <StopWithWarning action={stopTradingAction} />
      )}

      {controls.stop && !controls.stopNeedsWarning && (
        <form action={stopTradingAction}>
          <button className="btn danger" type="submit">■ Stop trading</button>
        </form>
      )}

      {controls.withdraw && (
        <form action={withdrawAction}>
          <button className="btn primary" type="submit">Withdraw funds</button>
        </form>
      )}

      {!controls.deposit && !controls.start && !controls.stop && !controls.withdraw && (
        <span className="muted" style={{ alignSelf: "center" }}>Controls unlock after you sign in.</span>
      )}
    </div>
  );
}
