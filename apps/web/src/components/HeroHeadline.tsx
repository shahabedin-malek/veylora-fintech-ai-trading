'use client';

import AnimatedText from './AnimatedText';
import WarpText from './reactbits/WarpText';
import { useBackdropAllowed } from '@/lib/motion';

/**
 * The landing hero headline.
 *
 * `WarpText` paints the headline into a WebGL canvas, so it only runs when the
 * visitor wants motion *and* the device can give us a GL context. Everyone else —
 * reduced motion, no WebGL, or JS that never arrives — gets the plain animated
 * headline this page already shipped, from `AnimatedText`.
 *
 * Keeping a real `<h1>` next to the shader matters: the component renders
 * `role="img"` with the copy as its label, which is fine for assistive tech but is
 * not a heading, cannot be selected or resized, and does not by itself give search
 * engines heading text. So the `<h1>` stays in the document (visually hidden) and
 * the shader is hidden from assistive tech behind it.
 */

export interface HeroHeadlineProps {
  /** The headline. Used verbatim by the real `<h1>` and the reduced-motion fallback. */
  text: string;
  /**
   * Optional manual line breaks for the WebGL renderer.
   *
   * Canvas text does not wrap, so a long single-line headline is scaled down until
   * it fits one line — legible on a desktop, unreadably small on a phone. Pass
   * explicit `\n`-separated lines to keep it sized sensibly at every width. Falls
   * back to `text` when omitted.
   */
  warpText?: string;
  className?: string;
}

export function HeroHeadline({ text, warpText, className = '' }: HeroHeadlineProps) {
  const allowed = useBackdropAllowed();

  if (!allowed) {
    return (
      <AnimatedText
        tag="h1"
        className={`hero-title display${className ? ` ${className}` : ''}`}
        text={text}
        splitType="words"
        delay={55}
        textAlign="left"
      />
    );
  }

  return (
    <div className={`hero-headline${className ? ` ${className}` : ''}`}>
      <h1 className="sr-only">{text}</h1>
      {/* The shader is decoration over the real heading above, so it is hidden from
       * assistive tech — otherwise the copy would be announced twice. */}
      <div className="hero-warp" aria-hidden="true">
        <WarpText
          text={warpText ?? text}
          color="#f2f6ff"
          fontSize="clamp(2.1rem, 5.4vw, 4.5rem)"
          fontWeight={800}
          letterSpacing="-0.04em"
          lineHeight={0.98}
        />
      </div>
    </div>
  );
}

export default HeroHeadline;
