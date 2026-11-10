import { describe, expect, it } from "vitest";

import { cashMovementSchema, closeTradeSchema, tradeResultSchema, tradeSchema } from "./trading";

const trade = { symbol: "nvda", side: "long", quantity: 1, entryPrice: 100, openedAt: "2026-11-03T14:00:00Z" };
const firstIssue = (input: unknown): string | undefined => tradeSchema.safeParse(input).error?.issues[0].message;

describe("tradeSchema", () => {
  it("takes the smallest quantity the column holds, and nothing finer", () => {
    expect(tradeSchema.safeParse({ ...trade, quantity: 0.00000001 }).success).toBe(true);
    expect(firstIssue({ ...trade, quantity: 0.000000001 })).toBe("Quantity must be at least 0.00000001");
    expect(firstIssue({ ...trade, quantity: 0 })).toBe("Quantity must be more than 0");
  });

  it("refuses a number past the column's digits", () => {
    expect(firstIssue({ ...trade, quantity: 1e12 })).toBe("Quantity is too large");
    expect(firstIssue({ ...trade, entryPrice: 1e12 })).toBe("Entry price is too large");
  });
});

describe("tradeResultSchema", () => {
  const OPENED = "2026-11-03T14:00:00Z";
  const CLOSED = "2026-11-04T14:00:00Z";
  const issue = (input: unknown): string | undefined => tradeResultSchema.safeParse(input).error?.issues[0].message;

  it("takes an open trade with nothing but its instrument and when it opened", () => {
    expect(tradeResultSchema.parse({ symbol: " xauusd ", openedAt: OPENED })).toEqual({
      symbol: "XAUUSD",
      openedAt: OPENED,
      closedAt: null,
      pnl: null,
      notes: null,
    });
  });

  it("takes a loss, to the cent", () => {
    expect(tradeResultSchema.parse({ symbol: "BTCUSD", openedAt: OPENED, closedAt: CLOSED, pnl: -12.34 }).pnl).toBe(-12.34);
    expect(issue({ symbol: "BTCUSD", openedAt: OPENED, closedAt: CLOSED, pnl: 1.234 })).toBe("P&L has at most 2 decimals");
  });

  it("closes a trade with its result and its time together, never one alone", () => {
    const message = "A closed trade needs both its P&L and when it closed";
    expect(issue({ symbol: "BTCUSD", openedAt: OPENED, closedAt: CLOSED })).toBe(message);
    expect(issue({ symbol: "BTCUSD", openedAt: OPENED, pnl: 10 })).toBe(message);
  });

  it("refuses a close before the open", () => {
    expect(issue({ symbol: "BTCUSD", openedAt: CLOSED, closedAt: OPENED, pnl: 10 })).toBe(
      "A trade cannot close before it opened"
    );
  });
});

describe("closeTradeSchema", () => {
  it("needs what the trade made", () => {
    const close = { id: "00000000-0000-4000-8000-000000000001", closedAt: "2026-11-04T14:00:00Z" };
    expect(closeTradeSchema.safeParse({ ...close, pnl: 0 }).success).toBe(true);
    expect(closeTradeSchema.safeParse(close).success).toBe(false);
    expect(closeTradeSchema.safeParse({ ...close, pnl: null }).success).toBe(false);
    expect(closeTradeSchema.safeParse({ ...close, pnl: "" }).error?.issues[0].message).toBe("P&L must be a number");
  });
});

describe("cashMovementSchema", () => {
  it("refuses an amount past the column's digits", () => {
    const parsed = cashMovementSchema.safeParse({ kind: "deposit", amount: 1e12, occurredAt: "2026-11-03T14:00:00Z" });
    expect(parsed.error?.issues[0].message).toBe("Amount is too large");
  });
});
