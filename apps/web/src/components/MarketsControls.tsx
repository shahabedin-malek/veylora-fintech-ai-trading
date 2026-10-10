'use client';

import { useRouter } from 'next/navigation';

import RubberSegment from '@/components/reactbits/RubberSegment';

interface Option {
  value: string;
  label: string;
}

/**
 * Range and chart-view toggles for `/markets`, rendered as a rubber segmented
 * control and written back to the URL as a query string.
 *
 * The URL stays the source of truth, so the page keeps rendering from
 * `searchParams` on the server; this is only a richer input for it. Without JS the
 * control is inert and the page falls back to its default range and view.
 */
export function MarketsControls({
  symbol,
  range,
  view,
  news,
  ranges,
  views
}: {
  symbol: string;
  range: number;
  view: string;
  /** Active news asset-class filter, carried through so changing the chart keeps it. */
  news?: string;
  ranges: Option[];
  views: Option[];
}) {
  const router = useRouter();

  const go = (next: { range?: number; view?: string }): void => {
    const params = new URLSearchParams({
      symbol,
      range: String(next.range ?? range),
      view: next.view ?? view
    });
    if (news) params.set('news', news);
    router.push(`/markets?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="market-controls">
      <RubberSegment
        aria-label="Chart range"
        size="sm"
        items={ranges}
        value={String(range)}
        onChange={value => go({ range: Number(value) })}
        trackColor="var(--bg-elev)"
        thumbColor="var(--accent)"
        textColor="var(--muted)"
        activeTextColor="#05271d"
      />
      <RubberSegment
        aria-label="Chart view"
        size="sm"
        items={views}
        value={view}
        onChange={value => go({ view: value })}
        trackColor="var(--bg-elev)"
        thumbColor="var(--accent)"
        textColor="var(--muted)"
        activeTextColor="#05271d"
      />
    </div>
  );
}

export default MarketsControls;
