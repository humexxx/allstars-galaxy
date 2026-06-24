import { describe, expect, it, vi } from "vitest";

// The module pulls in `@/db` at the top, but `projectPlan` and
// `compareDebtStrategies` are pure functions that never touch it. Mocking the
// db boundary keeps the import-time side effects from breaking the suite.
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
    query: {},
  },
}));

import {
  compareDebtStrategies,
  projectPlan,
} from "./finance-plan-service";
import type {
  FinancePlan,
  FinancePlanDebt,
  FinancePlanExpense,
  FinancePlanIncome,
  FinancePlanLineOverride,
} from "@/types/finance";

// ---------- builders ----------
// Drizzle inferred types carry every column. The tests only need a subset of
// shape-compatible fields so we cast through `unknown` and centralise the
// defaults here. Anything not set on the override defaults to a "neutral"
// value (zeros, monthly_day cadence, no recurrence cap).

function buildPlan(overrides: Partial<FinancePlan> = {}): FinancePlan {
  const base = {
    id: "plan-1",
    userId: "user-1",
    name: "Test Plan",
    description: null,
    startMonth: new Date(Date.UTC(2026, 0, 1)),
    monthsAhead: 12,
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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  return base as unknown as FinancePlan;
}

function buildIncome(overrides: Partial<FinancePlanIncome> = {}): FinancePlanIncome {
  const base = {
    id: `income-${Math.random().toString(36).slice(2, 8)}`,
    planId: "plan-1",
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
    sortOrder: 0,
    createdAt: new Date(),
    ...overrides,
  };
  return base as unknown as FinancePlanIncome;
}

function buildExpense(overrides: Partial<FinancePlanExpense> = {}): FinancePlanExpense {
  const base = {
    id: `expense-${Math.random().toString(36).slice(2, 8)}`,
    planId: "plan-1",
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
    sortOrder: 0,
    createdAt: new Date(),
    ...overrides,
  };
  return base as unknown as FinancePlanExpense;
}

function buildDebt(overrides: Partial<FinancePlanDebt> = {}): FinancePlanDebt {
  const base = {
    id: `debt-${Math.random().toString(36).slice(2, 8)}`,
    planId: "plan-1",
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
    sortOrder: 0,
    createdAt: new Date(),
    ...overrides,
  };
  return base as unknown as FinancePlanDebt;
}

function buildOverride(
  overrides: Partial<FinancePlanLineOverride>
): FinancePlanLineOverride {
  const base = {
    id: `ov-${Math.random().toString(36).slice(2, 8)}`,
    planId: "plan-1",
    parentSide: "income",
    parentId: "",
    monthYear: "2026-01-01",
    action: "skip",
    date: null,
    monthlyAmount: null,
    createdAt: new Date(),
    ...overrides,
  };
  return base as unknown as FinancePlanLineOverride;
}

// Tolerant equality for compounded values — we round to cents every month so
// matchers can rely on 2 decimal precision.
const closeTo = (n: number, p = 2) => expect.closeTo(n, p);

// ---------- tests ----------

describe("projectPlan — empty plan", () => {
  it("returns monthsAhead months with zeros across the board", () => {
    const plan = buildPlan({ monthsAhead: 3 });
    const projection = projectPlan(plan, [], [], []);

    expect(projection.months).toHaveLength(3);
    expect(projection.endingSavings).toBe(0);
    expect(projection.endingInvestments).toBe(0);
    expect(projection.endingDebt).toBe(0);
    expect(projection.endingNetWorth).toBe(0);
    expect(projection.monthsToDebtFree).toBeNull();

    for (const m of projection.months) {
      expect(m.income).toBe(0);
      expect(m.expenses).toBe(0);
      expect(m.totalDebt).toBe(0);
      expect(m.cashFlow).toBe(0);
    }
  });

  it("month dates advance by one UTC month from plan.startMonth", () => {
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 0, 1)),
      monthsAhead: 3,
    });
    const projection = projectPlan(plan, [], [], []);

    expect(projection.months[0].date.getUTCMonth()).toBe(0);
    expect(projection.months[1].date.getUTCMonth()).toBe(1);
    expect(projection.months[2].date.getUTCMonth()).toBe(2);
  });
});

describe("projectPlan — savings and income", () => {
  it("accumulates recurring income into savings", () => {
    const plan = buildPlan({ monthsAhead: 3, initialSavings: "100" });
    const income = buildIncome({ monthlyAmount: "1000", kind: "recurring" });

    const projection = projectPlan(plan, [income], [], []);

    // No interest, no expenses → savings = 100 + 3 * 1000
    expect(projection.endingSavings).toBe(3100);
  });

  it("applies monthly savings interest compoundly", () => {
    const plan = buildPlan({
      monthsAhead: 2,
      initialSavings: "1000",
      monthlySavingsRate: "0.01", // 1% / month
    });

    const projection = projectPlan(plan, [], [], []);

    // m1: 1000 * 1.01 = 1010 (rounded). m2: 1010 * 1.01 = 1020.10
    expect(projection.months[0].savings).toBe(1010);
    expect(projection.months[1].savings).toBeCloseTo(1020.1, 2);
  });

  it("respects income startDate / endDate window", () => {
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 0, 1)),
      monthsAhead: 4,
    });
    // Income only active for Feb + Mar (months 1 and 2).
    const income = buildIncome({
      monthlyAmount: "500",
      startDate: "2026-02-01",
      endDate: "2026-03-31",
    });

    const projection = projectPlan(plan, [income], [], []);
    expect(projection.months[0].income).toBe(0);
    expect(projection.months[1].income).toBe(500);
    expect(projection.months[2].income).toBe(500);
    expect(projection.months[3].income).toBe(0);
  });

  it("skips a month when the recurring hit-day falls BEFORE startDate (same month)", () => {
    // Income kicks in 2026-06-15 but lands on day-1 of the month. June's hit
    // would be June 1 — already passed when the recurring becomes active, so
    // the projection must skip June and first count it on July 1.
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 5, 1)), // June 2026
      monthsAhead: 3,
    });
    const income = buildIncome({
      monthlyAmount: "1000",
      dayOfMonth: 1,
      startDate: "2026-06-15",
    });

    const projection = projectPlan(plan, [income], [], []);
    expect(projection.months[0].income).toBe(0); // June — skipped
    expect(projection.months[1].income).toBe(1000); // July 1 — first hit
    expect(projection.months[2].income).toBe(1000); // August 1
  });

  it("skips a month when the recurring hit-day falls AFTER endDate (same month)", () => {
    // Income paid on day-20 but the user marks it ended on June 15. June's
    // hit (the 20th) is after the end, so June must be 0; May still counts.
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 4, 1)), // May 2026
      monthsAhead: 3,
    });
    const income = buildIncome({
      monthlyAmount: "800",
      dayOfMonth: 20,
      endDate: "2026-06-15",
    });

    const projection = projectPlan(plan, [income], [], []);
    expect(projection.months[0].income).toBe(800); // May 20 — within window
    expect(projection.months[1].income).toBe(0); // June 20 — after end
    expect(projection.months[2].income).toBe(0); // July — after end
  });

  it("counts the month when startDate equals the hit-day (boundary inclusive)", () => {
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 5, 1)), // June 2026
      monthsAhead: 2,
    });
    const income = buildIncome({
      monthlyAmount: "1500",
      dayOfMonth: 15,
      startDate: "2026-06-15",
    });

    const projection = projectPlan(plan, [income], [], []);
    expect(projection.months[0].income).toBe(1500); // June 15 == startDate
    expect(projection.months[1].income).toBe(1500);
  });

  it("monthly_weekday respects day-precise startDate", () => {
    // 1st Friday of the month — June 2026 is Fri 2026-06-05, July is 2026-07-03.
    // startDate=2026-06-10 means June's 1st Friday already passed → skip June.
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 5, 1)),
      monthsAhead: 2,
    });
    const income = buildIncome({
      monthlyAmount: "500",
      recurrenceType: "monthly_weekday",
      weekOfMonth: 1,
      dayOfWeek: 5, // Friday
      dayOfMonth: null,
      startDate: "2026-06-10",
    });

    const projection = projectPlan(plan, [income], [], []);
    expect(projection.months[0].income).toBe(0); // June — Fri 5 < Jun 10
    expect(projection.months[1].income).toBe(500); // July — Fri 3 > Jun 10
  });

  it("one_time income hits exactly its target month", () => {
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 0, 1)),
      monthsAhead: 4,
    });
    const income = buildIncome({
      monthlyAmount: "2000",
      kind: "one_time",
      date: "2026-03-15",
    });

    const projection = projectPlan(plan, [income], [], []);
    expect(projection.months[0].income).toBe(0);
    expect(projection.months[1].income).toBe(0);
    expect(projection.months[2].income).toBe(2000);
    expect(projection.months[3].income).toBe(0);
  });
});

describe("projectPlan — debts", () => {
  it("accrues interest and reduces balance with a fixed payment", () => {
    const plan = buildPlan({ monthsAhead: 1 });
    const debt = buildDebt({
      initialBalance: "1000",
      monthlyInterestRate: "0.02", // 2% / month
      monthlyPayment: "200",
      paymentType: "fixed",
    });

    const projection = projectPlan(plan, [], [], [debt]);
    const m0 = projection.months[0];

    // Day-aware interest split: dayOfMonth=1 means the payment lands on day 1,
    // so NO interest accrues before it. Payment of 200 brings the balance to
    // 800; the remaining 31/31 of the month (full days-after factor of 1)
    // accrues 800 * 0.02 = 16 in interest. Ending balance 816.
    expect(m0.totalInterestAccrued).toBeCloseTo(16, 2);
    expect(m0.scheduledDebtPayments).toBeCloseTo(200, 2);
    expect(m0.totalDebt).toBeCloseTo(816, 2);
    expect(projection.totalInterestPaid).toBeCloseTo(16, 2);
  });

  it("caps payment at the outstanding balance and flags monthsToDebtFree", () => {
    const plan = buildPlan({ monthsAhead: 6 });
    const debt = buildDebt({
      initialBalance: "100",
      monthlyInterestRate: "0",
      monthlyPayment: "200", // pays more than owed
      paymentType: "fixed",
    });

    const projection = projectPlan(plan, [], [], [debt]);

    // m0 pays only the outstanding balance (100), not the full scheduled 200.
    expect(projection.months[0].scheduledDebtPayments).toBeCloseTo(100, 2);
    expect(projection.endingDebt).toBeCloseTo(0, 2);
    expect(projection.monthsToDebtFree).toBe(1);
  });

  it("uses min payment percent for percent_of_balance debts", () => {
    const plan = buildPlan({ monthsAhead: 1 });
    const debt = buildDebt({
      initialBalance: "1000",
      monthlyInterestRate: "0",
      paymentType: "percent_of_balance",
      minPaymentPercent: "0.03",
      minPaymentFloor: "25",
    });

    const projection = projectPlan(plan, [], [], [debt]);
    // 1000 * 0.03 = 30, above the floor (25), so payment is 30.
    expect(projection.months[0].scheduledDebtPayments).toBeCloseTo(30, 2);
  });

  it("applies the floor for small percent_of_balance debts", () => {
    const plan = buildPlan({ monthsAhead: 1 });
    const debt = buildDebt({
      initialBalance: "100",
      monthlyInterestRate: "0",
      paymentType: "percent_of_balance",
      minPaymentPercent: "0.02",
      minPaymentFloor: "25",
    });

    const projection = projectPlan(plan, [], [], [debt]);
    // 100 * 0.02 = 2, below floor 25 → 25 applied.
    expect(projection.months[0].scheduledDebtPayments).toBeCloseTo(25, 2);
  });
});

describe("projectPlan — surplus to debts + strategy ordering", () => {
  it("routes surplus to the highest-rate debt under avalanche", () => {
    const plan = buildPlan({
      monthsAhead: 1,
      surplusToDebtsPercent: "1", // 100% of surplus → extra debt
      debtStrategy: "avalanche",
    });
    const income = buildIncome({ monthlyAmount: "1000" });
    const lowRate = buildDebt({
      id: "low",
      initialBalance: "5000",
      monthlyInterestRate: "0.005",
      monthlyPayment: "0",
      paymentType: "fixed",
    });
    const highRate = buildDebt({
      id: "high",
      initialBalance: "5000",
      monthlyInterestRate: "0.02",
      monthlyPayment: "0",
      paymentType: "fixed",
    });

    const projection = projectPlan(plan, [income], [], [lowRate, highRate]);
    const month = projection.months[0];

    // Cash flow = 1000 (no expenses, no scheduled debt payments).
    // Avalanche → all 1000 of surplus goes to the high-rate debt first.
    const highEntry = month.debts.find((d) => d.debtId === "high")!;
    const lowEntry = month.debts.find((d) => d.debtId === "low")!;
    expect(highEntry.extraPayment).toBeCloseTo(1000, 2);
    expect(lowEntry.extraPayment).toBe(0);
  });

  it("routes surplus to the smallest balance under snowball", () => {
    const plan = buildPlan({
      monthsAhead: 1,
      surplusToDebtsPercent: "1",
      debtStrategy: "snowball",
    });
    const income = buildIncome({ monthlyAmount: "500" });
    const big = buildDebt({
      id: "big",
      initialBalance: "10000",
      monthlyInterestRate: "0.02",
    });
    const small = buildDebt({
      id: "small",
      initialBalance: "1000",
      monthlyInterestRate: "0.005",
    });

    const projection = projectPlan(plan, [income], [], [big, small]);
    const month = projection.months[0];

    // Snowball → small (1000) first. Cash flow = 500 → all to small.
    const smallEntry = month.debts.find((d) => d.debtId === "small")!;
    const bigEntry = month.debts.find((d) => d.debtId === "big")!;
    expect(smallEntry.extraPayment).toBeCloseTo(500, 2);
    expect(bigEntry.extraPayment).toBe(0);
  });

  it("skips extra payment entirely when strategy is 'none'", () => {
    const plan = buildPlan({
      monthsAhead: 1,
      surplusToDebtsPercent: "1",
      debtStrategy: "none",
    });
    const income = buildIncome({ monthlyAmount: "1000" });
    const debt = buildDebt({ initialBalance: "5000", monthlyInterestRate: "0.02" });

    const projection = projectPlan(plan, [income], [], [debt]);
    expect(projection.months[0].extraDebtPayments).toBe(0);
    // Surplus becomes savings instead.
    expect(projection.months[0].savings).toBeCloseTo(1000, 2);
  });
});

describe("projectPlan — auto-invest split", () => {
  it("splits leftover cash into investments + savings", () => {
    const plan = buildPlan({
      monthsAhead: 1,
      autoInvestPercent: "0.4",
    });
    const income = buildIncome({ monthlyAmount: "1000" });

    const projection = projectPlan(plan, [income], [], [], {
      autoInvestRate: 0,
    });
    const m0 = projection.months[0];

    // 40% of 1000 → investments. 60% → savings.
    expect(m0.investments).toBeCloseTo(400, 2);
    expect(m0.savings).toBeCloseTo(600, 2);
  });

  it("compounds investments using autoInvestRate", () => {
    const plan = buildPlan({
      monthsAhead: 2,
      autoInvestPercent: "1", // all leftover → invest
      initialInvestments: "1000",
    });

    // No income → no contribution, only compounding on initial 1000.
    const projection = projectPlan(plan, [], [], [], { autoInvestRate: 0.01 });
    // m1: 1000 * 1.01 = 1010. m2: 1010 * 1.01 = 1020.10
    expect(projection.months[0].investments).toBeCloseTo(1010, 2);
    expect(projection.months[1].investments).toBeCloseTo(1020.1, 2);
    // 10 (m1) + 10.1 (m2) = 20.1
    expect(projection.totalInvestmentsInterest).toBeCloseTo(20.1, 2);
  });
});

describe("projectPlan — overrides", () => {
  it("skip override removes recurring income for that month only", () => {
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 0, 1)),
      monthsAhead: 3,
    });
    const income = buildIncome({ id: "inc-skip", monthlyAmount: "500" });
    const override = buildOverride({
      parentSide: "income",
      parentId: "inc-skip",
      monthYear: "2026-02-01",
      action: "skip",
    });

    const projection = projectPlan(plan, [income], [], [], {
      overrides: [override],
    });

    expect(projection.months[0].income).toBe(500);
    expect(projection.months[1].income).toBe(0); // skipped
    expect(projection.months[2].income).toBe(500);
  });

  it("amount override swaps the amount for that month only", () => {
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 0, 1)),
      monthsAhead: 2,
    });
    const expense = buildExpense({ id: "exp-bump", monthlyAmount: "100" });
    const override = buildOverride({
      parentSide: "expense",
      parentId: "exp-bump",
      monthYear: "2026-02-01",
      action: "amount",
      monthlyAmount: "750",
    });

    const projection = projectPlan(plan, [], [expense], [], {
      overrides: [override],
    });

    expect(projection.months[0].expenses).toBe(100);
    expect(projection.months[1].expenses).toBe(750);
  });
});

describe("projectPlan — portfolio + clamping", () => {
  it("adds portfolio value to net worth but never earns interest", () => {
    const plan = buildPlan({
      monthsAhead: 1,
      initialSavings: "1000",
    });

    const projection = projectPlan(plan, [], [], [], { portfolioValue: 5000 });
    expect(projection.months[0].portfolioValue).toBe(5000);
    expect(projection.months[0].netWorth).toBeCloseTo(6000, 2);
  });

  it("treats negative portfolioValue as 0", () => {
    const plan = buildPlan({ monthsAhead: 1 });
    const projection = projectPlan(plan, [], [], [], { portfolioValue: -500 });
    expect(projection.months[0].portfolioValue).toBe(0);
  });

  it("carries a sustained deficit as negative cash instead of clipping at 0", () => {
    // Spends 1000/mo, earns 500/mo → −500 cash flow each month. The shortfall
    // must accumulate (savings goes negative) so net worth reflects it, rather
    // than silently clipping savings to 0 and over-stating net worth.
    const plan = buildPlan({ monthsAhead: 3, initialSavings: "100" });
    const income = buildIncome({ monthlyAmount: "500" });
    const expense = buildExpense({ monthlyAmount: "1000" });

    const projection = projectPlan(plan, [income], [expense], []);

    expect(projection.months[0].savings).toBeCloseTo(-400, 2);
    expect(projection.months[1].savings).toBeCloseTo(-900, 2);
    expect(projection.months[2].savings).toBeCloseTo(-1400, 2);
    expect(projection.endingNetWorth).toBeCloseTo(-1400, 2);
  });

  it("does not pay savings interest on a negative (overdraft) balance", () => {
    // Even with a savings rate set, a negative balance earns nothing.
    const plan = buildPlan({
      monthsAhead: 1,
      initialSavings: "0",
      monthlySavingsRate: "0.05",
    });
    const expense = buildExpense({ monthlyAmount: "200" });

    const projection = projectPlan(plan, [], [expense], []);
    // −200 carried, no interest applied on the negative balance.
    expect(projection.months[0].savings).toBeCloseTo(-200, 2);
    expect(projection.months[0].savingsInterest).toBe(0);
  });
});

// ---------- compareDebtStrategies ----------

describe("compareDebtStrategies", () => {
  it("returns a recommendation that matches the strategy with least interest", () => {
    const plan = buildPlan({
      monthsAhead: 24,
      surplusToDebtsPercent: "0.6",
    });
    const income = buildIncome({ monthlyAmount: "2000" });
    // Two debts with different rates so avalanche should usually win on interest.
    const cardA = buildDebt({
      id: "card-a",
      initialBalance: "3000",
      monthlyInterestRate: "0.02",
      monthlyPayment: "100",
    });
    const cardB = buildDebt({
      id: "card-b",
      initialBalance: "5000",
      monthlyInterestRate: "0.005",
      monthlyPayment: "100",
    });

    const comparison = compareDebtStrategies(plan, [income], [], [cardA, cardB]);

    // Recommendation = strategy with lowest totalInterestPaid (where applicable).
    const totals = {
      avalanche: comparison.avalanche.totalInterestPaid,
      snowball: comparison.snowball.totalInterestPaid,
      none: comparison.none.totalInterestPaid,
    };
    const min = Math.min(totals.avalanche, totals.snowball, totals.none);
    expect(totals[comparison.recommended]).toBeCloseTo(min, 1);
    expect(comparison.interestSaved).toBeGreaterThanOrEqual(0);
  });
});

describe("projectPlan — confirmation-day anchored periods", () => {
  it("emits period start dates that match the confirmation-day anchor", () => {
    // confirmationDayOfMonth=15 + startMonth=Jan 1 2026 means period 0
    // contains Jan 1, which lives in the Dec 15 2025 → Jan 14 2026 period.
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 0, 1)),
      monthsAhead: 3,
      confirmationDayOfMonth: 15,
    });
    const projection = projectPlan(plan, [], [], []);

    expect(projection.months[0].date).toEqual(new Date(Date.UTC(2025, 11, 15)));
    expect(projection.months[1].date).toEqual(new Date(Date.UTC(2026, 0, 15)));
    expect(projection.months[2].date).toEqual(new Date(Date.UTC(2026, 1, 15)));
  });

  it("attributes a recurring income to the period that contains its hit date", () => {
    // Anchor day 15 → periods run day-15 to day-14. Income hits day-1 of each
    // calendar month, so each hit (Jan 1, Feb 1, Mar 1, ...) lands in the
    // PREVIOUS period (Dec 15 → Jan 14, Jan 15 → Feb 14, Feb 15 → Mar 14).
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 0, 1)),
      monthsAhead: 4,
      confirmationDayOfMonth: 15,
    });
    const income = buildIncome({
      monthlyAmount: "1000",
      dayOfMonth: 1,
    });

    const projection = projectPlan(plan, [income], [], []);

    // Period 0 = Dec 15 2025 → Jan 14 2026 contains Jan 1's hit.
    expect(projection.months[0].income).toBe(1000);
    expect(projection.months[1].income).toBe(1000); // Feb 1
    expect(projection.months[2].income).toBe(1000); // Mar 1
    expect(projection.months[3].income).toBe(1000); // Apr 1
  });

  it("places a one-time income in the period that contains its date", () => {
    // confirmationDayOfMonth=15 → period 1 = Feb 15 → Mar 14.
    // A one-time income on Feb 20 must land in period 1, not period 0.
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 1, 1)),
      monthsAhead: 3,
      confirmationDayOfMonth: 15,
    });
    const income = buildIncome({
      monthlyAmount: "500",
      kind: "one_time",
      date: "2026-02-20",
    });

    const projection = projectPlan(plan, [income], [], []);

    // Period 0 = Jan 15 → Feb 14 (no hit), Period 1 = Feb 15 → Mar 14 (hit).
    expect(projection.months[0].income).toBe(0);
    expect(projection.months[1].income).toBe(500);
    expect(projection.months[2].income).toBe(0);
  });

  it("falls back to calendar months when confirmationDayOfMonth is 0", () => {
    // Disabled (0) collapses to anchor-day=1 internally, which is identical
    // to the calendar-month behaviour the engine had before periods.
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 0, 1)),
      monthsAhead: 3,
      confirmationDayOfMonth: 0,
    });
    const projection = projectPlan(plan, [], [], []);

    expect(projection.months[0].date).toEqual(new Date(Date.UTC(2026, 0, 1)));
    expect(projection.months[1].date).toEqual(new Date(Date.UTC(2026, 1, 1)));
    expect(projection.months[2].date).toEqual(new Date(Date.UTC(2026, 2, 1)));
  });
});

// Sanity check that closeTo helper compiles when used.
describe("internal helper", () => {
  it("compiles closeTo without runtime use", () => {
    expect(closeTo(1.0)).toBeDefined();
  });
});
