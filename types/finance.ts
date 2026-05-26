import type {
  financePlans,
  financePlanIncomes,
  financePlanExpenses,
  financePlanDebts,
  financePlanLineOverrides,
  financePlanSnapshots,
  financePlanConfirmations,
  financePlanDebtConfirmations,
} from "@/db/schema";

export type FinancePlan = typeof financePlans.$inferSelect;
export type FinancePlanIncome = typeof financePlanIncomes.$inferSelect;
export type FinancePlanExpense = typeof financePlanExpenses.$inferSelect;
export type FinancePlanDebt = typeof financePlanDebts.$inferSelect;
export type FinancePlanLineOverride =
  typeof financePlanLineOverrides.$inferSelect;
export type OverrideSide = "income" | "expense" | "debt";
export type OverrideAction = "skip" | "reschedule" | "amount";
export type FinancePlanSnapshot = typeof financePlanSnapshots.$inferSelect;
export type FinancePlanConfirmation = typeof financePlanConfirmations.$inferSelect;
export type FinancePlanDebtConfirmation = typeof financePlanDebtConfirmations.$inferSelect;

export type ConfirmationWithDebts = FinancePlanConfirmation & {
  debtConfirmations: FinancePlanDebtConfirmation[];
};

export type DebtStrategy = "avalanche" | "snowball" | "none";
export type DebtPaymentType = "fixed" | "percent_of_balance";

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
