import { describe, expect, it } from "vitest";

import { compareDebtStrategies, projectPlan, projectStateAt } from "./projection";
import type {
  FinancePlan,
  FinancePlanDebt,
  FinancePlanExpense,
  FinancePlanIncome,
  FinancePlanLineOverride,
} from "@/types/finance";

// Regression tests for the finance calculation audit. The numbers are the
// audit's worked examples; each expectation is the CORRECT value.

const U = (y: number, m: number, d = 1): Date => new Date(Date.UTC(y, m - 1, d));
let seq = 0;

function plan(o: Partial<FinancePlan> = {}): FinancePlan {
  return {
    id: "plan-1",
    userId: "u",
    name: "P",
    description: null,
    startMonth: U(2026, 1),
    monthsAhead: 24,
    initialSavings: "0",
    monthlySavingsRate: "0",
    includePortfolio: false,
    surplusToDebtsPercent: "0",
    debtStrategy: "avalanche",
    confirmationDayOfMonth: 1,
    autoInvestPercent: "0",
    autoInvestMethodId: null,
    initialInvestments: "0",
    color: "var(--chart-1)",
    ...o,
  } as unknown as FinancePlan;
}
function inc(o: Partial<FinancePlanIncome> = {}): FinancePlanIncome {
  return {
    id: `inc-${++seq}`,
    name: "Income",
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
  } as unknown as FinancePlanIncome;
}
function exp(o: Partial<FinancePlanExpense> = {}): FinancePlanExpense {
  return {
    id: `exp-${++seq}`,
    name: "Expense",
    monthlyAmount: "0",
    kind: "recurring",
    dayOfMonth: 1,
    date: null,
    recurrenceType: "monthly_day",
    weekOfMonth: null,
    dayOfWeek: null,
    intervalMonths: null,
    recurrenceStart: null,
    ...o,
  } as unknown as FinancePlanExpense;
}
function debt(o: Partial<FinancePlanDebt> = {}): FinancePlanDebt {
  return {
    id: `debt-${++seq}`,
    name: "Debt",
    initialBalance: "0",
    monthlyInterestRate: "0",
    monthlyPayment: "0",
    paymentType: "fixed",
    minPaymentPercent: "0",
    minPaymentFloor: "0",
    dayOfMonth: 1,
    recurrenceType: "monthly_day",
    weekOfMonth: null,
    dayOfWeek: null,
    intervalMonths: null,
    recurrenceStart: null,
    ...o,
  } as unknown as FinancePlanDebt;
}
function override(o: Partial<FinancePlanLineOverride>): FinancePlanLineOverride {
  return {
    id: `ov-${++seq}`,
    planId: "plan-1",
    parentSide: "income",
    parentId: "",
    monthYear: "2026-01-01",
    action: "skip",
    date: null,
    monthlyAmount: null,
    ...o,
  } as unknown as FinancePlanLineOverride;
}

describe("today's position (projectStateAt)", () => {
  it("F1: the period-end extra payment is not in today's debt (−$7,000, not −$4,200)", () => {
    const p = plan({ startMonth: U(2026, 9), monthsAhead: 12, surplusToDebtsPercent: "1" });
    const incomes = [inc({ monthlyAmount: "3000", dayOfMonth: 1 })];
    const debts = [debt({ initialBalance: "10000", monthlyPayment: "200", dayOfMonth: 5 })];
    const today = projectStateAt(p, incomes, [], debts, {}, U(2026, 9, 10))!;
    expect(today.status).toBe("in-range");
    expect(today.savings).toBe(2800);
    expect(today.totalDebt).toBe(9800);
    expect(today.netWorth).toBe(-7000);
    // …and the period close agrees: nothing "drops" between today and the close.
    const close = projectPlan(p, incomes, [], debts).months[0];
    expect(close.netWorth).toBe(-7000);
    expect(close.totalDebt).toBe(7000);
  });

  it("accrues debt interest up to today (balance 10,000 at 2%, no payment yet on day 15 of 30)", () => {
    const p = plan({ startMonth: U(2026, 9), monthsAhead: 3 });
    const debts = [
      debt({ initialBalance: "10000", monthlyInterestRate: "0.02", monthlyPayment: "500", dayOfMonth: 20 }),
    ];
    const today = projectStateAt(p, [], [], debts, {}, U(2026, 9, 15))!;
    // 15 of 30 days elapsed: 10,000 × 2% × 15/30 = 100.
    expect(today.totalDebt).toBeCloseTo(10100, 6);
  });

  it("F27: a plan that starts later reports its opening figures, flagged before-start", () => {
    const p = plan({ startMonth: U(2027, 1), monthsAhead: 12, initialSavings: "5000" });
    const s = projectStateAt(p, [inc({ monthlyAmount: "3000" })], [], [], {}, U(2026, 9, 29))!;
    expect(s.status).toBe("before-start");
    expect(s.netWorth).toBe(5000);
    expect(s.periodStart).toEqual(U(2027, 1));
  });

  it("F20: past the horizon it is the LAST close, not the second to last", () => {
    const p = plan({ startMonth: U(2026, 1), monthsAhead: 12 });
    const incomes = [inc({ monthlyAmount: "100" })];
    const s = projectStateAt(p, incomes, [], [], {}, U(2027, 3, 1))!;
    expect(s.status).toBe("after-end");
    expect(s.netWorth).toBe(1200);
  });
});

describe("F2 / F19: the as-of day", () => {
  it("a plan created mid-period doesn't re-apply what the typed balance already holds", () => {
    // Created Sep 29 with $5,000 typed; salary on the 1st, rent on the 5th.
    const p = plan({ startMonth: U(2026, 9), monthsAhead: 12, initialSavings: "5000" });
    const incomes = [inc({ monthlyAmount: "3000", dayOfMonth: 1 })];
    const expenses = [exp({ monthlyAmount: "1200", dayOfMonth: 5 })];
    const opts = { asOf: U(2026, 9, 29) };
    const today = projectStateAt(p, incomes, expenses, [], opts, U(2026, 9, 29))!;
    expect(today.netWorth).toBe(5000); // was 6,800
    const pr = projectPlan(p, incomes, expenses, [], opts);
    expect(pr.months[0].savings).toBe(5000);
    // The period's own totals still describe the whole period…
    expect(pr.months[0].income).toBe(3000);
    expect(pr.months[0].preAsOfCashFlow).toBe(1800);
    // …and from October on every period adds its +1,800.
    expect(pr.months[1].savings).toBe(6800);
  });

  it("a late confirmation no longer carries a permanent +$1,500 (11,500 on Sep 29)", () => {
    const p = plan({ startMonth: U(2026, 9), monthsAhead: 12, initialSavings: "11500" });
    const incomes = [inc({ monthlyAmount: "3000", dayOfMonth: 1 })];
    const expenses = [exp({ monthlyAmount: "1500", dayOfMonth: 3 })];
    const pr = projectPlan(p, incomes, expenses, [], { asOf: U(2026, 9, 29) });
    expect(pr.months[0].savings).toBe(11500); // was 13,000
    expect(pr.months[11].savings).toBe(28000); // was 29,500
  });

  it("prorates the as-of period's rates by the days that remain", () => {
    // 30-day September, as of the 20th: 10 days remain. Savings 1,000 at 3%
    // earn 1,000 × 3% × 10/30 = 10; a debt of 1,000 at 3% accrues 10.
    const p = plan({
      startMonth: U(2026, 9),
      monthsAhead: 2,
      initialSavings: "1000",
      monthlySavingsRate: "0.03",
    });
    const debts = [debt({ initialBalance: "1000", monthlyInterestRate: "0.03", monthlyPayment: "0" })];
    // (a 0 fixed payment with interest is refused by the schema — the engine
    // still has to accrue it correctly)
    const pr = projectPlan(p, [], [], debts, { asOf: U(2026, 9, 20) });
    expect(pr.months[0].savingsInterest).toBeCloseTo(10, 6);
    expect(pr.months[0].totalInterestAccrued).toBeCloseTo(10, 6);
  });

  it("ignores an as-of day outside the first period (a backdated plan)", () => {
    const p = plan({ startMonth: U(2026, 1), monthsAhead: 3 });
    const incomes = [inc({ monthlyAmount: "100" })];
    const a = projectPlan(p, incomes, [], [], { asOf: U(2026, 9, 29) });
    const b = projectPlan(p, incomes, [], []);
    expect(a.months.map((m) => m.savings)).toEqual(b.months.map((m) => m.savings));
  });
});

describe("F5: two payment dates in one period both pay", () => {
  it("'2nd Tuesday' with anchor 10: 12 payments in 12 periods, like the income", () => {
    const p = plan({ startMonth: U(2026, 8), confirmationDayOfMonth: 10, monthsAhead: 12 });
    const wk = { recurrenceType: "monthly_weekday" as const, weekOfMonth: 2, dayOfWeek: 2 };
    const pr = projectPlan(
      p,
      [inc({ monthlyAmount: "100", ...wk })],
      [],
      [debt({ initialBalance: "100000", monthlyPayment: "100", ...wk })]
    );
    const incomes = pr.months.map((m) => m.income);
    const paid = pr.months.map((m) => m.scheduledDebtPayments);
    expect(incomes).toEqual([100, 200, 0, 100, 200, 0, 200, 100, 0, 100, 200, 0]);
    expect(paid).toEqual(incomes); // was 8 payments: 1,1,0,1,1,0,…
  });

  it("monthly_day: exactly one hit per period for every anchor × day (incl. leap Feb)", () => {
    let bad = 0;
    for (let a = 0; a <= 28; a++) {
      for (let d = 1; d <= 31; d++) {
        const pr = projectPlan(
          plan({ startMonth: U(2027, 11), monthsAhead: 18, confirmationDayOfMonth: a }),
          [inc({ monthlyAmount: "1", dayOfMonth: d })],
          [],
          [debt({ initialBalance: "1000000", monthlyPayment: "1", dayOfMonth: d })]
        );
        for (const m of pr.months) if (m.income !== 1 || m.scheduledDebtPayments !== 1) bad++;
      }
    }
    expect(bad).toBe(0);
  });
});

describe("F14: a moved occurrence moves in the projection too", () => {
  it("salary moved from Feb 14 to Feb 16 (anchor 15) changes period", () => {
    const p = plan({ startMonth: U(2026, 1), confirmationDayOfMonth: 15, monthsAhead: 4 });
    const salary = inc({ id: "sal", monthlyAmount: "3000", dayOfMonth: 14 });
    const ov = override({
      parentSide: "income",
      parentId: "sal",
      monthYear: "2026-02-01",
      action: "reschedule",
      date: "2026-02-16",
    });
    const pr = projectPlan(p, [salary], [], [], { overrides: [ov] });
    expect(pr.months.map((m) => [m.date.toISOString().slice(0, 10), m.income])).toEqual([
      ["2025-12-15", 3000],
      ["2026-01-15", 0], // was 3,000
      ["2026-02-15", 6000], // was 3,000 (Feb 16 + Mar 14)
      ["2026-03-15", 3000],
    ]);
  });

  it("a debt payment moved out of its natural period is paid in the new one", () => {
    const p = plan({ startMonth: U(2026, 1), confirmationDayOfMonth: 15, monthsAhead: 3 });
    const d = debt({ id: "dd", initialBalance: "1000", monthlyPayment: "100", dayOfMonth: 14 });
    const ov = override({
      parentSide: "debt",
      parentId: "dd",
      monthYear: "2026-02-01",
      action: "reschedule",
      date: "2026-02-20",
    });
    const pr = projectPlan(p, [], [], [d], { overrides: [ov] });
    expect(pr.months.map((m) => m.scheduledDebtPayments)).toEqual([100, 0, 200]);
    expect(pr.months[2].debts[0].payments.map((x) => x.date.toISOString().slice(0, 10))).toEqual([
      "2026-02-20",
      "2026-03-14",
    ]);
  });

  it("skipping a month still works (no payment, full interest)", () => {
    const p = plan({ startMonth: U(2026, 1), monthsAhead: 2 });
    const d = debt({ id: "sk", initialBalance: "1000", monthlyInterestRate: "0.01", monthlyPayment: "100" });
    const ov = override({ parentSide: "debt", parentId: "sk", monthYear: "2026-01-01", action: "skip" });
    const pr = projectPlan(p, [], [], [d], { overrides: [ov] });
    expect(pr.months[0].scheduledDebtPayments).toBe(0);
    expect(pr.months[0].totalDebt).toBeCloseTo(1010, 6);
  });
});

describe("F23: surplus routing", () => {
  it("rolls the FULL freed minimum over (textbook snowball): extra 200, not 150", () => {
    const small = debt({ id: "a", initialBalance: "500", monthlyPayment: "100" });
    const big = debt({ id: "b", initialBalance: "10000", monthlyInterestRate: "0.01", monthlyPayment: "200" });
    const p = plan({ monthsAhead: 60, surplusToDebtsPercent: "0.5", debtStrategy: "snowball" });
    const pr = projectPlan(p, [inc({ monthlyAmount: "1000" })], [exp({ monthlyAmount: "500" })], [small, big]);
    expect(pr.months.slice(0, 4).map((m) => m.extraDebtPayments)).toEqual([100, 100, 100, 200]);
  });

  it("with 0% surplus, avalanche/snowball still roll freed minimums; 'none' doesn't", () => {
    const small = debt({ id: "a", initialBalance: "200", monthlyPayment: "100" });
    const big = debt({ id: "b", initialBalance: "5000", monthlyPayment: "100" });
    const base = { monthsAhead: 12, surplusToDebtsPercent: "0" };
    const incomes = [inc({ monthlyAmount: "1000" })];
    const roll = projectPlan(plan({ ...base, debtStrategy: "avalanche" }), incomes, [], [small, big]);
    const none = projectPlan(plan({ ...base, debtStrategy: "none" }), incomes, [], [small, big]);
    expect(roll.months[2].extraDebtPayments).toBe(100);
    expect(none.months[2].extraDebtPayments).toBe(0);
  });

  it("never prepays debt or invests while savings are overdrawn", () => {
    const d = debt({ initialBalance: "5000", monthlyPayment: "100" });
    const p = plan({ monthsAhead: 3, surplusToDebtsPercent: "1", autoInvestPercent: "0.5" });
    const pr = projectPlan(
      p,
      [inc({ monthlyAmount: "1000" })],
      [exp({ monthlyAmount: "500" }), exp({ kind: "one_time", date: "2026-01-02", monthlyAmount: "3000" })],
      [d]
    );
    // Jan ends at −2,600; Feb's +400 only brings it to −2,200: nothing routed.
    expect(pr.months[1].extraDebtPayments).toBe(0);
    expect(pr.months[1].investmentsContribution).toBe(0);
    expect(pr.months[1].savings).toBe(-2200);
  });

  it("routes only what is on hand when the overdraft is partly repaid", () => {
    const d = debt({ initialBalance: "5000", monthlyPayment: "0" });
    const p = plan({ monthsAhead: 1, initialSavings: "-300", surplusToDebtsPercent: "1" });
    const pr = projectPlan(p, [inc({ monthlyAmount: "1000" })], [], [d]);
    // 1,000 in, −300 opening → 700 on hand: extra capped at 700 (not 1,000).
    expect(pr.months[0].extraDebtPayments).toBe(700);
    expect(pr.months[0].savings).toBe(0);
  });

  it("savings interest accrues on the OPENING balance, not the same-period deposit", () => {
    const p = plan({ monthsAhead: 2, initialSavings: "1000", monthlySavingsRate: "0.01" });
    const pr = projectPlan(p, [inc({ monthlyAmount: "1000" })], [], []);
    expect(pr.months[0].savingsInterest).toBeCloseTo(10, 6); // was 20
    expect(pr.months[0].savings).toBe(2010);
    expect(pr.months[1].savingsInterest).toBeCloseTo(20.1, 6);
  });
});

describe("F7 / F28: strategy comparison", () => {
  it("uses the plan's own surplus share: the picker row matches the chart (46 mo, not 16)", () => {
    const d = debt({ initialBalance: "10000", monthlyInterestRate: "0.015", monthlyPayment: "300" });
    const p = plan({ monthsAhead: 120, surplusToDebtsPercent: "0", debtStrategy: "avalanche" });
    const incomes = [inc({ monthlyAmount: "3000" })];
    const expenses = [exp({ monthlyAmount: "2000" })];
    const chart = projectPlan(p, incomes, expenses, [d]);
    const cmp = compareDebtStrategies(p, incomes, expenses, [d]);
    expect(chart.monthsToDebtFree).toBe(46);
    expect(cmp.avalanche.monthsToDebtFree).toBe(46);
    expect(cmp.avalanche.totalInterestPaid).toBeCloseTo(chart.totalInterestPaid, 6);
    expect(cmp.surplusToDebtsPercent).toBe(0);
  });

  it("includes portfolio growth like the chart ($62,486.72, not $49,000)", () => {
    const d = debt({ initialBalance: "1000", monthlyPayment: "100" });
    const p = plan({ monthsAhead: 24, includePortfolio: true });
    const opts = { portfolioValue: 50000, portfolioMonthlyGrowthRate: 0.01 };
    const chart = projectPlan(p, [], [], [d], opts);
    const cmp = compareDebtStrategies(p, [], [], [d], opts);
    expect(chart.endingNetWorth).toBeCloseTo(62486.72, 2);
    expect(cmp.avalanche.endingNetWorth).toBeCloseTo(chart.endingNetWorth, 6);
  });
});

describe("payments record", () => {
  it("records each payment at the amount paid, capped at the balance", () => {
    const pr = projectPlan(
      plan({ monthsAhead: 3 }),
      [inc({ monthlyAmount: "1000" })],
      [],
      [debt({ initialBalance: "300", monthlyPayment: "200", dayOfMonth: 5 })]
    );
    expect(pr.months.map((m) => m.debts[0].payments.map((p) => p.amount))).toEqual([
      [200],
      [100],
      [],
    ]);
  });
});

describe("period 0 never starts before the plan's start date (anchor > 1)", () => {
  // A January plan anchored on the 15th: period 0 runs Dec 15 – Jan 14, but
  // the plan starts on Jan 1, so nothing dated Dec 15–31 is applied.
  const p = plan({ startMonth: U(2026, 1), monthsAhead: 3, confirmationDayOfMonth: 15, initialSavings: "1000" });
  const incomes = [
    inc({ monthlyAmount: "500", dayOfMonth: 20 }), // Dec 20 (before start), Jan 20, Feb 20
    inc({ monthlyAmount: "100", dayOfMonth: 5 }), // Jan 5 (after start), Feb 5, Mar 5
  ];

  it("applies no Dec 15–31 flows, whatever the as-of", () => {
    for (const asOf of [null, U(2025, 11, 1), U(2025, 12, 16), U(2026, 9, 29)]) {
      const first = projectPlan(p, incomes, [], [], { asOf }).months[0];
      expect(first.date).toEqual(U(2025, 12, 15));
      expect(first.preAsOfCashFlow).toBe(500);
      expect(first.savings).toBe(1100); // 1,000 + Jan 5's 100, never Dec 20's 500
    }
  });

  it("still honours an as-of inside the plan's part of period 0", () => {
    const first = projectPlan(p, incomes, [], [], { asOf: U(2026, 1, 10) }).months[0];
    expect(first.savings).toBe(1000); // Jan 5 is already in the balance too
  });

  it("today's position before the start date is the opening, flagged before-start", () => {
    const s = projectStateAt(p, incomes, [], [], {}, U(2025, 12, 25))!;
    expect(s.status).toBe("before-start");
    expect(s.savings).toBe(1000);
    const jan = projectStateAt(p, incomes, [], [], {}, U(2026, 1, 6))!;
    expect(jan.status).toBe("in-range");
    expect(jan.savings).toBe(1100);
  });
});
