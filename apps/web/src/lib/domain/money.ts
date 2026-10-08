/** Money is stored and computed in integer USD cents to avoid float drift. */

export function usdToCents(usd: number): number {
  return Math.round(usd * 100);
}

export function centsToUsd(cents: number): number {
  return cents / 100;
}

export function formatUsd(cents: number, opts: { sign?: boolean } = {}): string {
  const usd = centsToUsd(cents);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(usd));
  const negative = usd < 0;
  if (opts.sign && !negative) return `+${formatted}`;
  return negative ? `-${formatted}` : formatted;
}

export function clampNonNegativeCents(cents: number): number {
  return cents < 0 ? 0 : cents;
}
