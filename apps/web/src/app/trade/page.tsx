import { redirect } from "next/navigation";
import { getAccountContext } from "@/lib/account";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/domain/money";
import { TERMINAL_TEMPLATES, TRADING_STATE_LABEL } from "@/lib/domain/trading";
import { config } from "@/lib/config";
import { TradeControls } from "@/components/TradeControls";
import { TradingTerminal } from "@/components/TradingTerminal";

export default async function TradePage() {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/login");

  const events = ctx.session
    ? await prisma.tradeEvent.findMany({ where: { sessionId: ctx.session.id }, orderBy: { createdAt: "asc" }, take: 100 })
    : [];
  const initial = events.map((e) => ({ ts: e.createdAt.toISOString(), message: e.message }));
  const active = ctx.controls.state === 3;

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <h1 style={{ margin: 0 }}>Simulated trading desk</h1>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          State {ctx.controls.state} — {TRADING_STATE_LABEL[ctx.controls.state]}. All activity is paper trading.
        </p>
      </div>

      <section className="card">
        <TradeControls controls={ctx.controls} />
        {ctx.controls.reason && <p className="muted" style={{ marginBottom: 12 }}>{ctx.controls.reason}</p>}
        <div className="grid cols-3" style={{ marginTop: 8 }}>
          <div>
            <div className="muted" style={{ fontSize: 13 }}>Balance</div>
            <div className="mono" style={{ fontSize: 22 }}>{formatUsd(ctx.wallet.balanceCents)}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 13 }}>Session P/L (simulated)</div>
            <div className={`mono ${ctx.session && ctx.session.pnlCents >= 0 ? "pos" : "neg"}`} style={{ fontSize: 22 }}>
              {formatUsd(ctx.session?.pnlCents ?? 0, { sign: true })}
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 13 }}>Strategy</div>
            <div className="mono" style={{ fontSize: 22 }}>{ctx.session?.strategy ?? "paper-balanced"}</div>
          </div>
        </div>
      </section>

      <section className="card">
        <TradingTerminal
          initial={initial}
          active={active}
          templates={[...TERMINAL_TEMPLATES]}
          minMs={config.terminalTickMs.min}
          maxMs={config.terminalTickMs.max}
          startPnlCents={ctx.session?.pnlCents ?? 0}
        />
        <p className="muted" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
          Events are simulated and clearly labelled. P/L is not a real investment return.
        </p>
      </section>
    </div>
  );
}
