import type {
  financePlans,
  financePlanIncomes,
  financePlanExpenses,
  financePlanDebts,
} from "@/db/schema";

export type FinancePlan = typeof financePlans.$inferSelect;
export type FinancePlanIncome = typeof financePlanIncomes.$inferSelect;
export type FinancePlanExpense = typeof financePlanExpenses.$inferSelect;
export type FinancePlanDebt = typeof financePlanDebts.$inferSelect;

export type FinancePlanWithLines = FinancePlan & {
  incomes: FinancePlanIncome[];
  expenses: FinancePlanExpense[];
  debts: FinancePlanDebt[];
};

export type ProjectionDebtState = {
  debtId: string;
  name: string;
  balance: number;
  appliedPayment: number;
  interestAccrued: number;
};

export type ProjectionMonth = {
  monthOffset: number;
  date: Date;
  income: number;
  expenses: number;
  debtPayments: number;
  cashFlow: number;
  savings: number;
  savingsInterest: number;
  totalDebt: number;
  portfolioValue: number;
  netWorth: number;
  debts: ProjectionDebtState[];
};

export type Projection = {
  plan: FinancePlan;
  months: ProjectionMonth[];
  endingSavings: number;
  endingDebt: number;
  endingNetWorth: number;
  monthsToDebtFree: number | null;
};
