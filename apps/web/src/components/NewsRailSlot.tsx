import { NewsRail, type NewsRailItem } from "@/components/NewsRail";
import { getNews } from "@/lib/market";
import { timeAgo } from "@/lib/domain/time";

/**
 * Server side of the news sidebar: fetch the real feed list and shape the small set of
 * fields the rail needs, so the client component stays presentational. Suspense-wrapped
 * in the layout, so a slow feed never delays the page content.
 */
export async function NewsRailSlot() {
  const news = await getNews();
  const items: NewsRailItem[] = news.slice(0, 8).map((item) => ({
    headline: item.headline,
    url: item.url,
    source: item.source,
    age: timeAgo(item.publishedAt),
    category: item.category,
  }));
  return <NewsRail items={items} />;
}
