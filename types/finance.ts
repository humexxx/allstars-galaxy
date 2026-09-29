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
};

export type ProjectionDebtState = {
  debtId: string;
  name: string;
  balance: number;
  scheduledPayment: number;
  extraPayment: number;
  interestAccrued: number;
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
  totalInterestPaid: number;
  totalInvestmentsInterest: number;
};

export type StrategyComparison = {
  avalanche: { totalInterestPaid: number; monthsToDebtFree: number | null; endingNetWorth: number };
  snowball: { totalInterestPaid: number; monthsToDebtFree: number | null; endingNetWorth: number };
  none: { totalInterestPaid: number; monthsToDebtFree: number | null; endingNetWorth: number };
  recommended: DebtStrategy;
  interestSaved: number; // savings of recommended vs worst
  monthsSaved: number; // months saved by recommended vs worst
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
  monthsToDebtFree: number | null;
  endingNetWorth: number;
  endingDebt: number;
  endDate: Date | null;
};

/**
 * How the finance module's mascot should read the user's main plan. Derived by
 * `getFinanceMood` — see the mood table in `components/portal/context-avatar.tsx`.
 */
export type FinanceMood = "idle" | "thriving" | "steady" | "strained";
