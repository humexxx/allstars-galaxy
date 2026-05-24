"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import { createApprovalSnapshot } from "@/lib/services/snapshot-service";
import { createTransaction } from "@/lib/services/transaction-service";
import {
  createTransactionSchema,
  type CreateTransactionInput,
} from "@/schemas/transaction";
import type { Transaction } from "@/types";

/**
 * Create a transaction from the portfolio UI.
 *
 * Server-action replacement for the previous `/api/transactions` route — this
 * is internal app traffic so we get free type-safety, automatic
 * `revalidatePath`, and no separate route handler.
 *
 * Date handling rule mirrors the old route:
 * - Admins: can post-date or back-date freely (used to bulk-import).
 * - Users: clamped to "now" (drift ≤ 1 day allowed for clock skew).
 *
 * When the caller is impersonating, admin privileges DO NOT apply — the
 * action runs as the impersonated user would experience it.
 */
export async function createTransactionAction(
  input: CreateTransactionInput,
): Promise<ActionResult<Transaction>> {
  return safe("transactions", async () => {
    const ctx = await requireEffectiveContext();

    const parsed = createTransactionSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }

    const { investmentMethodId, amount, date, notes, userId } = parsed.data;
    const isAdmin = ctx.realRole === "admin" && !ctx.isImpersonating;
    const callerId = ctx.effectiveUserId;

    if (userId && userId !== callerId && !isAdmin) {
      return {
        success: false,
        error: "Only admins can create transactions for other users",
      };
    }

    const targetUserId = userId ?? callerId;

    const transactionDate = new Date(date);
    if (!isAdmin) {
      const dayInMs = 1000 * 60 * 60 * 24;
      const driftDays =
        Math.abs(transactionDate.getTime() - Date.now()) / dayInMs;
      if (driftDays > 1) {
        return {
          success: false,
          error: "Regular users can only create transactions with the current date",
        };
      }
      transactionDate.setTime(Date.now());
    }

    const { transaction, portfolio } = await createTransaction(
      targetUserId,
      callerId,
      {
        investmentMethodId,
        type: "buy",
        amount,
        date: transactionDate,
        notes: notes ?? undefined,
      },
    );

    if (isAdmin && transaction.status === "approved") {
      await createApprovalSnapshot(portfolio.id, transactionDate);
    }

    await logImpersonatedMutation({
      action: "transaction.create",
      entityTable: "transactions",
      entityId: transaction.id,
    });

    // Refresh both the portfolio page (which shows it for the user) and the
    // admin approvals queue (where pending transactions appear).
    revalidatePath("/portal/portfolio");
    revalidatePath("/portal/admin/transactions");

    return { success: true, data: transaction };
  });
}

