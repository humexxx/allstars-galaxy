import "server-only";

import { cache } from "react";

import { db } from "@/db";
import {
  financePlans,
  financePlanIncomes,
  financePlanExpenses,
  financePlanDebts,
  financePlanLineOverrides,
} from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

import type {
  DebtStrategy,
  FinancePlan,
  FinancePlanDebt,
  FinancePlanExpense,
  FinancePlanIncome,
  FinancePlanLineOverride,
  FinancePlanWithLines,
  Projection,
  ProjectionMonth,
} from "@/types/finance";
import type {
  CreateFinancePlanInput,
  DeleteLineOverrideInput,
  LineOverrideInput,
  PlanDebtInput,
  PlanExpenseInput,
  PlanIncomeInput,
  UpdateFinancePlanInput,
  UpdatePlanDebtInput,
  UpdatePlanExpenseInput,
  UpdatePlanIncomeInput,
} from "@/schemas/finance";

import { getUserPortfolio, getPortfolioStats } from "./portfolio-service";

// ---------- helpers ----------

function num(value: string | number): number {
  return typeof value === "number" ? value : parseFloat(value || "0");
}

function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

// Year-month integer (e.g. 2026-03 → 24315). Lets us compare months without
// dealing with timezones or day-of-month — purely a calendar bucket.
function yearMonthKey(year: number, monthZeroIdx: number): number {
  return year * 12 + monthZeroIdx;
}

function yearMonthKeyFromDate(date: Date): number {
  return yearMonthKey(date.getUTCFullYear(), date.getUTCMonth());
}

// Parses "YYYY-MM-DD" into a year-month key at UTC. Returns null for nullish
// inputs. We only care about year/month for the projection — the day is for
// the calendar view only.
function yearMonthKeyFromISO(value: string | null | undefined): number | null {
  if (!value) return null;
  const [y, m] = value.split("-").map((s) => parseInt(s, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return yearMonthKey(y, m - 1);
}

// Splits "YYYY-MM-DD" into its calendar parts (month is 0-indexed for parity
// with Date.prototype.getMonth). Used by the day-aware debt loop to decide
// whether a reschedule override's date lands inside the current projection
// month and on which day.
function parseISODateLocal(
  value: string
): { year: number; month: number; day: number } | null {
  const [y, m, d] = value.split("-").map((s) => parseInt(s, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  return { year: y, month: m - 1, day: d };
}

// True if a recurring income/expense is active during the month at `monthKey`.
// `startMonthKey` null → no lower bound. `endMonthKey` null → no upper bound.
function isActiveInMonth(
  monthKey: number,
  startMonthKey: number | null,
  endMonthKey: number | null
): boolean {
  if (startMonthKey !== null && monthKey < startMonthKey) return false;
  if (endMonthKey !== null && monthKey > endMonthKey) return false;
  return true;
}

async function ensureOwnership(planId: string, userId: string): Promise<void> {
  const [row] = await db
    .select({ userId: financePlans.userId })
    .from(financePlans)
    .where(eq(financePlans.id, planId));
  if (!row || row.userId !== userId) {
    throw new Error("Plan not found");
  }
}

// ---------- plan CRUD ----------

export async function listUserPlans(userId: string): Promise<FinancePlan[]> {
  return db
    .select()
    .from(financePlans)
    .where(eq(financePlans.userId, userId))
    .orderBy(asc(financePlans.createdAt));
}

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

export async function createPlan(
  userId: string,
  data: CreateFinancePlanInput
): Promise<FinancePlan> {
  const [plan] = await db
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
    })
    .returning();
  return plan;
}

export async function updatePlan(
  userId: string,
  data: UpdateFinancePlanInput
): Promise<FinancePlan> {
  await ensureOwnership(data.id, userId);
  const [plan] = await db
    .update(financePlans)
    .set({
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
      updatedAt: new Date(),
    })
    .where(eq(financePlans.id, data.id))
    .returning();
  return plan;
}

export async function deletePlan(userId: string, planId: string): Promise<void> {
  await ensureOwnership(planId, userId);
  await db.delete(financePlans).where(eq(financePlans.id, planId));
}

export async function clonePlan(
  userId: string,
  sourcePlanId: string,
  newName: string
): Promise<FinancePlan> {
  const source = await getPlanWithLines(sourcePlanId, userId);
  if (!source) throw new Error("Plan not found");

  const [plan] = await db
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
      color: source.color,
    })
    .returning();

  if (source.incomes.length > 0) {
    await db.insert(financePlanIncomes).values(
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
    );
  }
  if (source.expenses.length > 0) {
    await db.insert(financePlanExpenses).values(
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
    );
  }
  if (source.debts.length > 0) {
    await db.insert(financePlanDebts).values(
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
    );
  }

  return plan;
}

// ---------- income / expense / debt CRUD ----------

export async function addIncome(
  userId: string,
  planId: string,
  data: PlanIncomeInput
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
  data: UpdatePlanIncomeInput
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
  data: PlanExpenseInput
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
  data: UpdatePlanExpenseInput
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
  data: PlanDebtInput
): Promise<FinancePlanDebt> {
  await ensureOwnership(planId, userId);
  const [row] = await db
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
  return row;
}

export async function updateDebt(
  userId: string,
  planId: string,
  data: UpdatePlanDebtInput
): Promise<FinancePlanDebt> {
  await ensureOwnership(planId, userId);
  const [row] = await db
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
  data: LineOverrideInput
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
  data: DeleteLineOverrideInput
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

// ---------- projection algorithm ----------

type DebtRuntimeState = {
  id: string;
  name: string;
  balance: number;
  rate: number;
  // For 'fixed' debts this is the constant monthly payment. For 'percent_of_balance'
  // debts it is recomputed each month as max(balance * pct, floor).
  scheduledPaymentFixed: number;
  paymentType: import("@/types/finance").DebtPaymentType;
  minPercent: number;
  minFloor: number;
  // Recurrence model — see RecurrenceType. monthly_day / monthly_weekday hit
  // every month; every_n_months hits on the every-N cycle anchored at
  // anchorKey (interest still accrues every month, payments don't).
  recurrenceType: "monthly_day" | "monthly_weekday" | "every_n_months";
  intervalMonths: number | null;
  anchorKey: number | null;
  // Day-of-month fields drive WHEN inside a month the payment lands, which
  // the day-aware interest split uses to charge less interest when the
  // payment hits early.
  dayOfMonth: number | null;
  weekOfMonth: number | null;
  dayOfWeek: number | null;
};

// Day-of-month (1..lastDay) the debt payment lands on in (year, monthIdx).
// Mirrors the calendar's resolver so the projection charges interest against
// the same date the user sees on their calendar.
function nthWeekdayOfMonth(
  year: number,
  monthIdx: number,
  weekOfMonth: number,
  dayOfWeek: number
): number {
  const firstDow = new Date(year, monthIdx, 1).getDay();
  const firstOccurrence = 1 + ((dayOfWeek - firstDow + 7) % 7);
  let target = firstOccurrence + (weekOfMonth - 1) * 7;
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  if (target > lastDay) target -= 7;
  return target;
}

function debtPaymentDayInMonth(
  d: DebtRuntimeState,
  year: number,
  monthIdx: number
): number {
  if (
    d.recurrenceType === "monthly_weekday" &&
    d.weekOfMonth != null &&
    d.dayOfWeek != null
  ) {
    return nthWeekdayOfMonth(year, monthIdx, d.weekOfMonth, d.dayOfWeek);
  }
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  return Math.min(d.dayOfMonth ?? 1, lastDay);
}

// True if a recurring entry contributes to this month. monthly_day and
// monthly_weekday differ only in WHICH day inside the month — both contribute
// every month at the projection level. every_n_months contributes only on
// hit months in the cycle anchored at anchorKey.
function isRecurringHitMonth(
  monthKey: number,
  recurrenceType: "monthly_day" | "monthly_weekday" | "every_n_months",
  intervalMonths: number | null,
  anchorKey: number | null
): boolean {
  if (recurrenceType !== "every_n_months") return true;
  if (!intervalMonths || intervalMonths < 1 || anchorKey === null) return true;
  if (monthKey < anchorKey) return false;
  return (monthKey - anchorKey) % intervalMonths === 0;
}

function scheduledPaymentFor(d: DebtRuntimeState, balanceWithInterest: number): number {
  if (d.paymentType === "percent_of_balance") {
    const computed = balanceWithInterest * d.minPercent;
    return Math.max(computed, d.minFloor);
  }
  return d.scheduledPaymentFixed;
}

// Single epsilon used everywhere — debts below this are considered paid off.
// Same threshold as the active-filter so ordering and monthsToDebtFree agree.
const DEBT_PAID_EPS = 0.01;

function orderDebtsByStrategy(
  debts: DebtRuntimeState[],
  strategy: DebtStrategy
): DebtRuntimeState[] {
  const active = debts.filter((d) => d.balance > DEBT_PAID_EPS);
  // Tertiary tie-break by stable `id` so multiple debts with identical rate &
  // balance always order deterministically across runs.
  if (strategy === "avalanche") {
    return active.sort(
      (a, b) => b.rate - a.rate || b.balance - a.balance || a.id.localeCompare(b.id)
    );
  }
  if (strategy === "snowball") {
    return active.sort(
      (a, b) => a.balance - b.balance || b.rate - a.rate || a.id.localeCompare(b.id)
    );
  }
  return active;
}

type ProjectOptions = {
  portfolioValue?: number;
  /** Monthly ROI (decimal) for the auto-invest account. Looked up from the plan's
   *  autoInvestMethodId by the calling page. Ignored if plan.autoInvestPercent = 0. */
  autoInvestRate?: number;
  /** Per-month overrides for recurring entries. Optional so old callers that
   *  don't have access to overrides still work (they project as if no
   *  overrides were set, which is correct for those caller surfaces). */
  overrides?: FinancePlanLineOverride[];
};

/**
 * Walks the plan month by month and returns a series with savings, debts,
 * investments, cash flow and net worth at the end of each period.
 *
 * Each month, in order:
 *   1. Interest accrues on each debt balance.
 *   2. The scheduled payment for each debt is applied (capped at balance).
 *      For 'percent_of_balance' debts (credit cards) the payment is recomputed
 *      from the current balance, so it shrinks as the debt shrinks → curved line.
 *   3. Cash flow = income − expenses − total scheduled payments.
 *   4. If cash flow > 0 and surplusToDebtsPercent > 0, route a slice to EXTRA
 *      debt principal using the chosen strategy.
 *   5. From what's left, optionally route autoInvestPercent into the investments
 *      bucket. The remainder goes to savings.
 *   6. Savings + investments accrue their monthly compound interest.
 *
 * portfolioValue (the user's live portfolio) is added to net worth but does not
 * earn the savings or investment rate (it grows independently in its own module).
 */
export function projectPlan(
  plan: FinancePlan,
  incomes: FinancePlanIncome[],
  expenses: FinancePlanExpense[],
  debts: FinancePlanDebt[],
  options: ProjectOptions = {}
): Projection {
  const portfolioValue = Math.max(0, options.portfolioValue ?? 0);
  // Guard against negative ROI configurations — investments never shrink.
  const autoInvestRate = Math.max(0, options.autoInvestRate ?? 0);

  // Index overrides by side+parentId+monthKey so each iteration is O(1) lookup.
  // Overrides are an opt-in arg so older callers that don't pass them still
  // work (treated as no overrides → unchanged behaviour).
  const overrides = options.overrides ?? [];
  const overrideIndex = new Map<string, FinancePlanLineOverride>();
  for (const o of overrides) {
    const mKey = yearMonthKeyFromISO(o.monthYear);
    if (mKey === null) continue;
    overrideIndex.set(`${o.parentSide}:${o.parentId}:${mKey}`, o);
  }
  const lookupOverride = (
    side: "income" | "expense" | "debt",
    parentId: string,
    monthKey: number
  ): FinancePlanLineOverride | undefined =>
    overrideIndex.get(`${side}:${parentId}:${monthKey}`);

  // Anchor used by every_n_months when an entry doesn't set its own
  // recurrenceStart — fall back to the plan's startMonth.
  const planStartKey = yearMonthKeyFromDate(plan.startMonth);
  const anchorFor = (
    type: "monthly_day" | "monthly_weekday" | "every_n_months",
    recurrenceStart: string | null
  ): number | null =>
    type === "every_n_months"
      ? yearMonthKeyFromISO(recurrenceStart) ?? planStartKey
      : null;

  // Pre-compute per-line month bounds and one-time hit-months so the inner
  // loop is O(lines) per month with no string parsing or branching surprises.
  const incomeRows = incomes.map((i) => ({
    id: i.id,
    amount: Math.max(0, num(i.monthlyAmount)),
    kind: i.kind,
    startKey: yearMonthKeyFromISO(i.startDate),
    endKey: yearMonthKeyFromISO(i.endDate),
    oneTimeKey: i.kind === "one_time" ? yearMonthKeyFromISO(i.date) : null,
    recurrenceType: i.recurrenceType,
    intervalMonths: i.intervalMonths,
    anchorKey: anchorFor(i.recurrenceType, i.recurrenceStart),
  }));
  const expenseRows = expenses.map((e) => ({
    id: e.id,
    amount: Math.max(0, num(e.monthlyAmount)),
    kind: e.kind,
    oneTimeKey: e.kind === "one_time" ? yearMonthKeyFromISO(e.date) : null,
    recurrenceType: e.recurrenceType,
    intervalMonths: e.intervalMonths,
    anchorKey: anchorFor(e.recurrenceType, e.recurrenceStart),
  }));

  const savingsRate = Math.max(0, num(plan.monthlySavingsRate));
  const surplusPercent = Math.max(0, Math.min(1, num(plan.surplusToDebtsPercent)));
  const autoInvestPercent = Math.max(0, Math.min(1, num(plan.autoInvestPercent)));
  // Validate the strategy enum so a stale value doesn't fall through to default.
  const rawStrategy = plan.debtStrategy as string;
  const strategy: DebtStrategy =
    rawStrategy === "avalanche" || rawStrategy === "snowball" || rawStrategy === "none"
      ? rawStrategy
      : "avalanche";

  let savings = num(plan.initialSavings);
  let investments = num(plan.initialInvestments);
  const debtStates: DebtRuntimeState[] = debts.map((d) => ({
    id: d.id,
    name: d.name,
    balance: num(d.initialBalance),
    rate: num(d.monthlyInterestRate),
    scheduledPaymentFixed: num(d.monthlyPayment),
    paymentType: d.paymentType as import("@/types/finance").DebtPaymentType,
    minPercent: num(d.minPaymentPercent),
    minFloor: num(d.minPaymentFloor),
    recurrenceType: d.recurrenceType,
    intervalMonths: d.intervalMonths,
    anchorKey: anchorFor(d.recurrenceType, d.recurrenceStart),
    dayOfMonth: d.dayOfMonth,
    weekOfMonth: d.weekOfMonth,
    dayOfWeek: d.dayOfWeek,
  }));

  const months: ProjectionMonth[] = [];
  let monthsToDebtFree: number | null = null;
  let totalInterestPaidAcrossAllDebts = 0;
  let totalInvestmentsInterestAcrossMonths = 0;

  const monthly = new Map<string, { interest: number; scheduled: number; extra: number }>();

  for (let m = 0; m < plan.monthsAhead; m++) {
    monthly.clear();
    for (const d of debtStates) monthly.set(d.id, { interest: 0, scheduled: 0, extra: 0 });

    let scheduledTotal = 0;
    let interestTotal = 0;

    // Aggregate income/expenses for THIS month: recurring lines that fall
    // within their date window contribute monthlyAmount; one-time lines
    // contribute their amount only on the month that matches their `date`.
    const monthDate = addMonthsUtc(plan.startMonth, m);
    const monthKey = yearMonthKeyFromDate(monthDate);

    let monthIncome = 0;
    for (const row of incomeRows) {
      if (row.kind === "one_time") {
        if (row.oneTimeKey === monthKey) monthIncome += row.amount;
      } else if (
        isActiveInMonth(monthKey, row.startKey, row.endKey) &&
        isRecurringHitMonth(
          monthKey,
          row.recurrenceType,
          row.intervalMonths,
          row.anchorKey
        )
      ) {
        const ov = lookupOverride("income", row.id, monthKey);
        // skip → suppress this month; amount → swap; reschedule → no-op for
        // a monthly-aggregate projection (the day inside the month doesn't
        // matter at this layer).
        if (ov?.action === "skip") continue;
        const amount =
          ov?.action === "amount" && ov.monthlyAmount !== null
            ? Math.max(0, num(ov.monthlyAmount))
            : row.amount;
        monthIncome += amount;
      }
    }
    let monthExpenses = 0;
    for (const row of expenseRows) {
      if (row.kind === "one_time") {
        if (row.oneTimeKey === monthKey) monthExpenses += row.amount;
      } else if (
        isRecurringHitMonth(
          monthKey,
          row.recurrenceType,
          row.intervalMonths,
          row.anchorKey
        )
      ) {
        const ov = lookupOverride("expense", row.id, monthKey);
        if (ov?.action === "skip") continue;
        const amount =
          ov?.action === "amount" && ov.monthlyAmount !== null
            ? Math.max(0, num(ov.monthlyAmount))
            : row.amount;
        monthExpenses += amount;
      }
    }

    // Step 1 + 2: day-aware interest + scheduled payment. The user's calendar
    // tells us which day in the month the payment hits; we charge interest on
    // the pre-payment balance for the days BEFORE the payment, then apply the
    // payment, then charge interest for the days AFTER. Early payments end up
    // accruing less interest, matching how real loans behave. For non-hit
    // months (every_n_months gaps, skip overrides) the full month's interest
    // accrues with no payment.
    const year = monthDate.getUTCFullYear();
    const month = monthDate.getUTCMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (const d of debtStates) {
      if (d.balance <= 0) continue;
      const isHitMonth = isRecurringHitMonth(
        monthKey,
        d.recurrenceType,
        d.intervalMonths,
        d.anchorKey
      );
      const ov = lookupOverride("debt", d.id, monthKey);

      // No payment this month → straight interest on the whole month, no
      // scheduled outflow.
      if (!isHitMonth || ov?.action === "skip") {
        const interest = d.balance * d.rate;
        d.balance += interest;
        interestTotal += interest;
        const entry = monthly.get(d.id)!;
        entry.interest = interest;
        entry.scheduled = 0;
        continue;
      }

      // Decide which day in this month the payment lands on. Reschedule
      // overrides win when their date falls inside the same month.
      let paymentDay = debtPaymentDayInMonth(d, year, month);
      if (ov?.action === "reschedule" && ov.date) {
        const od = parseISODateLocal(ov.date);
        if (od && od.year === year && od.month === month) {
          paymentDay = od.day;
        }
      }

      // Two-halves interest: (paymentDay - 1) days at the pre-payment
      // balance, then payment, then the remaining days at the post-payment
      // balance. Reduces to "full month before payment" when paymentDay =
      // daysInMonth, and "no pre-payment interest" when paymentDay = 1.
      const daysBefore = Math.max(0, paymentDay - 1);
      const interestBefore = d.balance * d.rate * (daysBefore / daysInMonth);
      d.balance += interestBefore;

      const scheduled =
        ov?.action === "amount" && ov.monthlyAmount !== null
          ? Math.max(0, num(ov.monthlyAmount))
          : scheduledPaymentFor(d, d.balance);
      const payment = Math.min(scheduled, d.balance);
      d.balance -= payment;

      const daysAfter = daysInMonth - daysBefore;
      const interestAfter = d.balance * d.rate * (daysAfter / daysInMonth);
      d.balance += interestAfter;

      const totalInterest = interestBefore + interestAfter;
      interestTotal += totalInterest;
      scheduledTotal += payment;
      const entry = monthly.get(d.id)!;
      entry.interest = totalInterest;
      entry.scheduled = payment;
    }

    const cashFlow = monthIncome - monthExpenses - scheduledTotal;

    // Step 4: surplus → extra debt principal.
    let extraTotal = 0;
    if (cashFlow > 0 && surplusPercent > 0 && strategy !== "none") {
      let extraBudget = cashFlow * surplusPercent;
      for (const d of orderDebtsByStrategy(debtStates, strategy)) {
        if (extraBudget <= 0) break;
        if (d.balance <= 0) continue;
        const extra = Math.min(extraBudget, d.balance);
        d.balance -= extra;
        extraBudget -= extra;
        extraTotal += extra;
        monthly.get(d.id)!.extra = extra;
      }
    }

    totalInterestPaidAcrossAllDebts += interestTotal;
    const totalDebtPayments = scheduledTotal + extraTotal;
    const cashAfterDebts = cashFlow - extraTotal;

    // Step 5: remainder splits between auto-invest and savings.
    let investmentsContribution = 0;
    let savingsContribution = cashAfterDebts;
    if (cashAfterDebts > 0 && autoInvestPercent > 0) {
      investmentsContribution = cashAfterDebts * autoInvestPercent;
      savingsContribution = cashAfterDebts - investmentsContribution;
    }

    // Step 6: compound interest on both buckets. Cap savings at 0 — a negative
    // balance would represent an overdraft, which we don't model and shouldn't
    // earn interest. Net worth can still be negative via outstanding debt.
    const savingsBeforeInterest = Math.max(0, savings + savingsContribution);
    const savingsInterest = savingsBeforeInterest * savingsRate;
    // Round to cents each month to avoid floating-point drift over 120 iterations.
    savings = Math.round((savingsBeforeInterest + savingsInterest) * 100) / 100;

    const investmentsBeforeInterest = Math.max(0, investments + investmentsContribution);
    const investmentsInterest = investmentsBeforeInterest * autoInvestRate;
    investments =
      Math.round((investmentsBeforeInterest + investmentsInterest) * 100) / 100;
    totalInvestmentsInterestAcrossMonths += investmentsInterest;

    const totalDebt = debtStates.reduce((s, d) => s + d.balance, 0);
    const netWorth = savings + investments + portfolioValue - totalDebt;

    if (monthsToDebtFree === null && totalDebt <= DEBT_PAID_EPS && debts.length > 0) {
      monthsToDebtFree = m + 1;
    }

    months.push({
      monthOffset: m,
      date: monthDate,
      income: monthIncome,
      expenses: monthExpenses,
      scheduledDebtPayments: scheduledTotal,
      extraDebtPayments: extraTotal,
      debtPayments: totalDebtPayments,
      totalInterestAccrued: interestTotal,
      cashFlow,
      savings,
      savingsInterest,
      investments,
      investmentsContribution,
      investmentsInterest,
      totalDebt,
      portfolioValue,
      netWorth,
      debts: debtStates.map((d) => {
        const m = monthly.get(d.id)!;
        return {
          debtId: d.id,
          name: d.name,
          balance: d.balance,
          scheduledPayment: m.scheduled,
          extraPayment: m.extra,
          interestAccrued: m.interest,
        };
      }),
    });
  }

  const endingDebt = debtStates.reduce((s, d) => s + d.balance, 0);
  return {
    plan,
    months,
    endingSavings: savings,
    endingInvestments: investments,
    endingDebt,
    endingNetWorth: savings + investments + portfolioValue - endingDebt,
    monthsToDebtFree,
    totalInterestPaid: totalInterestPaidAcrossAllDebts,
    totalInvestmentsInterest: totalInvestmentsInterestAcrossMonths,
  };
}

/**
 * Runs the projection three times — once per strategy — to surface which one
 * pays off debt faster and saves the most interest. surplusToDebtsPercent is
 * forced to a usable value (the plan's, or 60% if the plan currently has 0)
 * so the comparison is meaningful even when the user has not enabled it yet.
 */
export function compareDebtStrategies(
  plan: FinancePlan,
  incomes: FinancePlanIncome[],
  expenses: FinancePlanExpense[],
  debts: FinancePlanDebt[],
  options: ProjectOptions = {}
): import("@/types/finance").StrategyComparison {
  const surplusForCompare =
    num(plan.surplusToDebtsPercent) > 0 ? plan.surplusToDebtsPercent : "0.6";

  const runWith = (strategy: DebtStrategy) =>
    projectPlan(
      { ...plan, debtStrategy: strategy, surplusToDebtsPercent: surplusForCompare },
      incomes,
      expenses,
      debts,
      options
    );

  const av = runWith("avalanche");
  const sn = runWith("snowball");
  const no = runWith("none");

  const summarize = (p: Projection) => ({
    totalInterestPaid: p.totalInterestPaid,
    monthsToDebtFree: p.monthsToDebtFree,
    endingNetWorth: p.endingNetWorth,
  });

  const a = summarize(av);
  const s = summarize(sn);
  const n = summarize(no);

  // Recommended = lower total interest paid (math-optimal). Avalanche almost
  // always wins; we still surface snowball numbers for the user to choose.
  const recommended: DebtStrategy =
    a.totalInterestPaid <= s.totalInterestPaid ? "avalanche" : "snowball";

  const winner = recommended === "avalanche" ? a : s;
  const worst = a.totalInterestPaid >= s.totalInterestPaid ? a : s;

  return {
    avalanche: a,
    snowball: s,
    none: n,
    recommended,
    interestSaved: Math.max(0, worst.totalInterestPaid - winner.totalInterestPaid),
    monthsSaved: Math.max(
      0,
      (worst.monthsToDebtFree ?? plan.monthsAhead) -
        (winner.monthsToDebtFree ?? plan.monthsAhead)
    ),
  };
}

export async function getPortfolioValueForUser(userId: string): Promise<number> {
  const portfolio = await getUserPortfolio(userId);
  if (!portfolio) return 0;
  const stats = await getPortfolioStats(portfolio.id);
  return stats.totalValue;
}

/**
 * Resolves the monthly ROI (as a decimal) of the plan's auto-invest method, or
 * 0 if none is linked. Used to compound the investments bucket during projection.
 */
export async function getAutoInvestRate(plan: FinancePlan): Promise<number> {
  if (!plan.autoInvestMethodId) return 0;
  const { investmentMethods } = await import("@/db/schema");
  const [row] = await db
    .select({ monthlyRoi: investmentMethods.monthlyRoi })
    .from(investmentMethods)
    .where(eq(investmentMethods.id, plan.autoInvestMethodId));
  if (!row) return 0;
  // monthly_roi is stored as a percentage (e.g. "0.7000" = 0.70%). Convert to a
  // decimal multiplier the projection algorithm can apply directly.
  return num(row.monthlyRoi) / 100;
}

export async function projectPlanWithPortfolio(
  plan: FinancePlanWithLines,
  userId: string
): Promise<Projection> {
  const [portfolioValue, autoInvestRate] = await Promise.all([
    plan.includePortfolio ? getPortfolioValueForUser(userId) : Promise.resolve(0),
    getAutoInvestRate(plan),
  ]);
  return projectPlan(plan, plan.incomes, plan.expenses, plan.debts, {
    portfolioValue,
    autoInvestRate,
    overrides: plan.overrides,
  });
}

export async function listInvestmentMethods(
  options: { includeDisabled?: boolean } = {}
): Promise<Array<{ id: string; name: string; monthlyRoi: string; enabled: boolean }>> {
  const { investmentMethods } = await import("@/db/schema");
  const rows = await db
    .select({
      id: investmentMethods.id,
      name: investmentMethods.name,
      monthlyRoi: investmentMethods.monthlyRoi,
      enabled: investmentMethods.enabled,
    })
    .from(investmentMethods)
    .orderBy(asc(investmentMethods.name));
  return options.includeDisabled ? rows : rows.filter((r) => r.enabled);
}
