import { db } from "@/db";
import {
  financePlans,
  financePlanIncomes,
  financePlanExpenses,
  financePlanDebts,
} from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

import type {
  DebtStrategy,
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
        paymentType: d.paymentType,
        minPaymentPercent: d.minPaymentPercent,
        minPaymentFloor: d.minPaymentFloor,
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
      paymentType: data.paymentType,
      minPaymentPercent: data.minPaymentPercent,
      minPaymentFloor: data.minPaymentFloor,
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
};

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

  const totalMonthlyIncome = Math.max(
    0,
    incomes.reduce((s, i) => s + num(i.monthlyAmount), 0)
  );
  const totalMonthlyExpenses = Math.max(
    0,
    expenses.reduce((s, e) => s + num(e.monthlyAmount), 0)
  );
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

    // Step 1 + 2: accrue interest and apply scheduled payments (variable for
    // percent_of_balance debts, fixed otherwise).
    for (const d of debtStates) {
      if (d.balance <= 0) continue;
      const interest = d.balance * d.rate;
      const balanceWithInterest = d.balance + interest;
      const scheduled = scheduledPaymentFor(d, balanceWithInterest);
      const payment = Math.min(scheduled, balanceWithInterest);
      d.balance = balanceWithInterest - payment;
      scheduledTotal += payment;
      interestTotal += interest;
      const entry = monthly.get(d.id)!;
      entry.interest = interest;
      entry.scheduled = payment;
    }

    const cashFlow = totalMonthlyIncome - totalMonthlyExpenses - scheduledTotal;

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
      date: addMonthsUtc(plan.startMonth, m),
      income: totalMonthlyIncome,
      expenses: totalMonthlyExpenses,
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
