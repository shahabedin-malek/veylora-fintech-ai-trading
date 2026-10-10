"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** A rail entry, pre-formatted on the server so the markup is stable at hydration. */
export interface NewsRailItem {
  headline: string;
  url: string;
  source: string;
  age: string;
  category?: string;
}

/**
 * The image-free news sidebar.
 *
 * Every page except the landing page gets a compact headline list beside its content;
 * the landing page (`/`) carries the picture-card version of the same feed inside the
 * page instead, so the rail renders nothing there. It is a client component only to
 * read the pathname — the headline data arrives from the server (`NewsRailSlot`).
 */
export function NewsRail({ items }: { items: NewsRailItem[] }) {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <aside className="news-rail" aria-label="Market news">
      <div className="news-rail-head">
        <h2 className="news-rail-title">Live market news</h2>
        <Link className="link" href="/markets">
          Markets →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          No headlines right now. News is read only from real configured RSS feeds —
          nothing here is invented.
        </p>
      ) : (
        <ul className="news-rail-list">
          {items.map((item) => (
            <li key={item.url}>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                {item.headline}
              </a>
              <span className="muted news-rail-meta">
                <span>{item.source}</span>
                <span aria-hidden>·</span>
                <span>{item.age}</span>
                {item.category && <span className="badge">{item.category}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
