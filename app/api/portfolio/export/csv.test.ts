import { describe, expect, it } from "vitest";

import { cell, signed } from "./csv";

describe("cell", () => {
  it("neutralises a formula", () => {
    expect(cell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(cell("+1+1")).toBe(`"'+1+1"`);
    expect(cell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
    expect(cell("-2+3")).toBe(`"'-2+3"`);
  });

  it("leaves a negative number a number", () => {
    // "'-500.00" is text to a spreadsheet: every withdrawal and every loss
    // dropped out of the sums a reader makes by hand.
    expect(cell("-500.00")).toBe(`"-500.00"`);
    expect(cell("-0.83752094")).toBe(`"-0.83752094"`);
    expect(cell(-12.4)).toBe(`"-12.4"`);
  });

  it("writes nothing for a missing value", () => {
    expect(cell(null)).toBe("");
    expect(cell(undefined)).toBe("");
  });
});

describe("signed", () => {
  it("puts a minus on withdrawals only", () => {
    expect(signed("1000.00", "withdrawal")).toBe("-1000.00");
    expect(signed("1000.00", "buy")).toBe("1000.00");
    expect(signed("0.00", "withdrawal")).toBe("0.00");
    expect(signed(null, "withdrawal")).toBeNull();
  });
});
