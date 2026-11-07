import { describe, expect, it } from "vitest";

import { nextPlanColor } from "./plan-colors";

describe("nextPlanColor", () => {
  it("takes the first slot nobody wears, in order", () => {
    expect(nextPlanColor([])).toBe("var(--chart-1)");
    expect(nextPlanColor(["var(--chart-1)"])).toBe("var(--chart-2)");
    expect(nextPlanColor(["var(--chart-1)", "var(--chart-3)"])).toBe("var(--chart-2)");
  });

  it("ignores custom colours, and with every slot taken picks the least worn", () => {
    expect(nextPlanColor(["#123456", "var(--chart-1)"])).toBe("var(--chart-2)");
    const all = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
    expect(nextPlanColor(all)).toBe("var(--chart-1)");
    expect(nextPlanColor([...all, "var(--chart-1)", "var(--chart-2)"])).toBe("var(--chart-3)");
  });
});
