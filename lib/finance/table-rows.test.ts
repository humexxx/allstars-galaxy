import { describe, expect, it } from "vitest";

import { densify } from "./table-rows";
import { projectPlan } from "./projection";
import type { FinancePlan, FinancePlanDebt, FinancePlanIncome, ProjectionMonth } from "@/types/finance";

const U = (y: number, m: number, d = 1): Date => new Date(Date.UTC(y, m - 1, d));

describe("F22: projection table", () => {
  it("keeps the first 12 rows then REAL Decembers (not every 12th row)", () => {
    // 40 rows from Jun 2026: the old rule kept rows 12, 24, 36 = May 2027,
    // May 2028, May 2029 and called them year-ends.
    const months = Array.from(
      { length: 40 },
      (_, i) => ({ monthOffset: i, date: U(2026, 6 + i) }) as unknown as ProjectionMonth
    );
    const kept = densify(months).map((m) => m.date.toISOString().slice(0, 7));
    expect(kept.slice(12)).toEqual(["2027-12", "2028-12", "2029-09"]);
    expect(kept.slice(0, 12)).toContain("2026-12");
  });

  it("'Debt pmt' (minimums + extra) makes a row reconcile with the savings column", () => {
    const plan = {
      id: "p",
      startMonth: U(2026, 9),
      monthsAhead: 3,
      confirmationDayOfMonth: 1,
      initialSavings: "1000",
      monthlySavingsRate: "0",
      surplusToDebtsPercent: "1",
      debtStrategy: "avalanche",
      autoInvestPercent: "0",
      initialInvestments: "0",
    } as unknown as FinancePlan;
    const income = {
      id: "i",
      name: "Pay",
      monthlyAmount: "3000",
      kind: "recurring",
      dayOfMonth: 1,
      recurrenceType: "monthly_day",
    } as unknown as FinancePlanIncome;
    const expense = { ...income, id: "e", monthlyAmount: "2000" } as never;
    const debt = {
      id: "d",
      name: "Loan",
      initialBalance: "10000",
      monthlyInterestRate: "0",
      monthlyPayment: "200",
      paymentType: "fixed",
      minPaymentPercent: "0",
      minPaymentFloor: "0",
      dayOfMonth: 20,
      recurrenceType: "monthly_day",
    } as unknown as FinancePlanDebt;
    const [row] = projectPlan(plan, [income], [expense], [debt]).months;
    // 3,000 − 2,000 − 200 minimum − 800 extra = 0 → savings stays at 1,000.
    expect(row.debtPayments).toBe(1000);
    expect(1000 + row.income - row.expenses - row.debtPayments - row.investmentsContribution + row.savingsInterest).toBe(
      row.savings
    );
  });
});
