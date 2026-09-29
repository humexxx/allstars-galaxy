import { describe, expect, it } from "vitest";

import { compareScenario } from "./scenario";
import { projectPlan } from "./projection";
import type { FinancePlan, FinancePlanDebt, FinancePlanIncome } from "@/types/finance";

const U = (y: number, m: number, d = 1): Date => new Date(Date.UTC(y, m - 1, d));

const plan = (o: Record<string, unknown> = {}): FinancePlan =>
  ({
    id: "p",
    startMonth: U(2026, 1),
    monthsAhead: 24,
    confirmationDayOfMonth: 1,
    initialSavings: "0",
    monthlySavingsRate: "0",
    surplusToDebtsPercent: "0",
    debtStrategy: "avalanche",
    autoInvestPercent: "0",
    initialInvestments: "0",
    ...o,
  }) as unknown as FinancePlan;
const pay = [
  { id: "i", name: "Pay", monthlyAmount: "3000", kind: "recurring", dayOfMonth: 1, recurrenceType: "monthly_day" },
] as unknown as FinancePlanIncome[];
const loan = (payment: string) =>
  [
    {
      id: "d",
      name: "Loan",
      initialBalance: "6000",
      monthlyInterestRate: "0",
      monthlyPayment: payment,
      paymentType: "fixed",
      minPaymentPercent: "0",
      minPaymentFloor: "0",
      dayOfMonth: 1,
      recurrenceType: "monthly_day",
    },
  ] as unknown as FinancePlanDebt[];

describe("F6: scenario vs base on one footing", () => {
  it("an unchanged scenario shows no difference (audit: −$10,500, '8 mo later')", () => {
    const base = projectPlan(plan(), pay, [], loan("500"));
    const scenario = projectPlan(plan({ id: "s" }), pay, [], loan("500"));
    const cmp = compareScenario(scenario, base, 1);
    expect(cmp.netWorthDelta).toBe(0);
    expect(cmp.debtFreeDeltaMonths).toBe(0);
  });

  it("compares at the SAME period — the earlier end — and payoff as dates", () => {
    const base = projectPlan(plan({ monthsAhead: 36 }), pay, [], loan("500"));
    const scenario = projectPlan(plan({ id: "s", monthsAhead: 24 }), pay, [], loan("1000"));
    const cmp = compareScenario(scenario, base, 1);
    expect(cmp.at).toEqual(U(2027, 12)); // the scenario's end, not each plan's own
    expect(cmp.netWorthDelta).toBe(0); // same cash either way once both are paid
    expect(cmp.scenarioDebtFreeDate).toEqual(U(2026, 6));
    expect(cmp.baseDebtFreeDate).toEqual(U(2026, 12));
    expect(cmp.debtFreeDeltaMonths).toBe(-6); // 6 months sooner
  });
});
