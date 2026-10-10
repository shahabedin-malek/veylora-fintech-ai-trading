import Counter from '@/components/reactbits/Counter';

/** An integer KPI whose digits roll in via the vendored `Counter`. */
export function KpiCount({
  value,
  fontSize = 30,
  className = ''
}: {
  value: number;
  fontSize?: number;
  className?: string;
}) {
  return (
    <span className={`kpi-amount mono ${className}`.trim()} style={{ fontSize }}>
      <Counter
        value={value}
        fontSize={fontSize}
        gap={1}
        textColor="currentColor"
        gradientFrom="var(--bg-card)"
        gradientHeight={Math.round(fontSize * 0.25)}
      />
    </span>
  );
}

export default KpiCount;
