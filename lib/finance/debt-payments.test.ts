import { describe, expect, it } from "vitest";

import { debtChipAmount, projectedDebtPayments } from "./debt-payments";
import { projectPlan } from "./projection";
import type { FinancePlan, FinancePlanDebt } from "@/types/finance";

const U = (y: number, m: number, d = 1): Date => new Date(Date.UTC(y, m - 1, d));

const plan = {
  id: "p",
  startMonth: U(2026, 1),
  monthsAhead: 6,
  confirmationDayOfMonth: 1,
  initialSavings: "0",
  monthlySavingsRate: "0",
  surplusToDebtsPercent: "0",
  debtStrategy: "none",
  autoInvestPercent: "0",
  initialInvestments: "0",
} as unknown as FinancePlan;

function debt(o: Record<string, unknown>): FinancePlanDebt {
  return {
    id: "d",
    name: "Debt",
    initialBalance: "0",
    monthlyInterestRate: "0",
    monthlyPayment: "0",
    paymentType: "fixed",
    minPaymentPercent: "0",
    minPaymentFloor: "0",
    dayOfMonth: 5,
    recurrenceType: "monthly_day",
    weekOfMonth: null,
    dayOfWeek: null,
    intervalMonths: null,
    recurrenceStart: null,
    ...o,
  } as unknown as FinancePlanDebt;
}

describe("F15: calendar debt chips show what the projection paid", () => {
  it("caps the last payment and stops after payoff ($300 at $200: 200, 100, nothing)", () => {
    const d = debt({ initialBalance: "300", monthlyPayment: "200" });
    const lookup = projectedDebtPayments([projectPlan(plan, [], [], [d])]);
    expect(debtChipAmount(d, U(2026, 1, 5), lookup)).toBe(200);
    expect(debtChipAmount(d, U(2026, 2, 5), lookup)).toBe(100);
    expect(debtChipAmount(d, U(2026, 3, 5), lookup)).toBeNull(); // was 200 forever
  });

  it("uses the percent-of-balance minimum, not the floor ($5,000 at 3% → $150, not $25)", () => {
    const card = debt({
      initialBalance: "5000",
      paymentType: "percent_of_balance",
      minPaymentPercent: "0.03",
      minPaymentFloor: "25",
    });
    const lookup = projectedDebtPayments([projectPlan(plan, [], [], [card])]);
    expect(debtChipAmount(card, U(2026, 1, 5), lookup)).toBe(150);
    expect(debtChipAmount(card, U(2026, 2, 5), lookup)).toBeCloseTo(145.5, 6);
  });

  it("falls back to the configured payment outside the projections' span", () => {
    const d = debt({ initialBalance: "300", monthlyPayment: "200" });
    const lookup = projectedDebtPayments([projectPlan(plan, [], [], [d])]);
    expect(debtChipAmount(d, U(2025, 12, 5), lookup)).toBe(200);
  });
});
