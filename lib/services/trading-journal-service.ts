import "server-only";

import { cache } from "react";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { tradingCashMovements, tradingTrades } from "@/db/schema";
import { buildJournal, toJournalTrade } from "@/lib/finance/trading";
import { isoDay } from "@/lib/finance/schedule";
import { calendarDayInTimeZone } from "@/lib/utils/date";
import type {
  CashMovementData,
  CloseTradeData,
  TradeData,
  UpdateTradeData,
} from "@/schemas/trading";
import type {
  JournalTrade,
  TradingCashMovementRow,
  TradingJournal,
  TradingSummary,
  TradingTradeRow,
} from "@/types/trading";

/** A refusal the user should read: a trade that is not theirs, a withdrawal past the balance. */
export class TradingJournalError extends Error {}

const decimal = (n: number): string => String(n);

/** Every trade and cash movement of the user's journal. */
export async function getJournalRows(
  userId: string
): Promise<{ trades: TradingTradeRow[]; cash: TradingCashMovementRow[] }> {
  const [trades, cash] = await Promise.all([
    db.select().from(tradingTrades).where(eq(tradingTrades.userId, userId)),
    db.select().from(tradingCashMovements).where(eq(tradingCashMovements.userId, userId)),
  ]);
  return { trades, cash };
}

/**
 * The user's journal with every day read on their calendar (`timeZone`), so
 * a trade closed at 9 pm in Costa Rica lands on that day, not tomorrow's UTC
 * one. Request-cached: the journal page and the plan read it in one request.
 */
export const getTradingJournal = cache(async function getTradingJournal(
  userId: string,
  timeZone: string | null,
  now: Date = new Date()
): Promise<TradingJournal> {
  const dayOf = (d: Date): string => isoDay(calendarDayInTimeZone(d, timeZone));
  return buildJournal(await getJournalRows(userId), dayOf, dayOf(now));
});

/** The trading account as a plan counts it; null for a user with no journal. */
export async function getTradingSummary(
  userId: string,
  timeZone: string | null
): Promise<TradingSummary | null> {
  const journal = await getTradingJournal(userId, timeZone);
  if (journal.trades.length === 0 && journal.cash.length === 0) return null;
  return {
    balance: journal.balance,
    asOf: journal.today,
    monthlyGrowthRate: journal.monthlyGrowthRate,
    growthMonths: journal.growthMonths,
  };
}

export function tradeValues(data: TradeData) {
  return {
    symbol: data.symbol,
    side: data.side,
    quantity: decimal(data.quantity),
    multiplier: decimal(data.multiplier),
    entryPrice: decimal(data.entryPrice),
    exitPrice: data.exitPrice == null ? null : decimal(data.exitPrice),
    openedAt: new Date(data.openedAt),
    closedAt: data.closedAt == null ? null : new Date(data.closedAt),
    fees: decimal(data.fees),
    setup: data.setup || null,
    notes: data.notes || null,
  };
}

const utcDay = (d: Date): string => d.toISOString().slice(0, 10);

export async function createTrade(userId: string, data: TradeData): Promise<JournalTrade> {
  const [row] = await db
    .insert(tradingTrades)
    .values({ userId, ...tradeValues(data) })
    .returning();
  return toJournalTrade(row, utcDay);
}

async function ownTrade(userId: string, id: string): Promise<TradingTradeRow> {
  const [row] = await db
    .select()
    .from(tradingTrades)
    .where(and(eq(tradingTrades.id, id), eq(tradingTrades.userId, userId)));
  if (!row) throw new TradingJournalError("Trade not found");
  return row;
}

export async function updateTrade(userId: string, data: UpdateTradeData): Promise<JournalTrade> {
  await ownTrade(userId, data.id);
  const [row] = await db
    .update(tradingTrades)
    .set({ ...tradeValues(data), updatedAt: new Date() })
    .where(and(eq(tradingTrades.id, data.id), eq(tradingTrades.userId, userId)))
    .returning();
  return toJournalTrade(row, utcDay);
}

/** Closes an open trade at a price and time, adding the closing order's fees. */
export async function closeTrade(userId: string, data: CloseTradeData): Promise<JournalTrade> {
  const trade = await ownTrade(userId, data.id);
  if (trade.closedAt) throw new TradingJournalError(`${trade.symbol} is already closed`);
  const closedAt = new Date(data.closedAt);
  if (closedAt < trade.openedAt) throw new TradingJournalError("A trade cannot close before it opened");
  const [row] = await db
    .update(tradingTrades)
    .set({
      exitPrice: decimal(data.exitPrice),
      closedAt,
      fees: decimal(parseFloat(trade.fees) + data.fees),
      updatedAt: new Date(),
    })
    .where(and(eq(tradingTrades.id, data.id), eq(tradingTrades.userId, userId)))
    .returning();
  return toJournalTrade(row, utcDay);
}

export async function deleteTrade(userId: string, id: string): Promise<void> {
  await ownTrade(userId, id);
  await db.delete(tradingTrades).where(and(eq(tradingTrades.id, id), eq(tradingTrades.userId, userId)));
}

/** A deposit or withdrawal. A withdrawal cannot take out more than the balance holds. */
export async function addCashMovement(
  userId: string,
  data: CashMovementData
): Promise<TradingCashMovementRow> {
  if (data.kind === "withdrawal") {
    const { balance } = buildJournal(await getJournalRows(userId), utcDay, utcDay(new Date()));
    if (data.amount > balance + 0.005) {
      throw new TradingJournalError(`Only $${balance.toFixed(2)} is in the account`);
    }
  }
  const [row] = await db
    .insert(tradingCashMovements)
    .values({
      userId,
      kind: data.kind,
      amount: data.amount.toFixed(2),
      occurredAt: new Date(data.occurredAt),
      note: data.note || null,
    })
    .returning();
  return row;
}

export async function deleteCashMovement(userId: string, id: string): Promise<void> {
  const deleted = await db
    .delete(tradingCashMovements)
    .where(and(eq(tradingCashMovements.id, id), eq(tradingCashMovements.userId, userId)))
    .returning({ id: tradingCashMovements.id });
  if (deleted.length === 0) throw new TradingJournalError("Movement not found");
}
