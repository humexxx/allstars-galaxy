import { describe, expect, it } from "vitest";

import { hrefWithPlanView, parsePlanView } from "./plan-view";

describe("parsePlanView", () => {
  it("reads a known view", () => {
    expect(parsePlanView("table")).toBe("table");
    expect(parsePlanView("calendar")).toBe("calendar");
  });

  it("falls back to the graph for anything else", () => {
    expect(parsePlanView(undefined)).toBe("chart");
    expect(parsePlanView("tabel")).toBe("chart");
    expect(parsePlanView(["table", "calendar"])).toBe("chart");
  });
});

describe("hrefWithPlanView", () => {
  const base = "http://localhost:3000/portal/plans/abc";

  it("sets the view and keeps other params", () => {
    expect(hrefWithPlanView(`${base}?x=1`, "table")).toBe("/portal/plans/abc?x=1&view=table");
  });

  it("drops the param for the default view", () => {
    expect(hrefWithPlanView(`${base}?view=calendar`, "chart")).toBe("/portal/plans/abc");
  });
});
