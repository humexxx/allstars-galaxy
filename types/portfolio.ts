import type { portfolios, investmentMethods } from "@/db/schema";

export type Portfolio = typeof portfolios.$inferSelect;
export type InvestmentMethod = typeof investmentMethods.$inferSelect;

export type TransactionStatus = "pending" | "approved" | "rejected" | "closed";
export type TransactionType = "buy" | "withdrawal";

export interface PortfolioStats {
  totalValue: number;
  costBasis: number;
  allTimeProfit: number;
  allTimeProfitPercentage: number;
  totalInvestmentMethods: number;
  activeTransactions: number;
}

export interface PortfolioTransaction {
  id: string;
  type: TransactionType;
  amount: string;
  fee: string;
  total: string;
  initialValue: string | null;
  currentValue: string | null;
  date: Date;
  status: TransactionStatus;
  notes: string | null;
  investmentMethod: InvestmentMethod;
}

export interface PortfolioAsset {
  investmentMethod: InvestmentMethod;
  totalInvested: number;
  totalWithdrawn: number;
  holdingAmount: number;
  approvedAmount: number;
  pendingAmount: number;
  hasPendingTransactions: boolean;
  profitLoss: number;
  profitLossPercentage: number;
}

/** One person's position inside a method someone else owns. */
export interface MethodInvestor {
  userId: string;
  email: string | null;
  fullName: string | null;
  invested: number;
  holding: number;
  withdrawn: number;
}

/** An owned method plus everyone invested in it. Read-only aggregate — this
 *  never contributes to the owner's net worth. */
export interface MethodInvestors {
  methodId: string;
  methodName: string;
  enabled: boolean;
  investors: MethodInvestor[];
  totalInvested: number;
  totalHolding: number;
}
