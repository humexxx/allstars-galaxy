import { describe, expect, it } from "vitest";

import {
  alignTodayPoint,
  buildChartSeries,
  buildCompareRows,
  buildPlanTimeline,
  calendarTicks,
  computeProjectionWindow,
  debtFreeMonthsFromNow,
  describeDebtFree,
  forecastKpiPoints,
  formatDebtFree,
  formatDebtFreeMonth,
  historyToCheckpoints,
  milestoneCrossings,
  summaryDebtFree,
  type PlanHistoryPoint,
} from "./chart-series";
import { projectPlan } from "./projection";
import type { FinancePlan, FinancePlanDebt, FinancePlanIncome, TodayState } from "@/types/finance";
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

  it("locates today by PERIOD, not calendar month, when anchorDay > 1", () => {
    // Period-anchored (day-15) projection. "today" = Jun 6 falls BEFORE the
    // June anchor, so it belongs to the May-15 period (index 2), NOT the
    // Jun-15 period. A calendar-month bucket would wrongly pick June (index 3).
    const proj = projectionOf([
      { date: utc(2026, 2, 15), netWorth: 1 }, // Mar-15 period (idx 0)
      { date: utc(2026, 3, 15), netWorth: 2 }, // Apr-15 (idx 1)
      { date: utc(2026, 4, 15), netWorth: 3 }, // May-15 (idx 2) ← today's period
      { date: utc(2026, 5, 15), netWorth: 4 }, // Jun-15 (idx 3)
      { date: utc(2026, 6, 15), netWorth: 5 }, // Jul-15 (idx 4)
    ]);
    const w = computeProjectionWindow(proj, 12, utc(2026, 5, 6), 15);
    // today index 2 → pastCount min(3,2)=2, startIndex 0.
    expect(w.pastCount).toBe(2);
    expect(w.todayIndex).toBe(2);
    expect(w.startIndex).toBe(0);
  });
});

const iso = (d: Date): string => d.toISOString().slice(0, 10);

describe("buildChartSeries", () => {
  it("dates every point at the day it shows: checkpoints, today, the closes ahead", () => {
    // Anchor day 5, today Nov 8. October was confirmed (late, on Oct 18); the
    // cron's Nov 5 row is the opening of today's period. The dot under "Oct"
    // used to be the latest November row, and today stood in for Dec 5.
    const history = [
      snap(utc(2026, 9, 5), 60),
      { ...snap(utc(2026, 9, 18), 14587), confirmed: true },
      snap(utc(2026, 9, 30), 70),
      snap(utc(2026, 10, 5), 25800),
      snap(utc(2026, 10, 7), 25900),
    ];
    const proj = projectionOf([
      { date: utc(2026, 10, 5), netWorth: 30000 }, // Nov-5 period, closes Dec 5
      { date: utc(2026, 11, 5), netWorth: 35000 },
      { date: utc(2027, 0, 5), netWorth: 40000 },
    ]);

    const { points, pastCount } = buildChartSeries(history, proj, 12, utc(2026, 10, 8), 5);

    expect(pastCount).toBe(2);
    expect(points.map((p) => iso(p.date))).toEqual([
      "2026-10-05",
      "2026-11-05",
      "2026-11-08",
      "2026-12-05",
      "2027-01-05",
      "2027-02-05",
    ]);
    expect(points.map((p) => p.netWorth)).toEqual([14587, 25800, 25800, 30000, 35000, 40000]);
  });

  it("on the anchor day itself, today replaces that day's checkpoint", () => {
    const history = [snap(utc(2026, 9, 5), 100), snap(utc(2026, 10, 5), 200)];
    const proj = projectionOf([{ date: utc(2026, 10, 5), netWorth: 300 }]);
    const { points, pastCount } = buildChartSeries(history, proj, 12, utc(2026, 10, 5), 5);
    expect(pastCount).toBe(1);
    expect(points.map((p) => [iso(p.date), p.netWorth])).toEqual([
      ["2026-10-05", 100],
      ["2026-11-05", 200],
      ["2026-12-05", 300],
    ]);
  });

  it("keeps the solid/dashed boundary on the period containing today (anchorDay > 1)", () => {
    // Anchor day 15: Jun 6 is in the May-15 period, so its close (Jun 15) is
    // still ahead and the May-15 opening is the last checkpoint.
    const history = [snap(utc(2026, 3, 20), 100), snap(utc(2026, 4, 20), 200)];
    const proj = projectionOf([
      { date: utc(2026, 4, 15), netWorth: 250 },
      { date: utc(2026, 5, 15), netWorth: 300 },
      { date: utc(2026, 6, 15), netWorth: 340 },
    ]);

    const { points, pastCount } = buildChartSeries(history, proj, 12, utc(2026, 5, 6), 15);

    expect(pastCount).toBe(2);
    expect(points.map((p) => iso(p.date))).toEqual([
      "2026-04-15",
      "2026-05-15",
      "2026-06-06",
      "2026-06-15",
      "2026-07-15",
      "2026-08-15",
    ]);
    expect(points.map((p) => p.netWorth)).toEqual([100, 200, 200, 250, 300, 340]);
  });

  it("caps the past at pastBudget = round(horizon * 0.25)", () => {
    const history = [
      snap(utc(2026, 2, 28), 1), // Mar
      snap(utc(2026, 3, 28), 2), // Apr
      snap(utc(2026, 4, 28), 3), // May
    ];
    const proj = projectionOf([{ date: utc(2026, 5, 1), netWorth: 4 }]); // Jun
    // horizon 4 → pastBudget = round(1) = 1 → only the latest (May) checkpoint.
    const { points, pastCount } = buildChartSeries(history, proj, 4, utc(2026, 5, 10));
    expect(pastCount).toBe(1);
    expect(points[0].netWorth).toBe(3);
  });

  it("falls back to the projection's own closes when there is no history", () => {
    const proj = projectionOf([
      { date: utc(2026, 2, 1), netWorth: 1 }, // Mar, closes Apr 1
      { date: utc(2026, 3, 1), netWorth: 2 },
      { date: utc(2026, 4, 1), netWorth: 3 },
      { date: utc(2026, 5, 1), netWorth: 4 }, // Jun (today's period)
      { date: utc(2026, 6, 1), netWorth: 5 },
    ]);
    const { points, pastCount } = buildChartSeries([], proj, 12, utc(2026, 5, 15));
    expect(pastCount).toBe(3);
    expect(points.map((p) => iso(p.date))).toEqual([
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
      "2026-06-15",
      "2026-07-01",
      "2026-08-01",
    ]);
    expect(points.map((p) => p.netWorth)).toEqual([1, 2, 3, 3, 4, 5]);
  });

  it("re-simulates the past from the RAW projection when the calibrated one starts at today", () => {
    const calibrated = projectionOf([
      { date: utc(2026, 5, 1), netWorth: 4 }, // Jun (today's period)
      { date: utc(2026, 6, 1), netWorth: 5 },
      { date: utc(2026, 7, 1), netWorth: 6 },
    ]);
    const raw = projectionOf([
      { date: utc(2026, 3, 1), netWorth: 2 },
      { date: utc(2026, 4, 1), netWorth: 3 },
      { date: utc(2026, 5, 1), netWorth: 4 },
      { date: utc(2026, 6, 1), netWorth: 5 },
      { date: utc(2026, 7, 1), netWorth: 6 },
    ]);

    const bare = buildChartSeries([], calibrated, 12, utc(2026, 5, 15));
    expect(bare.pastCount).toBe(0);
    expect(bare.points.slice(1).map((p) => p.netWorth)).toEqual([4, 5, 6]);

    const { points, pastCount } = buildChartSeries([], calibrated, 12, utc(2026, 5, 15), 1, raw);
    expect(pastCount).toBe(2);
    expect(points.map((p) => p.netWorth)).toEqual([2, 3, 3, 4, 5, 6]);
  });

  it("prefers real snapshots over the raw projection for the past", () => {
    const history = [snap(utc(2026, 4, 28), 200)];
    const calibrated = projectionOf([
      { date: utc(2026, 5, 1), netWorth: 4 },
      { date: utc(2026, 6, 1), netWorth: 5 },
    ]);
    const raw = projectionOf([
      { date: utc(2026, 3, 1), netWorth: 999 }, // closes May 1 — must be ignored
      { date: utc(2026, 4, 1), netWorth: 4 },
      { date: utc(2026, 5, 1), netWorth: 5 },
    ]);
    const { points, pastCount } = buildChartSeries(history, calibrated, 12, utc(2026, 5, 15), 1, raw);
    expect(pastCount).toBe(1);
    expect(points[0].netWorth).toBe(200);
  });

  it("never draws the old forecast as the past once the plan is confirmed (F21)", () => {
    const calibrated = projectionOf([
      { date: utc(2026, 5, 1), netWorth: 5000 },
      { date: utc(2026, 6, 1), netWorth: 5500 },
    ]);
    const { points, pastCount } = buildChartSeries([], calibrated, 12, utc(2026, 5, 15), 1, null);
    expect(pastCount).toBe(0);
    expect(points.slice(1).map((p) => p.netWorth)).toEqual([5000, 5500]);
  });

  it("spans the horizon past today, so the End KPI (last point) and the chart agree (F17)", () => {
    const proj = projectionOf(
      Array.from({ length: 36 }, (_, i) => ({ date: utc(2026, i, 1), netWorth: 1000 + 500 * i }))
    );
    const history = [snap(utc(2026, 8, 5), 4000)]; // Sep's opening
    const s12 = buildChartSeries(history, proj, 12, utc(2026, 8, 20), 1, null);
    expect(s12.pastCount).toBe(1);
    // Sep 1, today, then 11 closes: 12 checkpoints and today.
    expect(s12.points).toHaveLength(13);
    expect(s12.points.at(-1)!.date).toEqual(utc(2027, 7, 1));
  });
});

describe("debtFreeMonthsFromNow", () => {
  function withPlan(proj: Projection, monthsToDebtFree: number | null, anchorDay = 1): Projection {
    return {
      ...proj,
      monthsToDebtFree,
      plan: { confirmationDayOfMonth: anchorDay },
    } as unknown as Projection;
  }

  it("counts from today, not from the plan's first period", () => {
    const proj = withPlan(
      projectionOf(
        Array.from({ length: 36 }, (_, i) => ({ date: utc(2024, i, 1), netWorth: i }))
      ),
      30
    );
    // Plan started Jan 2024, debt cleared at period 30 (Jul 2026); on 11 Sep
    // 2026 that is already behind us — the old label still said "30 mo".
    expect(debtFreeMonthsFromNow(proj, utc(2026, 8, 11))).toBe(0);
    expect(debtFreeMonthsFromNow(proj, utc(2026, 3, 11))).toBe(3);
  });

  it("passes null through and tolerates an empty projection", () => {
    expect(debtFreeMonthsFromNow(withPlan(projectionOf([]), null), utc(2026, 0, 1))).toBeNull();
    expect(debtFreeMonthsFromNow(withPlan(projectionOf([]), 4), utc(2026, 0, 1))).toBe(4);
  });
});

// ---------- helpers for real projections ----------

function realPlan(o: Partial<FinancePlan> = {}): FinancePlan {
  return {
    id: "p",
    userId: "u",
    name: "P",
    description: null,
    startMonth: utc(2026, 0, 1),
    monthsAhead: 24,
    initialSavings: "0",
    monthlySavingsRate: "0",
    includePortfolio: false,
    surplusToDebtsPercent: "0",
    debtStrategy: "avalanche",
    confirmationDayOfMonth: 1,
    autoInvestPercent: "0",
    autoInvestMethodId: null,
    initialInvestments: "0",
    color: "var(--chart-1)",
    ...o,
  } as unknown as FinancePlan;
}
function income(amount: string): FinancePlanIncome {
  return {
    id: `i-${amount}`,
    name: "Salary",
    monthlyAmount: amount,
    kind: "recurring",
    dayOfMonth: 1,
    date: null,
    startDate: null,
    endDate: null,
    recurrenceType: "monthly_day",
    weekOfMonth: null,
    dayOfWeek: null,
    intervalMonths: null,
    recurrenceStart: null,
  } as unknown as FinancePlanIncome;
}
function debt(balance: string, payment: string): FinancePlanDebt {
  return {
    id: "d",
    name: "Loan",
    initialBalance: balance,
    monthlyInterestRate: "0",
    monthlyPayment: payment,
    paymentType: "fixed",
    minPaymentPercent: "0",
    minPaymentFloor: "0",
    dayOfMonth: 1,
    recurrenceType: "monthly_day",
    weekOfMonth: null,
    dayOfWeek: null,
    intervalMonths: null,
    recurrenceStart: null,
  } as unknown as FinancePlanDebt;
}

describe("historyToCheckpoints", () => {
  it("keeps each period's opening, dated at its first day", () => {
    const pts = historyToCheckpoints(
      [snap(utc(2026, 8, 3), 1), snap(utc(2026, 8, 20), 2), snap(utc(2026, 9, 2), 3)],
      1
    );
    expect(pts.map((p) => [iso(p.date), p.netWorth])).toEqual([
      ["2026-09-01", 1],
      ["2026-10-01", 3],
    ]);
  });

  it("a confirmation wins its period, however late in it", () => {
    const pts = historyToCheckpoints(
      [
        snap(utc(2026, 9, 5), 60),
        { ...snap(utc(2026, 9, 18), 14587), confirmed: true },
        snap(utc(2026, 10, 4), 70),
      ],
      5
    );
    expect(pts.map((p) => [iso(p.date), p.netWorth])).toEqual([["2026-10-05", 14587]]);
  });

  it("keeps what was still owed to the user, which the dashboard draws apart", () => {
    const [pt] = historyToCheckpoints([{ ...snap(utc(2026, 8, 3), 4100), receivables: 4000 }], 1);
    expect(pt.receivables).toBe(4000);
  });
});

describe("buildPlanTimeline", () => {
  it("a plan that starts in the future has no past and today on its first period (F27)", () => {
    const proj = projectionOf([
      { date: utc(2026, 10, 1), netWorth: 1 },
      { date: utc(2026, 11, 1), netWorth: 2 },
    ]);
    const t = buildPlanTimeline([], proj, utc(2026, 8, 29), 1, proj);
    expect(t.todayIndex).toBe(0);
    expect(t.points).toHaveLength(2);
  });

  it("a plan past its horizon puts today on its last close (F20)", () => {
    const proj = projectionOf([
      { date: utc(2026, 0, 1), netWorth: 1 },
      { date: utc(2026, 1, 1), netWorth: 2 },
    ]);
    const t = buildPlanTimeline([], proj, utc(2026, 8, 29), 1, proj);
    expect(t.todayIndex).toBe(1);
    expect(t.points.at(-1)!.netWorth).toBe(2);
  });
});

describe("alignTodayPoint", () => {
  const today = (status: TodayState["status"]): TodayState => ({
    status,
    date: utc(2026, 8, 10),
    periodIndex: 0,
    periodStart: utc(2026, 8, 1),
    savings: 2800,
    investments: 0,
    portfolioValue: 0,
    totalDebt: 9800,
    receivables: 0,
    netWorth: -7000,
    debts: [],
  });
  it("replaces the today point with the day-aware position, only in range", () => {
    const series = { points: [{ date: utc(2026, 8, 1), netWorth: -7000 }], pastCount: 0 };
    expect(alignTodayPoint(series, today("in-range"), 1).points[0]).toMatchObject({
      netWorth: -7000,
      savings: 2800,
      totalDebt: 9800,
    });
    expect(alignTodayPoint(series, today("before-start"), 1)).toBe(series);
  });
});

describe("debt-free: one definition (F8 / F18)", () => {
  it("counts from today and names the payoff month (audit: sidebar said 12, list said 4)", () => {
    // $6,000 at $500/mo from Jan 2026: cleared in the Dec 2026 period.
    const p = projectPlan(realPlan({ monthsAhead: 36 }), [], [], [debt("6000", "500")]);
    expect(p.monthsToDebtFree).toBe(12);
    const today = utc(2026, 8, 29);
    expect(debtFreeMonthsFromNow(p, today)).toBe(4);
    const status = describeDebtFree(p, 1, today);
    expect(status).toEqual({ kind: "on-track", months: 4, date: utc(2026, 11, 1) });
    expect(formatDebtFree(status)).toBe("Debt-free in 4 mo · Dec 2026");
    expect(formatDebtFreeMonth(utc(2026, 11, 1))).toBe("Dec 2026");
  });

  it("debts that all start at $0 read 'No debt', not 'Beyond horizon' (F18)", () => {
    const p = projectPlan(realPlan({ monthsAhead: 12 }), [], [], [debt("0", "0")]);
    expect(p.monthsToDebtFree).toBeNull();
    expect(p.hadDebt).toBe(false);
    expect(formatDebtFree(describeDebtFree(p, 1, utc(2026, 5, 1)))).toBe("No debt");
    expect(
      formatDebtFree(
        summaryDebtFree({
          monthsToDebtFree: null,
          debtFreeDate: null,
          hadDebt: false,
          endingNetWorth: 0,
          endingDebt: 0,
          endDate: null,
        })
      )
    ).toBe("No debt");
  });
});

describe("buildCompareRows — joined by calendar month (F4)", () => {
  it("plots each plan at its own dates (audit: B's Sep row showed its Feb 2027 value)", () => {
    // A starts Jan 2026, B starts Jun 2026 with $10k; both +$1,000/mo.
    const a = projectPlan(realPlan(), [income("1000")], [], []);
    const b = projectPlan(
      realPlan({ startMonth: utc(2026, 5, 1), initialSavings: "10000" }),
      [income("1000")],
      [],
      []
    );
    const today = utc(2026, 8, 20);
    const ta = buildPlanTimeline([], a, today, 1, a);
    const tb = buildPlanTimeline([], b, today, 1, b);
    const { rows, boundary } = buildCompareRows(
      [
        { key: "a", timeline: ta },
        { key: "b", timeline: tb },
      ],
      "netWorth",
      today,
      24,
      3
    );
    // Today (Sep 20) wins its month; unaligned it holds the Sep 1 opening.
    const sep = rows.find((r) => r.month.getTime() === utc(2026, 8, 1).getTime())!;
    expect(sep.values).toEqual({ a: 8000, b: 13000 });
    expect(rows[boundary].month).toEqual(utc(2026, 8, 1));
    // Before B starts it has no value — the line stops, it doesn't drop to 0.
    const may = rows.find((r) => r.month.getTime() === utc(2026, 4, 1).getTime());
    expect(may).toBeUndefined(); // outside the 3-month past window
    // B's first close, Jun's, falls on Jul 1.
    const jul = rows.find((r) => r.month.getTime() === utc(2026, 6, 1).getTime())!;
    expect(jul.values.b).toBe(11000);
  });

  it("'Full plan' covers every month of the LONGEST plan, not the first plan's", () => {
    const short = projectPlan(realPlan({ monthsAhead: 12 }), [income("1")], [], []);
    const long = projectPlan(realPlan({ monthsAhead: 120 }), [income("1")], [], []);
    const today = utc(2026, 8, 20);
    const { rows } = buildCompareRows(
      [
        { key: "s", timeline: buildPlanTimeline([], short, today, 1, short) },
        { key: "l", timeline: buildPlanTimeline([], long, today, 1, long) },
      ],
      "netWorth",
      today
    );
    expect(rows).toHaveLength(120);
    expect(rows.at(-1)!.values).toEqual({ s: null, l: 120 });
  });
});

describe("milestoneCrossings (F29)", () => {
  it("counts calendar months between dates, so a gap in the past still counts", () => {
    // Points a quarter apart in the past: Mar, Jun, then today Sep.
    const pts = [
      { date: utc(2026, 2, 1), value: 0 },
      { date: utc(2026, 5, 1), value: 10_000 },
      { date: utc(2026, 8, 1), value: 20_000 },
      { date: utc(2026, 9, 1), value: 30_000 },
    ];
    const [ten, twenty, fifty] = milestoneCrossings(pts, 2, [5_000, 20_000, 25_000]);
    // 5k is crossed halfway between Mar and Jun → 4.5 months before today (Sep),
    // not "1.5 points" as the index maths said.
    expect(ten.monthsFromToday).toBeCloseTo(-4.5, 5);
    expect(twenty.monthsFromToday).toBe(0);
    expect(fifty.monthsFromToday).toBeCloseTo(0.5, 5);
  });
});

describe("calendarTicks — evenly spaced month ticks", () => {
  const monthsFrom = (y: number, m: number, n: number): Date[] =>
    Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1 + i, 1)));
  const label = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;

  it("never forces the last month in: the steps stay equal (was 'Aug 28, Dec 28')", () => {
    // The compare page's full range: Jan 2026 – Dec 2028, room for ~12 ticks.
    const months = monthsFrom(2026, 1, 36);
    const ticks = calendarTicks(months, 12);
    const gaps = ticks.slice(1).map((t, i) => t - ticks[i]);
    expect(new Set(gaps).size).toBe(1);
    expect(ticks.map((i) => label(months[i]))).toEqual([
      "2026-1", "2026-4", "2026-7", "2026-10",
      "2027-1", "2027-4", "2027-7", "2027-10",
      "2028-1", "2028-4", "2028-7", "2028-10",
    ]);
  });

  it("widens the step on a narrow chart, staying on calendar boundaries", () => {
    const months = monthsFrom(2026, 6, 24); // Jun 2026 – May 2028
    expect(calendarTicks(months, 4).map((i) => label(months[i]))).toEqual([
      "2026-7", "2027-1", "2027-7", "2028-1",
    ]);
    expect(calendarTicks(months, 2).map((i) => label(months[i]))).toEqual([
      "2027-1", "2028-1",
    ]);
  });

  it("long horizons step in whole years", () => {
    const months = monthsFrom(2026, 1, 120);
    const ticks = calendarTicks(months, 6).map((i) => label(months[i]));
    expect(ticks).toEqual(["2026-1", "2028-1", "2030-1", "2032-1", "2034-1"]);
  });
});

describe("forecastKpiPoints — a plan that hasn't started", () => {
  const D = (y: number, m: number): Date => new Date(Date.UTC(y, m - 1, 1));
  const points = [
    { date: D(2027, 3), netWorth: 8689.49 },
    { date: D(2027, 4), netWorth: 12402.93 },
    { date: D(2027, 5), netWorth: 16127.74 },
  ];
  const opening: TodayState = {
    status: "before-start",
    date: D(2026, 9),
    periodIndex: 0,
    periodStart: D(2027, 3),
    savings: 8000,
    investments: 0,
    portfolioValue: 0,
    receivables: 0,
    totalDebt: 3000,
    netWorth: 5000,
    debts: [],
  };

  it("Today is the opening and Next the FIRST close (the Mar close was skipped)", () => {
    const { todayPoint, nextPoint } = forecastKpiPoints({ points, pastCount: 0 }, opening);
    expect(todayPoint?.netWorth).toBe(5000);
    expect(todayPoint?.date).toEqual(D(2027, 3));
    expect(nextPoint?.netWorth).toBe(8689.49);
  });

  it("in range: the today point and the close after it", () => {
    const { todayPoint, nextPoint } = forecastKpiPoints(
      { points, pastCount: 1 },
      { ...opening, status: "in-range" }
    );
    expect(todayPoint?.netWorth).toBe(12402.93);
    expect(nextPoint?.netWorth).toBe(16127.74);
  });
});
