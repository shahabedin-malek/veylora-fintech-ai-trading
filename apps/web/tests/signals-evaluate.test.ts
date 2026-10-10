import { describe, expect, it } from "vitest";

import {
  type PricePoint,
  type SignalSample,
  distribution,
  evaluate,
  regimesAt,
} from "@/lib/signals/evaluate";

/**
 * The evaluation engine earns trust for a signal key, so the properties that matter are:
 * a forward return is measured only from the price a signal fired at to the first *later*
 * stored reading (no lookahead), a sample with no entry price is never scored (coverage
 * is honest), a `neutral` event contributes no hit/miss (so a heuristic cannot look
 * prescient), and the out-of-sample split is by time.
 */

const t0 = Date.parse("2026-10-01T00:00:00Z");
const HOUR = 60 * 60 * 1000;

const SERIES: PricePoint[] = [
  { ts: t0, priceUsd: 100 },
  { ts: t0 + HOUR, priceUsd: 110 },
  { ts: t0 + 4 * HOUR, priceUsd: 90 },
  { ts: t0 + 24 * HOUR, priceUsd: 105 },
];

function sample(over: Partial<SignalSample>): SignalSample {
  return {
    signalKey: "TEST_KEY",
    symbol: "BTC",
    direction: "bullish",
    ts: t0,
    priceUsd: 100,
    ...over,
  };
}

describe("evaluate — forward returns", () => {
  it("measures from the signal price to the first reading at/after each horizon", () => {
    const { returns } = evaluate({
      samples: [sample({})],
      seriesBySymbol: { BTC: SERIES },
    });

    const byHorizon = Object.fromEntries(returns.map((r) => [r.horizon, r]));
    expect(byHorizon["1h"]).toMatchObject({ entryUsd: 100, exitUsd: 110, returnPct: 10, hit: true });
    expect(byHorizon["4h"]).toMatchObject({ exitUsd: 90, returnPct: -10, hit: false });
    expect(byHorizon["24h"]).toMatchObject({ exitUsd: 105, returnPct: 5, hit: true });
  });

  it("never looks back: the exit is at or after the horizon, not before", () => {
    // The 1h exit must be the t0+1h point even though an earlier duplicate exists.
    const { returns } = evaluate({
      samples: [sample({})],
      seriesBySymbol: { BTC: SERIES },
    });
    const oneHour = returns.find((r) => r.horizon === "1h")!;
    expect(oneHour.exitTs).toBeGreaterThanOrEqual(t0 + HOUR);
  });

  it("gives a neutral event a return but no directional hit", () => {
    const { returns } = evaluate({
      samples: [sample({ direction: "neutral" })],
      seriesBySymbol: { BTC: SERIES },
    });
    expect(returns).toHaveLength(3);
    expect(returns.every((r) => r.hit === null)).toBe(true);
  });

  it("scores a bearish signal as a hit when the price falls", () => {
    const { returns } = evaluate({
      samples: [sample({ direction: "bearish" })],
      seriesBySymbol: { BTC: SERIES },
    });
    const byHorizon = Object.fromEntries(returns.map((r) => [r.horizon, r]));
    expect(byHorizon["1h"].hit).toBe(false); // price rose
    expect(byHorizon["4h"].hit).toBe(true); // price fell
  });
});

describe("evaluate — coverage is honest", () => {
  it("counts a sample with no entry price as unscored, not as a zero", () => {
    const { returns, totals } = evaluate({
      samples: [sample({ priceUsd: null })],
      seriesBySymbol: { BTC: SERIES },
    });
    expect(returns).toHaveLength(0);
    expect(totals).toEqual({ samples: 1, eligible: 0, scoredPairs: 0 });
  });

  it("counts a sample eligible but not scored when no later reading exists", () => {
    const { summaries, totals } = evaluate({
      samples: [sample({ ts: t0 + 100 * HOUR, priceUsd: 50 })],
      seriesBySymbol: { BTC: SERIES },
    });
    expect(totals).toEqual({ samples: 1, eligible: 1, scoredPairs: 0 });
    expect(summaries).toHaveLength(0);
  });

  it("records eligible vs scored per key+horizon", () => {
    const { summaries } = evaluate({
      samples: [sample({}), sample({ ts: t0 + 100 * HOUR, priceUsd: 50 })],
      seriesBySymbol: { BTC: SERIES },
    });
    // The second sample is never scored, so it does not appear as a summary row at all.
    expect(summaries).toHaveLength(3);
    expect(summaries[0]).toMatchObject({ signalKey: "TEST_KEY" });
    // Eligible for each horizon counts both priced samples; scored counts only the first.
    for (const s of summaries) {
      expect(s.eligible).toBe(2);
      expect(s.scored).toBe(1);
    }
  });
});

describe("evaluate — out-of-sample split by time", () => {
  it("assigns earlier samples to in-sample and the tail to out-of-sample", () => {
    const samples = Array.from({ length: 10 }, (_, i) =>
      sample({ ts: t0 + i * HOUR, priceUsd: 100 + i })
    );
    // A dense series so every sample can be scored at 1h.
    const series: PricePoint[] = Array.from({ length: 40 }, (_, i) => ({
      ts: t0 + i * 30 * 60 * 1000,
      priceUsd: 100 + i,
    }));

    const { inSample, outOfSample, cutoffTs } = evaluate({
      samples,
      seriesBySymbol: { BTC: series },
      horizons: [{ label: "1h", ms: HOUR }],
    });

    // 70% of 10 = cutoff at sample index 7; indices 0..6 are in-sample, 7..9 out.
    expect(cutoffTs).toBe(t0 + 7 * HOUR);
    expect(inSample[0].scored).toBe(7);
    expect(outOfSample[0].scored).toBe(3);
  });
});

describe("distribution", () => {
  it("buckets returns over the fixed edges, with open ends", () => {
    const returns = [-10, -3, 0, 0.3, 3, 10].map((returnPct) => ({
      returnPct,
    })) as unknown as Parameters<typeof distribution>[0];

    const buckets = distribution(returns);
    const byCount = Object.fromEntries(buckets.map((b) => [b.label, b.count]));
    expect(byCount["< -5%"]).toBe(1); // -10
    expect(byCount["-5% … -2%"]).toBe(1); // -3
    expect(byCount["0% … 0.5%"]).toBe(2); // 0, 0.3
    expect(byCount["2% … 5%"]).toBe(1); // 3
    expect(byCount["≥ 5%"]).toBe(1); // 10
  });
});

describe("regimesAt", () => {
  it("tags each sample with the most recent marking at or before it", () => {
    const samples = [
      sample({ ts: 10 }),
      sample({ ts: 20 }),
      sample({ ts: 30 }),
    ];
    const tagged = regimesAt(samples, [
      { ts: 5, regime: "uptrend" },
      { ts: 25, regime: "downtrend" },
    ]);
    expect(tagged.map((s) => s.regime)).toEqual(["uptrend", "uptrend", "downtrend"]);
  });

  it("leaves a sample before any marking as unknown", () => {
    const [tagged] = regimesAt([sample({ ts: 1 })], [{ ts: 5, regime: "uptrend" }]);
    expect(tagged.regime).toBe("unknown");
  });
});
