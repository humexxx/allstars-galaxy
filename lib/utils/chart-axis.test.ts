import { describe, expect, it } from "vitest";

import { niceTicks, yAxisWidth } from "./chart-axis";
import { formatCurrencyCompact } from "./format";

// Expected values are what recharts-scale's getNiceTickValues returns for the
// same domain — the port was checked against it on 200k random value sets.
describe("niceTicks", () => {
  it("puts zero on a range that crosses it", () => {
    expect(niceTicks([-66396.3, 12000, 92000])).toEqual([-100000, -50000, 0, 50000, 100000]);
  });

  it("starts positive data at zero, as recharts' default [0, auto] domain does", () => {
    expect(niceTicks([95000])).toEqual([0, 25000, 50000, 75000, 100000]);
  });

  it("keeps half steps", () => {
    expect(niceTicks([-12500, 10000])).toEqual([-13000, -6500, 0, 6500, 13000]);
  });

  it("does not drag all-negative data up to zero", () => {
    expect(niceTicks([-40, -20])).toEqual([-40, -35, -30, -25, -20]);
  });

  it("falls back to recharts' ticks for an empty axis", () => {
    expect(niceTicks([])).toEqual([0, 1, 2, 3, 4]);
  });

  it("ignores values that are not finite", () => {
    expect(niceTicks([Number.NaN, Number.POSITIVE_INFINITY, 95000])).toEqual(niceTicks([95000]));
  });
});

describe("yAxisWidth", () => {
  it("leaves the widest label clear of the chart edge", () => {
    const labels = niceTicks([-66396.3, 92000]).map(formatCurrencyCompact);
    // "-$100k" ends 14px short of the plot (tick size + margin); the 10px left
    // margin is room it can use.
    expect(yAxisWidth(labels, { tickMargin: 8, marginLeft: 10 })).toBe(6 * 8 + 6 + 8 - 10);
  });

  it("defaults to recharts' tick margin and no chart margin", () => {
    expect(yAxisWidth(["$50k", "$0"])).toBe(4 * 8 + 6 + 2);
  });
});
