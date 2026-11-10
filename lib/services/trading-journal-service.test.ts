import { beforeEach, describe, expect, it, vi } from "vitest";

import { tradingTrades } from "@/db/schema";
import type { TradingCashMovementRow, TradingTradeRow } from "@/types/trading";

const journal: { trades: TradingTradeRow[]; cash: TradingCashMovementRow[] } = { trades: [], cash: [] };
const locks: unknown[] = [];
const inserted: Record<string, unknown>[] = [];
const updated: Record<string, unknown>[] = [];
let deletes = 0;

vi.mock("@/db", () => {
  const client = {
    execute: async (query: unknown) => locks.push(query),
    select: () => ({
      from: (table: unknown) => ({
        where: async () => (table === tradingTrades ? journal.trades : journal.cash),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          inserted.push(values);
          return [{ id: "new", ...values }];
        },
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            updated.push(values);
            return [{ ...journal.trades[0], ...values }];
          },
        }),
      }),
    }),
    delete: () => ({
      where: async () => {
        deletes += 1;
      },
    }),
  };
  return { db: { ...client, transaction: (run: (tx: typeof client) => unknown) => run(client) } };
});

import {
  addCashMovement,
  closeTrade,
  createTrade,
  deleteCashMovement,
  TradingJournalError,
  updateTrade,
} from "./trading-journal-service";

const USER = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-11-08T15:00:00Z");

function cash(id: string, kind: "deposit" | "withdrawal", amount: string): TradingCashMovementRow {
  return { id, userId: USER, kind, amount, occurredAt: NOW, note: null, createdAt: NOW, updatedAt: NOW };
}

function openTrade(fees: string): TradingTradeRow {
  return {
    id: "t1",
    userId: USER,
    symbol: "NVDA",
    side: "long",
    quantity: "10",
    multiplier: "1",
    entryPrice: "100",
    exitPrice: null,
    openedAt: new Date("2026-11-03T14:00:00Z"),
    closedAt: null,
    fees,
    setup: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const movement = (kind: "deposit" | "withdrawal", amount: number) => ({
  kind,
  amount,
  occurredAt: NOW.toISOString(),
  note: null,
});

beforeEach(() => {
  journal.trades = [];
  journal.cash = [];
  locks.length = 0;
  inserted.length = 0;
  updated.length = 0;
  deletes = 0;
});

describe("addCashMovement", () => {
  it("refuses a withdrawal past the balance, read under the journal's lock", async () => {
    journal.cash = [cash("d1", "deposit", "1000.00"), cash("w1", "withdrawal", "800.00")];

    await expect(addCashMovement(USER, movement("withdrawal", 800))).rejects.toThrow("Only $200.00 is in the account");

    expect(locks).toHaveLength(1);
    expect(inserted).toEqual([]);
  });

  it("writes a withdrawal the balance holds", async () => {
    journal.cash = [cash("d1", "deposit", "1000.00")];

    await addCashMovement(USER, movement("withdrawal", 1000));

    expect(inserted).toEqual([expect.objectContaining({ kind: "withdrawal", amount: "1000.00" })]);
  });

  it("writes a deposit without waiting on the lock", async () => {
    await addCashMovement(USER, movement("deposit", 250.5));

    expect(locks).toEqual([]);
    expect(inserted).toEqual([expect.objectContaining({ kind: "deposit", amount: "250.50" })]);
  });
});

describe("deleteCashMovement", () => {
  it("keeps a deposit the account already paid out", async () => {
    journal.cash = [cash("d1", "deposit", "1000.00"), cash("w1", "withdrawal", "900.00")];

    await expect(deleteCashMovement(USER, "d1")).rejects.toThrow(
      "Deleting it would leave the account at -$900.00; it cannot go below $0.00"
    );

    expect(deletes).toBe(0);
  });

  it("deletes a deposit nothing leans on, and any withdrawal", async () => {
    journal.cash = [cash("d1", "deposit", "1000.00"), cash("d2", "deposit", "500.00"), cash("w1", "withdrawal", "400.00")];

    await deleteCashMovement(USER, "d2");
    await deleteCashMovement(USER, "w1");

    expect(deletes).toBe(2);
    expect(locks).toHaveLength(2);
  });

  it("says when the movement is not the user's", async () => {
    await expect(deleteCashMovement(USER, "nope")).rejects.toBeInstanceOf(TradingJournalError);
    expect(deletes).toBe(0);
  });
});

const OPENED = "2026-11-03T14:00:00.000Z";

describe("a trade from the form", () => {
  it("is stored as its result alone", async () => {
    const made = await createTrade(USER, { symbol: "XAUUSD", openedAt: OPENED, closedAt: NOW.toISOString(), pnl: -42.5, notes: null });

    expect(inserted).toEqual([
      expect.objectContaining({ symbol: "XAUUSD", side: "long", quantity: "1", entryPrice: "42.5", exitPrice: "0", fees: "0" }),
    ]);
    expect(made.pnl).toBe(-42.5);
  });

  it("stays open with no result", async () => {
    const made = await createTrade(USER, { symbol: "XAUUSD", openedAt: OPENED, closedAt: null, pnl: null, notes: "Waiting" });

    expect(inserted).toEqual([expect.objectContaining({ entryPrice: "0", exitPrice: null, closedAt: null, notes: "Waiting" })]);
    expect(made.status).toBe("open");
  });

  it("keeps a recorded position when its result is edited", async () => {
    journal.trades = [{ ...openTrade("0"), exitPrice: "110", closedAt: NOW }];

    const edited = await updateTrade(USER, { id: "t1", symbol: "NVDA", openedAt: OPENED, closedAt: NOW.toISOString(), pnl: 150, notes: null });

    expect(updated).toEqual([expect.objectContaining({ side: "long", quantity: "10", entryPrice: "100", exitPrice: "115" })]);
    expect(edited.pnl).toBe(150);
  });

  it("reopens a trade when its close is cleared", async () => {
    journal.trades = [{ ...openTrade("0"), exitPrice: "110", closedAt: NOW }];

    const edited = await updateTrade(USER, { id: "t1", symbol: "NVDA", openedAt: OPENED, closedAt: null, pnl: null, notes: null });

    expect(updated).toEqual([expect.objectContaining({ exitPrice: null, closedAt: null })]);
    expect(edited.status).toBe("open");
  });
});

describe("closeTrade", () => {
  it("moves a position's exit price to what the trade made, fees included", async () => {
    journal.trades = [openTrade("0.50")];

    const closed = await closeTrade(USER, { id: "t1", pnl: 99.5, closedAt: NOW.toISOString() });

    expect(updated).toEqual([expect.objectContaining({ quantity: "10", exitPrice: "110", fees: "0.5", closedAt: NOW })]);
    expect(closed.pnl).toBe(99.5);
  });

  it("closes a trade recorded by its result", async () => {
    journal.trades = [{ ...openTrade("0"), quantity: "1", entryPrice: "0" }];

    const closed = await closeTrade(USER, { id: "t1", pnl: -30, closedAt: NOW.toISOString() });

    expect(updated).toEqual([expect.objectContaining({ entryPrice: "30", exitPrice: "0" })]);
    expect(closed.pnl).toBe(-30);
  });

  it("refuses a trade already closed, or a close before the open", async () => {
    journal.trades = [openTrade("0")];
    await expect(closeTrade(USER, { id: "t1", pnl: 10, closedAt: "2026-11-01T14:00:00Z" })).rejects.toThrow(
      "A trade cannot close before it opened"
    );

    journal.trades = [{ ...openTrade("0"), exitPrice: "110", closedAt: NOW }];
    await expect(closeTrade(USER, { id: "t1", pnl: 10, closedAt: NOW.toISOString() })).rejects.toThrow(
      "NVDA is already closed"
    );
    expect(updated).toEqual([]);
  });
});
