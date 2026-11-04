import "server-only";

import type { OpeningBalanceEdits } from "@/lib/finance/opening-balances";
import { logImpersonatedMutation } from "@/lib/services/impersonation";
import { getRequestTimeZone } from "@/lib/utils/request-today";
import { todayInTimeZone } from "@/lib/utils/date";
import { idSchema } from "@/schemas/common";
import {
  cloneFinancePlanSchema,
  createFinancePlanSchema,
  FIXED_DEBT_NEEDS_PAYMENT,
  MONTHLY_RATE_TOO_HIGH,
  planDebtSchema,
  planExpenseSchema,
  planIncomeSchema,
  SHARE_TOO_HIGH,
  updateFinancePlanSchema,
  updatePlanDebtSchema,
  updatePlanExpenseSchema,
  updatePlanIncomeSchema,
} from "@/schemas/finance";
import type {
  FinancePlan,
  FinancePlanDebt,
  FinancePlanExpense,
  FinancePlanIncome,
} from "@/types/finance";

import {
  addDebt,
  addExpense,
  addIncome,
  clonePlanWithLineIds,
  createPlan,
  deleteDebt,
  deleteExpense,
  deleteIncome,
  deletePlan,
  getPlanWithLines,
  setMainPlan,
  updateDebt,
  updateExpense,
  updateIncome,
  updatePlan,
  type PlanRestatement,
} from "./finance-plan-service";
import { recordMovementSnapshot, restateOpeningBalances } from "./finance-snapshot-service";

/**
 * Every change a finance plan can take, as one function each: validate the
 * input, restate the opening balances the change moves, write, log it under
 * an impersonation, and record the day's movement snapshot. The plan pages'
 * server actions and the plans assistant run these same functions, so a
 * change made from the chat is the change the form would have made.
 *
 * An expected refusal (bad input, a debt that could never be paid off) is a
 * `PlanOperationError` whose message the user can act on. Callers own auth
 * and revalidation.
 */
export class PlanOperationError extends Error {}

/** Who the change is for, and their calendar: balances are restated as of their today. */
export type PlanOperationContext = { userId: string; today: Date; timeZone: string };

/** The reader's context for a request. */
export async function planOperationContext(userId: string): Promise<PlanOperationContext> {
  const timeZone = await getRequestTimeZone();
  return { userId, timeZone, today: todayInTimeZone(timeZone) };
}

// Validation messages worth showing verbatim: they say how to fix the input.
const EXPLAINED_ERRORS = [FIXED_DEBT_NEEDS_PAYMENT, MONTHLY_RATE_TOO_HIGH, SHARE_TOO_HIGH];

/** An explained validation error (never-payable debt, absurd rate), else `fallback`. */
function explained(issues: { message: string }[], fallback = "Invalid input"): string {
  return issues.find((i) => EXPLAINED_ERRORS.includes(i.message))?.message ?? fallback;
}

function parse<T>(
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } },
  input: unknown,
  fallback = "Invalid input",
  explain = false
): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  throw new PlanOperationError(explain ? explained(parsed.error.issues, fallback) : fallback);
}

const id = (value: unknown, message = "Invalid id"): string => parse(idSchema, value, message);

/**
 * The restatement an edit of opening balances implies (null when it changes
 * none): the whole set is re-dated to the reader's today. See
 * `lib/finance/opening-balances.ts`. A plan that isn't the caller's yields
 * null here; the service's own ownership check then refuses the write.
 */
async function restatementFor(
  c: PlanOperationContext,
  planId: string,
  edits: OpeningBalanceEdits
): Promise<PlanRestatement | null> {
  const plan = await getPlanWithLines(planId, c.userId);
  if (!plan) return null;
  return restateOpeningBalances(plan, c.userId, c.today, edits, c.timeZone);
}

/** Where the plan stands after the change, for the dashboard. Never fails the change. */
export async function recordPlanMovement(c: PlanOperationContext, planId: string): Promise<void> {
  try {
    await recordMovementSnapshot(planId, c.userId, c.today, c.timeZone);
  } catch (error) {
    console.error(`[finance-plans] movement snapshot for ${planId} failed:`, error);
  }
}

// ---------- plans ----------

export async function createPlanOperation(c: PlanOperationContext, input: unknown): Promise<FinancePlan> {
  const data = parse(createFinancePlanSchema, input, "Invalid input", true);
  // The balances typed into the form are as of the reader's today.
  const plan = await createPlan(c.userId, data, c.today);
  await logImpersonatedMutation({
    action: "financePlan.create",
    entityTable: "finance_plans",
    entityId: plan.id,
    after: plan,
  });
  return plan;
}

/** A copy of a plan, lines and overrides included; a scenario keeps a link to its source. */
export async function copyPlanOperation(
  c: PlanOperationContext,
  input: { planId: unknown; name: unknown; asScenario?: boolean }
): Promise<{ plan: FinancePlan; lineIds: ReadonlyMap<string, string> }> {
  const data = parse(cloneFinancePlanSchema, { planId: input.planId, name: input.name });
  const copy = await clonePlanWithLineIds(c.userId, data.planId, data.name, { asScenario: input.asScenario });
  await logImpersonatedMutation({
    action: input.asScenario ? "financePlan.createScenario" : "financePlan.clone",
    entityTable: "finance_plans",
    entityId: copy.plan.id,
    metadata: { sourcePlanId: data.planId },
  });
  return copy;
}

export async function updatePlanOperation(c: PlanOperationContext, input: unknown): Promise<FinancePlan> {
  const data = parse(updateFinancePlanSchema, input, "Invalid input", true);
  // Only the balances sent are edits: an untouched, stale figure passed along
  // would be re-dated past the latest confirmation.
  const { initialSavings, initialInvestments } = data;
  const restatement = await restatementFor(c, data.id, {
    ...(initialSavings !== undefined ? { savings: initialSavings } : {}),
    ...(initialInvestments !== undefined ? { investments: initialInvestments } : {}),
  });
  const plan = await updatePlan(c.userId, data, restatement);
  await logImpersonatedMutation({
    action: "financePlan.update",
    entityTable: "finance_plans",
    entityId: plan.id,
    after: plan,
  });
  await recordPlanMovement(c, plan.id);
  return plan;
}

export async function deletePlanOperation(c: PlanOperationContext, planId: unknown): Promise<void> {
  const target = id(planId);
  await deletePlan(c.userId, target);
  await logImpersonatedMutation({ action: "financePlan.delete", entityTable: "finance_plans", entityId: target });
}

export async function setMainPlanOperation(c: PlanOperationContext, planId: unknown): Promise<void> {
  const target = id(planId);
  await setMainPlan(c.userId, target);
  await logImpersonatedMutation({ action: "financePlan.setMain", entityTable: "finance_plans", entityId: target });
}

// ---------- incomes ----------

export async function addIncomeOperation(
  c: PlanOperationContext,
  planId: unknown,
  input: unknown
): Promise<FinancePlanIncome> {
  const plan = id(planId, "Invalid input");
  const data = parse(planIncomeSchema, input);
  const row = await addIncome(c.userId, plan, data);
  await logImpersonatedMutation({ action: "financePlanIncome.create", entityTable: "finance_plan_incomes", entityId: row.id });
  await recordPlanMovement(c, plan);
  return row;
}

export async function updateIncomeOperation(
  c: PlanOperationContext,
  planId: unknown,
  input: unknown
): Promise<FinancePlanIncome> {
  const plan = id(planId, "Invalid input");
  const data = parse(updatePlanIncomeSchema, input);
  const row = await updateIncome(c.userId, plan, data);
  await logImpersonatedMutation({ action: "financePlanIncome.update", entityTable: "finance_plan_incomes", entityId: row.id });
  await recordPlanMovement(c, plan);
  return row;
}

export async function deleteIncomeOperation(
  c: PlanOperationContext,
  planId: unknown,
  incomeId: unknown
): Promise<void> {
  const plan = id(planId);
  const income = id(incomeId);
  await deleteIncome(c.userId, plan, income);
  await logImpersonatedMutation({ action: "financePlanIncome.delete", entityTable: "finance_plan_incomes", entityId: income });
  await recordPlanMovement(c, plan);
}

// ---------- expenses ----------

export async function addExpenseOperation(
  c: PlanOperationContext,
  planId: unknown,
  input: unknown
): Promise<FinancePlanExpense> {
  const plan = id(planId, "Invalid input");
  const data = parse(planExpenseSchema, input);
  const row = await addExpense(c.userId, plan, data);
  await logImpersonatedMutation({ action: "financePlanExpense.create", entityTable: "finance_plan_expenses", entityId: row.id });
  await recordPlanMovement(c, plan);
  return row;
}

export async function updateExpenseOperation(
  c: PlanOperationContext,
  planId: unknown,
  input: unknown
): Promise<FinancePlanExpense> {
  const plan = id(planId, "Invalid input");
  const data = parse(updatePlanExpenseSchema, input);
  const row = await updateExpense(c.userId, plan, data);
  await logImpersonatedMutation({ action: "financePlanExpense.update", entityTable: "finance_plan_expenses", entityId: row.id });
  await recordPlanMovement(c, plan);
  return row;
}

export async function deleteExpenseOperation(
  c: PlanOperationContext,
  planId: unknown,
  expenseId: unknown
): Promise<void> {
  const plan = id(planId);
  const expense = id(expenseId);
  await deleteExpense(c.userId, plan, expense);
  await logImpersonatedMutation({ action: "financePlanExpense.delete", entityTable: "finance_plan_expenses", entityId: expense });
  await recordPlanMovement(c, plan);
}

// ---------- debts ----------

export async function addDebtOperation(
  c: PlanOperationContext,
  planId: unknown,
  input: unknown
): Promise<FinancePlanDebt> {
  const plan = id(planId, "Invalid input");
  const data = parse(planDebtSchema, input, "Invalid input", true);
  const restatement = await restatementFor(c, plan, { addedDebtBalance: data.initialBalance });
  const row = await addDebt(c.userId, plan, data, restatement);
  await logImpersonatedMutation({ action: "financePlanDebt.create", entityTable: "finance_plan_debts", entityId: row.id });
  await recordPlanMovement(c, plan);
  return row;
}

export async function updateDebtOperation(
  c: PlanOperationContext,
  planId: unknown,
  input: unknown
): Promise<FinancePlanDebt> {
  const plan = id(planId, "Invalid input");
  const data = parse(updatePlanDebtSchema, input, "Invalid input", true);
  const restatement = await restatementFor(c, plan, { debts: { [data.id]: data.initialBalance } });
  const row = await updateDebt(c.userId, plan, data, restatement);
  await logImpersonatedMutation({ action: "financePlanDebt.update", entityTable: "finance_plan_debts", entityId: row.id });
  await recordPlanMovement(c, plan);
  return row;
}

export async function deleteDebtOperation(
  c: PlanOperationContext,
  planId: unknown,
  debtId: unknown
): Promise<void> {
  const plan = id(planId);
  const debt = id(debtId);
  await deleteDebt(c.userId, plan, debt);
  await logImpersonatedMutation({ action: "financePlanDebt.delete", entityTable: "finance_plan_debts", entityId: debt });
  await recordPlanMovement(c, plan);
}
