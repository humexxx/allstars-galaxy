import { describe, expect, it } from "vitest";

import { dayGroupLabel, moneyRange, runsUntil } from "./format";

describe("moneyRange", () => {
  it("collapses to one figure when the ends agree", () => {
    expect(moneyRange(3800, 3800, "USD")).toBe("$3,800");
  });

  it("shows both ends when they do not", () => {
    expect(moneyRange(600, 800, "USD")).toBe("$600 ~ $800");
  });
});


describe("where moneyRange lives", () => {
  it("is importable from a server component", async () => {
    // It used to be exported from `traveller-bar.tsx`, a client module. The
    // public trip page is a server component, so the moment a shared link was
    // allowed to show prices the page crashed with "Attempted to call
    // moneyRange() from the server". A pure formatter must not carry a
    // runtime boundary — so this module must not open with the directive.
    const { readFileSync } = await import("node:fs");
    const first = readFileSync("lib/travel/format.ts", "utf8")
      .split("\n")
      .find((l) => l.trim() !== "");
    expect(first).not.toMatch(/^["']use client["']/);
  });
});

describe("dayGroupLabel", () => {
  it("leaves an ordinary day alone", () => {
    expect(dayGroupLabel("2027-01-15", null)).toBe("Friday, Jan 15");
  });

  it("carries the run when the day starts something longer", () => {
    // "Sunday, Jan 17" under a seven-night sailing says less than the trip
    // does — the reader had to open the item to learn when it ends.
    expect(dayGroupLabel("2027-01-17", "2027-01-24")).toBe(
      "Sunday, Jan 17 – Sun, Jan 24"
    );
  });

  it("ignores an end that is not actually later", () => {
    expect(dayGroupLabel("2027-01-17", "2027-01-17")).toBe("Sunday, Jan 17");
  });
});

describe("runsUntil", () => {
  const item = (over: Partial<Parameters<typeof runsUntil>[0][number]>) => ({
    category: "lodging" as const,
    scheduledOn: "2027-01-15",
    endsOn: null,
    ...over,
  });

  it("takes the furthest end among the things that really span", () => {
    expect(
      runsUntil([
        item({ endsOn: "2027-01-17" }),
        item({ category: "cruise", endsOn: "2027-01-24" }),
      ])
    ).toBe("2027-01-24");
  });

  it("does not stretch a heading for a return flight", () => {
    // Its second date is the day it comes back, not a day it occupies.
    expect(runsUntil([item({ category: "flight", endsOn: "2027-01-24" })])).toBeNull();
  });

  it("returns nothing when nothing spans", () => {
    expect(runsUntil([item({ category: "food" })])).toBeNull();
  });
});
