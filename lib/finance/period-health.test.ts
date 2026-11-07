import { describe, expect, it } from "vitest";

import { periodHealthBand } from "./period-health";

const label = (ratio: number): string => periodHealthBand(ratio).label;

describe("periodHealthBand", () => {
  it("names each band from its lower edge", () => {
    expect(label(0)).toBe("Thriving");
    expect(label(0.49)).toBe("Thriving");
    expect(label(0.5)).toBe("Healthy");
    expect(label(0.69)).toBe("Healthy");
    expect(label(0.7)).toBe("Steady");
    expect(label(0.8)).toBe("Tight");
    expect(label(0.9)).toBe("Strained");
    expect(label(1)).toBe("Strained");
    expect(label(1.01)).toBe("Underwater");
    expect(label(30)).toBe("Underwater");
  });

  it("follows the whole percent the gauge prints", () => {
    expect(label(0.496)).toBe("Healthy");
    expect(label(1.004)).toBe("Strained");
  });
});
