import { describe, expect, it } from "vitest";

import { RECENCY_MS, assessRisk, type RiskNewsInput, type RiskSignalInput } from "@/lib/risk/assess";

/**
 * The risk gate can only **refuse** new risk, so the properties that matter are: it
 * refuses on genuine danger (a severe event, a bearish regime, desk-wide breadth), it
 * does not refuse on ordinary price noise, it ignores stale input, and every verdict
 * comes with a reason a human can read.
 */

const NOW = Date.parse("2026-10-10T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

function signal(over: Partial<RiskSignalInput> = {}): RiskSignalInput {
  return {
    providerKey: "SIGNALS_SUMMARY_ENGULFING",
    name: "Engulfing",
    symbol: "SOL",
    direction: "bullish",
    ts: ago(60 * 60 * 1000),
    ...over,
  };
}

function news(headline: string, over: Partial<RiskNewsInput> = {}): RiskNewsInput {
  return {
    headline,
    source: "example.com",
    url: "https://example.com/a",
    publishedAt: ago(60 * 60 * 1000),
    ...over,
  };
}

const assess = (input: { signals?: RiskSignalInput[]; news?: RiskNewsInput[] }) =>
  assessRisk({ signals: input.signals ?? [], news: input.news ?? [], now: NOW });

describe("assessRisk", () => {
  it("is normal with no input at all", () => {
    const result = assess({});
    expect(result.level).toBe("normal");
    expect(result.riskOff).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("refuses on a severe headline and explains why", () => {
    const result = assess({ news: [news("Exchange exploited for $40m, withdrawals halted")] });
    expect(result.riskOff).toBe(true);
    expect(result.level).toBe("off");
    expect(result.reasons[0]).toMatch(/Exchange exploited/);
    expect(result.headlines).toHaveLength(1);
  });

  it("does not refuse on an ordinary price-move headline", () => {
    // "crash"/"plunge" describe volatility, not a reason to distrust the venue.
    const result = assess({
      news: [news("Bitcoin plunges to $80,000 as traders brace for another crash")],
    });
    expect(result.level).toBe("normal");
  });

  it("ignores a severe headline older than the recency window", () => {
    const stale = news("Protocol hacked for $12m", { publishedAt: new Date(NOW - RECENCY_MS - 1000).toISOString() });
    expect(assess({ news: [stale] }).riskOff).toBe(false);
  });

  it("refuses on a bearish regime signal", () => {
    const result = assess({
      signals: [
        signal({
          providerKey: "SIGNALS_SUMMARY_STRONG_UP_DOWN_TREND",
          name: "Strong Downtrend across Short- Medium- and Long-Term",
          symbol: "BTC",
          direction: "bearish",
        }),
      ],
    });
    expect(result.riskOff).toBe(true);
    expect(result.signals[0].symbol).toBe("BTC");
  });

  it("does not refuse on a bullish regime signal", () => {
    const result = assess({
      signals: [
        signal({ providerKey: "SIGNALS_SUMMARY_STRONG_UP_DOWN_TREND", name: "Strong Uptrend", direction: "bullish" }),
      ],
    });
    expect(result.riskOff).toBe(false);
  });

  it("is elevated — not off — on an extreme-volatility signal", () => {
    const result = assess({
      signals: [signal({ providerKey: "SIGNALS_SUMMARY_TR_ATR_5x", name: "Volatility Spike: above 5x ATR", direction: "neutral" })],
    });
    expect(result.level).toBe("elevated");
    expect(result.riskOff).toBe(false);
    expect(result.reasons[0]).toMatch(/Volatility/);
  });

  it("refuses on desk-wide bearish breadth", () => {
    const result = assess({
      signals: [
        signal({ symbol: "BTC", direction: "bearish" }),
        signal({ symbol: "ETH", direction: "bearish" }),
        signal({ symbol: "SOL", direction: "bearish" }),
        signal({ symbol: "XRP", direction: "bullish" }),
      ],
    });
    expect(result.riskOff).toBe(true);
    expect(result.reasons.some((r) => r.startsWith("Breadth:"))).toBe(true);
  });

  it("does not refuse on a small or balanced mix", () => {
    const result = assess({
      signals: [
        signal({ symbol: "BTC", direction: "bearish" }),
        signal({ symbol: "ETH", direction: "bearish" }),
        signal({ symbol: "SOL", direction: "bullish" }),
        signal({ symbol: "XRP", direction: "bullish" }),
      ],
    });
    expect(result.riskOff).toBe(false);
  });

  it("counts only inputs inside the recency window", () => {
    const result = assess({
      signals: [signal({ ts: ago(10 * 60 * 60 * 1000) }), signal({ ts: new Date(NOW - RECENCY_MS - 1).toISOString() })],
      news: [news("hello", { publishedAt: ago(60 * 60 * 1000) })],
    });
    expect(result.counts).toEqual({ signals: 1, news: 1 });
  });
});
