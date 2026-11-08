"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import {
  deleteLineOverride,
  setPlanColor,
  upsertLineOverride,
} from "@/lib/services/finance-plan-service";
import {
  addDebtOperation,
  addExpenseOperation,
  addIncomeOperation,
  copyPlanOperation,
  createPlanOperation,
  deleteDebtOperation,
  deleteExpenseOperation,
  deleteIncomeOperation,
  deletePlanOperation,
  planOperationContext,
  PlanOperationError,
  setMainPlanOperation,
  updateDebtOperation,
  updateExpenseOperation,
  updateIncomeOperation,
  updatePlanOperation,
  recordPlanMovement,
  type PlanOperationContext,
} from "@/lib/services/finance-plan-operations";
import { idSchema } from "@/schemas/common";
import {
  deleteLineOverrideSchema,
  lineOverrideSchema,
  planColorSchema,
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

/**
 * A plan change through its operation (`lib/services/finance-plan-operations`):
 * the auth gate, the reader's calendar, an expected refusal as the action's
 * error, and the plan pages revalidated once it is written.
 */
async function planAction<T>(
  run: (c: PlanOperationContext) => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  return safe<T>("finance-plans", async () => {
    const ctx = await requireEffectiveContext();
    try {
      const result = await run(await planOperationContext(ctx.effectiveUserId));
      if (result.success) revalidatePlans();
      return result;
    } catch (err) {
      if (err instanceof PlanOperationError) return { success: false, error: err.message };
      throw err;
    }
  });
}

// ---------- plans ----------

export async function createPlanAction(
  input: CreateFinancePlanInput
): Promise<ActionResult<FinancePlan>> {
  return planAction(async (c) => ({ success: true, data: await createPlanOperation(c, input) }));
}

export async function updatePlanAction(
  input: UpdateFinancePlanInput
): Promise<ActionResult<FinancePlan>> {
  return planAction(async (c) => ({ success: true, data: await updatePlanOperation(c, input) }));
}

export async function deletePlanAction(planId: string): Promise<ActionResult> {
  return planAction(async (c) => {
    await deletePlanOperation(c, planId);
    return { success: true };
  });
}

export async function setMainPlanAction(planId: string): Promise<ActionResult> {
  return planAction(async (c) => {
    await setMainPlanOperation(c, planId);
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
  return planAction(async (c) => ({
    success: true,
    data: (await copyPlanOperation(c, { planId, name: newName })).plan,
  }));
}

/** Clone + link: the new plan keeps a basedOnPlanId reference to the source,
 *  so its chart can overlay the base plan's projection as a ghost line. */
export async function createScenarioAction(
  planId: string,
  newName: string
): Promise<ActionResult<FinancePlan>> {
  return planAction(async (c) => ({
    success: true,
    data: (await copyPlanOperation(c, { planId, name: newName, asScenario: true })).plan,
  }));
}

// ---------- incomes ----------

export async function addPlanIncomeAction(
  planId: string,
  input: PlanIncomeInput
): Promise<ActionResult<FinancePlanIncome>> {
  return planAction(async (c) => ({ success: true, data: await addIncomeOperation(c, planId, input) }));
}

export async function updatePlanIncomeAction(
  planId: string,
  input: UpdatePlanIncomeInput
): Promise<ActionResult<FinancePlanIncome>> {
  return planAction(async (c) => ({ success: true, data: await updateIncomeOperation(c, planId, input) }));
}

export async function deletePlanIncomeAction(
  planId: string,
  incomeId: string
): Promise<ActionResult> {
  return planAction(async (c) => {
    await deleteIncomeOperation(c, planId, incomeId);
    return { success: true };
  });
}

// ---------- expenses ----------

export async function addPlanExpenseAction(
  planId: string,
  input: PlanExpenseInput
): Promise<ActionResult<FinancePlanExpense>> {
  return planAction(async (c) => ({ success: true, data: await addExpenseOperation(c, planId, input) }));
}

export async function updatePlanExpenseAction(
  planId: string,
  input: UpdatePlanExpenseInput
): Promise<ActionResult<FinancePlanExpense>> {
  return planAction(async (c) => ({ success: true, data: await updateExpenseOperation(c, planId, input) }));
}

export async function deletePlanExpenseAction(
  planId: string,
  expenseId: string
): Promise<ActionResult> {
  return planAction(async (c) => {
    await deleteExpenseOperation(c, planId, expenseId);
    return { success: true };
  });
}

// ---------- debts ----------

export async function addPlanDebtAction(
  planId: string,
  input: PlanDebtInput
): Promise<ActionResult<FinancePlanDebt>> {
  return planAction(async (c) => ({ success: true, data: await addDebtOperation(c, planId, input) }));
}

export async function updatePlanDebtAction(
  planId: string,
  input: UpdatePlanDebtInput
): Promise<ActionResult<FinancePlanDebt>> {
  return planAction(async (c) => ({ success: true, data: await updateDebtOperation(c, planId, input) }));
}

export async function deletePlanDebtAction(
  planId: string,
  debtId: string
): Promise<ActionResult> {
  return planAction(async (c) => {
    await deleteDebtOperation(c, planId, debtId);
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
    await recordPlanMovement(await planOperationContext(ctx.effectiveUserId), idParsed.data);
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
    await recordPlanMovement(await planOperationContext(ctx.effectiveUserId), idParsed.data);
    revalidatePlans();
    return { success: true };
  });
}
