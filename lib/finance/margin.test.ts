import { describe, expect, it } from "vitest";

import {
  computeMethodMargin,
  splitLiability,
  totalMargin,
  type MarginHolding,
} from "./margin";

const hold = (over: Partial<MarginHolding> = {}): MarginHolding => ({
  id: "h1",
  assetId: "asset-ada",
  symbol: "ADA",
  name: "Cardano",
  quantity: 1000,
  price: 1,
  costBasis: 900,
  ...over,
});

describe("computeMethodMargin", () => {
  it("margin is real assets minus what investors are owed", () => {
    const m = computeMethodMargin({
      methodId: "m1",
      methodName: "Safe",
      liability: 7277.87,
      ownPosition: 1050.05,
      holdings: [hold({ quantity: 10000, price: 0.9 })],
    });

    expect(m.assets).toBeCloseTo(9000, 2);
    expect(m.margin).toBeCloseTo(1722.13, 2);
    expect(m.marginPercent).toBeCloseTo(23.66, 1);
    expect(m.incomplete).toBe(false);
  });

  it("reports a shortfall rather than clamping at zero", () => {
    const m = computeMethodMargin({
      methodId: "m1",
      methodName: "Safe",
      liability: 10000,
      ownPosition: 0,
      holdings: [hold({ quantity: 1000, price: 8 })],
    });

    // The promised return outran the real one: this must show as negative.
    expect(m.margin).toBeCloseTo(-2000, 2);
    expect(m.marginPercent).toBeCloseTo(-20, 2);
  });

  it("flags an unpriced holding instead of valuing it at zero silently", () => {
    const m = computeMethodMargin({
      methodId: "m1",
      methodName: "Safe",
      liability: 1000,
      ownPosition: 0,
      holdings: [hold({ quantity: 100, price: 5 }), hold({ symbol: "X", price: null })],
    });

    expect(m.assets).toBeCloseTo(500, 2);
    expect(m.incomplete).toBe(true);
  });

  it("does not divide by zero when nothing is owed", () => {
    const m = computeMethodMargin({
      methodId: "m1",
      methodName: "Safe",
      liability: 0,
      ownPosition: 0,
      holdings: [hold({ quantity: 10, price: 3 })],
    });

    expect(m.marginPercent).toBe(0);
    expect(m.margin).toBeCloseTo(30, 2);
  });
});

describe("totalMargin", () => {
  it("sums methods and propagates incompleteness", () => {
    const a = computeMethodMargin({
      methodId: "a", methodName: "A", liability: 100, ownPosition: 0,
      holdings: [hold({ quantity: 1, price: 150 })],
    });
    const b = computeMethodMargin({
      methodId: "b", methodName: "B", liability: 200, ownPosition: 0,
      holdings: [hold({ quantity: 1, price: null })],
    });

    const t = totalMargin([a, b]);
    expect(t.liability).toBe(300);
    expect(t.assets).toBeCloseTo(150, 2);
    expect(t.margin).toBeCloseTo(-150, 2);
    expect(t.incomplete).toBe(true);
  });
});

describe("splitLiability", () => {
  const OWNER = "jason";

  it("treats the owner's own stake as capital, never as debt", () => {
    const { liability, ownPosition } = splitLiability(
      [
        { userId: "yalena", holding: 7277.87 },
        { userId: OWNER, holding: 1050.05 },
      ],
      OWNER
    );

    expect(liability).toBeCloseTo(7277.87, 2);
    expect(ownPosition).toBeCloseTo(1050.05, 2);
  });

  it("owes nothing when the owner is the only investor", () => {
    const { liability, ownPosition } = splitLiability(
      [{ userId: OWNER, holding: 5000 }],
      OWNER
    );

    expect(liability).toBe(0);
    expect(ownPosition).toBe(5000);
  });

  it("sums several outside investors", () => {
    const { liability } = splitLiability(
      [
        { userId: "a", holding: 100 },
        { userId: "b", holding: 250 },
        { userId: OWNER, holding: 999 },
      ],
      OWNER
    );

    expect(liability).toBe(350);
  });

  it("counts the owner's stake once even when it arrives as several rows", () => {
    const { ownPosition, liability } = splitLiability(
      [
        { userId: OWNER, holding: 600 },
        { userId: OWNER, holding: 400 },
      ],
      OWNER
    );

    expect(ownPosition).toBe(1000);
    expect(liability).toBe(0);
  });
});
