/**
 * Vendored from React Bits — <https://reactbits.dev> — component `StarBorder`.
 *
 * Body copied verbatim from the saved `reactbits.dev.md` export by
 * `scripts/reactbits_extract.py`; the annotations below were added by hand because
 * the export ships the untyped "JavaScript + CSS" variant and this project compiles
 * with `strict`. Re-running the extractor would drop those annotations.
 *
 * React Bits is open source (MIT) — see <https://reactbits.dev/license>.
 *
 * Dependencies: none
 *
 * Local addition: `href`/`target`/`rel`, because this project renders it as a link
 * on the marketing pages and the export's prop type only covers a `<button>`.
 */
'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import './StarBorder.css';

export interface StarBorderProps extends Omit<ComponentPropsWithoutRef<'button'>, 'color'> {
  /** Element to render — a button by default; pass `Link` for navigation. */
  as?: React.ElementType;
  /** Allowed because `as` is often a link rather than a button. */
  href?: string;
  target?: string;
  rel?: string;
  color?: string;
  /** CSS duration for one sweep of the travelling highlight. */
  speed?: string;
  thickness?: number;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  children?: ReactNode;
}

const StarBorder = ({
  as: Component = 'button',
  className = '',
  color = 'white',
  speed = '6s',
  thickness = 1,
  backgroundColor = '#000000',
  textColor = '#ffffff',
  borderColor = '#222222',
  children,
  ...rest
}: StarBorderProps) => {
  return (
    <Component
      className={`star-border-container ${className}`}
      style={{
        padding: `${thickness}px 0`,
        ...rest.style
      }}
      {...rest}
    >
      <div
        className="border-gradient-bottom"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed
        }}
      ></div>
      <div
        className="border-gradient-top"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed
        }}
      ></div>
      <div className="inner-content" style={{ background: backgroundColor, color: textColor, borderColor }}>
        {children}
      </div>
    </Component>
  );
};

export default StarBorder;
