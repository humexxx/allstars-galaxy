import { describe, expect, it } from "vitest";

import { formatCurrency, formatCurrencyCompact, moneySign, roundCents } from "./format";

describe("formatCurrencyCompact", () => {
  it("chooses the unit after rounding (999,960 → $1M, 999.6 → $1k)", () => {
    expect(formatCurrencyCompact(999_960)).toBe("$1M");
    expect(formatCurrencyCompact(999_949)).toBe("$999.9k");
    expect(formatCurrencyCompact(999.6)).toBe("$1k");
    expect(formatCurrencyCompact(9_960)).toBe("$10k");
    expect(formatCurrencyCompact(1_960_000)).toBe("$2M");
  });

  it("never prints a sign in front of zero", () => {
    expect(formatCurrencyCompact(-0.004)).toBe("$0");
    expect(formatCurrencyCompact(-0.4)).toBe("$0");
    expect(formatCurrencyCompact(-1_200)).toBe("-$1.2k");
  });
});

describe("formatCurrency", () => {
  it("formats a float leftover that rounds to zero as $0.00, not −$0.00", () => {
    expect(formatCurrency(0.3 - (0.1 + 0.2))).toBe("$0.00");
    expect(formatCurrency(-0.004)).toBe("$0.00");
    expect(formatCurrency(-0.005)).toBe("$0.00");
    expect(formatCurrency(-0.006)).toBe("-$0.01");
  });
});

describe("cent-precision helpers", () => {
  it("classes sub-cent noise as zero, not a deficit", () => {
    expect(moneySign(0.3 - (0.1 + 0.2))).toBe(0);
    expect(moneySign(-0.01)).toBe(-1);
    expect(moneySign(0.01)).toBe(1);
    expect(Object.is(roundCents(-0.001), 0)).toBe(true);
  });
});
