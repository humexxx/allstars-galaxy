import { describe, expect, it } from "vitest";

import { owedAfter, owedRepayments } from "./receivables";
import type { FinancePlanIncome } from "@/types/finance";

const U = (y: number, m: number, d = 1): Date => new Date(Date.UTC(y, m - 1, d));

function owed(o: Partial<FinancePlanIncome> = {}): FinancePlanIncome {
  return {
    id: "owed",
    name: "Padre",
    monthlyAmount: "0",
    kind: "one_time",
    owedToMe: true,
    dayOfMonth: null,
    date: null,
    startDate: null,
    endDate: null,
    recurrenceType: "monthly_day",
    weekOfMonth: null,
    dayOfWeek: null,
    intervalMonths: null,
    recurrenceStart: null,
    ...o,
  } as unknown as FinancePlanIncome;
}

describe("owedRepayments", () => {
  it("lists only the lines marked as owed, oldest first", () => {
    const repayments = owedRepayments(
      {
        startMonth: U(2026, 10),
        incomes: [
          owed({ id: "sister", monthlyAmount: "600", date: "2026-12-31" }),
          owed({ id: "salary", owedToMe: false, kind: "recurring", monthlyAmount: "3000", dayOfMonth: 1 }),
          owed({ id: "father", monthlyAmount: "4000", date: "2026-11-30" }),
        ],
      },
      U(2026, 10)
    );

    expect(repayments).toEqual([
      { date: U(2026, 11, 30), amount: 4000 },
      { date: U(2026, 12, 31), amount: 600 },
    ]);
  });

  it("walks a recurring repayment to its own end date, however far past the plan", () => {
    // $6,000 every six months on the 31st, January 2027 to January 2030.
    const repayments = owedRepayments(
      {
        startMonth: U(2026, 10),
        incomes: [
          owed({
            kind: "recurring",
            monthlyAmount: "6000",
            recurrenceType: "every_n_months",
            intervalMonths: 6,
            dayOfMonth: 31,
            recurrenceStart: "2027-01-01",
            startDate: "2027-01-01",
            endDate: "2030-02-01",
          }),
        ],
      },
      U(2026, 10)
    );

    expect(repayments.map((r) => r.date)).toEqual([
      U(2027, 1, 31),
      U(2027, 7, 31),
      U(2028, 1, 31),
      U(2028, 7, 31),
      U(2029, 1, 31),
      U(2029, 7, 31),
      U(2030, 1, 31),
    ]);
    expect(repayments.reduce((s, r) => s + r.amount, 0)).toBe(42000);
  });

  it("leaves out repayments dated before the plan starts", () => {
    const repayments = owedRepayments(
      { startMonth: U(2026, 10), incomes: [owed({ monthlyAmount: "500", date: "2026-09-15" })] },
      U(2026, 10)
    );

    expect(repayments).toEqual([]);
  });

  it("cuts off a recurring receivable with no end date instead of owing it forever", () => {
    const repayments = owedRepayments(
      {
        startMonth: U(2026, 10),
        incomes: [owed({ kind: "recurring", monthlyAmount: "100", dayOfMonth: 1 })],
      },
      U(2026, 10)
    );

    expect(repayments.length).toBeGreaterThan(0);
    expect(repayments.length).toBeLessThan(400);
  });
});

describe("owedAfter", () => {
  const repayments = [
    { date: U(2026, 11, 30), amount: 4000 },
    { date: U(2026, 12, 31), amount: 600 },
  ];

  it("counts what lands after the day, and nothing that lands on or before it", () => {
    expect(owedAfter(repayments, U(2026, 10, 18))).toBe(4600);
    expect(owedAfter(repayments, U(2026, 11, 30))).toBe(600);
    expect(owedAfter(repayments, U(2026, 12, 31))).toBe(0);
  });
});
