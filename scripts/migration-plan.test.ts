import { describe, expect, it } from "vitest";

import { planMigrations, type JournalEntry } from "./migration-plan";

const entry = (idx: number, when: number): JournalEntry => ({ idx, tag: `00${idx}_m`, when });
const tags = (entries: JournalEntry[]): string[] => entries.map((e) => e.tag);

describe("planMigrations", () => {
  it("a fresh database has every entry pending", () => {
    const plan = planMigrations([entry(1, 200), entry(0, 100)], []);

    expect(tags(plan.pending)).toEqual(["000_m", "001_m"]);
    expect(plan.lastAppliedAt).toBeNull();
  });

  it("an up-to-date database has nothing pending", () => {
    const plan = planMigrations([entry(0, 100), entry(1, 200)], [100, 200]);

    expect(tags(plan.applied)).toEqual(["000_m", "001_m"]);
    expect(plan.pending).toEqual([]);
    expect(plan.skipped).toEqual([]);
    expect(plan.foreign).toEqual([]);
  });

  it("another branch's migration does not hide this branch's newer one", () => {
    // Both branches add a 56th migration; the other branch's is applied, so
    // the counts match (2 = 2) while this branch's column is still missing.
    const plan = planMigrations([entry(0, 100), entry(1, 300)], [100, 250]);

    expect(tags(plan.pending)).toEqual(["001_m"]);
    expect(plan.foreign).toEqual([250]);
    expect(plan.skipped).toEqual([]);
  });

  it("an entry older than the database's newest is skipped, never pending", () => {
    // The other branch's migration is newer, so drizzle would never apply ours.
    const plan = planMigrations([entry(0, 100), entry(1, 200)], [100, 250]);

    expect(plan.pending).toEqual([]);
    expect(tags(plan.skipped)).toEqual(["001_m"]);
    expect(plan.foreign).toEqual([250]);
    expect(plan.lastAppliedAt).toBe(250);
  });

  it("splits one journal into applied, skipped and pending around the newest row", () => {
    const plan = planMigrations([entry(0, 100), entry(1, 200), entry(2, 400)], [100, 300]);

    expect(tags(plan.applied)).toEqual(["000_m"]);
    expect(tags(plan.skipped)).toEqual(["001_m"]);
    expect(tags(plan.pending)).toEqual(["002_m"]);
  });
});
