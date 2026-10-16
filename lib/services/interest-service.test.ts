import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// applyMonthlyInterest claims the month and compounds inside ONE
// `db.transaction`. The mocked `db` has nothing but `transaction`, so any read
// or write issued outside it — the old separate `markInterestApplied` — throws.

const setMock = vi.fn();
const whereMock = vi.fn();
const updateReturning = vi.fn();
const updateMock = vi.fn(() => ({ set: setMock }));
const returning = vi.fn();
const onConflictDoUpdate = vi.fn<(config: { setWhere?: unknown }) => { returning: typeof returning }>(
  () => ({ returning })
);
const insertValues = vi.fn<
  (row: Record<string, unknown>) => { onConflictDoUpdate: typeof onConflictDoUpdate }
>(() => ({ onConflictDoUpdate }));
const insertMock = vi.fn<(table: unknown) => { values: typeof insertValues }>(() => ({
  values: insertValues,
}));

const tx = {
  insert: insertMock,
  update: updateMock,
};

vi.mock("@/db", () => ({
  db: {
    transaction: (cb: (t: unknown) => Promise<unknown>) => cb(tx),
  },
}));

import { applyMonthlyInterest, interestMonthOf, LAST_INTEREST_RUN_KEY } from "./interest-service";

beforeEach(() => {
  // Default chain: update().set().where().returning() resolves; the month
  // claim succeeds.
  setMock.mockReturnValue({ where: whereMock });
  whereMock.mockReturnValue({ returning: updateReturning });
  updateReturning.mockResolvedValue([]);
  returning.mockResolvedValue([{ key: LAST_INTEREST_RUN_KEY }]);
});

afterEach(() => {
  vi.clearAllMocks();
  setMock.mockReset();
  whereMock.mockReset();
  updateReturning.mockReset();
  returning.mockReset();
});

const OCT_1 = new Date("2026-10-01T06:00:00Z");

function claimCondition(): { sql: string; params: unknown[] } {
  const { setWhere } = onConflictDoUpdate.mock.calls[0][0];
  return new PgDialect().sqlToQuery(setWhere as Parameters<PgDialect["sqlToQuery"]>[0]);
}

function rendered(value: unknown): string {
  return new PgDialect().sqlToQuery(value as Parameters<PgDialect["sqlToQuery"]>[0]).sql;
}

describe("applyMonthlyInterest — once per month", () => {
  it("claims the month before compounding, inside the same transaction", async () => {
    updateReturning.mockResolvedValueOnce([{ status: "approved" }]);

    const run = await applyMonthlyInterest(OCT_1);

    expect(run).toEqual({ applied: true, month: "2026-10", processed: 1, closed: 0 });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ key: LAST_INTEREST_RUN_KEY, value: OCT_1.toISOString() })
    );
    // The claim is what a concurrent run waits on, so it must come first.
    expect(insertMock.mock.invocationCallOrder[0]).toBeLessThan(
      updateMock.mock.invocationCallOrder[0]
    );
  });

  it("compounds nothing when the month is already claimed", async () => {
    returning.mockResolvedValueOnce([]);

    const run = await applyMonthlyInterest(OCT_1);

    expect(run).toEqual({ applied: false, month: "2026-10" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("only lets a month later than the one on record claim", async () => {
    // A manual snapshot on Oct 16 back-dated to Sep 30 claims SEPTEMBER, not
    // "now" — stamping the current time is what let the two paths disagree.
    await applyMonthlyInterest(new Date("2026-09-30T21:59:59.999Z"));

    const { sql, params } = claimCondition();
    expect(sql).toContain('left("app_state"."value", 7) <');
    expect(params).toContain("2026-09");
  });

  it("fails the claim with the compounding: one transaction, nothing committed apart", async () => {
    updateReturning.mockRejectedValueOnce(new Error("connection reset"));

    await expect(applyMonthlyInterest(OCT_1)).rejects.toThrow("connection reset");
    // Both statements went through the transaction handle; the mocked `db`
    // has no `insert`, so a claim written outside it would have thrown first.
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});

describe("applyMonthlyInterest — compounding", () => {
  it("counts what the single UPDATE touched and closed", async () => {
    updateReturning.mockResolvedValueOnce([
      { status: "approved" },
      { status: "closed" },
      { status: "approved" },
    ]);

    const run = await applyMonthlyInterest(OCT_1);

    expect(run).toEqual({ applied: true, month: "2026-10", processed: 3, closed: 1 });
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("does the arithmetic in the database, from the row's current value", async () => {
    // Read-then-write let a withdrawal approved in between be overwritten
    // with a value computed from the old balance. The new value is an SQL
    // expression over the column itself, rounded as `numeric`.
    await applyMonthlyInterest(OCT_1);

    const payload = setMock.mock.calls[0][0];
    const value = rendered(payload.currentValue);
    expect(value).toContain('round("transactions"."current_value" * (1 + coalesce(');
    expect(value).toContain('"investment_methods"."monthly_roi"');
    expect(value).toContain("/ 100), 2)");
    expect(rendered(payload.status)).toContain("then 'closed'::transaction_status");
  });

  it("only compounds approved buys still holding value, up to the cutoff", async () => {
    const cutoff = new Date("2026-01-01T00:00:00Z");
    await applyMonthlyInterest(cutoff, cutoff);

    const where = rendered(whereMock.mock.calls[0][0]);
    expect(where).toContain('"transactions"."status" = $');
    expect(where).toContain('"transactions"."type" = $');
    expect(where).toContain('"transactions"."current_value" > $');
    expect(where).toContain('"transactions"."date" <= $');
  });
});

describe("interestMonthOf", () => {
  it("is the UTC calendar month — the cron's clock", () => {
    expect(interestMonthOf(new Date("2026-10-01T00:00:10Z"))).toBe("2026-10");
    expect(interestMonthOf(new Date("2026-09-30T23:59:00Z"))).toBe("2026-09");
  });
});
