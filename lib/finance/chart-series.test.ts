import { describe, expect, it } from "vitest";

import {
  buildChartSeries,
  computeProjectionWindow,
  type PlanHistoryPoint,
} from "./chart-series";
import type { Projection, ProjectionMonth } from "@/types/finance";

function utc(year: number, monthZeroIdx: number, day: number): Date {
  return new Date(Date.UTC(year, monthZeroIdx, day));
}

// Minimal projection: buildChartSeries / computeProjectionWindow only read
// `months[].date` and `.netWorth`, so we cast a partial shape through unknown.
function projectionOf(
  months: { date: Date; netWorth: number }[]
): Projection {
  return {
    months: months.map((m) => ({ ...m }) as unknown as ProjectionMonth),
  } as unknown as Projection;
}

function snap(date: Date, netWorth: number): PlanHistoryPoint {
  return { date, netWorth, savings: 0, investments: 0, totalDebt: 0 };
}

describe("computeProjectionWindow", () => {
  it("anchors ~25% past on today's month", () => {
    // Projection Mar..Aug (6 months), today = Jun → index 3.
    const proj = projectionOf([
      { date: utc(2026, 2, 1), netWorth: 1 }, // Mar
      { date: utc(2026, 3, 1), netWorth: 2 }, // Apr
      { date: utc(2026, 4, 1), netWorth: 3 }, // May
      { date: utc(2026, 5, 1), netWorth: 4 }, // Jun (today)
      { date: utc(2026, 6, 1), netWorth: 5 }, // Jul
      { date: utc(2026, 7, 1), netWorth: 6 }, // Aug
    ]);
    const w = computeProjectionWindow(proj, 12, utc(2026, 5, 20));
    // targetPast = round(12*0.25)=3, today index 3 → pastCount 3, startIndex 0.
    expect(w.pastCount).toBe(3);
    expect(w.startIndex).toBe(0);
    expect(w.count).toBe(6);
  });
});

describe("buildChartSeries", () => {
  it("uses real snapshots for the past and the projection for current+future", () => {
    const history = [
      snap(utc(2026, 3, 30), 100), // Apr (real)
      snap(utc(2026, 4, 30), 200), // May (real)
      snap(utc(2026, 5, 10), 999), // Jun — same month as today, must be ignored
    ];
    const proj = projectionOf([
      { date: utc(2026, 5, 1), netWorth: 260 }, // Jun (boundary, projection)
      { date: utc(2026, 6, 1), netWorth: 300 }, // Jul
      { date: utc(2026, 7, 1), netWorth: 340 }, // Aug
    ]);

    const { points, pastCount } = buildChartSeries(history, proj, 12, utc(2026, 5, 15));

    expect(pastCount).toBe(2);
    expect(points.map((p) => p.netWorth)).toEqual([100, 200, 260, 300, 340]);
    // Boundary point is the projection's current month, not the Jun snapshot.
    expect(points[2].netWorth).toBe(260);
  });

  it("aligns a day-30 snapshot with a period-anchored (day-15) projection by calendar month", () => {
    const history = [snap(utc(2026, 4, 30), 200)]; // May 30 (real)
    const proj = projectionOf([
      { date: utc(2026, 4, 15), netWorth: 210 }, // May-15 period — same month as the snapshot
      { date: utc(2026, 5, 15), netWorth: 250 }, // Jun-15 period (boundary)
      { date: utc(2026, 6, 15), netWorth: 290 }, // Jul-15 period
    ]);

    const { points, pastCount } = buildChartSeries(history, proj, 12, utc(2026, 5, 20));

    // Past = the May snapshot; the projection's May-15 period is NOT duplicated.
    expect(pastCount).toBe(1);
    expect(points[0].netWorth).toBe(200);
    expect(points[1].date).toEqual(utc(2026, 5, 15)); // Jun-15 boundary
    expect(points.map((p) => p.netWorth)).toEqual([200, 250, 290]);
  });

  it("caps the past at pastBudget = round(horizon * 0.25)", () => {
    const history = [
      snap(utc(2026, 2, 28), 1), // Mar
      snap(utc(2026, 3, 28), 2), // Apr
      snap(utc(2026, 4, 28), 3), // May
    ];
    const proj = projectionOf([{ date: utc(2026, 5, 1), netWorth: 4 }]); // Jun
    // horizon 4 → pastBudget = round(1) = 1 → only the latest (May) snapshot.
    const { points, pastCount } = buildChartSeries(history, proj, 4, utc(2026, 5, 10));
    expect(pastCount).toBe(1);
    expect(points[0].netWorth).toBe(3); // May only
  });

  it("falls back to the projection window when there is no history", () => {
    const proj = projectionOf([
      { date: utc(2026, 2, 1), netWorth: 1 }, // Mar
      { date: utc(2026, 3, 1), netWorth: 2 }, // Apr
      { date: utc(2026, 4, 1), netWorth: 3 }, // May
      { date: utc(2026, 5, 1), netWorth: 4 }, // Jun (today)
      { date: utc(2026, 6, 1), netWorth: 5 }, // Jul
    ]);
    const { points, pastCount } = buildChartSeries([], proj, 12, utc(2026, 5, 15));
    // Mirrors computeProjectionWindow: past = re-simulated months before today.
    expect(pastCount).toBe(3);
    expect(points.map((p) => p.netWorth)).toEqual([1, 2, 3, 4, 5]);
  });

  it("falls back when snapshots exist but none predate the current month", () => {
    const history = [snap(utc(2026, 5, 10), 999)]; // Jun, same month as today
    const proj = projectionOf([
      { date: utc(2026, 4, 1), netWorth: 3 }, // May
      { date: utc(2026, 5, 1), netWorth: 4 }, // Jun (today)
      { date: utc(2026, 6, 1), netWorth: 5 }, // Jul
    ]);
    const { points, pastCount } = buildChartSeries(history, proj, 12, utc(2026, 5, 15));
    // No snapshot strictly before Jun → fallback window.
    expect(pastCount).toBe(1);
    expect(points.map((p) => p.netWorth)).toEqual([3, 4, 5]);
  });
});
