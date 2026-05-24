"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/services/auth-server";
import { createApprovalSnapshot } from "@/lib/services/snapshot-service";
import {
  approveTransactionById,
  rejectTransactionById,
} from "@/lib/services/transaction-service";

const transactionIdSchema = z.string().uuid();

export async function approveTransaction(
  transactionId: string,
): Promise<{ success: true }> {
  const admin = await requireAdmin();

  const parsed = transactionIdSchema.safeParse(transactionId);
  if (!parsed.success) throw new Error("Invalid ID");

  const { portfolioId, transactionDate } = await approveTransactionById(
    admin.id,
    parsed.data,
  );

  // Snapshot is intentionally created after the DB transaction commits so the
  // sum sees the just-approved transaction.
  await createApprovalSnapshot(portfolioId, transactionDate);

  revalidatePath("/portal/admin/transactions");
  revalidatePath("/portal/portfolio");

  return { success: true };
}

export async function rejectTransaction(
  transactionId: string,
): Promise<{ success: true }> {
  const admin = await requireAdmin();

  const parsed = transactionIdSchema.safeParse(transactionId);
  if (!parsed.success) throw new Error("Invalid ID");

  await rejectTransactionById(admin.id, parsed.data);

  // Rejection doesn't affect portfolio totals, so we only revalidate the
  // admin queue page here.
  revalidatePath("/portal/admin/transactions");

  return { success: true };
}
