import Counter from '@/components/reactbits/Counter';

/**
 * A currency KPI whose integer dollars roll in via the vendored `Counter`.
 *
 * `Counter` renders bare digits, so the sign, the `$` and the cents are rendered
 * around it as plain text — that keeps full cent precision (the value is never
 * rounded to a whole dollar on screen). Callers colour it with `.pos` / `.neg`.
 */
export function KpiAmount({
  cents,
  showSign = false,
  fontSize = 30,
  className = ''
}: {
  cents: number;
  /** Prefix a `+` for positive values (used for P/L). */
  showSign?: boolean;
  fontSize?: number;
  className?: string;
}) {
  const value = Math.round(cents);
  const sign = value < 0 ? '-' : showSign ? '+' : '';
  const absolute = Math.abs(value);
  const dollars = Math.floor(absolute / 100);
  const remainder = absolute % 100;

  return (
    <span className={`kpi-amount mono ${className}`.trim()} style={{ fontSize }}>
      {sign ? <span className="kpi-sign">{sign}</span> : null}
      <span className="kpi-symbol">$</span>
      <Counter
        value={dollars}
        fontSize={fontSize}
        gap={1}
        textColor="currentColor"
        gradientFrom="var(--bg-card)"
        gradientHeight={Math.round(fontSize * 0.25)}
      />
      <span className="kpi-cents">.{String(remainder).padStart(2, '0')}</span>
    </span>
  );
}

export default KpiAmount;
