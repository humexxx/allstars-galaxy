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

import { addCashMovement, closeTrade, deleteCashMovement, TradingJournalError } from "./trading-journal-service";

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

describe("closeTrade", () => {
  it("adds the closing fees to the cent", async () => {
    journal.trades = [openTrade("0.10")];

    await closeTrade(USER, { id: "t1", exitPrice: 110, closedAt: NOW.toISOString(), fees: 0.2 });

    expect(updated).toEqual([expect.objectContaining({ exitPrice: "110", fees: "0.30" })]);
  });
});
