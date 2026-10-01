import { describe, expect, it } from "vitest";

import { performanceSeries, rangeGain } from "./performance-series";

const TODAY = new Date("2026-10-01T12:00:00Z");

describe("performanceSeries", () => {
  const txs = [
    { type: "buy" as const, status: "approved" as const, total: "6000.00", date: new Date("2026-02-20T15:00:00Z") },
    { type: "buy" as const, status: "approved" as const, total: "1500.00", date: new Date("2026-07-01T15:00:00Z") },
    { type: "buy" as const, status: "rejected" as const, total: "250.00", date: new Date("2026-08-02T15:00:00Z") },
  ];

  it("treats the service's fabricated $0 points as no history", () => {
    // With no snapshots the service returns two $0 points, which drew a flat
    // zero line under a portfolio holding $7,512.33 and blocked the fallback.
    const dummy = [
      { date: "2026-09-01T00:00:00.000Z", value: 0 },
      { date: TODAY.toISOString(), value: 0 },
    ];

    expect(performanceSeries(dummy, txs, 7512.33, TODAY)).toEqual([
      { date: "2026-02-20T15:00:00.000Z", value: 6000 },
      { date: "2026-07-01T15:00:00.000Z", value: 7500 },
      { date: TODAY.toISOString(), value: 7512.33 },
    ]);
  });

  it("ends on today's live value, not the last snapshot", () => {
    // Snapshots lag the interest applied on the 1st: the chart said 14,010.34
    // beside a 14,012.31 card.
    const snaps = [
      { date: "2026-09-30T23:59:00.000Z", value: 14010.34 },
      { date: TODAY.toISOString(), value: 14010.34 },
    ];

    const out = performanceSeries(snaps, [], 14012.31, TODAY);
    expect(out.at(-1)).toEqual({ date: TODAY.toISOString(), value: 14012.31 });
    expect(out).toHaveLength(2);
  });

  it("returns nothing when there is nothing approved", () => {
    expect(performanceSeries([], [txs[2]], 0, TODAY)).toEqual([]);
  });
});

describe("rangeGain", () => {
  it("does not count deposits as performance", () => {
    // 10,000 on Mar 5, +3,000 and +2,000 deposited, 1,000 withdrawn, now
    // 14,012.31. The chart used to call that "+$4,012.31 (40.1%)".
    const points = [
      { date: "2026-03-05T23:59:00Z", value: 10000 },
      { date: "2026-10-01T12:00:00Z", value: 14012.31 },
    ];
    const flows = [
      { date: "2026-03-05T15:00:00Z", amount: 10000 }, // already in the first point
      { date: "2026-05-12T15:00:00Z", amount: 3000 },
      { date: "2026-08-20T15:00:00Z", amount: 2000 },
      { date: "2026-09-08T15:00:00Z", amount: -1000 },
    ];

    const { gain, percent } = rangeGain(points, flows);
    expect(gain).toBeCloseTo(12.31, 6);
    // Against what was at work: the starting 10,000 plus the 5,000 added.
    expect(percent).toBeCloseTo((12.31 / 15000) * 100, 6);
  });

  it("is zero for a single point", () => {
    expect(rangeGain([{ date: "2026-10-01", value: 5 }], [])).toEqual({ gain: 0, percent: 0 });
  });
});
