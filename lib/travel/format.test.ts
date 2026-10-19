import { describe, expect, it } from "vitest";

import {
  dayGroupLabel,
  formatDateRange,
  formatTripMoney,
  moneyRange,
  runsUntil,
} from "./format";

describe("formatTripMoney", () => {
  it("drops the cents on a whole amount", () => {
    expect(formatTripMoney(1380, "USD")).toBe("$1,380");
  });

  it("prints both cent digits when there are any", () => {
    // It used to print "$1,750.5" — half a cent column.
    expect(formatTripMoney(1750.5, "USD")).toBe("$1,750.50");
    expect(formatTripMoney(2829.8000000001, "USD")).toBe("$2,829.80");
  });

  it("rounds to the cent before deciding", () => {
    expect(formatTripMoney(99.999, "USD")).toBe("$100");
  });

  it("uses the trip's currency", () => {
    expect(formatTripMoney(140, "EUR")).toBe("€140");
  });
});

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

describe("formatDateRange", () => {
  it("names the weekdays within one year", () => {
    expect(formatDateRange("2026-09-03", "2026-09-10")).toBe("Thu, Sep 3 – Thu, Sep 10, 2026");
  });

  it("is a single day when the trip has no end", () => {
    expect(formatDateRange("2026-09-03", null)).toBe("Thu, Sep 3, 2026");
  });

  it("keeps both years across new year", () => {
    expect(formatDateRange("2026-12-30", "2027-01-02")).toBe("Dec 30, 2026 – Jan 2, 2027");
  });
});
