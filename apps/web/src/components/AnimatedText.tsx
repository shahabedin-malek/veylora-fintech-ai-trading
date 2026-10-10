'use client';

import type { CSSProperties, ReactNode } from 'react';

import SplitText from './reactbits/SplitText';
import { usePrefersReducedMotion } from '@/lib/motion';

/**
 * A headline that animates in when that is welcome, and is plain text when it is not.
 *
 * Two things make this wrapper worth having rather than calling `SplitText` directly:
 *
 *  - `SplitText` animates from `opacity: 0`, so a visitor who asked for reduced motion
 *    (or whose browser declines to run the tween) would be left with an invisible
 *    headline. Here they get the same text, rendered statically.
 *  - Both branches render the same tag and the same copy, so the document outline,
 *    the accessible name and any text-based test are unaffected by which one runs.
 */

export type AnimatedTextTag = 'h1' | 'h2' | 'h3' | 'p' | 'span';

export interface AnimatedTextProps {
  text: string;
  tag?: AnimatedTextTag;
  className?: string;
  style?: CSSProperties;
  /** Any combination of 'chars', 'words', 'lines'. */
  splitType?: string;
  /** Stagger between characters, in milliseconds. */
  delay?: number;
  duration?: number;
  textAlign?: CSSProperties['textAlign'];
}

function PlainText({
  tag,
  className,
  style,
  text
}: {
  tag: AnimatedTextTag;
  className?: string;
  style?: CSSProperties;
  text: string;
}): ReactNode {
  const props = { className: `${className ?? ''} animated-text`.trim(), style };
  switch (tag) {
    case 'h1':
      return <h1 {...props}>{text}</h1>;
    case 'h2':
      return <h2 {...props}>{text}</h2>;
    case 'h3':
      return <h3 {...props}>{text}</h3>;
    case 'span':
      return <span {...props}>{text}</span>;
    default:
      return <p {...props}>{text}</p>;
  }
}

export function AnimatedText({
  text,
  tag = 'p',
  className,
  style,
  splitType = 'chars',
  delay = 26,
  duration = 1.1,
  textAlign = 'left'
}: AnimatedTextProps) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <PlainText tag={tag} className={className} style={style} text={text} />;
  }

  return (
    <SplitText
      text={text}
      tag={tag}
      className={className}
      style={style}
      splitType={splitType}
      delay={delay}
      duration={duration}
      textAlign={textAlign}
      from={{ opacity: 0, y: 28 }}
      to={{ opacity: 1, y: 0 }}
    />
  );
}

export default AnimatedText;
