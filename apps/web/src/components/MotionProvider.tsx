'use client';

import { MotionConfig } from 'motion/react';

/**
 * Makes Motion (the library behind `Counter`, `Stepper`, …) follow the visitor's
 * reduced-motion setting globally, instead of each component having to ask.
 *
 * With `reducedMotion="user"`, transform animations are dropped while opacity
 * changes still apply — so state changes remain legible without the movement.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export default MotionProvider;
