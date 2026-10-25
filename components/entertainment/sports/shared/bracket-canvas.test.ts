import { describe, expect, it } from "vitest";

import { elbow } from "./bracket-canvas";

describe("elbow", () => {
  it("runs right, turns down and in again", () => {
    expect(elbow(0, 0, 40, 40)).toBe("M0,0 H12 Q20,0 20,8 V32 Q20,40 28,40 H40");
  });

  it("runs left the same way, for the right half of a two-sided bracket", () => {
    expect(elbow(40, 0, 0, 40)).toBe("M40,0 H28 Q20,0 20,8 V32 Q20,40 12,40 H0");
  });

  it("is a straight line where there is no room to turn", () => {
    expect(elbow(0, 10, 40, 10)).toBe("M0,10 L40,10");
  });
});
