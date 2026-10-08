import type { Candle } from "@/lib/market/types";

export type ChartView = "line" | "area" | "candles";

interface Props {
  candles: Candle[];
  height?: number;
  label?: string;
  view?: ChartView;
  showVolume?: boolean;
}

const VIEWS: ChartView[] = ["line", "area", "candles"];

export function isChartView(v: string | undefined): v is ChartView {
  return v !== undefined && (VIEWS as string[]).includes(v);
}

function fmtUsd(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: n >= 100 ? 2 : 4 });
}

function fmtCompact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/**
 * Dependency-free responsive SVG chart supporting line, area and candlestick
 * views plus a volume histogram. No external chart vendor is required.
 * High/low values come straight from the data — nothing is synthesized here.
 */
export function PriceChart({ candles, height = 280, label, view = "area", showVolume = true }: Props) {
  if (!candles.length) {
    return (
      <div className="card skeleton" style={{ height }} role="img" aria-label="Chart loading">
        <span className="sr-only">Loading chart</span>
      </div>
    );
  }

  const W = 800;
  const H = height;
  const pad = 10;

  const lows = candles.map((c) => c.l ?? Math.min(c.o, c.c));
  const highs = candles.map((c) => c.h ?? Math.max(c.o, c.c));
  const closes = candles.map((c) => c.c);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const span = max - min || Math.abs(max) || 1;

  const hasVolume = showVolume && candles.some((c) => (c.v ?? 0) > 0);
  const volH = hasVolume ? Math.round(H * 0.22) : 0;
  const priceH = H - volH;

  const x = (i: number) => pad + (i / Math.max(1, candles.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (priceH - pad * 2);

  const up = closes[closes.length - 1] >= closes[0];
  const stroke = up ? "var(--accent)" : "var(--danger)";
  const first = closes[0];
  const last = closes[closes.length - 1];
  const pct = first ? ((last - first) / first) * 100 : 0;

  const linePath = candles
    .map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(c.c).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${x(candles.length - 1).toFixed(1)},${(priceH - pad).toFixed(1)} L${x(0).toFixed(1)},${(priceH - pad).toFixed(1)} Z`;

  const slot = (W - pad * 2) / candles.length;
  const bodyW = Math.max(1, slot * 0.6);
  const volMax = Math.max(...candles.map((c) => c.v ?? 0), 1);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={label ? `${label} ${view} price chart with volume` : "Price chart"}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.30" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={pad}
            x2={W - pad}
            y1={pad + f * (priceH - pad * 2)}
            y2={pad + f * (priceH - pad * 2)}
            stroke="var(--border)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* volume histogram */}
        {hasVolume &&
          candles.map((c, i) => {
            const h = ((c.v ?? 0) / volMax) * (volH - 6);
            return (
              <rect
                key={`v${i}`}
                x={(pad + i * slot).toFixed(2)}
                y={(H - h).toFixed(2)}
                width={bodyW.toFixed(2)}
                height={Math.max(0.5, h).toFixed(2)}
                fill={(c.c >= c.o ? "var(--accent)" : "var(--danger)")}
                opacity="0.28"
              />
            );
          })}

        {view === "candles" ? (
          candles.map((c, i) => {
            const cx = pad + i * slot + slot / 2;
            const bullish = c.c >= c.o;
            const color = bullish ? "var(--accent)" : "var(--danger)";
            const yO = y(c.o);
            const yC = y(c.c);
            const top = Math.min(yO, yC);
            const bodyHeight = Math.max(1, Math.abs(yC - yO));
            return (
              <g key={`c${i}`}>
                <line x1={cx.toFixed(2)} x2={cx.toFixed(2)} y1={y(c.h).toFixed(2)} y2={y(c.l).toFixed(2)} stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <rect x={(cx - bodyW / 2).toFixed(2)} y={top.toFixed(2)} width={bodyW.toFixed(2)} height={bodyHeight.toFixed(2)} fill={color} opacity={bullish ? 1 : 0.85} />
              </g>
            );
          })
        ) : (
          <>
            {view === "area" && <path d={areaPath} fill="url(#areaFill)" />}
            <path d={linePath} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>

      <div className="muted" style={{ fontSize: 12, display: "flex", justifyContent: "space-between", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
        <span>
          {candles.length} points · low {fmtUsd(min)} · high {fmtUsd(max)}
          {hasVolume && <> · volume {fmtCompact(candles.reduce((s, c) => s + (c.v ?? 0), 0))}</>}
        </span>
        <span className={up ? "pos" : "neg"}>
          {pct >= 0 ? "+" : ""}
          {pct.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}
