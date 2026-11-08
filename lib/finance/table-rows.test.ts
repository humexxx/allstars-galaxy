import { describe, expect, it } from "vitest";

import { rowStepFor, sampleRows } from "./table-rows";
import { projectPlan } from "./projection";
import type { FinancePlan, FinancePlanDebt, FinancePlanIncome } from "@/types/finance";

const U = (y: number, m: number, d = 1): Date => new Date(Date.UTC(y, m - 1, d));

describe("F22: projection table", () => {
  it("spaces the rows by horizon: monthly to a year, then 2, 6 and 12 months apart", () => {
    expect([6, 12, 24, 60, 120].map(rowStepFor)).toEqual([1, 1, 2, 6, 12]);
  });

  it("keeps the rows leading in, then today's period and every step after it", () => {
    const months = Array.from({ length: 26 }, (_, i) => i);
    // One closed period (index 0), today's at 1, two years every other month.
    expect(sampleRows(months, 1, 2)).toEqual([0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25]);
    expect(sampleRows(months.slice(0, 5), 1, 1)).toEqual([0, 1, 2, 3, 4]);
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
