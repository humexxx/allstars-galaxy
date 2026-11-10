import { describe, expect, it } from "vitest";

import { cashMovementSchema, tradeSchema } from "./trading";

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

describe("cashMovementSchema", () => {
  it("refuses an amount past the column's digits", () => {
    const parsed = cashMovementSchema.safeParse({ kind: "deposit", amount: 1e12, occurredAt: "2026-11-03T14:00:00Z" });
    expect(parsed.error?.issues[0].message).toBe("Amount is too large");
  });
});
