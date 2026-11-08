"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { logImpersonatedMutation, requireEffectiveContext } from "@/lib/services/impersonation";
import {
  addCashMovement,
  closeTrade,
  createTrade,
  deleteCashMovement,
  deleteTrade,
  TradingJournalError,
  updateTrade,
} from "@/lib/services/trading-journal-service";
import { idSchema } from "@/schemas/common";
import {
  cashMovementSchema,
  closeTradeSchema,
  tradeSchema,
  updateTradeSchema,
  type CashMovementInput,
  type CloseTradeInput,
  type TradeInput,
  type UpdateTradeInput,
} from "@/schemas/trading";
import type { JournalTrade } from "@/types/trading";

/** The journal, the plans (their trading card and net worth) and the dashboard. */
function revalidateJournal(): void {
  revalidatePath("/portal/trading");
  revalidatePath("/portal/plans", "layout");
  revalidatePath("/portal");
}

/** Runs a journal write: a refusal the user should read comes back as the error. */
async function journalWrite<T>(
  action: string,
  write: (userId: string) => Promise<T>
): Promise<ActionResult<T>> {
  const ctx = await requireEffectiveContext();
  try {
    const data = await write(ctx.effectiveUserId);
    await logImpersonatedMutation({ action, entityTable: "trading_trades" });
    revalidateJournal();
    return { success: true, data } as ActionResult<T>;
  } catch (err) {
    if (err instanceof TradingJournalError) return { success: false, error: err.message };
    throw err;
  }
}

export async function createTradeAction(input: TradeInput): Promise<ActionResult<JournalTrade>> {
  return safe("trading-journal", async () => {
    const parsed = tradeSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    return journalWrite("trading.trade.create", (userId) => createTrade(userId, parsed.data));
  });
}

export async function updateTradeAction(input: UpdateTradeInput): Promise<ActionResult<JournalTrade>> {
  return safe("trading-journal", async () => {
    const parsed = updateTradeSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    return journalWrite("trading.trade.update", (userId) => updateTrade(userId, parsed.data));
  });
}

export async function closeTradeAction(input: CloseTradeInput): Promise<ActionResult<JournalTrade>> {
  return safe("trading-journal", async () => {
    const parsed = closeTradeSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    return journalWrite("trading.trade.close", (userId) => closeTrade(userId, parsed.data));
  });
}

export async function deleteTradeAction(id: string): Promise<ActionResult> {
  return safe("trading-journal", async () => {
    if (!idSchema.safeParse(id).success) return { success: false, error: "Trade not found" };
    const result = await journalWrite("trading.trade.delete", (userId) => deleteTrade(userId, id));
    return result.success ? { success: true } : result;
  });
}

export async function addCashMovementAction(input: CashMovementInput): Promise<ActionResult> {
  return safe("trading-journal", async () => {
    const parsed = cashMovementSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    const result = await journalWrite("trading.cash.add", (userId) => addCashMovement(userId, parsed.data));
    return result.success ? { success: true } : result;
  });
}

export async function deleteCashMovementAction(id: string): Promise<ActionResult> {
  return safe("trading-journal", async () => {
    if (!idSchema.safeParse(id).success) return { success: false, error: "Movement not found" };
    const result = await journalWrite("trading.cash.delete", (userId) => deleteCashMovement(userId, id));
    return result.success ? { success: true } : result;
  });
}
