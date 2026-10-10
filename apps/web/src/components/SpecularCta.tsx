'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import SpecularButton from './reactbits/SpecularButton';
import StarLink from './StarLink';
import { useBackdropAllowed } from '@/lib/motion';

/**
 * The landing page's primary call to action.
 *
 * `SpecularButton` is a real `<button>` with a WebGL rim light, and it does not
 * honour `prefers-reduced-motion` — its render loop runs unconditionally. So it is
 * only mounted when motion is welcome and a GL context is available; everyone else
 * gets the `StarBorder` link this page already shipped, pointing at the same place
 * with the same accessible name.
 *
 * The button branch navigates with `router.push`, which means it is not an
 * `<a href="" />`: no middle-click, no "open in new tab", no link role. That is the
 * cost of the visual, so the fallback and the secondary CTA beside it stay real
 * links, and the destination is still reachable by keyboard and by crawlers.
 */

export interface SpecularCtaProps {
  href: string;
  children: ReactNode;
  className?: string;
}

export function SpecularCta({ href, children, className = '' }: SpecularCtaProps) {
  const allowed = useBackdropAllowed();
  const router = useRouter();

  if (!allowed) {
    return (
      <StarLink
        href={href}
        className={`cta-star${className ? ` ${className}` : ''}`}
        color="#38d39f"
        speed="5s"
        backgroundColor="#122a4d"
        textColor="#ffffff"
      >
        {children}
      </StarLink>
    );
  }

  return (
    <SpecularButton
      size="md"
      radius={12}
      tint="#1e56b8"
      tintOpacity={1}
      textColor="#ffffff"
      lineColor="#8ef2c6"
      baseColor="#0b2c1c"
      intensity={1.35}
      className={`cta-specular${className ? ` ${className}` : ''}`}
      onClick={() => router.push(href)}
    >
      {children}
    </SpecularButton>
  );
}

export default SpecularCta;
