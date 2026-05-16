"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireEffectiveContext } from "@/lib/services/impersonation";
import {
  addDebt,
  addExpense,
  addIncome,
  clonePlan,
  createPlan,
  deleteDebt,
  deleteExpense,
  deleteIncome,
  deletePlan,
  updateDebt,
  updateExpense,
  updateIncome,
  updatePlan,
} from "@/lib/services/finance-plan-service";
import {
  createFinancePlanSchema,
  planDebtSchema,
  planLineSchema,
  updateFinancePlanSchema,
  updatePlanDebtSchema,
  updatePlanLineSchema,
  type CreateFinancePlanInput,
  type PlanDebtInput,
  type PlanLineInput,
  type UpdateFinancePlanInput,
  type UpdatePlanDebtInput,
  type UpdatePlanLineInput,
} from "@/schemas/finance";

const PLAN_PATH = "/portal/plans";

function pathForPlan(planId: string): string {
  return `${PLAN_PATH}/${planId}`;
}

// ---------- plans ----------

export async function createPlanAction(input: CreateFinancePlanInput) {
  const ctx = await requireEffectiveContext();
  const parsed = createFinancePlanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: "Invalid input" };
  }
  const plan = await createPlan(ctx.effectiveUserId, parsed.data);
  revalidatePath(PLAN_PATH);
  return { success: true as const, data: plan };
}

export async function updatePlanAction(input: UpdateFinancePlanInput) {
  const ctx = await requireEffectiveContext();
  const parsed = updateFinancePlanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: "Invalid input" };
  }
  const plan = await updatePlan(ctx.effectiveUserId, parsed.data);
  revalidatePath(PLAN_PATH);
  revalidatePath(pathForPlan(plan.id));
  return { success: true as const, data: plan };
}

export async function deletePlanAction(planId: string) {
  const ctx = await requireEffectiveContext();
  const parsed = z.string().uuid().safeParse(planId);
  if (!parsed.success) return { success: false as const, error: "Invalid id" };
  await deletePlan(ctx.effectiveUserId, parsed.data);
  revalidatePath(PLAN_PATH);
  return { success: true as const };
}

export async function clonePlanAction(planId: string, newName: string) {
  const ctx = await requireEffectiveContext();
  const idParsed = z.string().uuid().safeParse(planId);
  const nameParsed = z.string().min(1).max(120).safeParse(newName);
  if (!idParsed.success || !nameParsed.success) {
    return { success: false as const, error: "Invalid input" };
  }
  const plan = await clonePlan(ctx.effectiveUserId, idParsed.data, nameParsed.data);
  revalidatePath(PLAN_PATH);
  return { success: true as const, data: plan };
}

// ---------- incomes ----------

export async function addPlanIncomeAction(planId: string, input: PlanLineInput) {
  const ctx = await requireEffectiveContext();
  const idParsed = z.string().uuid().safeParse(planId);
  const parsed = planLineSchema.safeParse(input);
  if (!idParsed.success || !parsed.success) {
    return { success: false as const, error: "Invalid input" };
  }
  const row = await addIncome(ctx.effectiveUserId, idParsed.data, parsed.data);
  revalidatePath(pathForPlan(planId));
  return { success: true as const, data: row };
}

export async function updatePlanIncomeAction(planId: string, input: UpdatePlanLineInput) {
  const ctx = await requireEffectiveContext();
  const idParsed = z.string().uuid().safeParse(planId);
  const parsed = updatePlanLineSchema.safeParse(input);
  if (!idParsed.success || !parsed.success) {
    return { success: false as const, error: "Invalid input" };
  }
  const row = await updateIncome(ctx.effectiveUserId, idParsed.data, parsed.data);
  revalidatePath(pathForPlan(planId));
  return { success: true as const, data: row };
}

export async function deletePlanIncomeAction(planId: string, incomeId: string) {
  const ctx = await requireEffectiveContext();
  const planIdParsed = z.string().uuid().safeParse(planId);
  const incomeIdParsed = z.string().uuid().safeParse(incomeId);
  if (!planIdParsed.success || !incomeIdParsed.success) {
    return { success: false as const, error: "Invalid id" };
  }
  await deleteIncome(ctx.effectiveUserId, planIdParsed.data, incomeIdParsed.data);
  revalidatePath(pathForPlan(planId));
  return { success: true as const };
}

// ---------- expenses ----------

export async function addPlanExpenseAction(planId: string, input: PlanLineInput) {
  const ctx = await requireEffectiveContext();
  const idParsed = z.string().uuid().safeParse(planId);
  const parsed = planLineSchema.safeParse(input);
  if (!idParsed.success || !parsed.success) {
    return { success: false as const, error: "Invalid input" };
  }
  const row = await addExpense(ctx.effectiveUserId, idParsed.data, parsed.data);
  revalidatePath(pathForPlan(planId));
  return { success: true as const, data: row };
}

export async function updatePlanExpenseAction(
  planId: string,
  input: UpdatePlanLineInput
) {
  const ctx = await requireEffectiveContext();
  const idParsed = z.string().uuid().safeParse(planId);
  const parsed = updatePlanLineSchema.safeParse(input);
  if (!idParsed.success || !parsed.success) {
    return { success: false as const, error: "Invalid input" };
  }
  const row = await updateExpense(ctx.effectiveUserId, idParsed.data, parsed.data);
  revalidatePath(pathForPlan(planId));
  return { success: true as const, data: row };
}

export async function deletePlanExpenseAction(planId: string, expenseId: string) {
  const ctx = await requireEffectiveContext();
  const planIdParsed = z.string().uuid().safeParse(planId);
  const expenseIdParsed = z.string().uuid().safeParse(expenseId);
  if (!planIdParsed.success || !expenseIdParsed.success) {
    return { success: false as const, error: "Invalid id" };
  }
  await deleteExpense(ctx.effectiveUserId, planIdParsed.data, expenseIdParsed.data);
  revalidatePath(pathForPlan(planId));
  return { success: true as const };
}

// ---------- debts ----------

export async function addPlanDebtAction(planId: string, input: PlanDebtInput) {
  const ctx = await requireEffectiveContext();
  const idParsed = z.string().uuid().safeParse(planId);
  const parsed = planDebtSchema.safeParse(input);
  if (!idParsed.success || !parsed.success) {
    return { success: false as const, error: "Invalid input" };
  }
  const row = await addDebt(ctx.effectiveUserId, idParsed.data, parsed.data);
  revalidatePath(pathForPlan(planId));
  return { success: true as const, data: row };
}

export async function updatePlanDebtAction(planId: string, input: UpdatePlanDebtInput) {
  const ctx = await requireEffectiveContext();
  const idParsed = z.string().uuid().safeParse(planId);
  const parsed = updatePlanDebtSchema.safeParse(input);
  if (!idParsed.success || !parsed.success) {
    return { success: false as const, error: "Invalid input" };
  }
  const row = await updateDebt(ctx.effectiveUserId, idParsed.data, parsed.data);
  revalidatePath(pathForPlan(planId));
  return { success: true as const, data: row };
}

export async function deletePlanDebtAction(planId: string, debtId: string) {
  const ctx = await requireEffectiveContext();
  const planIdParsed = z.string().uuid().safeParse(planId);
  const debtIdParsed = z.string().uuid().safeParse(debtId);
  if (!planIdParsed.success || !debtIdParsed.success) {
    return { success: false as const, error: "Invalid id" };
  }
  await deleteDebt(ctx.effectiveUserId, planIdParsed.data, debtIdParsed.data);
  revalidatePath(pathForPlan(planId));
  return { success: true as const };
}
