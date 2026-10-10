'use client';

import MagicBento, { type BentoCardData } from './reactbits/MagicBento';
import { usePrefersReducedMotion } from '@/lib/motion';

/**
 * The bento feature grid, gated on the visitor's motion preference.
 *
 * `MagicBento` drives particles, tilt and a document-wide spotlight from `gsap`;
 * with reduced motion it is told to disable all of them, so only the static grid
 * (and its hover glow, which needs no animation loop) remains. Mobile is already
 * handled inside the component.
 */
export function FeatureBento({ cards }: { cards: BentoCardData[] }) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <MagicBento
      cards={cards}
      disableAnimations={reducedMotion}
      enableStars={!reducedMotion}
      enableTilt={!reducedMotion}
      enableMagnetism={!reducedMotion}
      glowColor="56, 211, 159"
    />
  );
}

export default FeatureBento;
