import type {
  financePlans,
  financePlanIncomes,
  financePlanExpenses,
  financePlanDebts,
  financePlanLineOverrides,
  financePlanConfirmations,
  financePlanDebtConfirmations,
} from "@/db/schema";

export type FinancePlan = typeof financePlans.$inferSelect;
export type FinancePlanIncome = typeof financePlanIncomes.$inferSelect;
export type FinancePlanExpense = typeof financePlanExpenses.$inferSelect;
export type FinancePlanDebt = typeof financePlanDebts.$inferSelect;
export type FinancePlanLineOverride =
  typeof financePlanLineOverrides.$inferSelect;

/**
 * The literal unions below mirror pgEnums in `db/schema.ts` and back the Zod
 * enums in `schemas/finance.ts`. Each is spelled out once here; the calendar,
 * the line and debt dialogs and the projection used to redeclare them.
 */
export const OVERRIDE_SIDES = ["income", "expense", "debt"] as const;
export type OverrideSide = (typeof OVERRIDE_SIDES)[number];
export const OVERRIDE_ACTIONS = ["skip", "reschedule", "amount"] as const;
export type OverrideAction = (typeof OVERRIDE_ACTIONS)[number];

/** `monthly_day` is the historical behaviour and the default. */
export const RECURRENCE_TYPES = [
  "monthly_day",
  "monthly_weekday",
  "every_n_months",
] as const;
export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];
export type FinancePlanConfirmation = typeof financePlanConfirmations.$inferSelect;
export type FinancePlanDebtConfirmation = typeof financePlanDebtConfirmations.$inferSelect;

export type ConfirmationWithDebts = FinancePlanConfirmation & {
  debtConfirmations: FinancePlanDebtConfirmation[];
};

export const DEBT_STRATEGIES = ["avalanche", "snowball", "none"] as const;
export type DebtStrategy = (typeof DEBT_STRATEGIES)[number];
export const DEBT_PAYMENT_TYPES = ["fixed", "percent_of_balance"] as const;
export type DebtPaymentType = (typeof DEBT_PAYMENT_TYPES)[number];

export type FinancePlanWithLines = FinancePlan & {
  incomes: FinancePlanIncome[];
  expenses: FinancePlanExpense[];
  debts: FinancePlanDebt[];
  overrides: FinancePlanLineOverride[];
  /**
   * The calendar day (UTC midnight) the opening balances were read on — the
   * day of the latest user confirmation, or the day the plan was created.
   * Occurrences dated on/before it inside the first period are already in
   * those balances and are not applied again. Set by `buildCalibratedPlan`;
   * absent on a raw plan (then period 0 opens with nothing applied yet).
   */
  asOf?: Date | null;
  /** Where the opening balances came from. Set by `buildCalibratedPlan`. */
  baselineSource?: "confirmation" | "plan";
};

export type ProjectionDebtState = {
  debtId: string;
  name: string;
  balance: number;
  scheduledPayment: number;
  extraPayment: number;
  interestAccrued: number;
  /**
   * Each scheduled payment in the period, on the day it lands, at the amount
   * actually paid (capped at the balance, percent-of-balance minimum applied).
   * `applied: false` marks payments dated on/before the as-of day: they are
   * already in the confirmed balance, shown but not charged again.
   */
  payments: { date: Date; amount: number; applied: boolean }[];
};

export type ProjectionMonth = {
  monthOffset: number;
  date: Date;
  income: number;
  expenses: number;
  scheduledDebtPayments: number;
  extraDebtPayments: number;
  debtPayments: number; // scheduled + extra
  totalInterestAccrued: number;
  cashFlow: number;
  savings: number;
  savingsInterest: number;
  investments: number;
  investmentsContribution: number;
  investmentsInterest: number;
  totalDebt: number;
  portfolioValue: number;
  netWorth: number;
  /**
   * Net cash flow dated on/before the as-of day (only in the period that
   * contains it; 0 elsewhere). `income`, `expenses` and the debt payments
   * describe the WHOLE period; this part of it was already in the opening
   * balance, so it isn't applied again.
   */
  preAsOfCashFlow: number;
  debts: ProjectionDebtState[];
};

export type Projection = {
  plan: FinancePlan;
  months: ProjectionMonth[];
  endingSavings: number;
  endingInvestments: number;
  endingDebt: number;
  endingNetWorth: number;
  monthsToDebtFree: number | null;
  /** Start of the period in which the debt is cleared (null when never). */
  debtFreeDate: Date | null;
  /** False when every debt starts at 0 (or there are none): "No debt". */
  hadDebt: boolean;
  totalInterestPaid: number;
  totalInvestmentsInterest: number;
};

/**
 * Where the plan stands on one calendar day, mid-period: the period's opening
 * plus every occurrence dated up to and including that day, and debt interest
 * accrued to it. Period-end steps (extra payments, auto-invest, savings
 * interest) haven't happened yet. This is THE "today" figure — the KPI, the
 * chart's today point, the dashboard tiles and the confirmation pre-fill.
 */
export type TodayState = {
  /** in-range: inside the horizon. before-start: the plan starts later, so
   *  these are its opening figures. after-end: past the horizon, the last
   *  period's close. */
  status: "before-start" | "in-range" | "after-end";
  /** The calendar day described (UTC midnight). */
  date: Date;
  /** Index of the period it falls in, clamped into the projection. */
  periodIndex: number;
  /** Start of that period (the first period for before-start). */
  periodStart: Date;
  savings: number;
  investments: number;
  portfolioValue: number;
  totalDebt: number;
  netWorth: number;
  debts: { debtId: string; name: string; balance: number }[];
};

export type StrategyOutcome = {
  totalInterestPaid: number;
  monthsToDebtFree: number | null;
  /** Start of the payoff period — the date "debt-free" is shown against. */
  debtFreeDate: Date | null;
  endingNetWorth: number;
};

export type StrategyComparison = {
  avalanche: StrategyOutcome;
  snowball: StrategyOutcome;
  none: StrategyOutcome;
  recommended: DebtStrategy;
  interestSaved: number; // savings of recommended vs worst
  monthsSaved: number; // months saved by recommended vs worst
  /** The plan's own surplus-to-debts share (0..1) every row was run with. At
   *  0 the strategies only decide where freed-up minimums roll over. */
  surplusToDebtsPercent: number;
};

/** An investment method as the plan form's auto-invest picker lists it. */
export type InvestmentMethodOption = {
  id: string;
  name: string;
  monthlyRoi: string;
  enabled: boolean;
};

/** Card/rail-level outcome of a projection, precomputed server-side. */
export type PlanSummary = {
  /** Months from today until debt-free (see `debtFreeMonthsFromNow`). */
  monthsToDebtFree: number | null;
  /** Payoff period start, shown next to the month count. */
  debtFreeDate: Date | null;
  /** False when the plan never carried debt — reads "No debt". */
  hadDebt: boolean;
  endingNetWorth: number;
  endingDebt: number;
  /** The period the ending figures describe (the plan's last period). */
  endDate: Date | null;
};

/**
 * How the finance module's mascot should read the user's main plan. Derived by
 * `getFinanceMood` — see the mood table in `components/portal/context-avatar.tsx`.
 */
export type FinanceMood = "idle" | "thriving" | "steady" | "strained";
