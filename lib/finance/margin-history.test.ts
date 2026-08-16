import { describe, expect, it } from "vitest";

import {
  buildMarginHistory,
  discountToMonth,
  monthRange,
  monthsBetween,
} from "./margin-history";

describe("monthRange", () => {
  it("is inclusive at both ends", () => {
    expect(monthRange("2025-11", "2026-02")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("handles a single month", () => {
    expect(monthRange("2026-08", "2026-08")).toEqual(["2026-08"]);
  });

  it("rolls the year over correctly", () => {
    expect(monthRange("2025-12", "2026-01")).toEqual(["2025-12", "2026-01"]);
  });
});

describe("monthsBetween", () => {
  it("counts across a year boundary", () => {
    expect(monthsBetween("2025-08", "2026-08")).toBe(12);
  });

  it("is negative going backwards", () => {
    expect(monthsBetween("2026-08", "2025-08")).toBe(-12);
  });
});

describe("discountToMonth", () => {
  it("unwinds compounding back to the original stake", () => {
    // 1000 at 0.7%/month for 14 periods is 1102.59.
    expect(discountToMonth(1102.59, 0.007, "2025-06", "2026-08")).toBeCloseTo(1000, 1);
  });

  it("leaves today's value alone", () => {
    expect(discountToMonth(1102.59, 0.007, "2026-08", "2026-08")).toBe(1102.59);
  });

  it("never inflates a future month past the stored value", () => {
    expect(discountToMonth(1000, 0.007, "2026-12", "2026-08")).toBe(1000);
  });
});

describe("buildMarginHistory", () => {
  const prices = new Map([
    ["ada|2025-08", 0.8114],
    ["ada|2025-09", 0.8072],
    ["ada|2025-10", 0.609],
    ["ada|2025-11", 0.4143],
  ]);

  it("values units at each month's own price", () => {
    const out = buildMarginHistory({
      contributions: [{ month: "2025-08", assetId: "ada", quantity: 1000, amount: 811.4 }],
      liabilities: [],
      prices,
      today: "2025-11",
    });

    expect(out.map((p) => Math.round(p.deployed))).toEqual([811, 807, 609, 414]);
  });

  it("accumulates contributions as they land", () => {
    const out = buildMarginHistory({
      contributions: [
        { month: "2025-08", assetId: "ada", quantity: 1000, amount: 811.4 },
        { month: "2025-10", assetId: "ada", quantity: 1000, amount: 609 },
      ],
      liabilities: [],
      prices,
      today: "2025-11",
    });

    expect(out[0].invested).toBeCloseTo(811.4, 2);
    expect(out[3].invested).toBeCloseTo(1420.4, 2);
    // Two thousand units at November's price.
    expect(out[3].deployed).toBeCloseTo(828.6, 1);
  });

  it("lets a withdrawal reduce the deployed position", () => {
    const out = buildMarginHistory({
      contributions: [
        { month: "2025-08", assetId: "ada", quantity: 1000, amount: 811.4 },
        { month: "2025-10", assetId: "ada", quantity: -400, amount: -243.6 },
      ],
      liabilities: [],
      prices,
      today: "2025-10",
    });

    expect(out[2].deployed).toBeCloseTo(600 * 0.609, 2);
  });

  it("separates what is owed from the owner's own stake", () => {
    const out = buildMarginHistory({
      contributions: [],
      liabilities: [
        { month: "2025-08", currentValue: 1000, monthlyRoi: 0, isOwn: false },
        { month: "2025-08", currentValue: 500, monthlyRoi: 0, isOwn: true },
      ],
      prices,
      today: "2025-08",
    });

    expect(out[0].liability).toBe(1000);
    expect(out[0].ownPosition).toBe(500);
    // Own money is capital: it never counts as debt against the margin.
    expect(out[0].margin).toBe(-1000);
  });

  it("lands exactly on today's stored value, so the chart cannot contradict the card", () => {
    const out = buildMarginHistory({
      contributions: [],
      liabilities: [{ month: "2025-08", currentValue: 7277.87, monthlyRoi: 0.007, isOwn: false }],
      prices,
      today: "2026-08",
    });

    expect(out.at(-1)!.liability).toBeCloseTo(7277.87, 6);
  });

  it("carries the last price forward through a month with no quote", () => {
    // A gap in our data is not the asset going to zero — that would draw a
    // cliff that never happened.
    const out = buildMarginHistory({
      contributions: [{ month: "2025-08", assetId: "ada", quantity: 100, amount: 81 }],
      liabilities: [],
      prices: new Map([["ada|2025-08", 0.8]]),
      today: "2025-10",
    });

    expect(out.map((p) => p.deployed)).toEqual([80, 80, 80]);
  });

  it("returns nothing when there is nothing to plot", () => {
    expect(
      buildMarginHistory({ contributions: [], liabilities: [], prices, today: "2026-08" })
    ).toEqual([]);
  });
});
