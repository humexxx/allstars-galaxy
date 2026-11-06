import { describe, expect, it } from "vitest";

import { groupLinesByName, owedStillToCome, type OwedLine } from "./line-groups";

function recurring(
  id: string,
  name: string,
  amount: number,
  startDate: string | null,
  endDate: string | null
): OwedLine {
  return {
    id,
    name,
    monthlyAmount: String(amount),
    kind: "recurring",
    date: null,
    dayOfMonth: 1,
    startDate,
    endDate,
  };
}

function oneTime(id: string, name: string, amount: number, date: string): OwedLine {
  return { id, name, monthlyAmount: String(amount), kind: "one_time", date, dayOfMonth: null };
}

describe("groupLinesByName", () => {
  it("folds a trimmed, case-insensitive name into one group, oldest phase first", () => {
    const groups = groupLinesByName(
      [
        recurring("b", "Experian ", 3500, "2027-05-02", "2029-01-01"),
        recurring("x", "Rent share", 200, null, null),
        recurring("a", "experian", 6500, null, "2027-05-01"),
      ],
      "2026-11-05"
    );

    expect(groups.map((g) => g.key)).toEqual(["experian", "rent share"]);
    expect(groups[0].name).toBe("Experian");
    expect(groups[0].lines.map((l) => l.id)).toEqual(["a", "b"]);
    expect(groups[0].from).toBeNull();
    expect(groups[0].to).toBe("2029-01-01");
  });

  it("shows today's phase", () => {
    const [group] = groupLinesByName(
      [
        recurring("a", "Experian", 6500, null, "2027-05-01"),
        recurring("b", "Experian", 3500, "2027-05-02", "2029-01-01"),
      ],
      "2027-06-10"
    );
    expect(group.headline.id).toBe("b");
    expect(group.status).toBe("current");
  });

  it("falls back to the next phase, then to the last", () => {
    const phases = [
      recurring("y1", "Inversiones", 2500, "2027-01-01", "2027-12-31"),
      recurring("y2", "Inversiones", 5000, "2028-01-01", "2028-12-31"),
    ];

    const [ahead] = groupLinesByName(phases, "2026-11-05");
    expect(ahead.headline.id).toBe("y1");
    expect(ahead.status).toBe("upcoming");

    const [done] = groupLinesByName(phases, "2030-01-01");
    expect(done.headline.id).toBe("y2");
    expect(done.status).toBe("past");
  });

  it("treats a one-time line as a single day", () => {
    const [group] = groupLinesByName(
      [oneTime("p1", "Padre", 100, "2026-10-01"), oneTime("p2", "Padre", 300, "2026-12-01")],
      "2026-11-05"
    );
    expect(group.headline.id).toBe("p2");
    expect(group.status).toBe("upcoming");
    expect([group.from, group.to]).toEqual(["2026-10-01", "2026-12-01"]);
  });

  it("leaves the status unknown until today is", () => {
    const [group] = groupLinesByName([recurring("a", "Salary", 1, null, null)], null);
    expect(group.status).toBeNull();
    expect(group.headline.id).toBe("a");
  });
});

describe("owedStillToCome", () => {
  it("adds every repayment after today, recurring ones to their end", () => {
    const total = owedStillToCome(
      [
        oneTime("p1", "Padre", 100, "2026-10-01"),
        oneTime("p2", "Padre", 300, "2026-12-01"),
        recurring("h", "Hermana", 50, "2026-01-01", "2027-02-28"),
      ],
      "2026-11-05"
    );
    // Padre's December payment, and Hermana's Dec, Jan and Feb.
    expect(total).toBe(300 + 50 * 3);
  });
});
