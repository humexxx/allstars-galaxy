import { db } from "@/db";
import {
  financePlans,
  financePlanIncomes,
  financePlanExpenses,
  financePlanDebts,
} from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

import type {
  FinancePlan,
  FinancePlanDebt,
  FinancePlanExpense,
  FinancePlanIncome,
  FinancePlanWithLines,
  Projection,
  ProjectionMonth,
} from "@/types/finance";
import type {
  CreateFinancePlanInput,
  PlanDebtInput,
  PlanLineInput,
  UpdateFinancePlanInput,
  UpdatePlanDebtInput,
  UpdatePlanLineInput,
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

export async function getPlanWithLines(
  planId: string,
  userId: string
): Promise<FinancePlanWithLines | null> {
  const [plan] = await db
    .select()
    .from(financePlans)
    .where(and(eq(financePlans.id, planId), eq(financePlans.userId, userId)));
  if (!plan) return null;

  const [incomes, expenses, debts] = await Promise.all([
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
  ]);

  return { ...plan, incomes, expenses, debts };
}

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
      color: source.color,
    })
    .returning();

  if (source.incomes.length > 0) {
    await db.insert(financePlanIncomes).values(
      source.incomes.map((i) => ({
        planId: plan.id,
        name: i.name,
        monthlyAmount: i.monthlyAmount,
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
  data: PlanLineInput
): Promise<FinancePlanIncome> {
  await ensureOwnership(planId, userId);
  const [row] = await db
    .insert(financePlanIncomes)
    .values({
      planId,
      name: data.name,
      monthlyAmount: data.monthlyAmount,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateIncome(
  userId: string,
  planId: string,
  data: UpdatePlanLineInput
): Promise<FinancePlanIncome> {
  await ensureOwnership(planId, userId);
  const [row] = await db
    .update(financePlanIncomes)
    .set({
      name: data.name,
      monthlyAmount: data.monthlyAmount,
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
  await db
    .delete(financePlanIncomes)
    .where(and(eq(financePlanIncomes.id, incomeId), eq(financePlanIncomes.planId, planId)));
}

export async function addExpense(
  userId: string,
  planId: string,
  data: PlanLineInput
): Promise<FinancePlanExpense> {
  await ensureOwnership(planId, userId);
  const [row] = await db
    .insert(financePlanExpenses)
    .values({
      planId,
      name: data.name,
      monthlyAmount: data.monthlyAmount,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateExpense(
  userId: string,
  planId: string,
  data: UpdatePlanLineInput
): Promise<FinancePlanExpense> {
  await ensureOwnership(planId, userId);
  const [row] = await db
    .update(financePlanExpenses)
    .set({
      name: data.name,
      monthlyAmount: data.monthlyAmount,
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
    .delete(financePlanDebts)
    .where(and(eq(financePlanDebts.id, debtId), eq(financePlanDebts.planId, planId)));
}

// ---------- projection algorithm ----------

/**
 * Walks the plan month by month and returns a series with savings, debts,
 * cash flow and net worth at the end of each period.
 *
 * Conventions:
 *   - Income, expenses and debt payments apply at the START of the month.
 *   - Interest on remaining savings and on outstanding debts accrues over the month
 *     using the configured monthly rates.
 *   - Payment is capped at outstanding balance + accrued interest (no overpayment).
 *   - portfolioValue is added to net worth (but does not earn the savings rate).
 */
export function projectPlan(
  plan: FinancePlan,
  incomes: FinancePlanIncome[],
  expenses: FinancePlanExpense[],
  debts: FinancePlanDebt[],
  portfolioValue: number = 0
): Projection {
  const totalMonthlyIncome = incomes.reduce((s, i) => s + num(i.monthlyAmount), 0);
  const totalMonthlyExpenses = expenses.reduce((s, e) => s + num(e.monthlyAmount), 0);
  const savingsRate = num(plan.monthlySavingsRate);

  let savings = num(plan.initialSavings);
  const debtStates = debts.map((d) => ({
    id: d.id,
    name: d.name,
    balance: num(d.initialBalance),
    rate: num(d.monthlyInterestRate),
    scheduledPayment: num(d.monthlyPayment),
  }));

  const months: ProjectionMonth[] = [];
  let monthsToDebtFree: number | null = null;

  for (let m = 0; m < plan.monthsAhead; m++) {
    let actualDebtPayments = 0;
    const debtSnapshot = debtStates.map((d) => {
      const interest = d.balance * d.rate;
      const balanceWithInterest = d.balance + interest;
      const payment = Math.min(d.scheduledPayment, balanceWithInterest);
      const newBalance = balanceWithInterest - payment;
      actualDebtPayments += payment;
      // Persist for next month.
      d.balance = newBalance;
      return {
        debtId: d.id,
        name: d.name,
        balance: newBalance,
        appliedPayment: payment,
        interestAccrued: interest,
      };
    });

    const cashFlow = totalMonthlyIncome - totalMonthlyExpenses - actualDebtPayments;
    // Savings interest is applied AFTER cash flow is added.
    const balanceAfterFlow = savings + cashFlow;
    const interestEarned = balanceAfterFlow > 0 ? balanceAfterFlow * savingsRate : 0;
    savings = balanceAfterFlow + interestEarned;

    const totalDebt = debtStates.reduce((s, d) => s + d.balance, 0);
    const netWorth = savings + portfolioValue - totalDebt;

    if (monthsToDebtFree === null && totalDebt <= 0.01 && debts.length > 0) {
      monthsToDebtFree = m + 1;
    }

    months.push({
      monthOffset: m,
      date: addMonthsUtc(plan.startMonth, m),
      income: totalMonthlyIncome,
      expenses: totalMonthlyExpenses,
      debtPayments: actualDebtPayments,
      cashFlow,
      savings,
      savingsInterest: interestEarned,
      totalDebt,
      portfolioValue,
      netWorth,
      debts: debtSnapshot,
    });
  }

  return {
    plan,
    months,
    endingSavings: savings,
    endingDebt: debtStates.reduce((s, d) => s + d.balance, 0),
    endingNetWorth:
      savings + portfolioValue - debtStates.reduce((s, d) => s + d.balance, 0),
    monthsToDebtFree,
  };
}

export async function getPortfolioValueForUser(userId: string): Promise<number> {
  const portfolio = await getUserPortfolio(userId);
  if (!portfolio) return 0;
  const stats = await getPortfolioStats(portfolio.id);
  return stats.totalValue;
}

export async function projectPlanWithPortfolio(
  plan: FinancePlanWithLines,
  userId: string
): Promise<Projection> {
  const portfolioValue = plan.includePortfolio
    ? await getPortfolioValueForUser(userId)
    : 0;
  return projectPlan(plan, plan.incomes, plan.expenses, plan.debts, portfolioValue);
}
