import { db } from "@/db";
import { transactions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

import { getUserRole } from "./auth-server";
import { getUserPortfolio, createPortfolio } from "./portfolio-service";
import type { Portfolio } from "@/types/portfolio";
import type { Transaction } from "@/types";
import type { TransactionInput } from "@/types/transaction";

export async function createTransaction(
  targetUserId: string,
  callerId: string,
  data: TransactionInput
): Promise<{ transaction: Transaction; portfolio: Portfolio }> {
  const callerRole = await getUserRole(callerId);
  const isAdmin = callerRole === "admin";

  if (targetUserId !== callerId && !isAdmin) {
    throw new Error("Forbidden: only admins can create transactions for other users");
  }

  let portfolio = await getUserPortfolio(targetUserId);
  if (!portfolio) {
    portfolio = await createPortfolio(targetUserId);
  }

  const fee = "0";
  const total = calculateTotal(data.amount, fee);
  const status = isAdmin ? ("approved" as const) : ("pending" as const);

  const transactionData = {
    portfolioId: portfolio.id,
    investmentMethodId: data.investmentMethodId,
    type: data.type,
    amount: data.amount,
    fee,
    total,
    date: data.date,
    notes: data.notes,
    status,
    ...(isAdmin && data.type === "buy" && {
      initialValue: total,
      currentValue: total,
      approvedAt: new Date(),
    }),
  };

  const [transaction] = await db
    .insert(transactions)
    .values(transactionData)
    .returning();

  return { transaction, portfolio };
}

export async function getPortfolioTransactions(portfolioId: string): Promise<Transaction[]> {
  return await db
    .select()
    .from(transactions)
    .where(eq(transactions.portfolioId, portfolioId));
}

export function calculateTotal(amount: string, fee: string): string {
  const amountNum = parseFloat(amount);
  const feeNum = parseFloat(fee);
  return (amountNum + feeNum).toFixed(2);
}

/**
 * Approve a pending transaction.
 *
 * For `buy` transactions: sets the initial and current value to the total.
 * For `withdrawal` transactions: validates the source `buy` transaction has
 * sufficient remaining `currentValue`, subtracts the amount, and links the
 * withdrawal to the source via `withdrawalTransactionIds`.
 *
 * Returns the portfolio id and transaction date so the caller can create the
 * matching approval snapshot.
 */
export async function approveTransactionById(
  adminId: string,
  transactionId: string
): Promise<{ portfolioId: string; transactionDate: Date }> {
  const transaction = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
  });

  if (!transaction) throw new Error("Transaction not found");

  await db.transaction(async (tx) => {
    if (transaction.type === "buy") {
      await tx
        .update(transactions)
        .set({
          status: "approved",
          approvedAt: new Date(),
          approvedBy: adminId,
          initialValue: transaction.total,
          currentValue: transaction.total,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, transactionId));
      return;
    }

    if (transaction.type === "withdrawal") {
      const sourceTransactionId = transaction.sourceTransactionId;
      if (!sourceTransactionId) {
        throw new Error("Withdrawal must have a source transaction");
      }

      const sourceTransaction = await tx.query.transactions.findFirst({
        where: eq(transactions.id, sourceTransactionId),
      });
      if (!sourceTransaction) {
        throw new Error("Source transaction not found");
      }

      const currentValue = parseFloat(sourceTransaction.currentValue || "0");
      const withdrawalAmount = parseFloat(transaction.total);

      if (currentValue < withdrawalAmount) {
        throw new Error("Insufficient funds in source transaction");
      }

      const newValue = currentValue - withdrawalAmount;

      await tx
        .update(transactions)
        .set({
          currentValue: newValue.toFixed(2),
          status: newValue <= 0 ? "closed" : "approved",
          withdrawalTransactionIds: sql`array_append(COALESCE(${transactions.withdrawalTransactionIds}, ARRAY[]::text[]), ${transactionId})`,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, sourceTransactionId));

      await tx
        .update(transactions)
        .set({
          status: "approved",
          approvedAt: new Date(),
          approvedBy: adminId,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, transactionId));
    }
  });

  return {
    portfolioId: transaction.portfolioId,
    transactionDate: transaction.date,
  };
}

/**
 * Reject a pending transaction.
 */
export async function rejectTransactionById(
  adminId: string,
  transactionId: string
): Promise<{ portfolioId: string }> {
  const transaction = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
    columns: { id: true, portfolioId: true },
  });

  if (!transaction) throw new Error("Transaction not found");

  await db
    .update(transactions)
    .set({
      status: "rejected",
      rejectedAt: new Date(),
      rejectedBy: adminId,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, transactionId));

  return { portfolioId: transaction.portfolioId };
}
