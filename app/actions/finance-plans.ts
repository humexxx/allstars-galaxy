"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import {
  addDebt,
  addExpense,
  addIncome,
  clonePlan,
  createPlan,
  deleteDebt,
  deleteExpense,
  deleteIncome,
  deleteLineOverride,
  deletePlan,
  setMainPlan,
  setPlanColor,
  updateDebt,
  updateExpense,
  updateIncome,
  updatePlan,
  upsertLineOverride,
} from "@/lib/services/finance-plan-service";
import { idSchema } from "@/schemas/common";
import {
  cloneFinancePlanSchema,
  createFinancePlanSchema,
  FIXED_DEBT_NEEDS_PAYMENT,
  MONTHLY_RATE_TOO_HIGH,
  SHARE_TOO_HIGH,
  deleteLineOverrideSchema,
  lineOverrideSchema,
  planDebtSchema,
  planExpenseSchema,
  planColorSchema,
  planIncomeSchema,
  updateFinancePlanSchema,
  updatePlanDebtSchema,
  updatePlanExpenseSchema,
  updatePlanIncomeSchema,
  type CreateFinancePlanInput,
  type DeleteLineOverrideData,
  type LineOverrideData,
  type PlanColorData,
  type PlanDebtInput,
  type PlanExpenseInput,
  type PlanIncomeInput,
  type UpdateFinancePlanInput,
  type UpdatePlanDebtInput,
  type UpdatePlanExpenseInput,
  type UpdatePlanIncomeInput,
} from "@/schemas/finance";
import type {
  FinancePlan,
  FinancePlanDebt,
  FinancePlanExpense,
  FinancePlanIncome,
} from "@/types/finance";

const PLAN_PATH = "/portal/plans";

/**
 * Every plan surface shows projections: the list and compare view chart each
 * plan, the editor owns one, and the dashboard card follows the main plan. A
 * change to any line moves all of them, so the whole segment is revalidated.
 */
function revalidatePlans(): void {
  revalidatePath(PLAN_PATH, "layout");
  revalidatePath("/portal");
}

// Validation messages worth showing verbatim: they say how to fix the input.
const EXPLAINED_ERRORS = [FIXED_DEBT_NEEDS_PAYMENT, MONTHLY_RATE_TOO_HIGH, SHARE_TOO_HIGH];

/** An explained validation error (never-payable debt, absurd rate), else the generic one. */
function explainedError(issues: { message: string }[]): string {
  return issues.find((i) => EXPLAINED_ERRORS.includes(i.message))?.message ?? "Invalid input";
}

/** A debt the projection could never pay off gets its own message. */
function debtError(issues: { message: string }[]): string {
  return explainedError(issues);
}

// ---------- plans ----------

export async function createPlanAction(
  input: CreateFinancePlanInput
): Promise<ActionResult<FinancePlan>> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = createFinancePlanSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: explainedError(parsed.error.issues) };
    }
    const plan = await createPlan(ctx.effectiveUserId, parsed.data);
    await logImpersonatedMutation({
      action: "financePlan.create",
      entityTable: "finance_plans",
      entityId: plan.id,
      after: plan,
    });
    revalidatePlans();
    return { success: true, data: plan };
  });
}

export async function updatePlanAction(
  input: UpdateFinancePlanInput
): Promise<ActionResult<FinancePlan>> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = updateFinancePlanSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: explainedError(parsed.error.issues) };
    }
    const plan = await updatePlan(ctx.effectiveUserId, parsed.data);
    await logImpersonatedMutation({
      action: "financePlan.update",
      entityTable: "finance_plans",
      entityId: plan.id,
      after: plan,
    });
    revalidatePlans();
    return { success: true, data: plan };
  });
}

export async function deletePlanAction(planId: string): Promise<ActionResult> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = idSchema.safeParse(planId);
    if (!parsed.success) return { success: false, error: "Invalid id" };
    await deletePlan(ctx.effectiveUserId, parsed.data);
    await logImpersonatedMutation({
      action: "financePlan.delete",
      entityTable: "finance_plans",
      entityId: parsed.data,
    });
    revalidatePlans();
    return { success: true };
  });
}

export async function setMainPlanAction(planId: string): Promise<ActionResult> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = idSchema.safeParse(planId);
    if (!parsed.success) return { success: false, error: "Invalid id" };
    await setMainPlan(ctx.effectiveUserId, parsed.data);
    await logImpersonatedMutation({
      action: "financePlan.setMain",
      entityTable: "finance_plans",
      entityId: parsed.data,
    });
    revalidatePlans();
    return { success: true };
  });
}

export async function setPlanColorAction(input: PlanColorData): Promise<ActionResult> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = planColorSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Unsupported colour" };
    }
    await setPlanColor(ctx.effectiveUserId, parsed.data.id, parsed.data.color);
    await logImpersonatedMutation({
      action: "financePlan.setColour",
      entityTable: "finance_plans",
      entityId: parsed.data.id,
      after: { color: parsed.data.color },
    });
    revalidatePlans();
    return { success: true };
  });
}

export async function clonePlanAction(
  planId: string,
  newName: string
): Promise<ActionResult<FinancePlan>> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = cloneFinancePlanSchema.safeParse({ planId, name: newName });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    const plan = await clonePlan(ctx.effectiveUserId, parsed.data.planId, parsed.data.name);
    await logImpersonatedMutation({
      action: "financePlan.clone",
      entityTable: "finance_plans",
      entityId: plan.id,
      metadata: { sourcePlanId: parsed.data.planId },
    });
    revalidatePlans();
    return { success: true, data: plan };
  });
}

/** Clone + link: the new plan keeps a basedOnPlanId reference to the source,
 *  so its chart can overlay the base plan's projection as a ghost line. */
export async function createScenarioAction(
  planId: string,
  newName: string
): Promise<ActionResult<FinancePlan>> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const parsed = cloneFinancePlanSchema.safeParse({ planId, name: newName });
    if (!parsed.success) return { success: false, error: "Invalid input" };
    const plan = await clonePlan(ctx.effectiveUserId, parsed.data.planId, parsed.data.name, {
      asScenario: true,
    });
    await logImpersonatedMutation({
      action: "financePlan.createScenario",
      entityTable: "finance_plans",
      entityId: plan.id,
      metadata: { sourcePlanId: parsed.data.planId },
    });
    revalidatePlans();
    return { success: true, data: plan };
  });
}

// ---------- incomes ----------

export async function addPlanIncomeAction(
  planId: string,
  input: PlanIncomeInput
): Promise<ActionResult<FinancePlanIncome>> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(planId);
    const parsed = planIncomeSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const row = await addIncome(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "financePlanIncome.create",
      entityTable: "finance_plan_incomes",
      entityId: row.id,
    });
    revalidatePlans();
    return { success: true, data: row };
  });
}

export async function updatePlanIncomeAction(
  planId: string,
  input: UpdatePlanIncomeInput
): Promise<ActionResult<FinancePlanIncome>> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(planId);
    const parsed = updatePlanIncomeSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const row = await updateIncome(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "financePlanIncome.update",
      entityTable: "finance_plan_incomes",
      entityId: row.id,
    });
    revalidatePlans();
    return { success: true, data: row };
  });
}

export async function deletePlanIncomeAction(
  planId: string,
  incomeId: string
): Promise<ActionResult> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const planIdParsed = idSchema.safeParse(planId);
    const incomeIdParsed = idSchema.safeParse(incomeId);
    if (!planIdParsed.success || !incomeIdParsed.success) {
      return { success: false, error: "Invalid id" };
    }
    await deleteIncome(ctx.effectiveUserId, planIdParsed.data, incomeIdParsed.data);
    await logImpersonatedMutation({
      action: "financePlanIncome.delete",
      entityTable: "finance_plan_incomes",
      entityId: incomeIdParsed.data,
    });
    revalidatePlans();
    return { success: true };
  });
}

// ---------- expenses ----------

export async function addPlanExpenseAction(
  planId: string,
  input: PlanExpenseInput
): Promise<ActionResult<FinancePlanExpense>> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(planId);
    const parsed = planExpenseSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const row = await addExpense(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "financePlanExpense.create",
      entityTable: "finance_plan_expenses",
      entityId: row.id,
    });
    revalidatePlans();
    return { success: true, data: row };
  });
}

export async function updatePlanExpenseAction(
  planId: string,
  input: UpdatePlanExpenseInput
): Promise<ActionResult<FinancePlanExpense>> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(planId);
    const parsed = updatePlanExpenseSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    const row = await updateExpense(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "financePlanExpense.update",
      entityTable: "finance_plan_expenses",
      entityId: row.id,
    });
    revalidatePlans();
    return { success: true, data: row };
  });
}

export async function deletePlanExpenseAction(
  planId: string,
  expenseId: string
): Promise<ActionResult> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const planIdParsed = idSchema.safeParse(planId);
    const expenseIdParsed = idSchema.safeParse(expenseId);
    if (!planIdParsed.success || !expenseIdParsed.success) {
      return { success: false, error: "Invalid id" };
    }
    await deleteExpense(ctx.effectiveUserId, planIdParsed.data, expenseIdParsed.data);
    await logImpersonatedMutation({
      action: "financePlanExpense.delete",
      entityTable: "finance_plan_expenses",
      entityId: expenseIdParsed.data,
    });
    revalidatePlans();
    return { success: true };
  });
}

// ---------- debts ----------

export async function addPlanDebtAction(
  planId: string,
  input: PlanDebtInput
): Promise<ActionResult<FinancePlanDebt>> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(planId);
    const parsed = planDebtSchema.safeParse(input);
    if (!idParsed.success) return { success: false, error: "Invalid input" };
    if (!parsed.success) {
      return { success: false, error: debtError(parsed.error.issues) };
    }
    const row = await addDebt(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "financePlanDebt.create",
      entityTable: "finance_plan_debts",
      entityId: row.id,
    });
    revalidatePlans();
    return { success: true, data: row };
  });
}

export async function updatePlanDebtAction(
  planId: string,
  input: UpdatePlanDebtInput
): Promise<ActionResult<FinancePlanDebt>> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(planId);
    const parsed = updatePlanDebtSchema.safeParse(input);
    if (!idParsed.success) return { success: false, error: "Invalid input" };
    if (!parsed.success) {
      return { success: false, error: debtError(parsed.error.issues) };
    }
    const row = await updateDebt(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "financePlanDebt.update",
      entityTable: "finance_plan_debts",
      entityId: row.id,
    });
    revalidatePlans();
    return { success: true, data: row };
  });
}

export async function deletePlanDebtAction(
  planId: string,
  debtId: string
): Promise<ActionResult> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const planIdParsed = idSchema.safeParse(planId);
    const debtIdParsed = idSchema.safeParse(debtId);
    if (!planIdParsed.success || !debtIdParsed.success) {
      return { success: false, error: "Invalid id" };
    }
    await deleteDebt(ctx.effectiveUserId, planIdParsed.data, debtIdParsed.data);
    await logImpersonatedMutation({
      action: "financePlanDebt.delete",
      entityTable: "finance_plan_debts",
      entityId: debtIdParsed.data,
    });
    revalidatePlans();
    return { success: true };
  });
}

// ---------- per-month line overrides ----------

export async function upsertLineOverrideAction(
  planId: string,
  input: LineOverrideData
): Promise<ActionResult> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(planId);
    const parsed = lineOverrideSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    await upsertLineOverride(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "financePlanLineOverride.upsert",
      entityTable: "finance_plan_line_overrides",
      entityId: parsed.data.parentId,
    });
    revalidatePlans();
    return { success: true };
  });
}

export async function deleteLineOverrideAction(
  planId: string,
  input: DeleteLineOverrideData
): Promise<ActionResult> {
  return safe("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    const idParsed = idSchema.safeParse(planId);
    const parsed = deleteLineOverrideSchema.safeParse(input);
    if (!idParsed.success || !parsed.success) {
      return { success: false, error: "Invalid input" };
    }
    await deleteLineOverride(ctx.effectiveUserId, idParsed.data, parsed.data);
    await logImpersonatedMutation({
      action: "financePlanLineOverride.delete",
      entityTable: "finance_plan_line_overrides",
      entityId: parsed.data.parentId,
    });
    revalidatePlans();
    return { success: true };
  });
}
