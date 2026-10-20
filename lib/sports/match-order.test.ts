import { describe, expect, it } from "vitest";

import { orderMatchesForDisplay } from "./match-order";

type M = { id: string; date: string; status: string };

const match = (id: string, date: string, status: string): M => ({ id, date, status });
const order = (matches: M[], max?: number): string[] =>
  orderMatchesForDisplay(
    matches,
    (m) => m.date,
    (m) => m.status,
    max
  ).map((m) => m.id);

describe("orderMatchesForDisplay", () => {
  const results = [1, 2, 3, 4].map((d) => match(`r${d}`, `2026-10-0${d}T15:00:00Z`, "ft"));
  const fixtures = [5, 6, 7, 8, 9].map((d) => match(`f${d}`, `2026-10-0${d}T15:00:00Z`, "scheduled"));
  const live = match("live", "2026-10-04T18:00:00Z", "live");

  it("puts live first, then fixtures soonest first, then results latest first", () => {
    expect(order([...results, ...fixtures, live])).toEqual([
      "live",
      "f5", "f6", "f7", "f8", "f9",
      "r4", "r3", "r2", "r1",
    ]);
  });

  it("shares a cap between fixtures and results instead of filling it with fixtures", () => {
    expect(order([...results, ...fixtures, live], 5)).toEqual(["live", "f5", "f6", "r4", "r3"]);
  });

  it("gives one side's unused room to the other", () => {
    expect(order([...results.slice(0, 1), ...fixtures], 4)).toEqual(["f5", "f6", "f7", "r1"]);
    expect(order([...results, ...fixtures.slice(0, 1)], 4)).toEqual(["f5", "r4", "r3", "r2"]);
  });
});
