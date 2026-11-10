"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { logImpersonatedMutation } from "@/lib/services/impersonation";
import { requireModuleContext } from "@/lib/services/module-access-service";
import { searchInstruments } from "@/lib/services/trading-instrument-service";
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
  instrumentQuerySchema,
  tradeResultSchema,
  updateTradeResultSchema,
  type CashMovementInput,
  type CloseTradeInput,
  type TradeResultInput,
  type UpdateTradeResultInput,
} from "@/schemas/trading";
import type { JournalTrade, TradingInstrument } from "@/types/trading";

/** The journal, the plans (their trading card and net worth) and the dashboard. */
function revalidateJournal(): void {
  revalidatePath("/portal/trading");
  revalidatePath("/portal/plans", "layout");
  revalidatePath("/portal");
}

/** Runs a journal write: a refusal the user should read comes back as the error. */
async function journalWrite<T>(
  action: string,
  entityTable: "trading_trades" | "trading_cash_movements",
  write: (userId: string) => Promise<T>
): Promise<ActionResult<T>> {
  const ctx = await requireModuleContext("trading");
  try {
    const data = await write(ctx.effectiveUserId);
    await logImpersonatedMutation({ action, entityTable });
    revalidateJournal();
    return { success: true, data } as ActionResult<T>;
  } catch (err) {
    if (err instanceof TradingJournalError) return { success: false, error: err.message };
    throw err;
  }
}

export async function createTradeAction(input: TradeResultInput): Promise<ActionResult<JournalTrade>> {
  return safe("trading-journal", async () => {
    const parsed = tradeResultSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    return journalWrite("trading.trade.create", "trading_trades", (userId) => createTrade(userId, parsed.data));
  });
}

export async function updateTradeAction(input: UpdateTradeResultInput): Promise<ActionResult<JournalTrade>> {
  return safe("trading-journal", async () => {
    const parsed = updateTradeResultSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    return journalWrite("trading.trade.update", "trading_trades", (userId) => updateTrade(userId, parsed.data));
  });
}

export async function closeTradeAction(input: CloseTradeInput): Promise<ActionResult<JournalTrade>> {
  return safe("trading-journal", async () => {
    const parsed = closeTradeSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    return journalWrite("trading.trade.close", "trading_trades", (userId) => closeTrade(userId, parsed.data));
  });
}

export async function deleteTradeAction(id: string): Promise<ActionResult> {
  return safe("trading-journal", async () => {
    if (!idSchema.safeParse(id).success) return { success: false, error: "Trade not found" };
    const result = await journalWrite("trading.trade.delete", "trading_trades", (userId) =>
      deleteTrade(userId, id)
    );
    return result.success ? { success: true } : result;
  });
}

export async function addCashMovementAction(input: CashMovementInput): Promise<ActionResult> {
  return safe("trading-journal", async () => {
    const parsed = cashMovementSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    const result = await journalWrite("trading.cash.add", "trading_cash_movements", (userId) =>
      addCashMovement(userId, parsed.data)
    );
    return result.success ? { success: true } : result;
  });
}

export async function deleteCashMovementAction(id: string): Promise<ActionResult> {
  return safe("trading-journal", async () => {
    if (!idSchema.safeParse(id).success) return { success: false, error: "Movement not found" };
    const result = await journalWrite("trading.cash.delete", "trading_cash_movements", (userId) =>
      deleteCashMovement(userId, id)
    );
    return result.success ? { success: true } : result;
  });
}

/**
 * Market instruments matching what was typed in the trade form. `available`
 * is false when the search cannot answer; the form then takes a typed symbol.
 */
export async function searchInstrumentsAction(
  query: string
): Promise<ActionResult<{ instruments: TradingInstrument[]; available: boolean }>> {
  return safe("trading-journal", async () => {
    await requireModuleContext("trading");
    const parsed = instrumentQuerySchema.safeParse(query);
    if (!parsed.success) return { success: true, data: { instruments: [], available: true } };
    const instruments = await searchInstruments(parsed.data);
    return { success: true, data: { instruments: instruments ?? [], available: instruments !== null } };
  });
}
