import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Error-recovery tests.
 *
 * The product must survive a failing external dependency: market data falls back
 * to clearly-labelled offline values, news degrades to an empty feed instead of
 * throwing, and bad/expired sessions are rejected rather than trusted.
 */

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));

import { createToken, verifyToken } from "@/lib/session";
import { config } from "@/lib/config";
import { getCandlesSafe, getNews, getQuotesSafe } from "@/lib/market";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const RSS = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  "<rss version=\"2.0\"><channel>",
  "<item>",
  "<title><![CDATA[Bitcoin ETF sees record inflows]]></title>",
  "<link><![CDATA[https://example.com/btc?utm_source=rss]]></link>",
  "<pubDate>Wed, 08 Oct 2026 12:00:00 GMT</pubDate>",
  "<description><![CDATA[<p>Demand for <b>BTC</b> products keeps rising.</p>]]></description>",
  "</item>",
  "<item>",
  "<title>Fed holds rates steady</title>",
  "<link>https://example.com/fed</link>",
  "<pubDate>Wed, 08 Oct 2026 11:00:00 GMT</pubDate>",
  "<description>Markets rally on the decision.</description>",
  "</item>",
  "</channel></rss>",
].join("\n");

function stubFetch(impl: (url: string) => Promise<unknown>) {
  vi.stubGlobal("fetch", (input: unknown) => impl(String(input)));
}

/* ---------------------------------------------------- market data resilience */

describe("market data resilience", () => {
  it("falls back to labelled offline quotes when the live provider fails", async () => {
    stubFetch(() => Promise.reject(new Error("network down")));

    const { quotes, degraded, source } = await getQuotesSafe(["BTC", "ETH", "SOL"]);

    expect(quotes).toHaveLength(3);
    expect(quotes.every((q) => q.offline === true)).toBe(true);
    expect(quotes.every((q) => q.source === "offline")).toBe(true);
    expect(degraded).toBe(true);
    expect(source).toBe("offline");
  });

  it("falls back when the live provider returns a bad status", async () => {
    stubFetch(() => Promise.resolve({ ok: false, status: 503, json: async () => ({}) }));

    const { quotes, degraded } = await getQuotesSafe(["BTC"]);

    expect(quotes).toHaveLength(1);
    expect(quotes[0].offline).toBe(true);
    expect(degraded).toBe(true);
  });

  it("labels non-crypto instruments as offline even on the live provider path", async () => {
    // No fetch should be needed for forex-only requests.
    stubFetch(() => Promise.reject(new Error("should not be called for forex")));

    const { quotes, degraded } = await getQuotesSafe(["EURUSD", "AAPL"]);

    expect(quotes).toHaveLength(2);
    expect(quotes.every((q) => q.offline === true)).toBe(true);
    expect(degraded).toBe(true);
  });

  it("falls back to offline candles and flags them", async () => {
    stubFetch(() => Promise.reject(new Error("network down")));

    const { candles, offline } = await getCandlesSafe("BTC", 24);

    expect(candles).toHaveLength(24);
    expect(offline).toBe(true);
    for (const c of candles) {
      expect(c.offline).toBe(true);
      expect(c.h).toBeGreaterThanOrEqual(Math.max(c.o, c.c));
      expect(c.l).toBeLessThanOrEqual(Math.min(c.o, c.c));
    }
  });

  it("returns an empty news list instead of throwing when every feed is down", async () => {
    stubFetch(() => Promise.reject(new Error("offline")));

    await expect(getNews()).resolves.toEqual([]);
  });

  it("returns an empty news list when feeds return unusable payloads", async () => {
    stubFetch(() => Promise.resolve({ ok: true, text: async () => "<html>not a feed</html>" }));

    await expect(getNews()).resolves.toEqual([]);
  });
});

/* ----------------------------------------------------------- news happy path */

describe("news parsing", () => {
  it("parses real RSS, strips CDATA, dedupes across feeds and tags instruments", async () => {
    stubFetch(() => Promise.resolve({ ok: true, text: async () => RSS }));

    const items = await getNews(["BTC"]);

    // Every configured feed returns the same two items -> deduped to two.
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.url).sort()).toEqual([
      "https://example.com/btc?utm_source=rss",
      "https://example.com/fed",
    ]);

    const hosts = config.newsFeeds.map((f) => new URL(f).hostname);
    expect(hosts).toContain(items[0].source);
    expect(items.every((i) => i.offline === false)).toBe(true);

    // Instrument-relevant story sorts first when symbols are supplied.
    const btc = items[0];
    expect(btc.headline).toBe("Bitcoin ETF sees record inflows");
    expect(btc.relatedSymbols).toContain("BTC");
    expect(btc.category).toBe("crypto");
    expect(Number.isNaN(Date.parse(btc.publishedAt))).toBe(false);
  });

  it("degrades quietly when a feed returns a non-response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(undefined));

    await expect(getNews()).resolves.toEqual([]);
  });
});

/* ------------------------------------------------------------- session health */

describe("session recovery", () => {
  it("rejects an expired session token", () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const expired = createToken("user-1", 11155111, eightDaysAgo);

    expect(verifyToken(expired)).toBeNull();
  });

  it("rejects malformed and missing tokens", () => {
    for (const bad of [undefined, "", "garbage", "a.b", "a.b.c", ".."]) {
      expect(verifyToken(bad)).toBeNull();
    }
  });

  it("rejects a token signed with a different secret", () => {
    const forged = "user-1.11155111." + (Date.now() + 60_000) + ".not-a-valid-signature";
    expect(verifyToken(forged)).toBeNull();
  });

  it("accepts a freshly issued token and carries the signed-in chain", () => {
    expect(verifyToken(createToken("user-42", 8453))).toEqual({ userId: "user-42", chainId: 8453 });
  });
});
