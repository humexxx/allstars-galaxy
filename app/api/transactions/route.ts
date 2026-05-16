import { NextResponse } from "next/server";
import { createTransaction } from "@/lib/services/transaction-service";
import { createApprovalSnapshot } from "@/lib/services/snapshot-service";
import { createTransactionSchema } from "@/schemas/transaction";
import {
  getEffectiveContext,
  logImpersonatedMutation,
} from "@/lib/services/impersonation";

export async function POST(request: Request) {
  try {
    const ctx = await getEffectiveContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { investmentMethodId, amount, date, notes, userId } = parsed.data;
    // When impersonating, the request runs as the impersonated user — the admin's
    // privileges do NOT apply. Mirrors what the user would see/do themselves.
    const isAdmin = ctx.realRole === "admin" && !ctx.isImpersonating;
    const callerId = ctx.effectiveUserId;

    if (userId && userId !== callerId && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only admins can create transactions for other users" },
        { status: 403 }
      );
    }

    const targetUserId = userId ?? callerId;

    const transactionDate = new Date(date);
    if (!isAdmin) {
      const dayInMs = 1000 * 60 * 60 * 24;
      const driftDays = Math.abs(transactionDate.getTime() - Date.now()) / dayInMs;
      if (driftDays > 1) {
        return NextResponse.json(
          { error: "Regular users can only create transactions with the current date" },
          { status: 400 }
        );
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
      }
    );

    if (isAdmin && transaction.status === "approved") {
      await createApprovalSnapshot(portfolio.id, transactionDate);
    }

    await logImpersonatedMutation({
      action: "transaction.create",
      entityTable: "transactions",
      entityId: transaction.id,
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Transaction creation error:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
