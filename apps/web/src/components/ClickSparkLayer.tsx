'use client';

import ClickSpark from './reactbits/ClickSpark';
import { useMotionAllowed } from '@/lib/motion';

/**
 * Site-wide click feedback.
 *
 * Gated on the visitor's motion preference: when motion is reduced this renders its
 * children untouched, so no canvas or animation loop is created at all.
 */
export function ClickSparkLayer({ children }: { children: React.ReactNode }) {
  const allowed = useMotionAllowed();

  if (!allowed) return <>{children}</>;

  return (
    <ClickSpark sparkColor="#38d39f" sparkCount={8} sparkRadius={18} sparkSize={8} duration={420} extraScale={1.15}>
      {children}
    </ClickSpark>
  );
}

export default ClickSparkLayer;
