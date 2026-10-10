'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import StarBorder from '@/components/reactbits/StarBorder';

/**
 * `StarBorder` rendered as a Next `Link`.
 *
 * `StarBorder` is a client component, and React Server Components forbid passing a
 * function — such as the `Link` component — across the server→client boundary.
 * Importing `Link` here and exposing a plain data-prop wrapper lets the landing page
 * stay a server component without serialising a function.
 */
export function StarLink({
  href,
  className,
  color,
  speed,
  backgroundColor,
  textColor,
  children
}: {
  href: string;
  className?: string;
  color?: string;
  speed?: string;
  backgroundColor?: string;
  textColor?: string;
  children: ReactNode;
}) {
  return (
    <StarBorder
      as={Link}
      href={href}
      className={className}
      color={color}
      speed={speed}
      backgroundColor={backgroundColor}
      textColor={textColor}
    >
      {children}
    </StarBorder>
  );
}

export default StarLink;
