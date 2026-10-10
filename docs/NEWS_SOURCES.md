# News sources (RSS)

Where the market news on the home page and in the sidebar comes from, and how each feed was
checked. News is **only** ever read from real, configured RSS feeds — a headline, image or
summary is never fabricated. If no feed responds, the UI shows an empty state that says so.

## Verified feeds (checked live, 2026-10-10)

Every feed below answered HTTP 200 and publishes a per-item image, so it can drive both the
home picture cards **and** the image-free sidebar.

| Feed | Items | Image carried as | Notes |
| --- | --- | --- | --- |
| `https://cointelegraph.com/rss` | 30 | `<img>` in content, media | default |
| `https://www.coindesk.com/arc/outboundfeeds/rss` | 25 | `media:content` / enclosure | default |
| `https://decrypt.co/feed` | 58 | `media:content`, `<img>` | default |
| `https://cryptoslate.com/feed/` | 10 | `media:content` | default |
| `https://bitcoinist.com/feed/` | 8 | `<img>` / media | default |
| `https://cryptopotato.com/feed/` | 36 | `media:content`, `<img>` | default |
| `https://www.investing.com/rss/news_25.rss` | 10 | `<enclosure type="image/*">` | equities/markets — the only non-crypto default |
| `https://feeds.bbci.co.uk/news/business/rss.xml` | 52 | `media:thumbnail` | business — the only non-crypto default |

### Also verified, usable via `NEWS_FEEDS`

Not in the default set (mostly to keep the default mix balanced), but they work if added to
the comma-separated `NEWS_FEEDS` env var:

| Feed | Items | Image carried as | Notes |
| --- | --- | --- | --- |
| `https://www.theblock.co/rss.xml` | 20 | `media:content` | crypto |
| `https://beincrypto.com/feed/` | 12 | `media:content`, `media:thumbnail` | crypto |
| `https://cryptonews.com/news/feed/` | 20 | `<enclosure>`, `<img>` | crypto |
| `https://www.newsbtc.com/feed/` | 10 | media | crypto |
| `https://cryptobriefing.com/feed/` | 30 | `media:content` | crypto; returns 403 to some user agents |
| `https://bitcoinmagazine.com/.rss/full/` | 10 | `media:content`, `<img>` | crypto; returns 403 to some user agents |
| `https://rss.app/feeds/tTQBntgpb3hxqt7X.xml` | 25 | `media:content`, `<img>` | third-party aggregator of other publishers, not a primary source |

## Deliberately excluded

| Entry | Why |
| --- | --- |
| `https://www.sharpe.ai/news/feed.xml` | Not a public feed — it is API-key gated (the docs in `rss/rss-feeds.txt` show `Authorization: Bearer sk_live_…`). An unauthenticated probe returned **HTTP 429**, and no items. |
| `https://www.rsscrypto.com/#newest/all` | A web-app page, not an RSS/XML document — nothing to parse. |

## How an image is read

`getNews()` (`src/lib/market/index.ts`) extracts the first usable image per item, in this
order, and only accepts an absolute `http(s)` URL:

1. `<enclosure>` — **only** when its `type` is `image/*` (an audio/video enclosure is ignored)
2. `<media:content url="…">`
3. `<media:thumbnail url="…">`
4. the first `<img src="…">` inside the `<description>` or `<content:encoded>` body

If none match (or the URL is relative or a `data:` URI), `NewsItem.imageUrl` is simply
absent, and the card falls back to a neutral gradient — an image is never invented.

## Where it is shown

- **Home page (`/`)** — picture cards (`news-card`) in the "Market news" section, up to six
  items, each with its image.
- **Every other page** — the image-free sidebar (`NewsRail`, fed by `NewsRailSlot` in the
  root layout), hidden on the landing page. Headline, source and age only.
- **Markets page (`/markets`)** — the full browse surface: up to 60 items with an
  asset-class filter (All / Crypto / Forex / Equities) carried in the `?news=` query
  parameter. An item's class comes from its tagged catalog symbols (`news-filter.ts`), so a
  story with no recognisable instrument (a Fed statement, say) appears under **All** only.
  The filter is a plain link, so it works without JavaScript and is shareable.

Feeds are fetched in parallel with a 6s timeout each and `revalidate: 300`, so a cold cache
pays the latency once and the sidebar is `Suspense`-wrapped so it never blocks page content.

## Planned: news as a trading signal input

The desk is meant to read these headlines as one input to risk decisions — e.g. a
collapse/hack/liquidation headline arguing for *not* taking risk and waiting. `NewsItem`
already carries `category` and `relatedSymbols` (tagged from the instrument catalog) as the
seam for that. The signal rules themselves are not built yet; they will be defined from the
signals supplied separately, so nothing here guesses at a strategy.

The signal sources themselves are catalogued in [`docs/signals/`](./signals/README.md): AltFins
(discrete signals), TAAPI.IO and FreeCryptoAPI (indicators), CoinGecko, CoinMarketCap and Finnhub
(market data + news), and WunderTrading (execution) — with the adapter design and risk gates in
[`docs/signals/IMPLEMENTATION.md`](./signals/IMPLEMENTATION.md).
