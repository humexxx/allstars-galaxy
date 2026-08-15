import { describe, expect, it } from "vitest";

import {
  aggregateManagedCapital,
  filterContributions,
  NO_FILTERS,
  type ManagedContribution,
} from "./managed-capital";

const row = (over: Partial<ManagedContribution> = {}): ManagedContribution => ({
  date: "2026-01-01",
  methodId: "m1",
  methodName: "Safe",
  investorId: "u2",
  investorName: "Bea",
  isOwn: false,
  contributed: 100,
  holding: 110,
  ...over,
});

describe("aggregateManagedCapital", () => {
  it("accumulates own and third-party separately", () => {
    const out = aggregateManagedCapital([
      row({ date: "2026-01-01", contributed: 1000, holding: 1100 }),
      row({ date: "2026-02-01", isOwn: true, contributed: 500, holding: 520 }),
    ]);

    expect(out.thirdPartyContributed).toBe(1000);
    expect(out.ownContributed).toBe(500);
    expect(out.ownHolding).toBe(520);
    // Cumulative: the second point carries the first's third-party total.
    expect(out.points).toEqual([
      { date: "2026-01-01", own: 0, thirdParty: 1000 },
      { date: "2026-02-01", own: 500, thirdParty: 1000 },
    ]);
  });

  it("collapses same-day buys into one point", () => {
    const out = aggregateManagedCapital([
      row({ date: "2026-01-01", contributed: 100 }),
      row({ date: "2026-01-01", contributed: 400 }),
    ]);

    expect(out.points).toHaveLength(1);
    expect(out.points[0].thirdParty).toBe(500);
  });

  it("sorts rows that arrive out of order", () => {
    const out = aggregateManagedCapital([
      row({ date: "2026-03-01", contributed: 300 }),
      row({ date: "2026-01-01", contributed: 100 }),
    ]);

    expect(out.points.map((p) => p.date)).toEqual(["2026-01-01", "2026-03-01"]);
    expect(out.points[1].thirdParty).toBe(400);
  });
});

describe("filterContributions", () => {
  const rows = [
    row({ methodId: "m1", investorId: "u1", isOwn: true }),
    row({ methodId: "m2", investorId: "u2" }),
    row({ methodId: "m1", investorId: "u2" }),
  ];

  it("an empty list means everything, not nothing", () => {
    expect(filterContributions(rows, NO_FILTERS)).toHaveLength(3);
  });

  it("filters by method and investor together", () => {
    const out = filterContributions(rows, {
      methodIds: ["m1"],
      investorIds: ["u2"],
    });
    expect(out).toHaveLength(1);
    expect(out[0].methodId).toBe("m1");
    expect(out[0].investorId).toBe("u2");
  });

  it("can exclude everything", () => {
    const out = filterContributions(rows, {
      methodIds: ["m2"],
      investorIds: ["u1"],
    });
    expect(out).toHaveLength(0);
    expect(aggregateManagedCapital(out).points).toEqual([]);
  });
});
