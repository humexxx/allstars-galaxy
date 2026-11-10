import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/db", () => ({ db: {} }));

import { tradingChangeSetSchema, type TradingChangeSetInput } from "@/schemas/trading-assistant";
import type { TradingCashMovementRow, TradingTradeRow } from "@/types/trading";

import { planTradingChanges, TradingChangeError } from "./trading-assistant-service";

const NOW = new Date("2026-11-08T15:00:00Z");
const ID = (n: number): string => `00000000-0000-4000-8000-00000000000${n}`;

function trade(over: Partial<TradingTradeRow> = {}): TradingTradeRow {
  return {
    id: ID(1),
    userId: "u",
    symbol: "NVDA",
    side: "long",
    quantity: "10",
    multiplier: "1",
    entryPrice: "100",
    exitPrice: null,
    openedAt: new Date("2026-11-03T14:00:00Z"),
    closedAt: null,
    fees: "1",
    setup: "Breakout",
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

const deposit = (amount: string): TradingCashMovementRow => ({
  id: ID(9),
  userId: "u",
  kind: "deposit",
  amount,
  occurredAt: new Date("2026-10-01T12:00:00Z"),
  note: null,
  createdAt: NOW,
  updatedAt: NOW,
});

function plan(set: TradingChangeSetInput, rows = { trades: [trade()], cash: [deposit("1000")] }) {
  return planTradingChanges(tradingChangeSetSchema.parse(set), rows, { now: NOW, timeZone: "America/Costa_Rica" });
}

describe("planTradingChanges", () => {
  it("closes an open trade, realising its P&L into the balance", () => {
    const planned = plan({ summary: "Close NVDA", changes: [{ op: "close_trade", tradeId: ID(1), exitPrice: 110, fees: 1 }] });
    expect(planned.lines[0]).toMatchObject({ action: "close", title: "Close Long 10 NVDA", pnl: 98 });
    expect(planned.before).toMatchObject({ balance: 1000, openPositions: 1 });
    expect(planned.after).toMatchObject({ balance: 1098, openPositions: 0, monthPnl: 98, winRate: 1 });
    expect(planned.writes).toEqual([
      expect.objectContaining({ kind: "updateTrade", id: ID(1), values: expect.objectContaining({ exitPrice: "110", fees: "2", closedAt: NOW }) }),
    ]);
  });

  it("refuses to close a trade twice", () => {
    const rows = { trades: [trade({ exitPrice: "105", closedAt: NOW })], cash: [] };
    expect(() => plan({ summary: "x", changes: [{ op: "close_trade", tradeId: ID(1), exitPrice: 110 }] }, rows)).toThrow(
      /already closed/
    );
  });

  it("names an unknown trade", () => {
    expect(() => plan({ summary: "x", changes: [{ op: "delete_trade", tradeId: ID(7) }] })).toThrow(TradingChangeError);
  });

  it("refuses a withdrawal past the balance, unless an earlier change funds it", () => {
    expect(() => plan({ summary: "x", changes: [{ op: "withdraw", amount: 1500 }] })).toThrow(/below \$0\.00/);
    const funded = plan({
      summary: "x",
      changes: [
        { op: "deposit", amount: 600 },
        { op: "withdraw", amount: 1500, note: "Rent" },
      ],
    });
    expect(funded.after.balance).toBe(100);
    expect(funded.lines.map((l) => l.title)).toEqual(["Deposit $600.00", "Withdraw $1,500.00"]);
  });

  it("records a closed trade in one change, at the journal's maths", () => {
    const planned = plan({
      summary: "x",
      changes: [
        {
          op: "add_trade",
          symbol: "es",
          side: "short",
          quantity: 1,
          multiplier: 50,
          entryPrice: 6000,
          exitPrice: 5990,
          openedAt: "2026-11-07T09:00:00-06:00",
          fees: 4,
        },
      ],
    });
    expect(planned.lines[0]).toMatchObject({ action: "add", title: "Short 1 ES @ 6,000.00", pnl: 496 });
    expect(planned.after.balance).toBe(1496);
  });

  it("validates a patch over the stored trade and lists what it changes", () => {
    const planned = plan({ summary: "x", changes: [{ op: "update_trade", tradeId: ID(1), patch: { entryPrice: 99.5 } }] });
    expect(planned.lines[0].details).toEqual(["entryPrice: 100.00 → 99.50"]);
    expect(() =>
      plan({ summary: "x", changes: [{ op: "update_trade", tradeId: ID(1), patch: { closedAt: NOW.toISOString() } }] })
    ).toThrow(/exit price/);
    expect(() => plan({ summary: "x", changes: [{ op: "update_trade", tradeId: ID(1), patch: { entryPrice: 100 } }] })).toThrow(
      /as it is/
    );
  });

  it("deleting a deposit that funded a withdrawal is refused", () => {
    const rows = {
      trades: [],
      cash: [deposit("1000"), { ...deposit("800"), id: ID(8), kind: "withdrawal" as const }],
    };
    expect(() => plan({ summary: "x", changes: [{ op: "delete_cash_movement", movementId: ID(9) }] }, rows)).toThrow(
      /below/
    );
  });
});

describe("tradingChangeSetSchema", () => {
  it("describes itself as a JSON Schema the API accepts", () => {
    const json = z.toJSONSchema(tradingChangeSetSchema, { io: "input" }) as { properties: Record<string, unknown> };
    expect(Object.keys(json.properties)).toEqual(["summary", "changes"]);
  });
});
