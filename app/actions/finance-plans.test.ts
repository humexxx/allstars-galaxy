import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/impersonation", () => ({
  requireEffectiveContext: vi.fn(),
  logImpersonatedMutation: vi.fn(),
}));

vi.mock("@/lib/services/finance-snapshot-service", () => ({
  restateOpeningBalances: vi.fn(async () => null),
}));

vi.mock("@/lib/utils/request-today", () => ({
  getRequestTimeZone: vi.fn(async () => "UTC"),
}));

vi.mock("@/lib/services/finance-plan-service", () => ({
  getPlanWithLines: vi.fn(async () => null),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  deletePlan: vi.fn(),
  clonePlan: vi.fn(),
  addIncome: vi.fn(),
  updateIncome: vi.fn(),
  deleteIncome: vi.fn(),
  addExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
  addDebt: vi.fn(),
  updateDebt: vi.fn(),
  deleteDebt: vi.fn(),
  upsertLineOverride: vi.fn(),
  deleteLineOverride: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { restateOpeningBalances } from "@/lib/services/finance-snapshot-service";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import {
  addDebt,
  addIncome,
  clonePlan,
  createPlan,
  deleteIncome,
  getPlanWithLines,
  deleteLineOverride,
  deletePlan,
  updateDebt,
  updatePlan,
  upsertLineOverride,
} from "@/lib/services/finance-plan-service";

import {
  addPlanDebtAction,
  addPlanIncomeAction,
  clonePlanAction,
  createPlanAction,
  deleteLineOverrideAction,
  deletePlanAction,
  deletePlanIncomeAction,
  updatePlanAction,
  updatePlanDebtAction,
  upsertLineOverrideAction,
} from "./finance-plans";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const PLAN_ID = "11111111-1111-4111-8111-111111111111";
const ROW_ID = "22222222-2222-4222-8222-222222222222";
const SECONDARY_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.mocked(requireEffectiveContext).mockResolvedValue({
    realUser: { id: USER_ID } as never,
    realRole: "user",
    impersonatedUser: null,
    effectiveUserId: USER_ID,
    isImpersonating: false,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------- createPlanAction ----------

describe("createPlanAction", () => {
  const validInput = {
    name: "My Plan",
    description: null,
    startMonth: new Date("2026-01-01"),
    monthsAhead: 24,
    initialSavings: "1000",
    monthlySavingsRate: "0.1",
    includePortfolio: false,
    surplusToDebtsPercent: "0",
    debtStrategy: "avalanche" as const,
    autoInvestPercent: "0",
    autoInvestMethodId: null,
    initialInvestments: "0",
    confirmationDayOfMonth: 1,
    color: "var(--chart-1)",
  };

  it("creates the plan, logs, and revalidates on happy path", async () => {
    const plan = { id: PLAN_ID, name: "My Plan" };
    vi.mocked(createPlan).mockResolvedValueOnce(plan as never);

    const result = await createPlanAction(validInput as never);

    expect(result).toEqual({ success: true, data: plan });
    expect(createPlan).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ name: "My Plan" }),
      expect.any(Date)
    );
    expect(logImpersonatedMutation).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/portal/plans", "layout");
  });

  it("returns Invalid input and skips the service when name is missing", async () => {
    const result = await createPlanAction({ ...validInput, name: "" } as unknown as never);

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(createPlan).not.toHaveBeenCalled();
    expect(logImpersonatedMutation).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// ---------- updatePlanAction ----------

describe("updatePlanAction", () => {
  const validInput = {
    id: PLAN_ID,
    name: "Updated Plan",
    description: null,
    startMonth: new Date("2026-01-01"),
    monthsAhead: 24,
    initialSavings: "0",
    monthlySavingsRate: "0",
    includePortfolio: false,
    surplusToDebtsPercent: "0",
    debtStrategy: "avalanche" as const,
    autoInvestPercent: "0",
    autoInvestMethodId: null,
    initialInvestments: "0",
    confirmationDayOfMonth: 1,
    color: "var(--chart-1)",
  };

  it("updates plan, logs, and revalidates the list + plan path", async () => {
    const plan = { id: PLAN_ID, name: "Updated Plan" };
    vi.mocked(updatePlan).mockResolvedValueOnce(plan as never);

    const result = await updatePlanAction(validInput as never);

    expect(result).toEqual({ success: true, data: plan });
    expect(updatePlan).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ id: PLAN_ID }), null);
    expect(logImpersonatedMutation).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/portal/plans", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/portal");
  });

  it("restates the opening balances when the form changes them", async () => {
    const stored = { id: PLAN_ID, initialSavings: "0", initialInvestments: "0", debts: [] };
    const restatement = {
      initialSavings: "500.00",
      initialInvestments: "0.00",
      debtBalances: {},
      balancesAsOf: "2026-09-30",
      syncConfirmationId: null,
    };
    vi.mocked(getPlanWithLines).mockResolvedValueOnce(stored as never);
    vi.mocked(restateOpeningBalances).mockResolvedValueOnce(restatement);
    vi.mocked(updatePlan).mockResolvedValueOnce({ id: PLAN_ID } as never);

    await updatePlanAction({ ...validInput, initialSavings: "500" } as never);

    expect(restateOpeningBalances).toHaveBeenCalledWith(
      stored,
      USER_ID,
      expect.any(Date),
      { savings: "500", investments: "0" },
      "UTC"
    );
    expect(updatePlan).toHaveBeenCalledWith(USER_ID, expect.anything(), restatement);
  });

  it("returns Invalid input when id is not a UUID", async () => {
    const result = await updatePlanAction({ ...validInput, id: "not-a-uuid" } as unknown as never);

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(updatePlan).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// ---------- deletePlanAction ----------

describe("deletePlanAction", () => {
  it("deletes when planId is a valid UUID", async () => {
    vi.mocked(deletePlan).mockResolvedValueOnce(undefined as never);

    const result = await deletePlanAction(PLAN_ID);

    expect(result).toEqual({ success: true });
    expect(deletePlan).toHaveBeenCalledWith(USER_ID, PLAN_ID);
    expect(logImpersonatedMutation).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/portal/plans", "layout");
  });

  it("returns Invalid id and skips the service when planId is not a UUID", async () => {
    const result = await deletePlanAction("nope");

    expect(result).toEqual({ success: false, error: "Invalid id" });
    expect(deletePlan).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// ---------- clonePlanAction ----------

describe("clonePlanAction", () => {
  it("clones when id and name are valid", async () => {
    const plan = { id: SECONDARY_ID, name: "Clone" };
    vi.mocked(clonePlan).mockResolvedValueOnce(plan as never);

    const result = await clonePlanAction(PLAN_ID, "Clone");

    expect(result).toEqual({ success: true, data: plan });
    expect(clonePlan).toHaveBeenCalledWith(USER_ID, PLAN_ID, "Clone");
    expect(logImpersonatedMutation).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/portal/plans", "layout");
  });

  it("rejects invalid id", async () => {
    const result = await clonePlanAction("bad-id", "Clone");

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(clonePlan).not.toHaveBeenCalled();
  });

  it("rejects too-long names (>120 chars)", async () => {
    const longName = "a".repeat(200);
    const result = await clonePlanAction(PLAN_ID, longName);

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(clonePlan).not.toHaveBeenCalled();
  });
});

// ---------- addPlanDebtAction ----------

describe("addPlanDebtAction", () => {
  const validDebt = {
    name: "Car Loan",
    initialBalance: "10000",
    monthlyInterestRate: "0.01",
    monthlyPayment: "200",
    paymentType: "fixed" as const,
    minPaymentPercent: "0",
    minPaymentFloor: "0",
    dayOfMonth: 1,
    recurrenceType: "monthly_day" as const,
  };

  it("adds the debt on happy path", async () => {
    const row = { id: ROW_ID };
    vi.mocked(addDebt).mockResolvedValueOnce(row as never);

    const result = await addPlanDebtAction(PLAN_ID, validDebt as never);

    expect(result).toEqual({ success: true, data: row });
    expect(addDebt).toHaveBeenCalledWith(
      USER_ID,
      PLAN_ID,
      expect.objectContaining({ name: "Car Loan" }),
      null
    );
    expect(logImpersonatedMutation).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/portal/plans", "layout");
  });

  it("rejects fixed-payment debt with interest>0 and payment=0", async () => {
    const bad = { ...validDebt, monthlyPayment: "0", monthlyInterestRate: "0.05" };

    const result = await addPlanDebtAction(PLAN_ID, bad as never);

    expect(result).toEqual({
      success: false,
      error: "Fixed-payment debt with interest needs a non-zero monthly payment.",
    });
    expect(addDebt).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("allows percent_of_balance debt with payment=0 (no guard)", async () => {
    const percentDebt = {
      ...validDebt,
      paymentType: "percent_of_balance" as const,
      monthlyPayment: "0",
      monthlyInterestRate: "0.05",
      minPaymentPercent: "0.02",
      minPaymentFloor: "50",
    };
    const row = { id: ROW_ID };
    vi.mocked(addDebt).mockResolvedValueOnce(row as never);

    const result = await addPlanDebtAction(PLAN_ID, percentDebt as never);

    expect(result).toEqual({ success: true, data: row });
    expect(addDebt).toHaveBeenCalled();
  });
});

// ---------- updatePlanDebtAction ----------

describe("updatePlanDebtAction", () => {
  const validDebt = {
    id: ROW_ID,
    name: "Car Loan",
    initialBalance: "10000",
    monthlyInterestRate: "0.01",
    monthlyPayment: "200",
    paymentType: "fixed" as const,
    minPaymentPercent: "0",
    minPaymentFloor: "0",
    dayOfMonth: 1,
    recurrenceType: "monthly_day" as const,
  };

  it("updates the debt on happy path", async () => {
    const row = { id: ROW_ID };
    vi.mocked(updateDebt).mockResolvedValueOnce(row as never);

    const result = await updatePlanDebtAction(PLAN_ID, validDebt as never);

    expect(result).toEqual({ success: true, data: row });
    expect(updateDebt).toHaveBeenCalledWith(
      USER_ID,
      PLAN_ID,
      expect.objectContaining({ id: ROW_ID }),
      null
    );
    expect(logImpersonatedMutation).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/portal/plans", "layout");
  });

  it("rejects fixed-payment debt with interest>0 and payment=0", async () => {
    const bad = { ...validDebt, monthlyPayment: "0", monthlyInterestRate: "0.05" };

    const result = await updatePlanDebtAction(PLAN_ID, bad as never);

    expect(result).toEqual({
      success: false,
      error: "Fixed-payment debt with interest needs a non-zero monthly payment.",
    });
    expect(updateDebt).not.toHaveBeenCalled();
  });

  it("returns Action failed when the debt is not on this plan", async () => {
    vi.mocked(updateDebt).mockRejectedValueOnce(new Error("Debt not found on this plan"));

    const result = await updatePlanDebtAction(PLAN_ID, validDebt as never);

    expect(result).toEqual({ success: false, error: "Action failed" });
    expect(logImpersonatedMutation).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("allows percent_of_balance debt with payment=0", async () => {
    const percentDebt = {
      ...validDebt,
      paymentType: "percent_of_balance" as const,
      monthlyPayment: "0",
      monthlyInterestRate: "0.05",
    };
    const row = { id: ROW_ID };
    vi.mocked(updateDebt).mockResolvedValueOnce(row as never);

    const result = await updatePlanDebtAction(PLAN_ID, percentDebt as never);

    expect(result).toEqual({ success: true, data: row });
    expect(updateDebt).toHaveBeenCalled();
  });
});

// ---------- addPlanIncomeAction ----------

describe("addPlanIncomeAction", () => {
  it("adds income and revalidates the plans segment + dashboard", async () => {
    const row = { id: ROW_ID };
    vi.mocked(addIncome).mockResolvedValueOnce(row as never);

    const input = {
      name: "Salary",
      monthlyAmount: "5000",
      kind: "recurring" as const,
      dayOfMonth: 15,
      recurrenceType: "monthly_day" as const,
    };

    const result = await addPlanIncomeAction(PLAN_ID, input as never);

    expect(result).toEqual({ success: true, data: row });
    expect(addIncome).toHaveBeenCalledWith(USER_ID, PLAN_ID, expect.objectContaining({ name: "Salary" }));
    expect(logImpersonatedMutation).toHaveBeenCalled();
    // Lines move every projection: the list, compare, editor and dashboard.
    expect(revalidatePath).toHaveBeenCalledWith("/portal/plans", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/portal");
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });
});

// ---------- deletePlanIncomeAction ----------

describe("deletePlanIncomeAction", () => {
  it("deletes income when both ids are valid UUIDs", async () => {
    vi.mocked(deleteIncome).mockResolvedValueOnce(undefined as never);

    const result = await deletePlanIncomeAction(PLAN_ID, ROW_ID);

    expect(result).toEqual({ success: true });
    expect(deleteIncome).toHaveBeenCalledWith(USER_ID, PLAN_ID, ROW_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/portal/plans", "layout");
  });

  it("rejects when planId is not a UUID", async () => {
    const result = await deletePlanIncomeAction("bad", ROW_ID);

    expect(result).toEqual({ success: false, error: "Invalid id" });
    expect(deleteIncome).not.toHaveBeenCalled();
  });

  it("rejects when incomeId is not a UUID", async () => {
    const result = await deletePlanIncomeAction(PLAN_ID, "bad");

    expect(result).toEqual({ success: false, error: "Invalid id" });
    expect(deleteIncome).not.toHaveBeenCalled();
  });
});

// ---------- upsertLineOverrideAction ----------

describe("upsertLineOverrideAction", () => {
  it("upserts on happy path and revalidates the plans segment", async () => {
    vi.mocked(upsertLineOverride).mockResolvedValueOnce(undefined as never);

    const input = {
      parentSide: "income" as const,
      parentId: ROW_ID,
      monthYear: "2026-08-01",
      action: "skip" as const,
    };

    const result = await upsertLineOverrideAction(PLAN_ID, input as never);

    expect(result).toEqual({ success: true });
    expect(upsertLineOverride).toHaveBeenCalledWith(
      USER_ID,
      PLAN_ID,
      expect.objectContaining({ parentId: ROW_ID, action: "skip" })
    );
    expect(logImpersonatedMutation).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/portal/plans", "layout");
  });
});

// ---------- deleteLineOverrideAction ----------

describe("deleteLineOverrideAction", () => {
  it("deletes the override on happy path", async () => {
    vi.mocked(deleteLineOverride).mockResolvedValueOnce(undefined as never);

    const input = {
      parentSide: "expense" as const,
      parentId: ROW_ID,
      monthYear: "2026-08-01",
    };

    const result = await deleteLineOverrideAction(PLAN_ID, input as never);

    expect(result).toEqual({ success: true });
    expect(deleteLineOverride).toHaveBeenCalledWith(
      USER_ID,
      PLAN_ID,
      expect.objectContaining({ parentId: ROW_ID })
    );
    expect(logImpersonatedMutation).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/portal/plans", "layout");
  });
});
