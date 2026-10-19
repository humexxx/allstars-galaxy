import { describe, expect, it } from "vitest";

import { confirmationSchema } from "@/schemas/finance-confirmations";

import { amountError, normalizeAmount } from "./amount-input";

describe("amount input (confirmation dialog)", () => {
  it("accepts what a banking app shows, as the schema's plain decimal", () => {
    expect(normalizeAmount("$1,234.50")).toBe("1234.50");
    expect(normalizeAmount(" -2,000 ")).toBe("-2000");
    expect(amountError("$1,234.50", false)).toBeNull();
  });

  it("names the problem per field instead of a bare 'Invalid input' toast", () => {
    expect(amountError("", false)).toMatch(/Enter an amount/);
    expect(amountError("-50", false)).toBe("Can't be negative.");
    expect(amountError("12.345", false)).toMatch(/up to 2 decimals/);
    expect(amountError("abc", true)).toMatch(/up to 2 decimals/);
  });

  it("savings may be negative (a carried overdraft); balances may not", () => {
    expect(amountError("-300.25", true)).toBeNull();
    expect(amountError("-300.25", false)).not.toBeNull();
  });

  it("whatever passes here passes the server schema", () => {
    const id = "44444444-0000-4000-8000-000000000001";
    for (const raw of ["$8,567.59", "0", "-12.5", "1e3", "12.345"]) {
      const savingsOk = amountError(raw, true) === null;
      const parsed = confirmationSchema.safeParse({
        planId: id,
        confirmedSavings: normalizeAmount(raw),
        confirmedInvestments: "0",
        debtBalances: [],
      });
      expect(parsed.success).toBe(savingsOk);
    }
  });
});
