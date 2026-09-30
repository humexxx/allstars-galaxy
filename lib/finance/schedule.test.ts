import { describe, expect, it } from "vitest";

import { projectPlan } from "./projection";
import { periodRangeFor } from "./period";
import {
  hitDayInMonth,
  monthKeyOf,
  monthYearOfKey,
  nthWeekdayOfMonth,
  planOccurrences,
  rescheduleWithinReach,
} from "./schedule";
import type {
  FinancePlan,
  FinancePlanDebt,
  FinancePlanExpense,
  FinancePlanIncome,
  FinancePlanLineOverride,
} from "@/types/finance";

const U = (y: number, m: number, d = 1): Date => new Date(Date.UTC(y, m - 1, d));
const iso = (d: Date): string => d.toISOString().slice(0, 10);

function line<T>(o: Record<string, unknown>): T {
  return {
    name: "Line",
    monthlyAmount: "0",
    kind: "recurring",
    dayOfMonth: 1,
    date: null,
    startDate: null,
    endDate: null,
    recurrenceType: "monthly_day",
    weekOfMonth: null,
    dayOfWeek: null,
    intervalMonths: null,
    recurrenceStart: null,
    ...o,
  } as unknown as T;
}
const ov = (o: Record<string, unknown>): FinancePlanLineOverride =>
  ({ id: "o", planId: "p", date: null, monthlyAmount: null, ...o }) as unknown as FinancePlanLineOverride;

describe("day resolution", () => {
  it("falls back to the LAST weekday when the month has no Nth one", () => {
    // Feb 2026: Tuesdays are 3, 10, 17, 24 — no 5th → the 24th.
    expect(nthWeekdayOfMonth(2026, 1, 5, 2)).toBe(24);
    expect(nthWeekdayOfMonth(2026, 8, 2, 2)).toBe(8); // Sep 2026: 1st is a Tuesday
  });

  it("every-N-months counts from recurrenceStart, else the plan's start month", () => {
    const q = { recurrenceType: "every_n_months" as const, intervalMonths: 3, dayOfMonth: 10, weekOfMonth: null, dayOfWeek: null, recurrenceStart: null };
    const planStartKey = 2026 * 12; // Jan 2026
    expect(hitDayInMonth(q, 2026, 3, planStartKey)).toBe(10); // Apr
    expect(hitDayInMonth(q, 2026, 4, planStartKey)).toBeNull(); // May
    expect(hitDayInMonth({ ...q, recurrenceStart: "2026-02-01" }, 2026, 4, planStartKey)).toBe(10);
  });
});

describe("planOccurrences", () => {
  const source = (o: Partial<{ incomes: FinancePlanIncome[]; expenses: FinancePlanExpense[]; debts: FinancePlanDebt[]; overrides: FinancePlanLineOverride[] }>) => ({
    startMonth: U(2026, 1),
    incomes: [],
    expenses: [],
    debts: [],
    overrides: [],
    ...o,
  });

  it("moves a rescheduled occurrence to its new day, even into another month", () => {
    const rent = line<FinancePlanExpense>({ id: "rent", name: "Rent", monthlyAmount: "1200", dayOfMonth: 30 });
    const occ = planOccurrences(
      source({
        expenses: [rent],
        overrides: [ov({ parentSide: "expense", parentId: "rent", monthYear: "2026-03-01", action: "reschedule", date: "2026-04-02" })],
      }),
      U(2026, 3),
      U(2026, 4, 30)
    );
    expect(occ.map((o) => [iso(o.date), o.moved])).toEqual([
      ["2026-04-02", true],
      ["2026-04-30", false],
    ]);
  });

  it("applies skip and amount overrides and the income window", () => {
    const salary = line<FinancePlanIncome>({ id: "sal", monthlyAmount: "3000", startDate: "2026-02-15" });
    const occ = planOccurrences(
      source({
        incomes: [salary],
        overrides: [
          ov({ parentSide: "income", parentId: "sal", monthYear: "2026-03-01", action: "skip" }),
          ov({ parentSide: "income", parentId: "sal", monthYear: "2026-04-01", action: "amount", monthlyAmount: "2500" }),
        ],
      }),
      U(2026, 1),
      U(2026, 4, 30)
    );
    // Jan/Feb 1 are before the start date, Mar is skipped, Apr is 2,500.
    expect(occ.map((o) => [iso(o.date), o.amount])).toEqual([["2026-04-01", 2500]]);
  });
});

describe("F16: breakdown lines add up to the period figure", () => {
  it("lists every occurrence the engine counts — overrides and double hits included", () => {
    const plan = {
      id: "p",
      startMonth: U(2026, 8),
      monthsAhead: 6,
      confirmationDayOfMonth: 10,
      initialSavings: "0",
      monthlySavingsRate: "0",
      surplusToDebtsPercent: "0",
      debtStrategy: "avalanche",
      autoInvestPercent: "0",
      initialInvestments: "0",
    } as unknown as FinancePlan;
    const incomes = [
      // 2nd Tuesday: the Aug 10 – Sep 9 period holds Aug 11 AND Sep 8.
      line<FinancePlanIncome>({ id: "w", monthlyAmount: "100", recurrenceType: "monthly_weekday", weekOfMonth: 2, dayOfWeek: 2 }),
      line<FinancePlanIncome>({ id: "sal", monthlyAmount: "3000", dayOfMonth: 15 }),
    ];
    const expenses = [
      line<FinancePlanExpense>({ id: "rent", monthlyAmount: "1200", dayOfMonth: 20 }),
      line<FinancePlanExpense>({ id: "gym", monthlyAmount: "50", dayOfMonth: 20 }),
    ];
    const overrides = [
      ov({ parentSide: "expense", parentId: "rent", monthYear: "2026-08-01", action: "amount", monthlyAmount: "900" }),
      ov({ parentSide: "expense", parentId: "gym", monthYear: "2026-08-01", action: "skip" }),
    ];
    const pr = projectPlan(plan, incomes, expenses, [], { overrides });
    const period = periodRangeFor(U(2026, 8, 20), 10);
    const month = pr.months.find((m) => iso(m.date) === iso(period.start))!;
    const occ = planOccurrences(
      { startMonth: plan.startMonth, incomes, expenses, debts: [], overrides },
      period.start,
      period.end
    );
    const sum = (side: string) =>
      occ.filter((o) => o.side === side).reduce((s, o) => s + (o.amount ?? 0), 0);
    expect(sum("income")).toBe(month.income);
    expect(month.income).toBe(3200); // 100 + 100 + 3,000
    expect(sum("expense")).toBe(month.expenses);
    expect(month.expenses).toBe(900); // rent at its override, gym skipped
  });
});

describe("cross-month 'just this month' moves", () => {
  const rent = line<FinancePlanExpense>({ id: "rent", name: "Rent", monthlyAmount: "1200", dayOfMonth: 30 });
  const marchToApril = ov({
    parentSide: "expense",
    parentId: "rent",
    monthYear: "2026-03-01",
    action: "reschedule",
    date: "2026-04-02",
  });

  it("keys a moved occurrence by its cadence month, beside the target month's own", () => {
    const occ = planOccurrences(
      { startMonth: U(2026, 1), incomes: [], expenses: [rent], debts: [], overrides: [marchToApril] },
      U(2026, 4),
      U(2026, 4, 30)
    );
    expect(occ.map((o) => [iso(o.date), monthYearOfKey(o.monthKey)])).toEqual([
      ["2026-04-02", "2026-03-01"],
      ["2026-04-30", "2026-04-01"],
    ]);
  });

  it("the projection moves the money with it: March pays no rent, April pays twice", () => {
    const plan = {
      id: "p",
      startMonth: U(2026, 1),
      monthsAhead: 6,
      confirmationDayOfMonth: 1,
      initialSavings: "5000",
      monthlySavingsRate: "0",
      surplusToDebtsPercent: "0",
      debtStrategy: "avalanche",
      autoInvestPercent: "0",
      initialInvestments: "0",
    } as unknown as FinancePlan;
    const pr = projectPlan(plan, [], [rent], [], { overrides: [marchToApril] });
    const byMonth = new Map(pr.months.map((m) => [iso(m.date).slice(0, 7), m.expenses]));
    expect(byMonth.get("2026-03")).toBe(0);
    expect(byMonth.get("2026-04")).toBe(2400);
    expect(byMonth.get("2026-05")).toBe(1200);
    expect(pr.months[5].savings).toBe(5000 - 6 * 1200); // nothing lost, nothing doubled
  });

  it("reach: any day of the month or the two either side of it", () => {
    expect(rescheduleWithinReach("2026-03-01", "2026-05-31")).toBe(true);
    expect(rescheduleWithinReach("2026-03-01", "2026-01-01")).toBe(true);
    expect(rescheduleWithinReach("2026-03-01", "2026-06-01")).toBe(false);
    expect(rescheduleWithinReach("2026-01-01", "2025-11-15")).toBe(true); // across a year
    expect(monthYearOfKey(monthKeyOf(U(2025, 12, 9)))).toBe("2025-12-01");
  });
});
