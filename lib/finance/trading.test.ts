import { describe, expect, it } from "vitest";

import type { TradingCashMovementRow, TradingTradeRow } from "@/types/trading";

import { buildJournal, journalMonths, tradePnl, trailingMonthlyRate } from "./trading";

const dayOf = (d: Date): string => d.toISOString().slice(0, 10);
const at = (day: string, hour = 15): Date => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);

function trade(o: Partial<TradingTradeRow> & { id: string }): TradingTradeRow {
  return {
    userId: "u",
    symbol: "AAPL",
    side: "long",
    quantity: "10",
    multiplier: "1",
    entryPrice: "100",
    exitPrice: null,
    openedAt: at("2026-09-01"),
    closedAt: null,
    fees: "0",
    setup: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...o,
  } as TradingTradeRow;
}

function cash(o: Partial<TradingCashMovementRow> & { id: string }): TradingCashMovementRow {
  return {
    userId: "u",
    kind: "deposit",
    amount: "1000",
    occurredAt: at("2026-09-01", 9),
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...o,
  } as TradingCashMovementRow;
}

describe("tradePnl", () => {
  it("counts a long's rise, a short's fall, the multiplier and the fees", () => {
    const base = { quantity: 2, multiplier: 1, entryPrice: 100, exitPrice: 110, fees: 1 };
    expect(tradePnl({ ...base, side: "long" })).toBe(19);
    expect(tradePnl({ ...base, side: "short" })).toBe(-21);
    expect(tradePnl({ ...base, side: "long", multiplier: 100 })).toBe(1999);
    expect(tradePnl({ ...base, side: "long", exitPrice: null })).toBeNull();
  });
});

describe("buildJournal", () => {
  const journal = buildJournal(
    {
      trades: [
        trade({ id: "a", exitPrice: "110", closedAt: at("2026-09-03") }), // +100, held 2 days
        trade({ id: "b", side: "short", entryPrice: "50", exitPrice: "55", openedAt: at("2026-09-03"), closedAt: at("2026-09-03"), fees: "2" }), // −52
        trade({ id: "c", symbol: "TSLA", entryPrice: "200", exitPrice: "230", openedAt: at("2026-09-10"), closedAt: at("2026-09-11") }), // +300
        trade({ id: "d", symbol: "NVDA", openedAt: at("2026-09-20") }), // open
      ],
      cash: [cash({ id: "x" }), cash({ id: "y", kind: "withdrawal", amount: "200", occurredAt: at("2026-09-15") })],
    },
    dayOf,
    "2026-09-30"
  );

  it("balances deposits, withdrawals and realized P&L", () => {
    expect(journal.realizedPnl).toBe(348);
    expect(journal.balance).toBe(1000 - 200 + 348);
    expect(journal.openExposure).toBe(1000);
  });

  it("reads the stats a trader checks first", () => {
    const s = journal.stats;
    expect(s.trades).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.winRate).toBeCloseTo(2 / 3);
    expect(s.profitFactor).toBeCloseTo(400 / 52);
    expect(s.expectancy).toBeCloseTo(116);
    expect(s.largestLoss).toBe(52);
    expect(s.maxDrawdown).toBe(52);
    expect(s.avgHoldDays).toBeCloseTo(1);
  });

  it("puts each closed trade on the day it closed", () => {
    expect(journal.days).toEqual([
      { day: "2026-09-03", pnl: 48, trades: 2, wins: 1, losses: 1 },
      { day: "2026-09-11", pnl: 300, trades: 1, wins: 1, losses: 0 },
    ]);
  });

  it("draws the balance day by day, cash and P&L together", () => {
    expect(journal.equity.map((p) => [p.day, p.balance, p.cumulativePnl])).toEqual([
      ["2026-09-01", 1000, 0],
      ["2026-09-03", 1048, 48],
      ["2026-09-11", 1348, 348],
      ["2026-09-15", 1148, 348],
    ]);
  });

  it("breaks P&L down by weekday and symbol", () => {
    expect(journal.byWeekday.map((r) => r.key)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(journal.byWeekday.find((r) => r.key === "Thu")?.pnl).toBe(48);
    expect(journal.bySymbol[0]).toMatchObject({ key: "TSLA", pnl: 300 });
  });
});

describe("growth for the plan", () => {
  it("averages the last complete months' returns, leaving today's month out", () => {
    const j = buildJournal(
      {
        trades: [
          trade({ id: "1", exitPrice: "110", openedAt: at("2026-07-02"), closedAt: at("2026-07-10") }), // +100 on 1,000
          trade({ id: "2", exitPrice: "105", openedAt: at("2026-08-02"), closedAt: at("2026-08-10") }), // +50 on 1,100
          trade({ id: "3", exitPrice: "150", openedAt: at("2026-09-02"), closedAt: at("2026-09-10") }), // this month
        ],
        cash: [cash({ id: "x", occurredAt: at("2026-07-01", 9) })],
      },
      dayOf,
      "2026-09-20"
    );
    expect(j.months.map((m) => m.month)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(j.months[1].returnPct).toBeCloseTo(50 / 1100);
    expect(j.growthMonths).toBe(2);
    expect(j.monthlyGrowthRate).toBeCloseTo((0.1 + 50 / 1100) / 2);
  });

  it("counts a day's deposit and withdrawal each in full, not their difference", () => {
    const j = buildJournal(
      {
        trades: [trade({ id: "1", exitPrice: "150", openedAt: at("2026-08-03"), closedAt: at("2026-08-10") })], // +500
        cash: [
          cash({ id: "in", amount: "5000", occurredAt: at("2026-08-01", 9) }),
          cash({ id: "out", kind: "withdrawal", amount: "4000", occurredAt: at("2026-08-01", 10) }),
        ],
      },
      dayOf,
      "2026-09-20"
    );
    expect(j.months[0].returnPct).toBeCloseTo(500 / 5000);
    expect(j.balance).toBe(1500);
    expect(j.equity[0]).toMatchObject({ day: "2026-08-01", balance: 1000 });
  });

  it("counts one month for at most a doubling, or a wipe-out", () => {
    const months = [
      { month: "2026-06", pnl: 500, returnPct: 50 },
      { month: "2026-07", pnl: -300, returnPct: -3 },
      { month: "2026-08", pnl: 20, returnPct: 0.02 },
    ];
    expect(trailingMonthlyRate(months.slice(0, 1), "2026-09-20").rate).toBe(1);
    expect(trailingMonthlyRate(months.slice(1, 2), "2026-09-20").rate).toBe(-1);
    expect(trailingMonthlyRate(months, "2026-09-20").rate).toBeCloseTo(0.02 / 3);
  });

  it("reads no pace without a complete month", () => {
    expect(trailingMonthlyRate(journalMonths([], [], "2026-09-20"), "2026-09-20")).toEqual({ rate: 0, months: 0 });
  });
});
