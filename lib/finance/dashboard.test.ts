import { describe, expect, it } from "vitest";

import { buildPlanTimeline, type ChartPoint } from "./chart-series";
import { buildDashboardFigures, changeBaseline, checkpointLabels, dashboardGoal } from "./dashboard";
import { projectPlan, projectStateAt } from "./projection";
import type {
  FinancePlan,
  FinancePlanDebt,
  FinancePlanExpense,
  FinancePlanIncome,
} from "@/types/finance";

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
    // Today's own period closes first (today used to stand in for it); the
    // labels carry the year, as the 12th close is a year on.
    expect(fig.points[1].label).toBe("Sep 30, 2026");
    expect(fig.points.at(-1)!.label).toBe("Aug 31, 2027");
    expect(fig.points.at(-1)!.month).toBe("Aug");
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
      "Jun 30, 2026",
      "Jul 31, 2026",
      "Aug 31, 2026",
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
    // Dated Aug 1, the checkpoint is July's close.
    const [jul] = buildDashboardFigures(projection, today, [snapshot]).points;

    expect(jul).toMatchObject({
      month: "Jul",
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

describe("dashboard card: period names and the headline goal", () => {
  const plan = {
    id: "p",
    startMonth: U(2026, 9),
    monthsAhead: 24,
    confirmationDayOfMonth: 5,
    initialSavings: "0",
    monthlySavingsRate: "0",
    surplusToDebtsPercent: "1",
    debtStrategy: "avalanche",
    autoInvestPercent: "0",
    initialInvestments: "0",
    includePortfolio: false,
  } as unknown as FinancePlan;
  const incomes = [
    { id: "i", name: "Pay", monthlyAmount: "5000", kind: "recurring", dayOfMonth: 1, recurrenceType: "monthly_day" },
  ] as unknown as FinancePlanIncome[];
  const debts = [
    {
      id: "d", name: "Card", initialBalance: "60000", monthlyInterestRate: "0", monthlyPayment: "500",
      paymentType: "fixed", minPaymentPercent: "0", minPaymentFloor: "0", dayOfMonth: 4,
      recurrenceType: "monthly_day",
    },
  ] as unknown as FinancePlanDebt[];
  const now = U(2026, 11, 3);

  it("names each point after the month its period closes in", () => {
    // Anchored on the 5th, the period of Nov 3 runs Oct 5 – Nov 4: the next
    // close is its own, the next day.
    const projection = projectPlan(plan, incomes, [], debts, {});
    const today = projectStateAt(plan, incomes, [], debts, {}, now);
    const fig = buildDashboardFigures(projection, today, [], 5);
    expect(fig.points[0].month).toBe("Now");
    expect(fig.points[1]).toMatchObject({ month: "Nov", label: "Nov 4, 2026" });
  });

  it("heads with the debt-free date while there is debt", () => {
    const projection = projectPlan(plan, incomes, [], debts, {});
    const today = projectStateAt(plan, incomes, [], debts, {}, now);
    expect(dashboardGoal(projection, today, [0, 10_000], 5, now)).toMatchObject({
      kind: "debt-free",
      text: expect.stringMatching(/^Debt-free in \d+ mo · /),
    });
  });

  it("heads with the next net-worth milestone once the debt is gone", () => {
    const projection = projectPlan(plan, incomes, [], [], {});
    const today = projectStateAt(plan, incomes, [], [], {}, now);
    const goal = dashboardGoal(projection, today, [0, 50_000, 10_000], 5, now);
    expect(goal).toMatchObject({ kind: "milestone", text: expect.stringMatching(/^\$50k net worth · /) });
  });

  it("says nothing when no milestone is reached within the horizon", () => {
    const projection = projectPlan(plan, incomes, [], [], {});
    const today = projectStateAt(plan, incomes, [], [], {}, now);
    expect(dashboardGoal(projection, today, [10_000_000], 5, now)).toBeNull();
  });
});

describe("dashboard card: movement days between the closes", () => {
  const plan = {
    id: "p",
    startMonth: U(2026, 7),
    monthsAhead: 24,
    confirmationDayOfMonth: 5,
    initialSavings: "0",
    monthlySavingsRate: "0",
    surplusToDebtsPercent: "1",
    debtStrategy: "avalanche",
    autoInvestPercent: "0",
    initialInvestments: "0",
    includePortfolio: false,
  } as unknown as FinancePlan;
  const incomes = [
    { id: "i", name: "Pay", monthlyAmount: "5000", kind: "recurring", dayOfMonth: 1, recurrenceType: "monthly_day" },
  ] as unknown as FinancePlanIncome[];
  const now = U(2026, 11, 3);
  const close = (m: number, netWorth: number): ChartPoint => ({ date: U(2026, m, 5), netWorth, savings: 0, totalDebt: 0, receivables: 0 });
  const moved = (m: number, d: number, netWorth: number): ChartPoint => ({ date: U(2026, m, d), netWorth, savings: netWorth, totalDebt: 0, receivables: 0 });

  it("draws movement days at their own dates, between the closes, before today", () => {
    const projection = projectPlan(plan, incomes, [], [], {});
    const today = projectStateAt(plan, incomes, [], [], {}, now);
    const fig = buildDashboardFigures(
      projection,
      today,
      [close(8, 100), close(9, 200), close(10, 300)],
      5,
      [moved(6, 1, 1), moved(10, 1, 250), moved(11, 1, 350), moved(11, 3, 400)]
    );
    const past = fig.points.slice(0, fig.pastCount);
    // The June movement is older than the first close shown; today's own day
    // is the Today point.
    expect(past.map((p) => p.label)).toEqual([
      "Aug 4, 2026",
      "Sep 4, 2026",
      "Oct 1, 2026",
      "Oct 4, 2026",
      "Nov 1, 2026",
    ]);
    expect(past.every((p, i) => i === 0 || p.time > past[i - 1].time)).toBe(true);
    expect(fig.points[fig.pastCount]).toMatchObject({ label: "Today", tick: true });
    expect(past.filter((p) => p.tick)).toHaveLength(1);
  });
});

describe("changeBaseline: what net worth's change is measured from", () => {
  // Checkpoints on the 5th, each the balance on its day (see `ChartPoint`).
  const closes = [
    { date: U(2026, 9, 5), netWorth: 10_000 }, // closes Sep 4
    { date: U(2026, 10, 5), netWorth: 14_000 }, // the position on Oct 5, confirmed
    { date: U(2026, 11, 5), netWorth: 23_600 }, // Nov 5, projected
  ];
  const time = (p: (typeof closes)[number]): number => checkpointLabels(p.date).time;
  const label = (p: (typeof closes)[number]): { month: string; label: string } => checkpointLabels(p.date);

  it("measures from the user's last confirmation, not the projected close after it", () => {
    const from = changeBaseline(closes, time, label, "2026-10-05");
    expect(from?.point.netWorth).toBe(14_000);
    expect(from?.since).toEqual({ month: "Oct 5", label: "your confirmation of Oct 5, 2026" });
  });

  it("falls back to the last close with no confirmation, or one before the chart", () => {
    expect(changeBaseline(closes, time, label, null)?.point.netWorth).toBe(23_600);
    expect(changeBaseline(closes, time, label, "2026-01-05")?.since.month).toBe("Nov");
    expect(changeBaseline([], time, label, null)).toBeNull();
  });
});
