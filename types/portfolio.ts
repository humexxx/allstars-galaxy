import type { portfolios, investmentMethods } from "@/db/schema";

import type { TransactionStatus, TransactionType } from "./transaction";

export type Portfolio = typeof portfolios.$inferSelect;
export type InvestmentMethod = typeof investmentMethods.$inferSelect;

/** A priceable asset as the allocation picker lists it. */
export type AssetOption = {
  id: string;
  symbol: string;
  name: string;
  source: string;
};

export interface PortfolioStats {
  totalValue: number;
  costBasis: number;
  /** Approved withdrawals — money already taken out, still part of the return. */
  totalWithdrawn: number;
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
  /** The buy a withdrawal was taken from; null on buys. */
  sourceTransactionId: string | null;
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

/** What one transaction bought, with today's price for valuing it. */
export type TransactionAllocationView = {
  symbol: string;
  quantity: number;
  invested: number;
  priceAtPurchase: number;
  /** Latest price, null when the asset has never been quoted. */
  price: number | null;
};

/**
 * One normalised row shape for every transaction table.
 *
 * The owner's own history and their investors' movements used to be two
 * components with different columns, which made the same fact look like two
 * different things depending on whose row it was.
 */
export type TransactionTableRow = {
  id: string;
  /** ISO timestamp. */
  date: string;
  methodName: string;
  /** Only set on rows belonging to somebody else. */
  investorId?: string;
  investorName?: string | null;
  type: TransactionType;
  status: TransactionStatus;
  total: string;
  initialValue: string | null;
  currentValue: string | null;
  /** Cash already withdrawn from this buy. Its `currentValue` is net of it,
   *  so growth must add it back or a withdrawal reads as a loss. */
  withdrawn?: number;
  /** Empty for a method the viewer does not run: where a client's money is
   *  deployed is the owner's private half of the deal. */
  allocations: TransactionAllocationView[];
};
