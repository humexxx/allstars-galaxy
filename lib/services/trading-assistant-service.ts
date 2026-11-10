import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { tradingCashMovements, tradingTrades } from "@/db/schema";
import { buildJournal, tradePnl } from "@/lib/finance/trading";
import { isoDay } from "@/lib/finance/schedule";
import { calendarDayInTimeZone, formatDateTime } from "@/lib/utils/date";
import { formatCurrency, formatSignedCurrency } from "@/lib/utils/format";
import type { TradingChange, TradingChangeSet } from "@/schemas/trading-assistant";
import { tradeSchema, type TradeInput } from "@/schemas/trading";
import type { TradingChangeLine, TradingOutlook } from "@/types/trading-assistant";
import type { JournalTrade, TradingCashMovementRow, TradingTradeRow } from "@/types/trading";

import { getJournalRows, getTradingJournal, tradeValues } from "./trading-journal-service";

/** A change the model must correct: an unknown id, a closed trade closed again, an overdraft. */
export class TradingChangeError extends Error {}

type Rows = { trades: TradingTradeRow[]; cash: TradingCashMovementRow[] };

type TradeValues = ReturnType<typeof tradeValues>;

/** What Apply writes, in order, once every change has been checked. */
type Write =
  | { kind: "insertTrade"; values: TradeValues }
  | { kind: "updateTrade"; id: string; values: TradeValues }
  | { kind: "deleteTrade"; id: string }
  | { kind: "insertCash"; values: Pick<TradingCashMovementRow, "kind" | "amount" | "occurredAt" | "note"> }
  | { kind: "deleteCash"; id: string };

export type PlannedChanges = {
  lines: TradingChangeLine[];
  writes: Write[];
  before: TradingOutlook;
  after: TradingOutlook;
};

const num = (s: string | null): number => (s == null ? 0 : parseFloat(s));

const price = (n: number): string =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 });

function tradeTitle(t: { side: string; quantity: number; symbol: string }): string {
  return `${t.side === "long" ? "Long" : "Short"} ${price(t.quantity).replace(/\.00$/, "")} ${t.symbol}`;
}

const rowTrade = (r: TradingTradeRow) => ({
  side: r.side,
  quantity: num(r.quantity),
  multiplier: num(r.multiplier) || 1,
  entryPrice: num(r.entryPrice),
  exitPrice: r.exitPrice == null ? null : num(r.exitPrice),
  fees: num(r.fees),
  symbol: r.symbol,
});

/** A stored trade as the form's input, so a patch over it is validated whole. */
function rowInput(r: TradingTradeRow): TradeInput {
  return {
    ...rowTrade(r),
    openedAt: r.openedAt.toISOString(),
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    setup: r.setup,
    notes: r.notes,
  };
}

function checkedTrade(input: TradeInput, label: string): TradeValues {
  const parsed = tradeSchema.safeParse(input);
  if (!parsed.success) throw new TradingChangeError(`${label}: ${parsed.error.issues[0].message}`);
  return tradeValues(parsed.data);
}

function outlook(rows: Rows, dayOf: (d: Date) => string, today: string): TradingOutlook {
  const journal = buildJournal(rows, dayOf, today);
  const month = journal.months.find((m) => m.month === today.slice(0, 7));
  return {
    balance: journal.balance,
    openPositions: journal.trades.filter((t) => t.status === "open").length,
    monthPnl: month?.pnl ?? 0,
    winRate: journal.stats.winRate,
  };
}

/**
 * Checks a change set against the journal as it stands and works out what it
 * writes, without writing: each change applies to an in-memory copy, so a
 * later change sees an earlier one (a deposit funds a withdrawal after it).
 * Pure, so the preview and Apply agree by construction.
 */
export function planTradingChanges(
  set: TradingChangeSet,
  stored: Rows,
  { now, timeZone }: { now: Date; timeZone: string | null }
): PlannedChanges {
  const dayOf = (d: Date): string => isoDay(calendarDayInTimeZone(d, timeZone));
  const today = dayOf(now);
  const when = (iso: string | undefined): string => iso ?? now.toISOString();
  const at = (d: Date | string): string => formatDateTime(d, timeZone ?? undefined);
  const rows: Rows = { trades: [...stored.trades], cash: [...stored.cash] };
  const lines: TradingChangeLine[] = [];
  const writes: Write[] = [];
  let fresh = 0;

  const findTrade = (id: string): TradingTradeRow => {
    const row = rows.trades.find((t) => t.id === id);
    if (!row) throw new TradingChangeError(`No trade of the user's has id ${id}`);
    return row;
  };
  const asRow = (values: TradeValues, base?: TradingTradeRow): TradingTradeRow => ({
    id: base?.id ?? `new-${++fresh}`,
    userId: base?.userId ?? "",
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
    ...values,
    side: values.side,
  });
  const replace = (row: TradingTradeRow): void => {
    rows.trades = rows.trades.map((t) => (t.id === row.id ? row : t));
  };

  for (const change of set.changes) {
    switch (change.op) {
      case "open_trade":
      case "add_trade": {
        const closing = change.op === "add_trade";
        const values = checkedTrade(
          {
            symbol: change.symbol,
            side: change.side,
            quantity: change.quantity,
            multiplier: change.multiplier ?? 1,
            entryPrice: change.entryPrice,
            openedAt: when(change.openedAt),
            exitPrice: closing ? change.exitPrice : null,
            closedAt: closing ? when(change.closedAt) : null,
            fees: change.fees ?? 0,
            setup: change.setup ?? null,
            notes: change.notes ?? null,
          },
          change.symbol.toUpperCase()
        );
        const row = asRow(values);
        rows.trades.push(row);
        writes.push({ kind: "insertTrade", values });
        const pnl = tradePnl(rowTrade(row));
        lines.push({
          action: closing ? "add" : "open",
          title: `${tradeTitle(rowTrade(row))} @ ${price(num(row.entryPrice))}`,
          details: [
            closing ? `${at(row.openedAt)} → ${at(row.closedAt!)}` : at(row.openedAt),
            ...(closing ? [`exit ${price(num(row.exitPrice))}`] : []),
            ...(num(row.multiplier) !== 1 ? [`×${num(row.multiplier)} a point`] : []),
            ...(num(row.fees) > 0 ? [`fees ${formatCurrency(row.fees)}`] : []),
            ...(row.setup ? [row.setup] : []),
          ],
          pnl,
        });
        break;
      }
      case "close_trade": {
        const trade = findTrade(change.tradeId);
        if (trade.closedAt) throw new TradingChangeError(`${trade.symbol} (${trade.id}) is already closed`);
        const values = checkedTrade(
          {
            ...rowInput(trade),
            exitPrice: change.exitPrice,
            closedAt: when(change.closedAt),
            fees: num(trade.fees) + (change.fees ?? 0),
          },
          trade.symbol
        );
        const row = asRow(values, trade);
        replace(row);
        writes.push({ kind: "updateTrade", id: trade.id, values });
        lines.push({
          action: "close",
          title: `Close ${tradeTitle(rowTrade(row))}`,
          details: [`at ${price(change.exitPrice)}`, at(row.closedAt!), `entry ${price(num(row.entryPrice))}`],
          pnl: tradePnl(rowTrade(row)),
        });
        break;
      }
      case "update_trade": {
        const trade = findTrade(change.tradeId);
        const before = rowInput(trade);
        const values = checkedTrade({ ...before, ...change.patch }, trade.symbol);
        const row = asRow(values, trade);
        const after = rowInput(row);
        const details = (Object.keys(change.patch) as (keyof TradeInput)[])
          .filter((k) => String(before[k] ?? "") !== String(after[k] ?? ""))
          .map((k) => `${k}: ${show(before[k], timeZone)} → ${show(after[k], timeZone)}`);
        if (details.length === 0) throw new TradingChangeError(`That leaves ${trade.symbol} as it is`);
        replace(row);
        writes.push({ kind: "updateTrade", id: trade.id, values });
        lines.push({ action: "update", title: `Edit ${tradeTitle(rowTrade(trade))}`, details, pnl: null });
        break;
      }
      case "delete_trade": {
        const trade = findTrade(change.tradeId);
        rows.trades = rows.trades.filter((t) => t.id !== trade.id);
        writes.push({ kind: "deleteTrade", id: trade.id });
        const pnl = tradePnl(rowTrade(trade));
        lines.push({
          action: "remove",
          title: `Delete ${tradeTitle(rowTrade(trade))}`,
          details: [`opened ${at(trade.openedAt)}`, ...(pnl == null ? ["open"] : [formatSignedCurrency(pnl)])],
          pnl: null,
        });
        break;
      }
      case "deposit":
      case "withdraw": {
        const kind = change.op === "deposit" ? "deposit" : "withdrawal";
        if (Math.round(change.amount * 100) / 100 !== change.amount) {
          throw new TradingChangeError("An amount has at most 2 decimals");
        }
        const values = {
          kind,
          amount: change.amount.toFixed(2),
          occurredAt: new Date(when(change.occurredAt)),
          note: change.note || null,
        } as const;
        rows.cash.push({ id: `new-${++fresh}`, userId: "", createdAt: now, updatedAt: now, ...values });
        writes.push({ kind: "insertCash", values });
        lines.push({
          action: change.op,
          title: `${kind === "deposit" ? "Deposit" : "Withdraw"} ${formatCurrency(change.amount)}`,
          details: [at(values.occurredAt), ...(values.note ? [values.note] : [])],
          pnl: null,
        });
        break;
      }
      case "delete_cash_movement": {
        const movement = rows.cash.find((c) => c.id === change.movementId);
        if (!movement) throw new TradingChangeError(`No deposit or withdrawal has id ${change.movementId}`);
        rows.cash = rows.cash.filter((c) => c.id !== movement.id);
        writes.push({ kind: "deleteCash", id: movement.id });
        lines.push({
          action: "remove",
          title: `Delete the ${movement.kind} of ${formatCurrency(movement.amount)}`,
          details: [at(movement.occurredAt), ...(movement.note ? [movement.note] : [])],
          pnl: null,
        });
        break;
      }
    }
    assertFunded(change, rows, dayOf, today);
  }

  return { lines, writes, before: outlook(stored, dayOf, today), after: outlook(rows, dayOf, today) };
}

/** Money cannot leave an account that does not hold it. */
function assertFunded(change: TradingChange, rows: Rows, dayOf: (d: Date) => string, today: string): void {
  if (change.op !== "withdraw" && change.op !== "delete_cash_movement") return;
  const { balance } = buildJournal(rows, dayOf, today);
  if (balance < -0.005) {
    throw new TradingChangeError(
      `That would leave the account at ${formatCurrency(balance)}; it cannot go below $0.00`
    );
  }
}

function show(value: unknown, timeZone: string | null): string {
  if (value == null || value === "") return "none";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return formatDateTime(value, timeZone ?? undefined);
  }
  return typeof value === "number" ? price(value) : String(value);
}

/** The preview the card shows: each change in words and the account before and after. */
export async function previewTradingChanges(
  userId: string,
  timeZone: string | null,
  set: TradingChangeSet,
  now: Date = new Date()
): Promise<PlannedChanges> {
  return planTradingChanges(set, await getJournalRows(userId), { now, timeZone });
}

/**
 * Writes a proposal the user approved: checked again against the journal as
 * it is now (the card is not trusted, and the journal may have moved), then
 * written in one transaction, so a proposal lands whole or not at all.
 */
export async function applyTradingChanges(
  userId: string,
  timeZone: string | null,
  set: TradingChangeSet,
  now: Date = new Date()
): Promise<PlannedChanges> {
  const planned = planTradingChanges(set, await getJournalRows(userId), { now, timeZone });
  await db.transaction(async (tx) => {
    for (const write of planned.writes) {
      switch (write.kind) {
        case "insertTrade":
          await tx.insert(tradingTrades).values({ userId, ...write.values });
          break;
        case "updateTrade":
          await tx
            .update(tradingTrades)
            .set({ ...write.values, updatedAt: now })
            .where(and(eq(tradingTrades.id, write.id), eq(tradingTrades.userId, userId)));
          break;
        case "deleteTrade":
          await tx
            .delete(tradingTrades)
            .where(and(eq(tradingTrades.id, write.id), eq(tradingTrades.userId, userId)));
          break;
        case "insertCash":
          await tx.insert(tradingCashMovements).values({ userId, ...write.values });
          break;
        case "deleteCash":
          await tx
            .delete(tradingCashMovements)
            .where(and(eq(tradingCashMovements.id, write.id), eq(tradingCashMovements.userId, userId)));
          break;
      }
    }
  });
  return planned;
}

/** Closed trades the model reads; older ones are summed in the stats. */
const RECENT_TRADES = 40;
const RECENT_CASH = 20;

/**
 * The journal as the model reads it: the account, how the trading is going,
 * every open position, and the latest closed trades and money moved, each
 * with the id a change names.
 */
export async function getAssistantJournal(userId: string, timeZone: string | null): Promise<object> {
  const journal = await getTradingJournal(userId, timeZone);
  const trade = (t: JournalTrade) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side,
    quantity: t.quantity,
    ...(t.multiplier !== 1 ? { multiplier: t.multiplier } : {}),
    entryPrice: t.entryPrice,
    openedAt: t.openedAt,
    ...(t.status === "closed" ? { exitPrice: t.exitPrice, closedAt: t.closedAt, pnl: t.pnl } : {}),
    fees: t.fees,
    setup: t.setup,
    notes: t.notes,
  });
  const closed = journal.trades
    .filter((t) => t.status === "closed")
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""));
  const { stats } = journal;
  return {
    today: journal.today,
    balance: journal.balance,
    deposited: journal.deposited,
    withdrawn: journal.withdrawn,
    realizedPnl: journal.realizedPnl,
    monthlyGrowthRate: journal.monthlyGrowthRate,
    stats: {
      trades: stats.trades,
      winRate: stats.winRate,
      profitFactor: stats.profitFactor,
      expectancy: stats.expectancy,
      avgWin: stats.avgWin,
      avgLoss: stats.avgLoss,
      maxDrawdown: stats.maxDrawdown,
    },
    months: journal.months.slice(-6),
    setups: [...new Set(journal.trades.map((t) => t.setup).filter(Boolean))],
    openTrades: journal.trades.filter((t) => t.status === "open").map(trade),
    recentClosedTrades: closed.slice(0, RECENT_TRADES).map(trade),
    olderClosedTrades: Math.max(0, closed.length - RECENT_TRADES),
    cashMovements: journal.cash.slice(0, RECENT_CASH),
  };
}
