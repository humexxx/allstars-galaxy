import type { transactions } from "@/db/schema";

export type Transaction = typeof transactions.$inferSelect;
export type TransactionStatus = Transaction["status"];
export type TransactionType = Transaction["type"];

/** What a service needs to write a transaction row; the rest is derived. */
export type TransactionInput = {
  investmentMethodId: string;
  type: TransactionType;
  amount: string;
  date: Date;
  notes?: string;
};

type AdminTransactionPerson = {
  id: string;
  email: string | null;
  fullName: string | null;
};

export type AdminTransactionRow = {
  id: string;
  amount: string;
  fee: string;
  total: string;
  date: Date;
  status: TransactionStatus;
  type: TransactionType;
  notes: string | null;
  user: (AdminTransactionPerson & { avatarUrl: string | null }) | null;
  method: {
    id: string;
    name: string;
  } | null;
  portfolioName: string | null;
  approvedAt: Date | null;
  approvedBy: AdminTransactionPerson | null;
  rejectedAt: Date | null;
  rejectedBy: AdminTransactionPerson | null;
};
