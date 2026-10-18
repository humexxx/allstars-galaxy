import { describe, expect, it } from "vitest";

import {
  MONTHLY_RATE_TOO_HIGH,
  SHARE_TOO_HIGH,
  createFinancePlanSchema,
  lineOverrideSchema,
  planDebtSchema,
} from "./finance";

describe("lineOverrideSchema: reschedules may cross months", () => {
  const move = (date: string) => ({
    parentSide: "expense" as const,
    parentId: "11111111-1111-4111-8111-111111111111",
    monthYear: "2026-03-01",
    action: "reschedule" as const,
    date,
  });

  it("accepts any day of the occurrence's month or the two either side", () => {
    for (const date of ["2026-03-15", "2026-04-02", "2026-01-01", "2026-05-31"]) {
      expect(lineOverrideSchema.safeParse(move(date)).success).toBe(true);
    }
  });

  it("refuses a move beyond the resolver's reach, with a message that says so", () => {
    const r = lineOverrideSchema.safeParse(move("2026-06-01"));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/at most 2 months/);
  });
});

describe("initial savings may be negative (a restated overdraft)", () => {
  it("accepts a negative opening savings figure", () => {
    const plan = { name: "P", startMonth: "2026-09", monthsAhead: 24, initialSavings: "-120.50" };
    expect(createFinancePlanSchema.safeParse(plan).success).toBe(true);
  });
});

// F23: monthly rates are decimals ("0.02 = 2% a month"). A percentage or an
// APR typed by habit ("24") meant 2,400% a month.
describe("rate bounds", () => {
  const debt = {
    name: "Card",
    initialBalance: "1000",
    monthlyPayment: "50",
    paymentType: "fixed" as const,
  };

  it("accepts a sane monthly rate and 100% exactly", () => {
    expect(planDebtSchema.safeParse({ ...debt, monthlyInterestRate: "0.02" }).success).toBe(true);
    expect(planDebtSchema.safeParse({ ...debt, monthlyInterestRate: "1" }).success).toBe(true);
  });

  it("refuses a rate above 100% a month with a message that says how to write it", () => {
    const r = planDebtSchema.safeParse({ ...debt, monthlyInterestRate: "24" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toContain(MONTHLY_RATE_TOO_HIGH);
  });

  it("refuses a minimum-payment share above 1", () => {
    const r = planDebtSchema.safeParse({
      ...debt,
      paymentType: "percent_of_balance",
      minPaymentPercent: "3",
    });
    expect(r.error?.issues.map((i) => i.message)).toContain(SHARE_TOO_HIGH);
  });

  it("bounds the plan's savings rate and shares too", () => {
    const plan = { name: "P", startMonth: "2026-09", monthsAhead: 24 };
    expect(createFinancePlanSchema.safeParse({ ...plan, monthlySavingsRate: "5" }).success).toBe(false);
    expect(createFinancePlanSchema.safeParse({ ...plan, surplusToDebtsPercent: "60" }).success).toBe(false);
    expect(createFinancePlanSchema.safeParse({ ...plan, monthlySavingsRate: "0.004" }).success).toBe(true);
  });
});
