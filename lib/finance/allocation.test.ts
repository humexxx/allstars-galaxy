import { describe, expect, it } from "vitest";

import {
  allocationTotal,
  isCompleteAllocation,
  netPositions,
  splitContribution,
  unitsFor,
} from "./allocation";

describe("isCompleteAllocation", () => {
  it("accepts a single asset taking everything", () => {
    expect(isCompleteAllocation([{ assetId: "ada", percent: 100 }])).toBe(true);
  });

  it("accepts a split that lands on 100", () => {
    expect(
      isCompleteAllocation([
        { assetId: "ada", percent: 50 },
        { assetId: "btc", percent: 50 },
      ])
    ).toBe(true);
  });

  it("rejects an allocation that leaves money unassigned", () => {
    expect(isCompleteAllocation([{ assetId: "ada", percent: 90 }])).toBe(false);
  });

  it("rejects an empty allocation — money would have nowhere to go", () => {
    expect(isCompleteAllocation([])).toBe(false);
  });

  it("tolerates thirds, which cannot sum exactly", () => {
    expect(
      isCompleteAllocation([
        { assetId: "a", percent: 33.333 },
        { assetId: "b", percent: 33.333 },
        { assetId: "c", percent: 33.334 },
      ])
    ).toBe(true);
  });

  it("sums percentages", () => {
    expect(allocationTotal([{ assetId: "a", percent: 60 }, { assetId: "b", percent: 40 }])).toBe(
      100
    );
  });
});

describe("splitContribution", () => {
  it("routes everything to a single asset", () => {
    expect(splitContribution(1650, [{ assetId: "ada", percent: 100 }])).toEqual([
      { assetId: "ada", amount: 1650 },
    ]);
  });

  it("splits evenly", () => {
    expect(
      splitContribution(1000, [
        { assetId: "ada", percent: 50 },
        { assetId: "btc", percent: 50 },
      ])
    ).toEqual([
      { assetId: "ada", amount: 500 },
      { assetId: "btc", amount: 500 },
    ]);
  });

  it("never loses a cent to rounding", () => {
    const parts = splitContribution(100, [
      { assetId: "a", percent: 33.333 },
      { assetId: "b", percent: 33.333 },
      { assetId: "c", percent: 33.334 },
    ]);

    const total = parts.reduce((s, p) => s + p.amount, 0);
    expect(total).toBeCloseTo(100, 10);
  });

  it("gives the remainder to the last slice rather than spreading it", () => {
    const parts = splitContribution(10, [
      { assetId: "a", percent: 33.333 },
      { assetId: "b", percent: 66.667 },
    ]);

    expect(parts[0].amount).toBe(3.33);
    expect(parts[1].amount).toBe(6.67);
  });

  it("returns nothing when no allocation is configured", () => {
    expect(splitContribution(500, [])).toEqual([]);
  });
});

describe("unitsFor", () => {
  it("buys units at the day's price", () => {
    // Yalena's first contribution: $1000 with ADA at $0.8114.
    expect(unitsFor(1000, 0.8114, "buy")).toBeCloseTo(1232.44, 2);
  });

  it("makes a withdrawal sell units, not subtract cash", () => {
    expect(unitsFor(500, 0.25, "withdrawal")).toBe(-2000);
  });

  it("refuses to divide by a missing price instead of returning Infinity", () => {
    expect(unitsFor(1000, 0, "buy")).toBe(0);
  });
});

describe("netPositions", () => {
  it("adds contributions to the same asset", () => {
    const p = netPositions([
      { assetId: "ada", quantity: 1232.44, amount: 1000 },
      { assetId: "ada", quantity: 2044.1, amount: 1650 },
    ]);

    expect(p.get("ada")!.quantity).toBeCloseTo(3276.54, 2);
    expect(p.get("ada")!.invested).toBe(2650);
  });

  it("lets a withdrawal reduce the position", () => {
    const p = netPositions([
      { assetId: "ada", quantity: 1000, amount: 500 },
      { assetId: "ada", quantity: -400, amount: -200 },
    ]);

    expect(p.get("ada")!.quantity).toBe(600);
    expect(p.get("ada")!.invested).toBe(300);
  });

  it("keeps assets apart", () => {
    const p = netPositions([
      { assetId: "ada", quantity: 10, amount: 5 },
      { assetId: "btc", quantity: 1, amount: 60000 },
    ]);

    expect(p.size).toBe(2);
    expect(p.get("btc")!.quantity).toBe(1);
  });
});
