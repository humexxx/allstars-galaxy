import { describe, expect, it } from "vitest";

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
    const fig = buildDashboardFigures(projection, today, 1, now);
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
    const fig = buildDashboardFigures(projection, today, 1, now);
    expect(fig.points).toHaveLength(13); // today + 12 closes
    expect(fig.deltaPeriods).toBe(12);
    expect(fig.delta).toBeCloseTo(fig.points.at(-1)!.netWorth - fig.netWorth, 0);
  });

  it("a plan that hasn't started shows its opening figures", () => {
    const later = { ...plan, startMonth: U(2027, 1), initialSavings: "5000" } as FinancePlan;
    const projection = projectPlan(later, incomes, expenses, [], {});
    const today = projectStateAt(later, incomes, expenses, [], {}, now);
    const fig = buildDashboardFigures(projection, today, 1, now);
    expect(fig.status).toBe("before-start");
    expect(fig.savings).toBe(5000);
  });
});
