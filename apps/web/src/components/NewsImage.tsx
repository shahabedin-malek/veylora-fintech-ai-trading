"use client";

import { useState } from "react";

/**
 * A feed image with a graceful failure path.
 *
 * Feeds hand us a URL on someone else's host, and those hosts block hotlinking or
 * vanish often. When the image fails, a neutral placeholder keeps the card's layout
 * intact instead of showing a broken-image icon. Images are lazy so a picture the
 * reader never scrolls to is never fetched.
 */
export function NewsImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="news-card-media news-card-media-fallback" aria-hidden />;
  }
  return (
    // Plain <img>: the source host is arbitrary and unknown at build time, so it cannot
    // be allow-listed for next/image. The host is third-party and untrusted either way.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="news-card-media"
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
