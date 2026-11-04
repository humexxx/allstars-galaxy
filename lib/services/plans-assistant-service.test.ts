import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FinancePlanWithLines } from "@/types/finance";

const PLAN = "00000000-0000-4000-8000-0000000000a1";
const INCOME = "00000000-0000-4000-8000-0000000000b1";
const DEBT = "00000000-0000-4000-8000-0000000000c1";
const USER = "00000000-0000-4000-8000-0000000000aa";
const U = (y: number, m: number, d = 1): Date => new Date(Date.UTC(y, m - 1, d));

function storedPlan(): FinancePlanWithLines {
  return {
    id: PLAN,
    userId: USER,
    name: "Main",
    description: null,
    startMonth: U(2026, 11),
    monthsAhead: 24,
    initialSavings: "0.00",
    monthlySavingsRate: "0",
    includePortfolio: false,
    surplusToDebtsPercent: "1.0000",
    debtStrategy: "avalanche",
    autoInvestPercent: "0.0000",
    autoInvestMethodId: null,
    autoInvestCustomRate: null,
    initialInvestments: "0.00",
    confirmationDayOfMonth: 1,
    color: "var(--chart-1)",
    isMain: true,
    basedOnPlanId: null,
    balancesAsOf: "2026-11-01",
    createdAt: U(2026, 11),
    updatedAt: U(2026, 11),
    incomes: [
      {
        id: INCOME,
        planId: PLAN,
        name: "Salary",
        monthlyAmount: "3000.00",
        sortOrder: 0,
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
        owedToMe: false,
        createdAt: U(2026, 11),
      },
    ],
    expenses: [],
    debts: [
      {
        id: DEBT,
        planId: PLAN,
        name: "Card",
        initialBalance: "6000.00",
        monthlyInterestRate: "0.020000",
        monthlyPayment: "300.00",
        sortOrder: 0,
        paymentType: "fixed",
        minPaymentPercent: "0.0000",
        minPaymentFloor: "0.00",
        dayOfMonth: 15,
        recurrenceType: "monthly_day",
        weekOfMonth: null,
        dayOfWeek: null,
        intervalMonths: null,
        recurrenceStart: null,
        kind: null,
        createdAt: U(2026, 11),
      },
    ],
    overrides: [],
  } as unknown as FinancePlanWithLines;
}

vi.mock("./finance-plan-service", () => ({ listUserPlansWithLines: vi.fn() }));
vi.mock("./investment-method-service", () => ({ listInvestmentMethods: vi.fn(async () => []) }));
vi.mock("./finance-snapshot-service", async () => {
  const { projectPlan, projectStateAt } = await import("@/lib/finance/projection");
  return {
    // The real projection, without the confirmations a calibration would read.
    loadCalibratedView: vi.fn(async (plan: FinancePlanWithLines, _u: string, today: Date) => ({
      baseline: plan,
      options: {},
      projection: projectPlan(plan, plan.incomes, plan.expenses, plan.debts, {}),
      today: projectStateAt(plan, plan.incomes, plan.expenses, plan.debts, {}, today),
    })),
    restateOpeningBalances: vi.fn(async () => null),
  };
});
vi.mock("./finance-plan-operations", () => {
  class PlanOperationError extends Error {}
  return {
    PlanOperationError,
    createPlanOperation: vi.fn(async (_c, input: { name: string }) => ({ ...storedPlan(), id: "new-plan-id", name: input.name })),
    updatePlanOperation: vi.fn(async () => storedPlan()),
    setMainPlanOperation: vi.fn(),
    deletePlanOperation: vi.fn(),
    addIncomeOperation: vi.fn(),
    updateIncomeOperation: vi.fn(),
    deleteIncomeOperation: vi.fn(),
    addExpenseOperation: vi.fn(),
    updateExpenseOperation: vi.fn(),
    deleteExpenseOperation: vi.fn(),
    addDebtOperation: vi.fn(),
    updateDebtOperation: vi.fn(),
    deleteDebtOperation: vi.fn(),
  };
});

import { listUserPlansWithLines } from "./finance-plan-service";
import {
  addDebtOperation,
  addIncomeOperation,
  createPlanOperation,
  PlanOperationError,
  updateDebtOperation,
  updatePlanOperation,
} from "./finance-plan-operations";
import { applyPlanChanges, PlanChangeError, previewPlanChanges } from "./plans-assistant-service";

const c = { userId: USER, today: U(2026, 11, 3), timeZone: "UTC" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listUserPlansWithLines).mockImplementation(async () => [storedPlan()]);
});

describe("previewPlanChanges", () => {
  it("shows a payment raise and its effect on the debt-free date before anything is saved", async () => {
    // No surplus to debts, so the card is paid by its payment alone.
    vi.mocked(listUserPlansWithLines).mockImplementation(async () => [
      { ...storedPlan(), surplusToDebtsPercent: "0" },
    ]);
    const { lines, effects } = await previewPlanChanges(c, {
      summary: "Pay the card faster",
      changes: [{ op: "update_debt", planId: PLAN, debtId: DEBT, changes: { monthlyPayment: 1500 } }],
    });

    expect(lines).toEqual([
      expect.objectContaining({ action: "update", subject: "debt", title: "Card", details: ["monthlyPayment: 300.00 → 1500.00"] }),
    ]);
    expect(effects).toHaveLength(1);
    const [effect] = effects;
    expect(effect.planName).toBe("Main");
    expect(effect.before!.debtFree).not.toBe(effect.after.debtFree);
    expect(updateDebtOperation).not.toHaveBeenCalled();
  });

  it("builds a new plan and its lines through a ref", async () => {
    const { lines, effects } = await previewPlanChanges(c, {
      summary: "A lean plan",
      changes: [
        { op: "create_plan", ref: "lean", settings: { name: "Lean", savingsToday: 1000 } },
        { op: "add_income", planRef: "lean", income: { name: "Salary", monthlyAmount: 4000, dayOfMonth: 1 } },
        { op: "add_expense", planRef: "lean", expense: { name: "Rent", monthlyAmount: 1200, dayOfMonth: 2 } },
      ],
    });

    expect(lines.map((l) => `${l.action} ${l.subject} ${l.title}`)).toEqual([
      "create plan Lean",
      "add income Salary",
      "add expense Rent",
    ]);
    const lean = effects.find((e) => e.isNew)!;
    expect(lean.before).toBeNull();
    expect(lean.after.cashToday).toBeGreaterThanOrEqual(1000);
  });

  it("refuses a change the plan forms would refuse, saying which one", async () => {
    await expect(
      previewPlanChanges(c, {
        summary: "Broken",
        changes: [
          { op: "add_debt", planId: PLAN, debt: { name: "Loan", initialBalance: 1000, monthlyInterestRate: 0.02, monthlyPayment: 0 } },
        ],
      })
    ).rejects.toThrow(/changes\.0 \(add_debt\).*non-zero monthly payment/);
  });

  it("refuses an id the user does not have, and a ref nothing created", async () => {
    await expect(
      previewPlanChanges(c, {
        summary: "Nope",
        changes: [{ op: "remove_income", planId: PLAN, incomeId: DEBT }],
      })
    ).rejects.toBeInstanceOf(PlanChangeError);
    await expect(
      previewPlanChanges(c, {
        summary: "Nope",
        changes: [{ op: "add_income", planRef: "ghost", income: { name: "X", monthlyAmount: 1 } }],
      })
    ).rejects.toThrow(/ref "ghost"/);
  });

  it("refuses percentages written as whole numbers", async () => {
    await expect(
      previewPlanChanges(c, {
        summary: "Rates",
        changes: [{ op: "update_plan", planId: PLAN, settings: { surplusToDebtsPercent: 60 } }],
      })
    ).rejects.toThrow(/proposal is not valid/);
  });
});

describe("applyPlanChanges", () => {
  it("runs each change through its operation, in order, with patches merged over the stored row", async () => {
    await applyPlanChanges(c, {
      summary: "Faster",
      changes: [
        { op: "update_plan", planId: PLAN, settings: { debtStrategy: "snowball" } },
        { op: "update_debt", planId: PLAN, debtId: DEBT, changes: { monthlyPayment: 900 } },
      ],
    });

    // The whole plan goes to the update, so fields the patch left out keep their value.
    expect(updatePlanOperation).toHaveBeenCalledWith(
      c,
      expect.objectContaining({ id: PLAN, debtStrategy: "snowball", confirmationDayOfMonth: 1, monthsAhead: 24 })
    );
    expect(updateDebtOperation).toHaveBeenCalledWith(
      c,
      PLAN,
      expect.objectContaining({ id: DEBT, name: "Card", monthlyPayment: "900.00", initialBalance: "6000.00" })
    );
  });

  it("points lines at the plan the proposal created", async () => {
    const result = await applyPlanChanges(c, {
      summary: "New plan",
      changes: [
        { op: "create_plan", ref: "b", settings: { name: "Plan B" } },
        { op: "add_debt", planRef: "b", debt: { name: "Car", initialBalance: 9000, monthlyPayment: 400 } },
      ],
    });
    expect(createPlanOperation).toHaveBeenCalledWith(c, expect.objectContaining({ name: "Plan B", monthsAhead: 120 }));
    expect(addDebtOperation).toHaveBeenCalledWith(c, "new-plan-id", expect.objectContaining({ name: "Car" }));
    expect(result.createdPlans).toEqual([{ ref: "b", id: "new-plan-id", name: "Plan B" }]);
  });

  it("writes nothing when any change would be refused", async () => {
    await expect(
      applyPlanChanges(c, {
        summary: "Half bad",
        changes: [
          { op: "add_income", planId: PLAN, income: { name: "Bonus", monthlyAmount: 500, kind: "one_time" } },
        ],
      })
    ).rejects.toThrow(/One-time income requires a date/);
    expect(addIncomeOperation).not.toHaveBeenCalled();
  });

  it("says where it stopped when a write fails part-way", async () => {
    vi.mocked(updateDebtOperation).mockRejectedValueOnce(new PlanOperationError("That debt is gone"));
    await expect(
      applyPlanChanges(c, {
        summary: "Two steps",
        changes: [
          { op: "update_plan", planId: PLAN, settings: { name: "Renamed" } },
          { op: "update_debt", planId: PLAN, debtId: DEBT, changes: { monthlyPayment: 900 } },
        ],
      })
    ).rejects.toThrow("Saved the first 1 change, then stopped at changes.1 (update_debt): That debt is gone");
  });
});
