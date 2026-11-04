import { describe, expect, it } from "vitest";

import { buildPlanTimeline, type ChartPoint } from "./chart-series";
import { buildDashboardFigures } from "./dashboard";
import { projectPlan, projectStateAt } from "./projection";
import type { FinancePlan, FinancePlanExpense, FinancePlanIncome } from "@/types/finance";

const U = (y: number, m: number, d = 1): Date => new Date(Date.UTC(y, m - 1, d));

describe("F11: dashboard card figures", () => {
  const plan = {
    id: "p",
    startMonth: U(2026, 1),
    monthsAhead: 36,
    confirmationDayOfMonth: 1,
    initialSavings: "0",
    monthlySavingsRate: "0",
    surplusToDebtsPercent: "0",
    debtStrategy: "avalanche",
    autoInvestPercent: "0",
    initialInvestments: "0",
    includePortfolio: true,
  } as unknown as FinancePlan;
  const incomes = [
    { id: "i", name: "Pay", monthlyAmount: "3000", kind: "recurring", dayOfMonth: 25, recurrenceType: "monthly_day" },
  ] as unknown as FinancePlanIncome[];
  const expenses = [
    { id: "e", name: "Rent", monthlyAmount: "1000", kind: "recurring", dayOfMonth: 1, recurrenceType: "monthly_day" },
  ] as unknown as FinancePlanExpense[];
  const options = { portfolioValue: 20000, portfolioMonthlyGrowthRate: 0.01 };
  const now = U(2026, 9, 10);

  it("'now' is today's day-aware position with the portfolio growing, like the plan page", () => {
    const projection = projectPlan(plan, incomes, expenses, [], options);
    const today = projectStateAt(plan, incomes, expenses, [], options, now);
    const fig = buildDashboardFigures(projection, today);
    // Sep 10: salary (25th) not in yet; portfolio at its Sep opening
    // 20,000 × 1.01^8. The card used to show the Sep CLOSE with a flat
    // portfolio: $38,000.
    expect(fig.netWorth).toBeCloseTo(today!.netWorth, 6);
    expect(fig.netWorth).toBeCloseTo(8 * 2000 - 1000 + 20000 * 1.01 ** 8, 1);
    expect(fig.netWorth).not.toBeCloseTo(38000, 0);
  });

  it("the '12 mo' badge measures to the chart's LAST point", () => {
    const projection = projectPlan(plan, incomes, expenses, [], options);
    const today = projectStateAt(plan, incomes, expenses, [], options, now);
    const fig = buildDashboardFigures(projection, today);
    expect(fig.points).toHaveLength(13); // today + 12 closes
    expect(fig.deltaPeriods).toBe(12);
    expect(fig.delta).toBeCloseTo(fig.points.at(-1)!.netWorth - fig.netWorth, 0);
  });

  it("points keep cents and name their year, so the tooltip matches the tiles", () => {
    const projection = projectPlan(plan, incomes, expenses, [], options);
    const today = projectStateAt(plan, incomes, expenses, [], options, now);
    const fig = buildDashboardFigures(projection, today);
    // The first point IS the Net worth tile (it was rounded to whole dollars).
    expect(fig.points[0].netWorth).toBe(Math.round(today!.netWorth * 100) / 100);
    expect(fig.points[0]).toMatchObject({ month: "Now", label: "Today" });
    // Today is in Sep 2026; the 12th close is Sep 2027 — same month, so the
    // label carries the year.
    expect(fig.points[1].label).toBe("Oct 2026");
    expect(fig.points.at(-1)!.label).toBe("Sep 2027");
    expect(fig.points.at(-1)!.month).toBe("Sep");
  });

  it("money owed to you is a figure of its own, and the parts add up to net worth", () => {
    const withOwed = [
      ...incomes,
      { id: "o", name: "Padre", monthlyAmount: "2300", kind: "one_time", date: "2026-12-31", owedToMe: true },
    ] as unknown as FinancePlanIncome[];
    const projection = projectPlan(plan, withOwed, expenses, [], options);
    const today = projectStateAt(plan, withOwed, expenses, [], options, now);
    const fig = buildDashboardFigures(projection, today);

    expect(fig.receivables).toBe(2300);
    expect(fig.points[0].receivables).toBe(2300);
    // Repaid on Dec 31: by the last close it is cash, not owed.
    expect(fig.points.at(-1)!.receivables).toBe(0);
    // The portfolio rides in investments, or the tiles fall $20k short of
    // the net worth above them.
    expect(fig.investments).toBeCloseTo(today!.investments + today!.portfolioValue, 6);
    expect(fig.savings + fig.investments + fig.receivables - fig.debt).toBeCloseTo(fig.netWorth, 6);
    for (const p of fig.points) {
      expect(p.savings + p.investments + p.receivables - p.debt).toBeCloseTo(p.netWorth, 1);
    }
  });

  it("a plan that hasn't started shows its opening figures", () => {
    const later = { ...plan, startMonth: U(2027, 1), initialSavings: "5000" } as FinancePlan;
    const projection = projectPlan(later, incomes, expenses, [], {});
    const today = projectStateAt(later, incomes, expenses, [], {}, now);
    const fig = buildDashboardFigures(projection, today);
    expect(fig.status).toBe("before-start");
    expect(fig.savings).toBe(5000);
  });

  it("leads with the last three closed periods, then today, then the projection", () => {
    const projection = projectPlan(plan, incomes, expenses, [], options);
    const today = projectStateAt(plan, incomes, expenses, [], options, now);
    // Jan–Aug have closed by Sep 10; the plan page's timeline holds all eight.
    const timeline = buildPlanTimeline([], projection, now, 1, projection);
    const fig = buildDashboardFigures(
      projection,
      today,
      timeline.points.slice(0, timeline.todayIndex)
    );

    expect(fig.pastCount).toBe(3);
    expect(fig.points).toHaveLength(3 + 1 + 12);
    expect(fig.points.slice(0, 4).map((p) => p.label)).toEqual([
      "Jun 2026",
      "Jul 2026",
      "Aug 2026",
      "Today",
    ]);
    expect(fig.points[3].netWorth).toBe(Math.round(today!.netWorth * 100) / 100);
    // The past changes neither the figures nor the badge.
    expect(fig.deltaPeriods).toBe(12);
    expect(fig.delta).toBeCloseTo(fig.points.at(-1)!.netWorth - fig.netWorth, 0);
    // A projected close carries the portfolio in investments, like today.
    const aug = projection.months[7];
    expect(fig.points[2].investments).toBeCloseTo(aug.investments + aug.portfolioValue, 1);
  });

  it("splits a recorded snapshot into parts that add up to its net worth", () => {
    // A snapshot keeps investments without the portfolio, and the net worth
    // that includes it: the portfolio is the part nothing else explains.
    const snapshot: ChartPoint = {
      date: U(2026, 8),
      netWorth: 25000,
      savings: 3000,
      investments: 500,
      totalDebt: 1000,
      receivables: 2300,
    };
    const projection = projectPlan(plan, incomes, expenses, [], options);
    const today = projectStateAt(plan, incomes, expenses, [], options, now);
    const [aug] = buildDashboardFigures(projection, today, [snapshot]).points;

    expect(aug).toMatchObject({
      month: "Aug",
      savings: 3000,
      investments: 20700,
      receivables: 2300,
      debt: 1000,
      netWorth: 25000,
    });
  });

  it("a plan that hasn't started has no past to show", () => {
    const later = { ...plan, startMonth: U(2027, 1) } as FinancePlan;
    const projection = projectPlan(later, incomes, expenses, [], {});
    const today = projectStateAt(later, incomes, expenses, [], {}, now);
    const fig = buildDashboardFigures(projection, today, [{ date: U(2026, 8), netWorth: 1 }]);
    expect(fig.pastCount).toBe(0);
    expect(fig.points[0].month).toBe("Start");
  });
});
