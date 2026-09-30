import { describe, expect, it } from "vitest";

import { changesOpeningBalances, restateOpeningSet } from "./opening-balances";
import type { FinancePlanWithLines, TodayState } from "@/types/finance";

const plan = {
  initialSavings: "1000",
  initialInvestments: "250.5",
  debts: [
    { id: "a", initialBalance: "5000" },
    { id: "b", initialBalance: "300" },
  ],
} as unknown as FinancePlanWithLines;

const projected: TodayState = {
  status: "in-range",
  date: new Date(Date.UTC(2026, 8, 30)),
  periodIndex: 8,
  periodStart: new Date(Date.UTC(2026, 8, 1)),
  savings: 4321.456,
  investments: 610,
  portfolioValue: 0,
  totalDebt: 4100,
  netWorth: 0,
  debts: [
    { debtId: "a", name: "A", balance: 4100 },
    { debtId: "b", name: "B", balance: -0.004 },
  ],
};

describe("changesOpeningBalances", () => {
  it("is false for a no-op edit (same values, cent precision, zero-balance debt added)", () => {
    expect(changesOpeningBalances(plan, {})).toBe(false);
    expect(
      changesOpeningBalances(plan, {
        savings: "1000.00",
        investments: "250.50",
        debts: { a: "5000", b: "300.00" },
        addedDebtBalance: "0",
      })
    ).toBe(false);
  });

  it("is true when any opening balance actually changes", () => {
    expect(changesOpeningBalances(plan, { savings: "1000.01" })).toBe(true);
    expect(changesOpeningBalances(plan, { investments: "0" })).toBe(true);
    expect(changesOpeningBalances(plan, { debts: { b: "299" } })).toBe(true);
    expect(changesOpeningBalances(plan, { addedDebtBalance: "10" })).toBe(true);
  });

  it("ignores an edit for a debt that is not on the plan", () => {
    expect(changesOpeningBalances(plan, { debts: { zzz: "1" } })).toBe(false);
  });
});

describe("restateOpeningSet", () => {
  const today = new Date(Date.UTC(2026, 8, 30));

  it("bumps the as-of to today and keeps the edited figure", () => {
    const set = restateOpeningSet(plan, projected, { savings: "500" }, today);
    expect(set.balancesAsOf).toBe("2026-09-30");
    expect(set.initialSavings).toBe("500.00");
  });

  it("rolls every other figure forward to where the plan stands today", () => {
    const set = restateOpeningSet(plan, projected, { debts: { a: "4000" } }, today);
    expect(set.initialSavings).toBe("4321.46");
    expect(set.initialInvestments).toBe("610.00");
    expect(set.debtBalances).toEqual({ a: "4000.00", b: "0.00" });
  });

  it("keeps a negative (overdraft) savings figure", () => {
    const set = restateOpeningSet(plan, { ...projected, savings: -120 }, {}, today);
    expect(set.initialSavings).toBe("-120.00");
  });
});
