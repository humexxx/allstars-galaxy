import { describe, expect, it } from "vitest";

import {
  alignTodayPoint,
  buildChartSeries,
  buildCompareRows,
  buildPlanTimeline,
  computeProjectionWindow,
  debtFreeMonthsFromNow,
  describeDebtFree,
  formatDebtFree,
  historyToClosePoints,
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

describe("buildChartSeries", () => {
  it("plots each snapshot at the period whose CLOSE it records (F10)", () => {
    // A snapshot stores the OPENING of the period it was taken in = the
    // previous period's close. Apr 30 → Mar close, May 30 → Apr close, and
    // Jun 10 (today's period) → May close.
    const history = [
      snap(utc(2026, 3, 30), 100),
      snap(utc(2026, 4, 30), 200),
      snap(utc(2026, 5, 10), 999),
    ];
    const proj = projectionOf([
      { date: utc(2026, 5, 1), netWorth: 260 }, // Jun (boundary, projection)
      { date: utc(2026, 6, 1), netWorth: 300 }, // Jul
      { date: utc(2026, 7, 1), netWorth: 340 }, // Aug
    ]);

    const { points, pastCount } = buildChartSeries(history, proj, 12, utc(2026, 5, 15));

    expect(pastCount).toBe(3);
    expect(points.map((p) => p.date)).toEqual([
      utc(2026, 2, 1),
      utc(2026, 3, 1),
      utc(2026, 4, 1),
      utc(2026, 5, 1),
      utc(2026, 6, 1),
      utc(2026, 7, 1),
    ]);
    expect(points.map((p) => p.netWorth)).toEqual([100, 200, 999, 260, 300, 340]);
  });

  it("puts snapshots and projection on ONE footing: no one-period lag (audit F10 numbers)", () => {
    // +500 a period from 1,000. Snapshots taken mid-Jul/Aug/Sep hold those
    // periods' OPENINGS (= Jun/Jul/Aug closes: 4,000 / 4,500 / 5,000). They
    // used to be drawn at Jul/Aug/Sep — 500 below the projection there — and
    // the line jumped +1,000 into the forecast. Now each lands on the period
    // it closes.
    const closes = Array.from({ length: 12 }, (_, i) => ({
      date: utc(2026, i, 1),
      netWorth: 1500 + 500 * i,
    }));
    const proj = projectionOf(closes);
    // Taken mid-Jul, mid-Aug and mid-Sep (today's period).
    const history = [6, 7, 8].map((m) => snap(utc(2026, m, 15), closes[m - 1].netWorth));
    const { points } = buildChartSeries(history, proj, 12, utc(2026, 8, 20), 1, proj);
    const sim = buildChartSeries([], proj, 12, utc(2026, 8, 20), 1, proj);
    const byDate = (ps: typeof points) => new Map(ps.map((p) => [p.date.getTime(), p.netWorth]));
    const real = byDate(points);
    let compared = 0;
    for (const [t, v] of byDate(sim.points)) {
      if (!real.has(t)) continue;
      expect(real.get(t)).toBe(v);
      compared += 1;
    }
    expect(compared).toBeGreaterThanOrEqual(3);
    // Jun / Jul / Aug read 4,000 / 4,500 / 5,000 — the closes — and Aug → Sep
    // steps +500 like every other period.
    expect(points.slice(0, 4).map((p) => p.netWorth)).toEqual([4000, 4500, 5000, 5500]);
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

  it("dates a past snapshot at its period start so the axis names each period once", () => {
    // Anchor day 5: the Aug-5 period runs Aug 5 – Sep 4. Its closing snapshot is
    // dated Sep 4 and used to label as "Sep" beside today's Sep-5 period.
    const history = [snap(utc(2026, 8, 4), 200)]; // Sep 4, inside the Aug-5 period
    const proj = projectionOf([
      { date: utc(2026, 7, 5), netWorth: 210 }, // Aug-5 period
      { date: utc(2026, 8, 5), netWorth: 250 }, // Sep-5 period (today)
      { date: utc(2026, 9, 5), netWorth: 290 }, // Oct-5 period
    ]);

    const { points, pastCount } = buildChartSeries(history, proj, 12, utc(2026, 8, 7), 5);

    // Taken in the Aug-5 period, it records the Jul-5 period's close.
    expect(pastCount).toBe(1);
    expect(points[0].date).toEqual(utc(2026, 6, 5));
    expect(points[0].netWorth).toBe(200);
    expect(points[1].date).toEqual(utc(2026, 8, 5));
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

  it("keeps the solid/dashed boundary on the period containing today (anchorDay > 1)", () => {
    // Anchor day 15. today = Jun 6 → belongs to the May-15 period (the
    // in-progress one). The dashed forecast must therefore start at May-15, and
    // only periods that closed before it (the Apr snapshot) count as past. A
    // calendar-month split would wrongly push the boundary to Jun-15.
    const history = [
      snap(utc(2026, 3, 20), 100), // Apr-15 period (closed)
      snap(utc(2026, 4, 20), 200), // May-15 period (the current, in-progress one)
    ];
    const proj = projectionOf([
      { date: utc(2026, 4, 15), netWorth: 250 }, // May-15 (today's period → boundary)
      { date: utc(2026, 5, 15), netWorth: 300 }, // Jun-15
      { date: utc(2026, 6, 15), netWorth: 340 }, // Jul-15
    ]);

    const { points, pastCount } = buildChartSeries(history, proj, 12, utc(2026, 5, 6), 15);

    // Apr-20 records the Mar-15 close, May-20 the Apr-15 close — both closed
    // before today's May-15 period, whose own close comes from the projection.
    expect(pastCount).toBe(2);
    expect(points[0].date).toEqual(utc(2026, 2, 15));
    expect(points[2].date).toEqual(utc(2026, 4, 15)); // May-15 boundary
    expect(points.map((p) => p.netWorth)).toEqual([100, 200, 250, 300, 340]);
  });

  it("re-simulates the past from the RAW projection when the calibrated one starts at today", () => {
    // Simulates confirming the CURRENT period: the calibrated projection begins
    // at today (Jun), so on its own it has no past to show. With no real
    // snapshots, the raw `pastProjection` (which still spans back to plan start)
    // supplies the past line so the chart history isn't blanked.
    const calibrated = projectionOf([
      { date: utc(2026, 5, 1), netWorth: 4 }, // Jun (today, boundary)
      { date: utc(2026, 6, 1), netWorth: 5 }, // Jul
      { date: utc(2026, 7, 1), netWorth: 6 }, // Aug
    ]);
    const raw = projectionOf([
      { date: utc(2026, 3, 1), netWorth: 2 }, // Apr
      { date: utc(2026, 4, 1), netWorth: 3 }, // May
      { date: utc(2026, 5, 1), netWorth: 4 }, // Jun
      { date: utc(2026, 6, 1), netWorth: 5 }, // Jul
      { date: utc(2026, 7, 1), netWorth: 6 }, // Aug
    ]);

    // Without pastProjection: no past at all (the regression the user hit).
    const bare = buildChartSeries([], calibrated, 12, utc(2026, 5, 15));
    expect(bare.pastCount).toBe(0);
    expect(bare.points.map((p) => p.netWorth)).toEqual([4, 5, 6]);

    // With pastProjection: Apr + May re-simulated as the past.
    const { points, pastCount } = buildChartSeries(
      [],
      calibrated,
      12,
      utc(2026, 5, 15),
      1,
      raw
    );
    expect(pastCount).toBe(2);
    expect(points.map((p) => p.netWorth)).toEqual([2, 3, 4, 5, 6]);
  });

  it("prefers real snapshots over the raw projection for the past", () => {
    const history = [snap(utc(2026, 4, 28), 200)]; // May (real)
    const calibrated = projectionOf([
      { date: utc(2026, 5, 1), netWorth: 4 }, // Jun (today)
      { date: utc(2026, 6, 1), netWorth: 5 }, // Jul
    ]);
    const raw = projectionOf([
      { date: utc(2026, 4, 1), netWorth: 999 }, // May (raw — must be ignored)
      { date: utc(2026, 5, 1), netWorth: 4 },
      { date: utc(2026, 6, 1), netWorth: 5 },
    ]);
    const { points, pastCount } = buildChartSeries(
      history,
      calibrated,
      12,
      utc(2026, 5, 15),
      1,
      raw
    );
    expect(pastCount).toBe(1);
    expect(points[0].netWorth).toBe(200); // real snapshot, not raw's 999
  });

  it("a snapshot taken in today's period is last period's REAL close (F21)", () => {
    // After confirming this period the confirmation snapshot is the only row —
    // it must become the solid past (the confirmed values), not the forecast.
    const history = [snap(utc(2026, 5, 10), 999)];
    const proj = projectionOf([
      { date: utc(2026, 4, 1), netWorth: 3 }, // May (forecast — not used)
      { date: utc(2026, 5, 1), netWorth: 4 }, // Jun (today)
      { date: utc(2026, 6, 1), netWorth: 5 }, // Jul
    ]);
    const { points, pastCount } = buildChartSeries(history, proj, 12, utc(2026, 5, 15), 1, proj);
    expect(pastCount).toBe(1);
    expect(points.map((p) => p.netWorth)).toEqual([999, 4, 5]);
  });

  it("never draws the old forecast as the past once the plan is confirmed (F21)", () => {
    // simulatedPast is only passed while the plan has no confirmation; with
    // null, a confirmed plan and no snapshots shows no invented history.
    const calibrated = projectionOf([
      { date: utc(2026, 5, 1), netWorth: 5000 },
      { date: utc(2026, 6, 1), netWorth: 5500 },
    ]);
    const { points, pastCount } = buildChartSeries([], calibrated, 12, utc(2026, 5, 15), 1, null);
    expect(pastCount).toBe(0);
    expect(points.map((p) => p.netWorth)).toEqual([5000, 5500]);
  });

  it("spans exactly the horizon, so the End KPI (last point) and the chart agree (F17)", () => {
    // 36 monthly closes from Jan 2026, today Sep 20 2026, ONE snapshot. The
    // chart used to end Jul 2027 while the End KPI said May 2027.
    const proj = projectionOf(
      Array.from({ length: 36 }, (_, i) => ({ date: utc(2026, i, 1), netWorth: 1000 + 500 * i }))
    );
    const history = [snap(utc(2026, 8, 5), 4000)]; // taken in Sep → Aug close
    const s12 = buildChartSeries(history, proj, 12, utc(2026, 8, 20), 1, null);
    expect(s12.points).toHaveLength(12);
    expect(s12.pastCount).toBe(1);
    expect(s12.points.at(-1)!.date).toEqual(utc(2027, 6, 1)); // Jul 2027
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

describe("historyToClosePoints", () => {
  it("keeps the latest snapshot per period, dated at the period it closes", () => {
    const pts = historyToClosePoints(
      [snap(utc(2026, 8, 3), 1), snap(utc(2026, 8, 20), 2), snap(utc(2026, 9, 2), 3)],
      1
    );
    expect(pts.map((p) => [p.date.toISOString().slice(0, 10), p.netWorth])).toEqual([
      ["2026-08-01", 2],
      ["2026-09-01", 3],
    ]);
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
    const sep = rows.find((r) => r.month.getTime() === utc(2026, 8, 1).getTime())!;
    expect(sep.values).toEqual({ a: 9000, b: 14000 });
    expect(rows[boundary].month).toEqual(utc(2026, 8, 1));
    // Before B starts it has no value — the line stops, it doesn't drop to 0.
    const may = rows.find((r) => r.month.getTime() === utc(2026, 4, 1).getTime());
    expect(may).toBeUndefined(); // outside the 3-month past window
    const jun = rows.find((r) => r.month.getTime() === utc(2026, 5, 1).getTime())!;
    expect(jun.values.b).toBe(11000);
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
