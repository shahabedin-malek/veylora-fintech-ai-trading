import { afterEach, describe, expect, it, vi } from "vitest";

import { getNews } from "@/lib/market";

/**
 * Image extraction for feed items.
 *
 * The home page shows a picture per headline, so the pipeline has to find the image a
 * feed publishes without being fooled by the shapes that should be refused: a non-image
 * enclosure (an audio/video file), a relative path, a `data:` URI, or no image at all.
 * Each case below feeds one item and asserts what `imageUrl` ends up as.
 */

function rssWith(itemInner: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    "<channel>",
    "<item>",
    "<title>Bitcoin ETF sees record inflows</title>",
    "<link>https://example.com/story</link>",
    "<pubDate>Wed, 08 Oct 2026 12:00:00 GMT</pubDate>",
    itemInner,
    "</item>",
    "</channel></rss>",
  ].join("");
}

async function imageFor(itemInner: string): Promise<string | undefined> {
  vi.stubGlobal("fetch", () =>
    Promise.resolve({ ok: true, text: async () => rssWith(itemInner) })
  );
  const [first] = await getNews();
  return first?.imageUrl;
}

afterEach(() => vi.unstubAllGlobals());

describe("news image extraction", () => {
  it("reads an image enclosure", async () => {
    const url = await imageFor(
      '<enclosure url="https://cdn.example.com/btc.jpg" type="image/jpeg" length="0" />'
    );
    expect(url).toBe("https://cdn.example.com/btc.jpg");
  });

  it("ignores a non-image enclosure and falls through to the body image", async () => {
    const url = await imageFor(
      '<enclosure url="https://cdn.example.com/clip.mp3" type="audio/mpeg" length="0" />' +
        '<description><![CDATA[<p>Story</p><img src="https://cdn.example.com/frame.jpg" />]]></description>'
    );
    expect(url).toBe("https://cdn.example.com/frame.jpg");
  });

  it("reads media:content and media:thumbnail", async () => {
    expect(await imageFor('<media:content url="https://cdn.example.com/a.jpg" medium="image" />')).toBe(
      "https://cdn.example.com/a.jpg"
    );
    expect(await imageFor('<media:thumbnail url="https://cdn.example.com/t.jpg" />')).toBe(
      "https://cdn.example.com/t.jpg"
    );
  });

  it("reads an image from description or content:encoded", async () => {
    expect(
      await imageFor(
        '<description><![CDATA[<p>Lead</p><img src="https://cdn.example.com/desc.png" />]]></description>'
      )
    ).toBe("https://cdn.example.com/desc.png");
    expect(
      await imageFor(
        '<content:encoded><![CDATA[<img src="https://cdn.example.com/body.png" />]]></content:encoded>'
      )
    ).toBe("https://cdn.example.com/body.png");
  });

  it("decodes an entity-escaped image URL", async () => {
    const url = await imageFor('<media:content url="https://cdn.example.com/a.jpg?x=1&amp;y=2" />');
    expect(url).toBe("https://cdn.example.com/a.jpg?x=1&y=2");
  });

  it("refuses relative and data: image URLs", async () => {
    expect(await imageFor('<description><![CDATA[<img src="/images/local.png" />]]></description>')).toBeUndefined();
    expect(
      await imageFor('<description><![CDATA[<img src="data:image/png;base64,AAAA" />]]></description>')
    ).toBeUndefined();
  });

  it("leaves imageUrl absent when the item carries no image", async () => {
    expect(await imageFor("<description>Just text, no picture.</description>")).toBeUndefined();
  });
});
