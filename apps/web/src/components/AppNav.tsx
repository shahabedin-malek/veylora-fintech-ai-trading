'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import PillNav from './reactbits/PillNav';
import StaggeredMenu from './reactbits/StaggeredMenu';
import { usePrefersReducedMotion } from '@/lib/motion';

/**
 * The application header.
 *
 * A server component (`Nav`) resolves the visitor and the sign-out form; this shell
 * — which has to be a client component because both vendored navs are GSAP-driven —
 * only picks between three presentations of the same data:
 *
 *  1. **Reduced motion:** the plain markup this app already shipped. No GSAP, no
 *     hidden-then-revealed links.
 *  2. **Desktop (≥901px):** `PillNav` — the links as an animated pill group.
 *  3. **Mobile (≤900px):** `StaggeredMenu` — the links in a full-height slide-in
 *     panel. Its toggle is placed in the bar by the `.nav-enhanced` rules in
 *     `globals.css`.
 *
 * Only branch 1 is reachable without JS, and only below 901px (the pills are real
 * anchors, so they survive scripting being off; the drawer is GSAP-revealed and
 * `inert` while closed, so it does not). A `<noscript>` row therefore carries the
 * links for scripting-off phones — see below.
 *
 * The brand wordmark and the account control (sign in / sign out) stay in the bar in
 * every branch, so the product name is a real link and signing out is always
 * reachable even when the menu is closed.
 */

export interface NavLink {
  label: string;
  href: string;
}

/** The longest link whose path the current one sits under, so `/admin/tickets/1` marks `/admin`. */
function activeHrefFor(pathname: string, links: NavLink[]): string | undefined {
  return links
    .filter(link => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Veylora home">
      <span className="dot" aria-hidden />
      Veylora
    </Link>
  );
}

function PlainLinks({ links, activeHref }: { links: NavLink[]; activeHref?: string }) {
  return links.map(link => (
    <Link
      key={link.href}
      className="link"
      href={link.href}
      aria-current={activeHref === link.href ? 'page' : undefined}
    >
      {link.label}
    </Link>
  ));
}

export function AppNav({ links, account }: { links: NavLink[]; account: ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = usePrefersReducedMotion();
  const activeHref = activeHrefFor(pathname, links);

  if (reducedMotion) {
    return (
      <nav className="nav" aria-label="Primary">
        <div className="container nav-inner">
          <Brand />
          <div className="nav-links">
            <PlainLinks links={links} activeHref={activeHref} />
            <div className="nav-account">{account}</div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="nav nav-enhanced" aria-label="Primary">
      <div className="container nav-inner">
        <div className="nav-staggered">
          <StaggeredMenu
            position="left"
            items={links.map(link => ({
              label: link.label,
              link: link.href,
              ariaLabel: link.href === activeHref ? `${link.label} (current page)` : undefined
            }))}
            colors={['#38d39f', '#4c8dff', '#5227FF']}
            accentColor="var(--accent)"
            logoUrl="/icon.svg"
            menuButtonColor="var(--text)"
            openMenuButtonColor="var(--text)"
            changeMenuColorOnOpen={false}
            displaySocials={false}
          />
        </div>
        <Brand />
        <div className="nav-links">
          <div className="nav-pill">
            <PillNav
              items={links}
              activeHref={activeHref}
              logo="/icon.svg"
              logoAlt="Veylora"
              /* The bar already renders the brand as a link; the component's own
               * logo would be a second, image-only home link right beside it. */
              className="app-pill-nav"
              ease="power2.easeOut"
              baseColor="#1e56b8"
              pillColor="#0a1224"
              pillTextColor="#e8eefc"
              hoveredPillTextColor="#ffffff"
              /* Leave the reveal animation off: it starts the links at `width: 0`,
               * which would hide the nav between the server render and hydration. */
              initialLoadAnimation={false}
            />
          </div>
          <div className="nav-account">{account}</div>
        </div>
      </div>
      {/*
       * Scripting-off fallback. The pills above are plain anchors and still work,
       * but below 901px they are hidden and the drawer cannot open — its panel is
       * revealed by GSAP and stays `inert` until then — so without this row a
       * scripting-off phone would get no links at all.
       *
       * `<noscript>` content is only rendered when scripting is disabled (browsers
       * that run scripts do not display it), and it is styled as a horizontally
       * scrollable row in `globals.css`, so it cannot introduce document overflow
       * no matter how many links a signed-in admin has.
       */}
      <noscript>
        <div className="container nav-nojs">
          <PlainLinks links={links} activeHref={activeHref} />
        </div>
      </noscript>
    </nav>
  );
}

export default AppNav;
