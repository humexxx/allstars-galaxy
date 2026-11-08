import { describe, expect, it } from "vitest";

import { shownCash } from "./cash";

describe("shownCash", () => {
  it("never shows the forecast's timing gap as negative cash", () => {
    expect(shownCash(-2375)).toBe(0);
    expect(shownCash(1200.5)).toBe(1200.5);
  });
});
