/**
 * Vendored from React Bits — <https://reactbits.dev> — component `CallChip`.
 *
 * Body copied verbatim from the saved `reactbits.dev.md` export by
 * `scripts/reactbits_extract.py`; the annotations below were added by hand because
 * the export ships the untyped "JavaScript + CSS" variant and this project compiles
 * with `strict`. Re-running the extractor would drop those annotations.
 *
 * React Bits is open source (MIT) — see <https://reactbits.dev/license>.
 *
 * Dependencies: @hugeicons/react @hugeicons/core-free-icons
 *
 * Local addition: the `live` prop (default `true`). The chip is its own
 * `role="status"` live region, which is right on its own but wrong inside a
 * `role="log"` — the log announces the new chip and the chip announces itself, so a
 * screen reader reads every event twice. Set `live={false}` where an ancestor already
 * announces, and the chip becomes plain (still readable) content in that region.
 */
'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  CommandLineIcon,
  File02Icon,
  PencilEdit01Icon,
  RefreshIcon,
  Search01Icon,
  Tick02Icon
} from '@hugeicons/core-free-icons';

import './CallChip.css';

type Status = 'idle' | 'running' | 'done' | 'error';
type Glyph = 'tool' | 'check' | 'retry';
type IconName = 'terminal' | 'file' | 'search' | 'edit';

const HOLD_AT = 0.9;
const SHAKE = [0, -1, 1, -0.66, 0.66, -0.33, 0];
const ICONS: Record<IconName, IconSvgElement> = {
  terminal: CommandLineIcon,
  file: File02Icon,
  search: Search01Icon,
  edit: PencilEdit01Icon
};
const WORDS: Record<Status, string> = { running: 'running', done: 'done', error: 'failed', idle: 'queued' };

const fmt = (ms: number): string => (ms < 10000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
const reduceMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const glyphOf = (s: Status): Glyph => (s === 'done' ? 'check' : s === 'error' ? 'retry' : 'tool');

export interface CallChipProps {
  /** The tool glyph. It rolls out when the call resolves. */
  icon?: IconName | ReactNode;
  name?: string;
  argument?: string;
  /** Running wipes the fill across; done completes it; error stops, tints and shakes. */
  status?: Status;
  /** Milliseconds the fill takes to reach its 90% park. */
  expectedMs?: number;
  size?: number;
  radius?: number;
  color?: string;
  surfaceColor?: string;
  progressColor?: string;
  progressOpacity?: number;
  doneColor?: string;
  errorColor?: string;
  washOpacity?: number;
  /** Error shake amplitude in pixels. 0 tints only. */
  shake?: number;
  showTimer?: boolean;
  /** When set, the failed chip becomes a retry button. */
  onRetry?: () => void;
  /**
   * Announce this chip's own status changes (`role="status"`). Turn it off when an
   * ancestor live region already announces the chip's insertion, or every event is
   * read aloud twice.
   */
  live?: boolean;
  className?: string;
  style?: CSSProperties;
}

export default function CallChip({
  icon = 'terminal',
  name = 'bash',
  argument = 'npm test',
  status = 'running',
  expectedMs = 2500,
  size = 34,
  radius = 10,
  color = 'currentColor',
  surfaceColor = '#27272a',
  progressColor = 'currentColor',
  progressOpacity = 0.08,
  doneColor = '#22c55e',
  errorColor = '#ef4444',
  washOpacity = 0.14,
  shake = 6,
  showTimer = true,
  onRetry,
  live = true,
  className = '',
  style
}: CallChipProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);
  const mountedRef = useRef(false);
  const fraction = useRef(0);
  const clock = useRef({ ms: 0 });
  const shakeAnim = useRef<Animation | null>(null);
  const statusRef = useRef<Status>(status);
  statusRef.current = status;
  const [mounted, setMounted] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [announce, setAnnounce] = useState('');
  const roll = useRef<{ cur: Glyph; prev: Glyph | null }>({ cur: glyphOf(status), prev: null });
  if (glyphOf(status) !== roll.current.cur) roll.current = { cur: glyphOf(status), prev: roll.current.cur };

  const setFraction = (f: number, instant: boolean): void => {
    const fill = fillRef.current;
    if (!fill) return;
    fraction.current = f;
    if (instant) fill.style.transition = 'none';
    fill.style.transform = `scaleX(${f})`;
    if (instant) {
      void fill.getBoundingClientRect();
      fill.style.transition = '';
    }
  };
  const apply = (s: Status, animate: boolean): void => {
    if (s === 'running') {
      shakeAnim.current?.cancel();
      setFraction(0, true);
      if (animate) setFraction(HOLD_AT, false);
    } else if (s === 'done') {
      setFraction(1, !animate);
    } else if (s === 'error') {
      const fill = fillRef.current;
      const live = fill ? new DOMMatrix(getComputedStyle(fill).transform).a : fraction.current;
      setFraction(Math.min(1, Math.max(0, live)), true);
      if (animate && shake > 0 && !reduceMotion() && rootRef.current) {
        shakeAnim.current = rootRef.current.animate(
          SHAKE.map(k => ({ transform: `translateX(${k * shake}px)`, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' })),
          { duration: 450, composite: 'add' }
        );
      }
    } else setFraction(0, true);
  };

  useEffect(() => {
    mountedRef.current = true;
    setMounted(true);
    apply(statusRef.current, statusRef.current === 'running');
    return () => {
      mountedRef.current = false;
      shakeAnim.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => {
    if (mountedRef.current) apply(status, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    const write = (ms: number): void => {
      clock.current.ms = ms;
      if (timerRef.current) timerRef.current.textContent = fmt(ms);
    };
    if (status !== 'running') {
      if ((status === 'idle' || !clock.current.ms) && timerRef.current) timerRef.current.textContent = '—';
      return undefined;
    }
    const startedAt = performance.now();
    write(0);
    if (reduceMotion()) {
      const id = setInterval(() => write(performance.now() - startedAt), 100);
      return () => {
        clearInterval(id);
        write(performance.now() - startedAt);
      };
    }
    let raf = 0;
    const tick = (): void => {
      write(performance.now() - startedAt);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      write(performance.now() - startedAt);
    };
  }, [status]);
  useEffect(() => {
    const ms = showTimer && clock.current.ms ? Math.round(clock.current.ms) : 0;
    const when = status === 'done' && ms ? ` in ${ms} ms` : status === 'error' && ms ? ` after ${ms} ms` : '';
    setAnnounce(`${name} ${argument}, ${WORDS[status] ?? status}${when}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const font = Math.max(11, Math.round(size * 0.38));
  const glyphState = (g: Glyph): 'in' | 'out' | undefined =>
    g === roll.current.cur ? 'in' : g === roll.current.prev ? 'out' : undefined;
  const toolIcon: IconSvgElement | null =
    typeof icon === 'string' ? ICONS[icon as IconName] ?? ICONS.terminal : null;
  const iconSize = font + 2;

  const vars = {
    '--cc-size': `${size}px`,
    '--cc-font': `${font}px`,
    '--cc-pad': `${Math.round(size * 0.35)}px`,
    '--cc-gap': `${Math.round(font * 0.55)}px`,
    '--cc-radius': `${radius}px`,
    '--cc-color': color,
    '--cc-surface': surfaceColor,
    '--cc-progress': progressColor,
    '--cc-progress-pct': `${progressOpacity * 100}%`,
    '--cc-done': doneColor,
    '--cc-error': errorColor,
    '--cc-wash-pct': `${washOpacity * 100}%`,
    '--cc-expected': `${expectedMs}ms`
  };

  return (
    <span
      ref={rootRef}
      role={live ? 'status' : undefined}
      aria-busy={status === 'running' || undefined}
      data-status={status}
      data-mounted={mounted ? '' : undefined}
      data-pressed={pressed ? '' : undefined}
      className={`call-chip${className ? ` ${className}` : ''}`}
      style={{ ...vars, ...style }}
    >
      <span ref={fillRef} className="call-chip__fill" aria-hidden="true" />
      <span className="call-chip__slot" aria-hidden="true">
        <span className="call-chip__glyph" data-state={glyphState('tool')}>
          {toolIcon ? <HugeiconsIcon icon={toolIcon} size={iconSize} strokeWidth={1.8} /> : icon}
        </span>
        <span className="call-chip__glyph" data-state={glyphState('check')}>
          <HugeiconsIcon icon={Tick02Icon} size={iconSize} strokeWidth={2.2} />
        </span>
        <span className="call-chip__glyph" data-state={glyphState('retry')}>
          <HugeiconsIcon icon={RefreshIcon} size={iconSize} strokeWidth={2} />
        </span>
      </span>
      <span className="call-chip__name" aria-hidden="true">
        {name}
      </span>
      <span className="call-chip__arg" aria-hidden="true">
        {argument}
      </span>
      {showTimer ? (
        <span ref={timerRef} className="call-chip__timer" aria-hidden="true">
          0 ms
        </span>
      ) : null}
      {status === 'error' && onRetry ? (
        <button
          type="button"
          className="call-chip__retry"
          aria-label={`Retry ${name} ${argument}`}
          onClick={() => onRetry()}
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerCancel={() => setPressed(false)}
        />
      ) : null}
      <span className="call-chip__sr">{announce}</span>
    </span>
  );
}
