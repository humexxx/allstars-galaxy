import { describe, expect, it } from "vitest";

import { cubicBezier, splitEasedStroke, sweepEasing } from "./dashboard-motion";

describe("splitEasedStroke", () => {
  it("draws the two halves as one eased stroke", () => {
    const D = 1000;
    const { first, second } = splitEasedStroke(0.25, D);
    expect(first.duration + second.duration).toBeCloseTo(D, -1);
    expect(second.delay).toBe(first.duration);

    // Sample the whole stroke through both halves; it must match the single
    // curve wherever it is, "Now" included.
    for (const ms of [0, 50, 120, 180, 300, 600, 900, 1000]) {
      const whole = sweepEasing(ms / D);
      const drawn =
        ms <= first.duration
          ? 0.25 * first.easing(ms / first.duration)
          : 0.25 + 0.75 * second.easing((ms - second.delay) / second.duration);
      expect(drawn).toBeCloseTo(whole, 2);
    }
  });

  it("each half starts at 0 and ends at 1", () => {
    const { first, second } = splitEasedStroke(0.6, 900);
    expect(first.easing(0)).toBeCloseTo(0, 6);
    expect(first.easing(1)).toBeCloseTo(1, 6);
    expect(second.easing(0)).toBeCloseTo(0, 6);
    expect(second.easing(1)).toBeCloseTo(1, 6);
  });

  it("copes with a chart that has no past or no projection", () => {
    expect(splitEasedStroke(0, 900).first.easing(0.5)).toBe(1);
    expect(splitEasedStroke(1, 900).second.easing(0.5)).toBe(1);
  });
});

describe("cubicBezier", () => {
  it("matches CSS's named curves at known points", () => {
    const linear = cubicBezier(0, 0, 1, 1);
    expect(linear(0.3)).toBeCloseTo(0.3, 4);
    // CSS `ease` = cubic-bezier(0.25, 0.1, 0.25, 1): about 0.8024 at t = 0.5.
    expect(cubicBezier(0.25, 0.1, 0.25, 1)(0.5)).toBeCloseTo(0.8024, 3);
    expect(sweepEasing(0)).toBe(0);
    expect(sweepEasing(1)).toBe(1);
  });

  it("starts soft: the sweep has barely moved at the first tenth", () => {
    expect(sweepEasing(0.1)).toBeLessThan(0.3);
    expect(sweepEasing(0.5)).toBeGreaterThan(0.8);
  });
});
