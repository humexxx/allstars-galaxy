import { beforeEach, describe, expect, it, vi } from "vitest";

import { tradingCashMovements, tradingTrades } from "@/db/schema";
import type { TradingBalanceAdjustmentRow, TradingCashMovementRow, TradingTradeRow } from "@/types/trading";

const journal: {
  trades: TradingTradeRow[];
  cash: TradingCashMovementRow[];
  adjustments: TradingBalanceAdjustmentRow[];
} = { trades: [], cash: [], adjustments: [] };
const locks: unknown[] = [];
const inserted: Record<string, unknown>[] = [];
const updated: Record<string, unknown>[] = [];
let deletes = 0;

vi.mock("@/db", () => {
  const client = {
    execute: async (query: unknown) => locks.push(query),
    select: () => ({
      from: (table: unknown) => ({
        where: async () =>
          table === tradingTrades ? journal.trades : table === tradingCashMovements ? journal.cash : journal.adjustments,
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
  adjustBalance,
  closeTrade,
  createTrade,
  deleteBalanceAdjustment,
  deleteCashMovement,
  TradingJournalError,
  updateTrade,
} from "./trading-journal-service";

const USER = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-11-08T15:00:00Z");

function cash(id: string, kind: "deposit" | "withdrawal", amount: string): TradingCashMovementRow {
  return { id, userId: USER, kind, amount, occurredAt: NOW, note: null, createdAt: NOW, updatedAt: NOW };
}

function adjustment(id: string, amount: string): TradingBalanceAdjustmentRow {
  return { id, userId: USER, amount, occurredAt: NOW, note: null, createdAt: NOW, updatedAt: NOW };
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
  journal.adjustments = [];
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

  it("counts a balance adjustment in what a withdrawal can take", async () => {
    journal.cash = [cash("d1", "deposit", "1000.00")];
    journal.adjustments = [adjustment("a1", "-12.40")];

    await expect(addCashMovement(USER, movement("withdrawal", 1000))).rejects.toThrow("Only $987.60 is in the account");
    await addCashMovement(USER, movement("withdrawal", 987.6));

    expect(inserted).toEqual([expect.objectContaining({ kind: "withdrawal", amount: "987.60" })]);
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

  it("keeps a deposit a balance adjustment already took from", async () => {
    journal.cash = [cash("d1", "deposit", "10.00")];
    journal.adjustments = [adjustment("a1", "-4.00")];

    await expect(deleteCashMovement(USER, "d1")).rejects.toThrow(
      "Deleting it would leave the account at -$4.00; it cannot go below $0.00"
    );
    expect(deletes).toBe(0);
  });

  it("says when the movement is not the user's", async () => {
    await expect(deleteCashMovement(USER, "nope")).rejects.toBeInstanceOf(TradingJournalError);
    expect(deletes).toBe(0);
  });
});

describe("adjustBalance", () => {
  const to = (balance: number, note: string | null = null) => ({ balance, occurredAt: NOW.toISOString(), note });

  it("records what separates the journal from the actual balance, read under the lock", async () => {
    journal.cash = [cash("d1", "deposit", "1000.00"), cash("w1", "withdrawal", "200.00")];
    journal.trades = [{ ...openTrade("0"), exitPrice: "110", closedAt: NOW }]; // +100
    journal.adjustments = [adjustment("a0", "-5.00")];

    const made = await adjustBalance(USER, to(882.6, "Swap"));

    expect(locks).toHaveLength(1);
    expect(inserted).toEqual([{ userId: USER, amount: "-12.40", occurredAt: NOW, note: "Swap" }]);
    expect(made).toMatchObject({ amount: -12.4, note: "Swap" });
  });

  it("records a credit when the account holds more", async () => {
    journal.cash = [cash("d1", "deposit", "1000.00")];

    await adjustBalance(USER, to(1000.07));

    expect(inserted).toEqual([expect.objectContaining({ amount: "0.07", note: null })]);
  });

  it("refuses a balance the journal already has", async () => {
    journal.cash = [cash("d1", "deposit", "1000.00")];

    await expect(adjustBalance(USER, to(1000))).rejects.toThrow(
      "The journal already matches: $1,000.00 is in the account"
    );
    expect(inserted).toEqual([]);
  });

  it("can take the account down to nothing", async () => {
    journal.cash = [cash("d1", "deposit", "30.00")];

    await adjustBalance(USER, to(0));

    expect(inserted).toEqual([expect.objectContaining({ amount: "-30.00" })]);
  });

  it("refuses a cost dated before the money that covers it", async () => {
    journal.cash = [cash("d1", "deposit", "100.00")];
    const earlier = new Date("2026-11-01T15:00:00Z").toISOString();

    await expect(adjustBalance(USER, { balance: 60, occurredAt: earlier, note: null })).rejects.toThrow(
      "The account held only $0.00 then"
    );
    expect(inserted).toEqual([]);
  });

  it("backdates a cost the account could pay then, and any credit", async () => {
    const before = new Date("2026-11-01T15:00:00Z");
    journal.cash = [{ ...cash("d0", "deposit", "50.00"), occurredAt: before }, cash("d1", "deposit", "100.00")];
    journal.trades = [{ ...openTrade("0"), exitPrice: "101", closedAt: before }]; // +10, closed at that instant

    await adjustBalance(USER, { balance: 105, occurredAt: before.toISOString(), note: null });
    await adjustBalance(USER, { balance: 170, occurredAt: new Date("2026-10-01T15:00:00Z").toISOString(), note: null });

    expect(inserted).toEqual([
      expect.objectContaining({ amount: "-55.00" }),
      expect.objectContaining({ amount: "10.00" }),
    ]);
  });
});

describe("deleteBalanceAdjustment", () => {
  it("keeps a credit the account already paid out", async () => {
    journal.cash = [cash("d1", "deposit", "100.00"), cash("w1", "withdrawal", "120.00")];
    journal.adjustments = [adjustment("a1", "25.00")];

    await expect(deleteBalanceAdjustment(USER, "a1")).rejects.toThrow(
      "Deleting it would leave the account at -$20.00; it cannot go below $0.00"
    );
    expect(deletes).toBe(0);
  });

  it("deletes a credit nothing leans on, and any cost", async () => {
    journal.cash = [cash("d1", "deposit", "100.00")];
    journal.adjustments = [adjustment("a1", "25.00"), adjustment("a2", "-12.40")];

    await deleteBalanceAdjustment(USER, "a1");
    await deleteBalanceAdjustment(USER, "a2");

    expect(deletes).toBe(2);
    expect(locks).toHaveLength(2);
  });

  it("says when the adjustment is not the user's", async () => {
    await expect(deleteBalanceAdjustment(USER, "nope")).rejects.toBeInstanceOf(TradingJournalError);
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
