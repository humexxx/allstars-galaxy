import "server-only";

import { cache } from "react";

import { db } from "@/db";
import {
  financePlans,
  financePlanConfirmations,
  financePlanDebtConfirmations,
  financePlanIncomes,
  financePlanExpenses,
  financePlanDebts,
  financePlanLineOverrides,
  investmentMethods,
} from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";

import type {
  FinancePlan,
  FinancePlanDebt,
  FinancePlanExpense,
  FinancePlanIncome,
  FinancePlanWithLines,
  Projection,
} from "@/types/finance";
import type {
  CreateFinancePlanData,
  DeleteLineOverrideData,
  LineOverrideData,
  PlanDebtData,
  PlanExpenseData,
  PlanIncomeData,
  UpdateFinancePlanData,
  UpdatePlanDebtData,
  UpdatePlanExpenseData,
  UpdatePlanIncomeData,
} from "@/schemas/finance";

import { projectPlan, type ProjectOptions } from "@/lib/finance/projection";
import type { OpeningRestatement } from "@/lib/finance/opening-balances";
import { isoDay } from "@/lib/finance/schedule";

import { getUserPortfolio, getPortfolioStats, getPortfolioAssets } from "./portfolio-service";
import { ensureOwnedRow } from "./ownership";

// ---------- helpers ----------

function num(value: string | number): number {
  return typeof value === "number" ? value : parseFloat(value || "0");
}

async function ensureOwnership(planId: string, userId: string): Promise<void> {
  await ensureOwnedRow({
    table: financePlans,
    idColumn: financePlans.id,
    id: planId,
    userId,
    entity: "Plan",
  });
}

// ---------- plan CRUD ----------

/**
 * Request-cached: the dashboard's finance card and the plans layout both list
 * the user's plans during one render, so the second call is free.
 */
export const listUserPlans = cache(async function listUserPlans(
  userId: string
): Promise<FinancePlan[]> {
  return db
    .select()
    .from(financePlans)
    .where(eq(financePlans.userId, userId))
    .orderBy(asc(financePlans.createdAt));
});

/**
 * Wrapped in React's `cache()` so calls from `generateMetadata` and the page
 * body within the same request hit the DB once. Args are part of the cache
 * key, so the per-user filter remains safe.
 */
export const getPlanWithLines = cache(async function getPlanWithLines(
  planId: string,
  userId: string
): Promise<FinancePlanWithLines | null> {
  const [plan] = await db
    .select()
    .from(financePlans)
    .where(and(eq(financePlans.id, planId), eq(financePlans.userId, userId)));
  if (!plan) return null;

  const [incomes, expenses, debts, overrides] = await Promise.all([
    db
      .select()
      .from(financePlanIncomes)
      .where(eq(financePlanIncomes.planId, planId))
      .orderBy(asc(financePlanIncomes.sortOrder), asc(financePlanIncomes.createdAt)),
    db
      .select()
      .from(financePlanExpenses)
      .where(eq(financePlanExpenses.planId, planId))
      .orderBy(asc(financePlanExpenses.sortOrder), asc(financePlanExpenses.createdAt)),
    db
      .select()
      .from(financePlanDebts)
      .where(eq(financePlanDebts.planId, planId))
      .orderBy(asc(financePlanDebts.sortOrder), asc(financePlanDebts.createdAt)),
    db
      .select()
      .from(financePlanLineOverrides)
      .where(eq(financePlanLineOverrides.planId, planId)),
  ]);

  return { ...plan, incomes, expenses, debts, overrides };
});

/**
 * Every plan the user owns with its lines, in five queries however many plans
 * there are. The list and compare pages project every plan; loading each one
 * through `getPlanWithLines` was one round-trip per plan.
 */
export const listUserPlansWithLines = cache(async function listUserPlansWithLines(
  userId: string
): Promise<FinancePlanWithLines[]> {
  const plans = await listUserPlans(userId);
  if (plans.length === 0) return [];
  const ids = plans.map((p) => p.id);

  const [incomes, expenses, debts, overrides] = await Promise.all([
    db
      .select()
      .from(financePlanIncomes)
      .where(inArray(financePlanIncomes.planId, ids))
      .orderBy(asc(financePlanIncomes.sortOrder), asc(financePlanIncomes.createdAt)),
    db
      .select()
      .from(financePlanExpenses)
      .where(inArray(financePlanExpenses.planId, ids))
      .orderBy(asc(financePlanExpenses.sortOrder), asc(financePlanExpenses.createdAt)),
    db
      .select()
      .from(financePlanDebts)
      .where(inArray(financePlanDebts.planId, ids))
      .orderBy(asc(financePlanDebts.sortOrder), asc(financePlanDebts.createdAt)),
    db
      .select()
      .from(financePlanLineOverrides)
      .where(inArray(financePlanLineOverrides.planId, ids)),
  ]);

  const byPlan = <T extends { planId: string }>(rows: T[], planId: string): T[] =>
    rows.filter((r) => r.planId === planId);
  return plans.map((plan) => ({
    ...plan,
    incomes: byPlan(incomes, plan.id),
    expenses: byPlan(expenses, plan.id),
    debts: byPlan(debts, plan.id),
    overrides: byPlan(overrides, plan.id),
  }));
});

/**
 * `today` is the reader's calendar day: the opening balances typed into the
 * form are as of it (`balances_as_of`).
 */
export async function createPlan(
  userId: string,
  data: CreateFinancePlanData,
  today?: Date
): Promise<FinancePlan> {
  return db.transaction(async (tx) => {
    // Auto-set as main when the user has no plans yet. Keeps the
    // confirmation host / dashboard finance card pointed at something
    // useful from the very first plan onwards.
    const [existing] = await tx
      .select({ id: financePlans.id })
      .from(financePlans)
      .where(eq(financePlans.userId, userId))
      .limit(1);
    const shouldBeMain = !existing;

    const [plan] = await tx
      .insert(financePlans)
      .values({
        userId,
        name: data.name,
        description: data.description ?? null,
        startMonth: data.startMonth,
        monthsAhead: data.monthsAhead,
        initialSavings: data.initialSavings,
        monthlySavingsRate: data.monthlySavingsRate,
        includePortfolio: data.includePortfolio,
        surplusToDebtsPercent: data.surplusToDebtsPercent,
        debtStrategy: data.debtStrategy,
        autoInvestPercent: data.autoInvestPercent,
        autoInvestMethodId: data.autoInvestMethodId ?? null,
        initialInvestments: data.initialInvestments,
        confirmationDayOfMonth: data.confirmationDayOfMonth,
        color: data.color,
        balancesAsOf: today ? isoDay(today) : null,
        isMain: shouldBeMain,
      })
      .returning();
    return plan;
  });
}

/**
 * A plan's opening balances restated as of one day — see
 * `lib/finance/opening-balances.ts`. `syncConfirmationId` names a
 * confirmation made on that same day, which is updated to match so the two
 * statements of that day agree.
 */
export type PlanRestatement = OpeningRestatement & { syncConfirmationId: string | null };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Writes a restatement's debt balances, re-dates the plan and syncs a
 * same-day confirmation. `extraDebts` are debts created in the same
 * transaction (not yet in `debtBalances`).
 */
async function writeRestatement(
  tx: Tx,
  planId: string,
  r: PlanRestatement,
  extraDebts: { id: string; balance: string }[] = []
): Promise<void> {
  await tx
    .update(financePlans)
    .set({
      initialSavings: r.initialSavings,
      initialInvestments: r.initialInvestments,
      balancesAsOf: r.balancesAsOf,
      updatedAt: new Date(),
    })
    .where(eq(financePlans.id, planId));
  for (const [debtId, balance] of Object.entries(r.debtBalances)) {
    await tx
      .update(financePlanDebts)
      .set({ initialBalance: balance })
      .where(and(eq(financePlanDebts.id, debtId), eq(financePlanDebts.planId, planId)));
  }
  if (r.syncConfirmationId) {
    await tx
      .update(financePlanConfirmations)
      .set({
        confirmedSavings: r.initialSavings,
        confirmedInvestments: r.initialInvestments,
        confirmedAt: new Date(),
      })
      .where(
        and(
          eq(financePlanConfirmations.id, r.syncConfirmationId),
          eq(financePlanConfirmations.planId, planId)
        )
      );
    await tx
      .delete(financePlanDebtConfirmations)
      .where(eq(financePlanDebtConfirmations.confirmationId, r.syncConfirmationId));
    const rows = [
      ...Object.entries(r.debtBalances).map(([debtId, balance]) => ({ debtId, balance })),
      ...extraDebts.map((d) => ({ debtId: d.id, balance: d.balance })),
    ];
    if (rows.length > 0) {
      await tx.insert(financePlanDebtConfirmations).values(
        rows.map((row) => ({
          confirmationId: r.syncConfirmationId!,
          debtId: row.debtId,
          confirmedBalance: row.balance,
        }))
      );
    }
  }
}

/**
 * `restatement` (from `restateOpeningBalances`) is passed when the edit
 * changes an opening balance: the whole set is then restated as of that day.
 */
export async function updatePlan(
  userId: string,
  data: UpdateFinancePlanData,
  restatement?: PlanRestatement | null
): Promise<FinancePlan> {
  await ensureOwnership(data.id, userId);
  if (data.basedOnPlanId != null) {
    if (data.basedOnPlanId === data.id) {
      throw new Error("A plan cannot be based on itself");
    }
    // The base plan must exist and belong to the same user.
    await ensureOwnership(data.basedOnPlanId, userId);
  }
  const run = async (exec: typeof db | Tx): Promise<FinancePlan | undefined> => {
    const [plan] = await exec
      .update(financePlans)
      .set({
        name: data.name,
        description: data.description ?? null,
        startMonth: data.startMonth,
        monthsAhead: data.monthsAhead,
        initialSavings: restatement?.initialSavings ?? data.initialSavings,
        monthlySavingsRate: data.monthlySavingsRate,
        includePortfolio: data.includePortfolio,
        surplusToDebtsPercent: data.surplusToDebtsPercent,
        debtStrategy: data.debtStrategy,
        autoInvestPercent: data.autoInvestPercent,
        autoInvestMethodId: data.autoInvestMethodId ?? null,
        initialInvestments: restatement?.initialInvestments ?? data.initialInvestments,
        confirmationDayOfMonth: data.confirmationDayOfMonth,
        color: data.color,
        // undefined leaves the link untouched; null explicitly detaches.
        basedOnPlanId: data.basedOnPlanId,
        ...(restatement ? { balancesAsOf: restatement.balancesAsOf } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(financePlans.id, data.id), eq(financePlans.userId, userId)))
      .returning();
    return plan;
  };
  const plan = restatement
    ? await db.transaction(async (tx) => {
        const updated = await run(tx);
        if (updated) await writeRestatement(tx, data.id, restatement);
        return updated;
      })
    : await run(db);
  // Ownership was checked above, so a miss means the plan was deleted since.
  if (!plan) throw new Error("Plan not found");
  return plan;
}

export async function deletePlan(userId: string, planId: string): Promise<void> {
  await ensureOwnership(planId, userId);
  await db.transaction(async (tx) => {
    // Was this the main plan? If so, after deletion we need to promote
    // another plan to keep the user with a main (so the confirmation host
    // and dashboard finance card still have a target).
    const [target] = await tx
      .select({ isMain: financePlans.isMain })
      .from(financePlans)
      .where(and(eq(financePlans.id, planId), eq(financePlans.userId, userId)));

    await tx
      .delete(financePlans)
      .where(and(eq(financePlans.id, planId), eq(financePlans.userId, userId)));

    if (target?.isMain) {
      const [nextOldest] = await tx
        .select({ id: financePlans.id })
        .from(financePlans)
        .where(eq(financePlans.userId, userId))
        .orderBy(asc(financePlans.createdAt))
        .limit(1);
      if (nextOldest) {
        await tx
          .update(financePlans)
          .set({ isMain: true })
          .where(eq(financePlans.id, nextOldest.id));
      }
    }
  });
}

/**
 * Atomically marks `planId` as the user's main plan and clears the flag on
 * every other plan they own. Enforced at the DB level by the partial unique
 * index, but the transaction makes the swap race-free.
 */
export async function setMainPlan(
  userId: string,
  planId: string
): Promise<void> {
  await ensureOwnership(planId, userId);
  await db.transaction(async (tx) => {
    // Clear the flag on every other plan first so the partial unique index
    // doesn't fire when we try to set the new one.
    await tx
      .update(financePlans)
      .set({ isMain: false })
      .where(
        and(eq(financePlans.userId, userId), eq(financePlans.isMain, true))
      );
    await tx
      .update(financePlans)
      .set({ isMain: true })
      .where(and(eq(financePlans.id, planId), eq(financePlans.userId, userId)));
  });
}

/** Repaints a single plan without touching any other field. */
export async function setPlanColor(
  userId: string,
  planId: string,
  color: string
): Promise<void> {
  await ensureOwnership(planId, userId);
  await db
    .update(financePlans)
    .set({ color, updatedAt: new Date() })
    .where(and(eq(financePlans.id, planId), eq(financePlans.userId, userId)));
}

/**
 * Returns the user's main plan, or null if none has been marked.
 *
 * Request-cached: the dashboard's finance card and its confirmation host both
 * resolve the main plan in the same render.
 */
export const getMainPlan = cache(async function getMainPlan(
  userId: string
): Promise<FinancePlan | null> {
  const [plan] = await db
    .select()
    .from(financePlans)
    .where(and(eq(financePlans.userId, userId), eq(financePlans.isMain, true)))
    .limit(1);
  return plan ?? null;
});

export async function clonePlan(
  userId: string,
  sourcePlanId: string,
  newName: string,
  options: { asScenario?: boolean } = {}
): Promise<FinancePlan> {
  const source = await getPlanWithLines(sourcePlanId, userId);
  if (!source) throw new Error("Plan not found");

  // One transaction: a clone either arrives whole (plan, lines AND the
  // per-month overrides pointing at them) or not at all.
  return db.transaction(async (tx) => {
    const [plan] = await tx
      .insert(financePlans)
      .values({
        userId,
        name: newName,
        description: source.description,
        startMonth: source.startMonth,
        monthsAhead: source.monthsAhead,
        initialSavings: source.initialSavings,
        monthlySavingsRate: source.monthlySavingsRate,
        includePortfolio: source.includePortfolio,
        surplusToDebtsPercent: source.surplusToDebtsPercent,
        debtStrategy: source.debtStrategy,
        autoInvestPercent: source.autoInvestPercent,
        autoInvestMethodId: source.autoInvestMethodId,
        initialInvestments: source.initialInvestments,
        // Keep the accounting-period anchor: without it the clone falls back to
        // day 1 and its periods drift out of alignment with the source plan.
        confirmationDayOfMonth: source.confirmationDayOfMonth,
        color: source.color,
        // Same balances, stated on the same day — the clone opens exactly
        // where its source does.
        balancesAsOf: source.balancesAsOf,
        basedOnPlanId: options.asScenario ? source.id : null,
      })
      .returning();

    // Old line id → new line id, per side. Overrides reference their line
    // polymorphically (no FK), so they have to be re-pointed by hand — a clone
    // that dropped them projected a skipped rent as paid and diverged from an
    // unchanged base. Confirmations are deliberately NOT copied: a scenario is
    // a what-if, and the comparison runs both plans on the same basis.
    const idMap = new Map<string, string>();
    const remember = (side: string, from: { id: string }[], to: { id: string }[]): void => {
      from.forEach((row, i) => {
        if (to[i]) idMap.set(`${side}:${row.id}`, to[i].id);
      });
    };

    if (source.incomes.length > 0) {
      const rows = await tx
        .insert(financePlanIncomes)
        .values(
          source.incomes.map((i) => ({
            planId: plan.id,
            name: i.name,
            monthlyAmount: i.monthlyAmount,
            kind: i.kind,
            dayOfMonth: i.dayOfMonth,
            date: i.date,
            startDate: i.startDate,
            endDate: i.endDate,
            recurrenceType: i.recurrenceType,
            weekOfMonth: i.weekOfMonth,
            dayOfWeek: i.dayOfWeek,
            intervalMonths: i.intervalMonths,
            recurrenceStart: i.recurrenceStart,
            sortOrder: i.sortOrder,
          }))
        )
        .returning({ id: financePlanIncomes.id });
      remember("income", source.incomes, rows);
    }
    if (source.expenses.length > 0) {
      const rows = await tx
        .insert(financePlanExpenses)
        .values(
          source.expenses.map((e) => ({
            planId: plan.id,
            name: e.name,
            monthlyAmount: e.monthlyAmount,
            kind: e.kind,
            dayOfMonth: e.dayOfMonth,
            date: e.date,
            recurrenceType: e.recurrenceType,
            weekOfMonth: e.weekOfMonth,
            dayOfWeek: e.dayOfWeek,
            intervalMonths: e.intervalMonths,
            recurrenceStart: e.recurrenceStart,
            sortOrder: e.sortOrder,
          }))
        )
        .returning({ id: financePlanExpenses.id });
      remember("expense", source.expenses, rows);
    }
    if (source.debts.length > 0) {
      const rows = await tx
        .insert(financePlanDebts)
        .values(
          source.debts.map((d) => ({
            planId: plan.id,
            name: d.name,
            initialBalance: d.initialBalance,
            monthlyInterestRate: d.monthlyInterestRate,
            monthlyPayment: d.monthlyPayment,
            paymentType: d.paymentType,
            minPaymentPercent: d.minPaymentPercent,
            minPaymentFloor: d.minPaymentFloor,
            dayOfMonth: d.dayOfMonth,
            recurrenceType: d.recurrenceType,
            weekOfMonth: d.weekOfMonth,
            dayOfWeek: d.dayOfWeek,
            intervalMonths: d.intervalMonths,
            recurrenceStart: d.recurrenceStart,
            sortOrder: d.sortOrder,
          }))
        )
        .returning({ id: financePlanDebts.id });
      remember("debt", source.debts, rows);
    }

    const overrides = cloneOverrides(source.overrides, plan.id, idMap);
    if (overrides.length > 0) {
      await tx.insert(financePlanLineOverrides).values(overrides);
    }

    return plan;
  });
}

/**
 * The source plan's overrides re-pointed at the clone's lines. Overrides whose
 * line didn't come across (a dangling id) are dropped. Exported for tests.
 */
export function cloneOverrides(
  overrides: FinancePlanWithLines["overrides"],
  newPlanId: string,
  idMap: ReadonlyMap<string, string>
): Array<{
  planId: string;
  parentSide: FinancePlanWithLines["overrides"][number]["parentSide"];
  parentId: string;
  monthYear: string;
  action: FinancePlanWithLines["overrides"][number]["action"];
  date: string | null;
  monthlyAmount: string | null;
}> {
  return overrides.flatMap((o) => {
    const parentId = idMap.get(`${o.parentSide}:${o.parentId}`);
    if (!parentId) return [];
    return [
      {
        planId: newPlanId,
        parentSide: o.parentSide,
        parentId,
        monthYear: o.monthYear,
        action: o.action,
        date: o.date,
        monthlyAmount: o.monthlyAmount,
      },
    ];
  });
}

// ---------- income / expense / debt CRUD ----------

export async function addIncome(
  userId: string,
  planId: string,
  data: PlanIncomeData
): Promise<FinancePlanIncome> {
  await ensureOwnership(planId, userId);
  const [row] = await db
    .insert(financePlanIncomes)
    .values({
      planId,
      name: data.name,
      monthlyAmount: data.monthlyAmount,
      kind: data.kind,
      dayOfMonth: data.dayOfMonth ?? null,
      date: data.kind === "one_time" ? data.date ?? null : null,
      startDate: data.kind === "recurring" ? data.startDate ?? null : null,
      endDate: data.kind === "recurring" ? data.endDate ?? null : null,
      recurrenceType: data.recurrenceType,
      weekOfMonth: data.weekOfMonth ?? null,
      dayOfWeek: data.dayOfWeek ?? null,
      intervalMonths: data.intervalMonths ?? null,
      recurrenceStart: data.recurrenceStart ?? null,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateIncome(
  userId: string,
  planId: string,
  data: UpdatePlanIncomeData
): Promise<FinancePlanIncome> {
  await ensureOwnership(planId, userId);
  const [row] = await db
    .update(financePlanIncomes)
    .set({
      name: data.name,
      monthlyAmount: data.monthlyAmount,
      kind: data.kind,
      dayOfMonth: data.dayOfMonth ?? null,
      date: data.kind === "one_time" ? data.date ?? null : null,
      startDate: data.kind === "recurring" ? data.startDate ?? null : null,
      endDate: data.kind === "recurring" ? data.endDate ?? null : null,
      recurrenceType: data.recurrenceType,
      weekOfMonth: data.weekOfMonth ?? null,
      dayOfWeek: data.dayOfWeek ?? null,
      intervalMonths: data.intervalMonths ?? null,
      recurrenceStart: data.recurrenceStart ?? null,
      sortOrder: data.sortOrder,
    })
    .where(and(eq(financePlanIncomes.id, data.id), eq(financePlanIncomes.planId, planId)))
    .returning();
  // The plan is the user's, but the line id is the caller's: one from another
  // plan matches nothing.
  if (!row) throw new Error("Income not found on this plan");
  return row;
}

export async function deleteIncome(
  userId: string,
  planId: string,
  incomeId: string
): Promise<void> {
  await ensureOwnership(planId, userId);
  // Cascade: kill any per-month overrides pointing at this income. The DB
  // can't enforce it because parentId is a polymorphic FK.
  await db
    .delete(financePlanLineOverrides)
    .where(
      and(
        eq(financePlanLineOverrides.planId, planId),
        eq(financePlanLineOverrides.parentSide, "income"),
        eq(financePlanLineOverrides.parentId, incomeId)
      )
    );
  await db
    .delete(financePlanIncomes)
    .where(and(eq(financePlanIncomes.id, incomeId), eq(financePlanIncomes.planId, planId)));
}

export async function addExpense(
  userId: string,
  planId: string,
  data: PlanExpenseData
): Promise<FinancePlanExpense> {
  await ensureOwnership(planId, userId);
  const [row] = await db
    .insert(financePlanExpenses)
    .values({
      planId,
      name: data.name,
      monthlyAmount: data.monthlyAmount,
      kind: data.kind,
      dayOfMonth: data.dayOfMonth ?? null,
      date: data.kind === "one_time" ? data.date ?? null : null,
      recurrenceType: data.recurrenceType,
      weekOfMonth: data.weekOfMonth ?? null,
      dayOfWeek: data.dayOfWeek ?? null,
      intervalMonths: data.intervalMonths ?? null,
      recurrenceStart: data.recurrenceStart ?? null,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateExpense(
  userId: string,
  planId: string,
  data: UpdatePlanExpenseData
): Promise<FinancePlanExpense> {
  await ensureOwnership(planId, userId);
  const [row] = await db
    .update(financePlanExpenses)
    .set({
      name: data.name,
      monthlyAmount: data.monthlyAmount,
      kind: data.kind,
      dayOfMonth: data.dayOfMonth ?? null,
      date: data.kind === "one_time" ? data.date ?? null : null,
      recurrenceType: data.recurrenceType,
      weekOfMonth: data.weekOfMonth ?? null,
      dayOfWeek: data.dayOfWeek ?? null,
      intervalMonths: data.intervalMonths ?? null,
      recurrenceStart: data.recurrenceStart ?? null,
      sortOrder: data.sortOrder,
    })
    .where(and(eq(financePlanExpenses.id, data.id), eq(financePlanExpenses.planId, planId)))
    .returning();
  // The plan is the user's, but the line id is the caller's: one from another
  // plan matches nothing.
  if (!row) throw new Error("Expense not found on this plan");
  return row;
}

export async function deleteExpense(
  userId: string,
  planId: string,
  expenseId: string
): Promise<void> {
  await ensureOwnership(planId, userId);
  await db
    .delete(financePlanLineOverrides)
    .where(
      and(
        eq(financePlanLineOverrides.planId, planId),
        eq(financePlanLineOverrides.parentSide, "expense"),
        eq(financePlanLineOverrides.parentId, expenseId)
      )
    );
  await db
    .delete(financePlanExpenses)
    .where(and(eq(financePlanExpenses.id, expenseId), eq(financePlanExpenses.planId, planId)));
}

export async function addDebt(
  userId: string,
  planId: string,
  data: PlanDebtData,
  restatement?: PlanRestatement | null
): Promise<FinancePlanDebt> {
  await ensureOwnership(planId, userId);
  if (restatement) {
    // The new debt's balance is as of today like the rest of the set.
    return db.transaction(async (tx) => {
      const [row] = await insertDebt(tx, planId, data);
      await writeRestatement(tx, planId, restatement, [
        { id: row.id, balance: data.initialBalance },
      ]);
      return row;
    });
  }
  const [row] = await insertDebt(db, planId, data);
  return row;
}

function insertDebt(
  exec: typeof db | Tx,
  planId: string,
  data: PlanDebtData
): Promise<FinancePlanDebt[]> {
  return exec
    .insert(financePlanDebts)
    .values({
      planId,
      name: data.name,
      initialBalance: data.initialBalance,
      monthlyInterestRate: data.monthlyInterestRate,
      monthlyPayment: data.monthlyPayment,
      paymentType: data.paymentType,
      minPaymentPercent: data.minPaymentPercent,
      minPaymentFloor: data.minPaymentFloor,
      dayOfMonth: data.dayOfMonth ?? null,
      recurrenceType: data.recurrenceType,
      weekOfMonth: data.weekOfMonth ?? null,
      dayOfWeek: data.dayOfWeek ?? null,
      intervalMonths: data.intervalMonths ?? null,
      recurrenceStart: data.recurrenceStart ?? null,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();
}

export async function updateDebt(
  userId: string,
  planId: string,
  data: UpdatePlanDebtData,
  restatement?: PlanRestatement | null
): Promise<FinancePlanDebt> {
  await ensureOwnership(planId, userId);
  const run = async (exec: typeof db | Tx): Promise<FinancePlanDebt | undefined> => {
    const [row] = await exec
      .update(financePlanDebts)
      .set({
        name: data.name,
        initialBalance: data.initialBalance,
        monthlyInterestRate: data.monthlyInterestRate,
        monthlyPayment: data.monthlyPayment,
        paymentType: data.paymentType,
        minPaymentPercent: data.minPaymentPercent,
        minPaymentFloor: data.minPaymentFloor,
        dayOfMonth: data.dayOfMonth ?? null,
        recurrenceType: data.recurrenceType,
        weekOfMonth: data.weekOfMonth ?? null,
        dayOfWeek: data.dayOfWeek ?? null,
        intervalMonths: data.intervalMonths ?? null,
        recurrenceStart: data.recurrenceStart ?? null,
        sortOrder: data.sortOrder,
      })
      .where(and(eq(financePlanDebts.id, data.id), eq(financePlanDebts.planId, planId)))
      .returning();
    return row;
  };
  const row = restatement
    ? await db.transaction(async (tx) => {
        const updated = await run(tx);
        if (updated) await writeRestatement(tx, planId, restatement);
        return updated;
      })
    : await run(db);
  // The plan is the user's, but the line id is the caller's: one from another
  // plan matches nothing.
  if (!row) throw new Error("Debt not found on this plan");
  return row;
}

export async function deleteDebt(
  userId: string,
  planId: string,
  debtId: string
): Promise<void> {
  await ensureOwnership(planId, userId);
  await db
    .delete(financePlanLineOverrides)
    .where(
      and(
        eq(financePlanLineOverrides.planId, planId),
        eq(financePlanLineOverrides.parentSide, "debt"),
        eq(financePlanLineOverrides.parentId, debtId)
      )
    );
  await db
    .delete(financePlanDebts)
    .where(and(eq(financePlanDebts.id, debtId), eq(financePlanDebts.planId, planId)));
}

// ---------- per-month line overrides ----------

/**
 * Upserts a single override for (parentSide, parentId, monthYear). The unique
 * index on those three columns makes this an idempotent replace: writing a
 * second override for the same recurring entry in the same month replaces
 * whatever was there before.
 */
export async function upsertLineOverride(
  userId: string,
  planId: string,
  data: LineOverrideData
): Promise<void> {
  await ensureOwnership(planId, userId);
  await db
    .insert(financePlanLineOverrides)
    .values({
      planId,
      parentSide: data.parentSide,
      parentId: data.parentId,
      monthYear: data.monthYear,
      action: data.action,
      date: data.action === "reschedule" ? data.date ?? null : null,
      monthlyAmount:
        data.action === "amount" ? data.monthlyAmount ?? null : null,
    })
    .onConflictDoUpdate({
      target: [
        financePlanLineOverrides.parentSide,
        financePlanLineOverrides.parentId,
        financePlanLineOverrides.monthYear,
      ],
      set: {
        action: data.action,
        date: data.action === "reschedule" ? data.date ?? null : null,
        monthlyAmount:
          data.action === "amount" ? data.monthlyAmount ?? null : null,
      },
    });
}

export async function deleteLineOverride(
  userId: string,
  planId: string,
  data: DeleteLineOverrideData
): Promise<void> {
  await ensureOwnership(planId, userId);
  await db
    .delete(financePlanLineOverrides)
    .where(
      and(
        eq(financePlanLineOverrides.planId, planId),
        eq(financePlanLineOverrides.parentSide, data.parentSide),
        eq(financePlanLineOverrides.parentId, data.parentId),
        eq(financePlanLineOverrides.monthYear, data.monthYear)
      )
    );
}

// ---------- projection ----------
//
// The engine lives in `lib/finance/projection.ts` (pure, so the client editor
// can run it too). Re-exported here for the existing server callers.
export {
  compareDebtStrategies,
  deriveFinanceMood,
  projectPlan,
  projectStateAt,
} from "@/lib/finance/projection";
export type { ProjectOptions } from "@/lib/finance/projection";

/** Request-cached: every projection on a plans page asks for this. */
export const getPortfolioValueForUser = cache(async function getPortfolioValueForUser(
  userId: string
): Promise<number> {
  const portfolio = await getUserPortfolio(userId);
  if (!portfolio) return 0;
  const stats = await getPortfolioStats(portfolio.id);
  return stats.totalValue;
});

/**
 * Value-weighted average monthly ROI (as a decimal) of the user's current
 * portfolio holdings. Weights each investment method's monthly ROI by the
 * holding value. Returns 0 when the user has no portfolio or no holdings,
 * which makes projections hold the portfolio flat (the safe fallback).
 */
export const getPortfolioWeightedMonthlyRoi = cache(async function getPortfolioWeightedMonthlyRoi(
  userId: string
): Promise<number> {
  const portfolio = await getUserPortfolio(userId);
  if (!portfolio) return 0;
  const assets = await getPortfolioAssets(portfolio.id);
  let weightedRoi = 0;
  let totalWeight = 0;
  for (const asset of assets) {
    if (asset.holdingAmount <= 0) continue;
    // monthly_roi is stored as a percentage (e.g. "0.7000" = 0.70%).
    weightedRoi += asset.holdingAmount * (num(asset.investmentMethod.monthlyRoi) / 100);
    totalWeight += asset.holdingAmount;
  }
  return totalWeight > 0 ? weightedRoi / totalWeight : 0;
});

/**
 * Resolves the monthly ROI (as a decimal) of the plan's auto-invest method, or
 * 0 if none is linked. Used to compound the investments bucket during projection.
 */
export async function getAutoInvestRate(plan: FinancePlan): Promise<number> {
  if (!plan.autoInvestMethodId) return 0;
  const [row] = await db
    .select({ monthlyRoi: investmentMethods.monthlyRoi })
    .from(investmentMethods)
    .where(eq(investmentMethods.id, plan.autoInvestMethodId));
  if (!row) return 0;
  // monthly_roi is stored as a percentage (e.g. "0.7000" = 0.70%). Convert to a
  // decimal multiplier the projection algorithm can apply directly.
  return num(row.monthlyRoi) / 100;
}

/**
 * Everything `projectPlan` needs beyond the plan's own lines: the live
 * portfolio (and its blended growth) when the plan includes it, the
 * auto-invest method's ROI, the overrides and the as-of day. One place, so
 * the plan page, the lists, the dashboard, the snapshots and the strategy
 * comparison all project with the SAME inputs.
 */
export async function projectionOptionsFor(
  plan: FinancePlanWithLines,
  userId: string
): Promise<ProjectOptions> {
  const [portfolioValue, portfolioMonthlyGrowthRate, autoInvestRate] = await Promise.all([
    plan.includePortfolio ? getPortfolioValueForUser(userId) : Promise.resolve(0),
    plan.includePortfolio ? getPortfolioWeightedMonthlyRoi(userId) : Promise.resolve(0),
    getAutoInvestRate(plan),
  ]);
  return {
    portfolioValue,
    portfolioMonthlyGrowthRate,
    autoInvestRate,
    overrides: plan.overrides,
    asOf: plan.asOf ?? null,
  };
}

export async function projectPlanWithPortfolio(
  plan: FinancePlanWithLines,
  userId: string
): Promise<Projection> {
  const options = await projectionOptionsFor(plan, userId);
  return projectPlan(plan, plan.incomes, plan.expenses, plan.debts, options);
}
