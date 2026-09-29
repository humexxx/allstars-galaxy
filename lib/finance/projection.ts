/**
 * The projection engine — pure, so the server pages, the dashboard and the
 * client editor all run the same maths. `finance-plan-service` re-exports it
 * for existing callers.
 *
 * A plan is walked one accounting PERIOD at a time (see `period.ts`). Money
 * moves on dated occurrences from `schedule.ts`; within a period:
 *
 *   1. Income and expense occurrences move cash.
 *   2. Each debt accrues interest day-weighted between its payment dates and
 *      pays each scheduled occurrence (percent-of-balance minimums recomputed
 *      on the balance, the last payment capped at what is owed). A period that
 *      holds two payment dates pays twice.
 *   3. At period end, the surplus is routed:
 *        - avalanche / snowball first roll over the FULL minimum of every debt
 *          already paid off (textbook), then add `surplusToDebtsPercent` of
 *          what is left, all as extra principal in strategy order;
 *        - `autoInvestPercent` of what remains goes to investments;
 *        - never more than the cash actually on hand: nothing is borrowed to
 *          prepay or invest while savings are overdrawn.
 *   4. Savings and investments earn their rate on the period's OPENING
 *      balance (a deposit made this period starts earning next period); the
 *      live portfolio grows at its blended monthly ROI.
 *
 * As-of day: the opening balances were read on a given day (a confirmation,
 * or plan creation). When that day falls inside the first period, occurrences
 * dated on/before it are already in the balances — they are reported in the
 * period's totals but not applied again — and every rate in that period
 * accrues only for the days that remain.
 */
import type {
  DebtPaymentType,
  DebtStrategy,
  FinanceMood,
  FinancePlan,
  FinancePlanDebt,
  FinancePlanExpense,
  FinancePlanIncome,
  FinancePlanLineOverride,
  Projection,
  ProjectionMonth,
  StrategyComparison,
  StrategyOutcome,
  TodayState,
} from "@/types/finance";

import {
  type Period,
  isDateInPeriod,
  iteratePeriods,
  periodIndexForDate,
  periodLengthDays,
} from "./period";
import { dayIndexInPeriod, planOccurrences, type Occurrence } from "./schedule";

// Debts at or below this are paid off — the same threshold everywhere so
// ordering, payoff detection and "No debt" agree.
export const DEBT_PAID_EPS = 0.01;

export type ProjectOptions = {
  /** The live portfolio's value today; added to net worth. */
  portfolioValue?: number;
  /** Monthly growth (decimal) compounded onto the portfolio each period —
   *  the value-weighted ROI of the holdings. 0 holds it flat. */
  portfolioMonthlyGrowthRate?: number;
  /** Monthly ROI (decimal) of the auto-invest method. */
  autoInvestRate?: number;
  /** Per-month overrides for recurring lines. */
  overrides?: FinancePlanLineOverride[];
  /** Day the opening balances were read on — see the module comment. When
   *  omitted, `plan.asOf` (set by `buildCalibratedPlan`) is used. */
  asOf?: Date | null;
};

function num(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  const n = parseFloat(value ?? "0");
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  const r = Math.round(value * 100) / 100;
  return r === 0 ? 0 : r;
}

type DebtState = {
  id: string;
  name: string;
  balance: number;
  rate: number;
  fixedPayment: number;
  paymentType: DebtPaymentType;
  minPercent: number;
  minFloor: number;
  /** The latest scheduled minimum — what rolls over once the debt clears. */
  lastMinimum: number;
  /** Already added to the rollover pool (or never carried a balance). */
  rolledOver: boolean;
};

function minimumFor(d: DebtState): number {
  if (d.paymentType === "percent_of_balance") {
    return Math.max(d.balance * d.minPercent, d.minFloor);
  }
  return d.fixedPayment;
}

function orderDebtsByStrategy(debts: DebtState[], strategy: DebtStrategy): DebtState[] {
  const active = debts.filter((d) => d.balance > DEBT_PAID_EPS);
  // Tertiary tie-break by id so equal debts order deterministically.
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

function strategyOf(plan: FinancePlan): DebtStrategy {
  const raw = plan.debtStrategy as string;
  return raw === "avalanche" || raw === "snowball" || raw === "none" ? raw : "avalanche";
}

function asOfOf(plan: FinancePlan, options: ProjectOptions): Date | null {
  if (options.asOf !== undefined) return options.asOf;
  const fromPlan = (plan as FinancePlan & { asOf?: Date | null }).asOf;
  return fromPlan ?? null;
}

type Opening = {
  savings: number;
  investments: number;
  portfolio: number;
  debts: DebtState[];
};

type EngineResult = {
  projection: Projection;
  /** Set when `stopAt` fell inside the horizon. */
  partial: TodayState | null;
};

function runEngine(
  plan: FinancePlan,
  incomes: FinancePlanIncome[],
  expenses: FinancePlanExpense[],
  debts: FinancePlanDebt[],
  options: ProjectOptions,
  stopAt: Date | null
): EngineResult {
  const portfolioValue = Math.max(0, options.portfolioValue ?? 0);
  const growth = Math.max(0, options.portfolioMonthlyGrowthRate ?? 0);
  const autoInvestRate = Math.max(0, options.autoInvestRate ?? 0);
  const savingsRate = Math.max(0, num(plan.monthlySavingsRate));
  const surplusPercent = Math.max(0, Math.min(1, num(plan.surplusToDebtsPercent)));
  const autoInvestPercent = Math.max(0, Math.min(1, num(plan.autoInvestPercent)));
  const strategy = strategyOf(plan);

  const anchorDay = plan.confirmationDayOfMonth > 0 ? plan.confirmationDayOfMonth : 1;
  const periods: Period[] = iteratePeriods(
    new Date(plan.startMonth),
    anchorDay,
    Math.max(0, plan.monthsAhead)
  );

  const debtStates: DebtState[] = debts.map((d) => {
    const state: DebtState = {
      id: d.id,
      name: d.name,
      balance: Math.max(0, num(d.initialBalance)),
      rate: Math.max(0, num(d.monthlyInterestRate)),
      fixedPayment: Math.max(0, num(d.monthlyPayment)),
      paymentType: d.paymentType as DebtPaymentType,
      minPercent: Math.max(0, num(d.minPaymentPercent)),
      minFloor: Math.max(0, num(d.minPaymentFloor)),
      lastMinimum: 0,
      rolledOver: false,
    };
    state.lastMinimum = minimumFor(state);
    state.rolledOver = state.balance <= DEBT_PAID_EPS;
    return state;
  });
  const hadDebt = debtStates.some((d) => d.balance > DEBT_PAID_EPS);

  const state: Opening = {
    savings: num(plan.initialSavings),
    investments: Math.max(0, num(plan.initialInvestments)),
    portfolio: portfolioValue,
    debts: debtStates,
  };

  const emptyProjection = (months: ProjectionMonth[]): Projection => ({
    plan,
    months,
    endingSavings: state.savings,
    endingInvestments: state.investments,
    endingDebt: 0,
    endingNetWorth: 0,
    monthsToDebtFree: null,
    debtFreeDate: null,
    hadDebt,
    totalInterestPaid: 0,
    totalInvestmentsInterest: 0,
  });

  if (periods.length === 0) {
    return { projection: emptyProjection([]), partial: null };
  }

  const first = periods[0];
  const last = periods[periods.length - 1];
  const occurrences = planOccurrences(
    {
      startMonth: new Date(plan.startMonth),
      incomes,
      expenses,
      debts,
      overrides: options.overrides ?? [],
    },
    first.start,
    last.end
  );
  const buckets: Occurrence[][] = periods.map(() => []);
  for (const o of occurrences) {
    const idx = periodIndexForDate(first.start, anchorDay, o.date);
    if (idx >= 0 && idx < periods.length) buckets[idx].push(o);
  }

  const rawAsOf = asOfOf(plan, options);
  const asOf = rawAsOf && isDateInPeriod(rawAsOf, first) ? rawAsOf : null;

  const months: ProjectionMonth[] = [];
  let monthsToDebtFree: number | null = null;
  let debtFreeDate: Date | null = null;
  let rolloverPool = 0;
  let totalInterest = 0;
  let totalInvestmentsInterest = 0;

  for (let m = 0; m < periods.length; m++) {
    const period = periods[m];
    const D = periodLengthDays(period);
    // Days already reflected in the opening balances (as-of period only).
    const elapsed = m === 0 && asOf ? dayIndexInPeriod(asOf, period.start) : 0;
    const isStop = stopAt !== null && isDateInPeriod(stopAt, period);
    // Last day this pass simulates: today for the partial pass, else the end.
    const until = isStop ? dayIndexInPeriod(stopAt!, period.start) : D;

    const bucket = buckets[m];
    const isApplied = (o: Occurrence): boolean => {
      const day = dayIndexInPeriod(o.date, period.start);
      return day > elapsed && day <= until;
    };

    // ---- income / expenses ----
    let income = 0;
    let expenseTotal = 0;
    let appliedIncome = 0;
    let appliedExpenses = 0;
    let preAsOf = 0;
    for (const o of bucket) {
      if (o.side === "debt") continue;
      const amount = o.amount ?? 0;
      const day = dayIndexInPeriod(o.date, period.start);
      if (o.side === "income") income += amount;
      else expenseTotal += amount;
      if (day <= elapsed) {
        preAsOf += o.side === "income" ? amount : -amount;
      } else if (isApplied(o)) {
        if (o.side === "income") appliedIncome += amount;
        else appliedExpenses += amount;
      }
    }

    // ---- debts: day-weighted interest between payment dates ----
    let scheduledTotal = 0;
    let appliedScheduled = 0;
    let interestTotal = 0;
    const perDebt = new Map<
      string,
      {
        interest: number;
        scheduled: number;
        extra: number;
        payments: { date: Date; amount: number; applied: boolean }[];
      }
    >();
    for (const d of state.debts) {
      const rec = {
        interest: 0,
        scheduled: 0,
        extra: 0,
        payments: [] as { date: Date; amount: number; applied: boolean }[],
      };
      perDebt.set(d.id, rec);
      if (d.balance <= 0) continue;
      let cursor = elapsed; // days of this period already accrued
      const accrue = (days: number): void => {
        if (days <= 0 || d.balance <= 0) return;
        const interest = (d.balance * d.rate * days) / D;
        d.balance += interest;
        rec.interest += interest;
      };
      for (const o of bucket) {
        if (o.side !== "debt" || o.lineId !== d.id) continue;
        const day = dayIndexInPeriod(o.date, period.start);
        if (day <= elapsed) {
          // Already in the confirmed balance — shown, not charged again.
          const due = o.amount ?? minimumFor(d);
          const shown = Math.min(due, d.balance);
          if (shown > 0) {
            rec.payments.push({ date: o.date, amount: shown, applied: false });
            rec.scheduled += shown;
            preAsOf -= shown;
          }
          continue;
        }
        if (day > until || d.balance <= 0) continue;
        accrue(day - 1 - cursor);
        cursor = day - 1;
        const due = o.amount ?? minimumFor(d);
        if (o.amount === null) d.lastMinimum = due;
        const pay = Math.min(due, d.balance);
        if (pay <= 0) continue;
        d.balance -= pay;
        if (d.balance < 1e-9) d.balance = 0;
        rec.payments.push({ date: o.date, amount: pay, applied: true });
        rec.scheduled += pay;
        appliedScheduled += pay;
      }
      accrue(until - cursor);
      scheduledTotal += rec.scheduled;
      interestTotal += rec.interest;
    }

    const appliedCash = appliedIncome - appliedExpenses - appliedScheduled;

    if (isStop) {
      // Partial pass: where things stand on `stopAt`. Period-end routing and
      // the savings/investment interest haven't happened yet.
      const savings = round2(state.savings + appliedCash);
      const totalDebt = state.debts.reduce((s, d) => s + d.balance, 0);
      return {
        projection: emptyProjection(months),
        partial: {
          status: "in-range",
          date: stopAt!,
          periodIndex: m,
          periodStart: period.start,
          savings,
          investments: state.investments,
          portfolioValue: state.portfolio,
          totalDebt,
          netWorth: savings + state.investments + state.portfolio - totalDebt,
          debts: state.debts.map((d) => ({ debtId: d.id, name: d.name, balance: d.balance })),
        },
      };
    }

    // ---- surplus routing ----
    // Cash on hand at period end before routing; nothing is routed beyond it.
    const onHand = Math.max(0, state.savings + appliedCash);
    let extraTotal = 0;
    if (strategy !== "none") {
      const positive = Math.max(0, appliedCash);
      const rollover = Math.min(rolloverPool, positive);
      const surplusExtra = Math.max(0, positive - rollover) * surplusPercent;
      let budget = Math.min(rollover + surplusExtra, onHand);
      for (const d of orderDebtsByStrategy(state.debts, strategy)) {
        if (budget <= 0) break;
        const extra = Math.min(budget, d.balance);
        d.balance -= extra;
        if (d.balance < 1e-9) d.balance = 0;
        budget -= extra;
        extraTotal += extra;
        perDebt.get(d.id)!.extra = extra;
      }
    }

    const cashAfterDebts = appliedCash - extraTotal;
    let investmentsContribution = 0;
    if (cashAfterDebts > 0 && autoInvestPercent > 0) {
      investmentsContribution = Math.min(
        cashAfterDebts * autoInvestPercent,
        Math.max(0, onHand - extraTotal)
      );
    }
    const savingsContribution = cashAfterDebts - investmentsContribution;

    // Rates accrue on the OPENING balance, for the part of the period that
    // isn't already in it.
    const fraction = (D - elapsed) / D;
    const savingsInterest = Math.max(0, state.savings) * savingsRate * fraction;
    const investmentsInterest = state.investments * autoInvestRate * fraction;
    state.savings = round2(state.savings + savingsContribution + savingsInterest);
    state.investments = round2(state.investments + investmentsContribution + investmentsInterest);
    state.portfolio = round2(state.portfolio * (1 + growth * fraction));
    totalInvestmentsInterest += investmentsInterest;
    totalInterest += interestTotal;

    // Freed-up minimums join the rollover pool from the next period on.
    for (const d of state.debts) {
      if (!d.rolledOver && d.balance <= DEBT_PAID_EPS) {
        d.rolledOver = true;
        if (strategy !== "none") rolloverPool += d.lastMinimum;
      }
    }

    const totalDebt = state.debts.reduce((s, d) => s + d.balance, 0);
    const netWorth = state.savings + state.investments + state.portfolio - totalDebt;
    if (monthsToDebtFree === null && hadDebt && totalDebt <= DEBT_PAID_EPS) {
      monthsToDebtFree = m + 1;
      debtFreeDate = period.start;
    }

    months.push({
      monthOffset: m,
      date: period.start,
      income,
      expenses: expenseTotal,
      scheduledDebtPayments: scheduledTotal,
      extraDebtPayments: extraTotal,
      debtPayments: scheduledTotal + extraTotal,
      totalInterestAccrued: interestTotal,
      cashFlow: income - expenseTotal - scheduledTotal,
      savings: state.savings,
      savingsInterest,
      investments: state.investments,
      investmentsContribution,
      investmentsInterest,
      totalDebt,
      portfolioValue: state.portfolio,
      netWorth,
      preAsOfCashFlow: preAsOf,
      debts: state.debts.map((d) => {
        const rec = perDebt.get(d.id)!;
        return {
          debtId: d.id,
          name: d.name,
          balance: d.balance,
          scheduledPayment: rec.scheduled,
          extraPayment: rec.extra,
          interestAccrued: rec.interest,
          payments: rec.payments,
        };
      }),
    });
  }

  const endingDebt = state.debts.reduce((s, d) => s + d.balance, 0);
  return {
    projection: {
      plan,
      months,
      endingSavings: state.savings,
      endingInvestments: state.investments,
      endingDebt,
      endingNetWorth: state.savings + state.investments + state.portfolio - endingDebt,
      monthsToDebtFree,
      debtFreeDate,
      hadDebt,
      totalInterestPaid: totalInterest,
      totalInvestmentsInterest,
    },
    partial: null,
  };
}

/** Walks the plan period by period — see the module comment. */
export function projectPlan(
  plan: FinancePlan,
  incomes: FinancePlanIncome[],
  expenses: FinancePlanExpense[],
  debts: FinancePlanDebt[],
  options: ProjectOptions = {}
): Projection {
  return runEngine(plan, incomes, expenses, debts, options, null).projection;
}

/**
 * Where the plan stands on `day` (a calendar day as UTC midnight): the
 * opening of its period plus everything dated up to and including `day`.
 * Before the first period → the opening figures (`before-start`); after the
 * last → the last close (`after-end`). Null for a plan with no periods.
 */
export function projectStateAt(
  plan: FinancePlan,
  incomes: FinancePlanIncome[],
  expenses: FinancePlanExpense[],
  debts: FinancePlanDebt[],
  options: ProjectOptions,
  day: Date
): TodayState | null {
  const anchorDay = plan.confirmationDayOfMonth > 0 ? plan.confirmationDayOfMonth : 1;
  const periods = iteratePeriods(new Date(plan.startMonth), anchorDay, Math.max(0, plan.monthsAhead));
  if (periods.length === 0) return null;
  const first = periods[0];
  const last = periods[periods.length - 1];

  if (day.getTime() < first.start.getTime()) {
    const debtRows = debts.map((d) => ({
      debtId: d.id,
      name: d.name,
      balance: Math.max(0, num(d.initialBalance)),
    }));
    const savings = num(plan.initialSavings);
    const investments = Math.max(0, num(plan.initialInvestments));
    const portfolio = Math.max(0, options.portfolioValue ?? 0);
    const totalDebt = debtRows.reduce((s, d) => s + d.balance, 0);
    return {
      status: "before-start",
      date: day,
      periodIndex: 0,
      periodStart: first.start,
      savings,
      investments,
      portfolioValue: portfolio,
      totalDebt,
      netWorth: savings + investments + portfolio - totalDebt,
      debts: debtRows,
    };
  }

  if (day.getTime() > last.end.getTime()) {
    const projection = projectPlan(plan, incomes, expenses, debts, options);
    const close = projection.months[projection.months.length - 1];
    return {
      status: "after-end",
      date: day,
      periodIndex: projection.months.length - 1,
      periodStart: close.date,
      savings: close.savings,
      investments: close.investments,
      portfolioValue: close.portfolioValue,
      totalDebt: close.totalDebt,
      netWorth: close.netWorth,
      debts: close.debts.map((d) => ({ debtId: d.debtId, name: d.name, balance: d.balance })),
    };
  }

  return runEngine(plan, incomes, expenses, debts, options, day).partial;
}

/**
 * Runs the plan once per strategy with the plan's OWN surplus-to-debts share,
 * so every row describes something the user can actually select. At 0% the
 * strategies differ only in where freed-up minimums roll over ("none" keeps
 * them as savings).
 */
export function compareDebtStrategies(
  plan: FinancePlan,
  incomes: FinancePlanIncome[],
  expenses: FinancePlanExpense[],
  debts: FinancePlanDebt[],
  options: ProjectOptions = {}
): StrategyComparison {
  const runWith = (strategy: DebtStrategy): StrategyOutcome => {
    const p = projectPlan({ ...plan, debtStrategy: strategy }, incomes, expenses, debts, options);
    return {
      totalInterestPaid: p.totalInterestPaid,
      monthsToDebtFree: p.monthsToDebtFree,
      debtFreeDate: p.debtFreeDate,
      endingNetWorth: p.endingNetWorth,
    };
  };

  const a = runWith("avalanche");
  const s = runWith("snowball");
  const n = runWith("none");

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
      (worst.monthsToDebtFree ?? plan.monthsAhead) - (winner.monthsToDebtFree ?? plan.monthsAhead)
    ),
    surplusToDebtsPercent: Math.max(0, Math.min(1, num(plan.surplusToDebtsPercent))),
  };
}

/**
 * Reads a projection as one of four moods, used to pose the finance mascot.
 *
 * | mood       | when                                                    |
 * | ---------- | ------------------------------------------------------- |
 * | `strained` | the plan ends underwater (negative net worth)            |
 * | `steady`   | solvent, but debt outlives the horizon or growth is flat |
 * | `thriving` | debt cleared **and** net worth grew over the horizon     |
 */
export function deriveFinanceMood(projection: Projection): FinanceMood {
  const first = projection.months[0];
  const last = projection.months.at(-1);
  if (!last) return "idle";

  if (projection.endingNetWorth < 0) return "strained";

  const debtCleared =
    projection.monthsToDebtFree !== null || projection.endingDebt <= DEBT_PAID_EPS;
  const grew = first ? last.netWorth > first.netWorth : last.netWorth > 0;

  return debtCleared && grew ? "thriving" : "steady";
}
