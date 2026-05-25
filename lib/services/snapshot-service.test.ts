import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// snapshot-service mixes several DB shapes:
//   - db.select({...}).from().where().groupBy()              (createDailySnapshots balances)
//   - db.selectDistinctOn([...], {...}).from().where().orderBy()
//                                                            (createDailySnapshots latest)
//   - db.select({...}).from().where()                        (per-portfolio sum)
//   - db.select({id: ...}).from()                            (all-portfolio listing)
//   - db.$count(table)                                       (totalPortfolios)
//   - db.query.portfolioSnapshots.findFirst({...})           (last snapshot lookup)
//   - db.insert().values()                                   (writes)
//   - db.delete().where()                                    (manual snapshot wipe)
//
// We use a queue of resolved values for chainable selects so callers can
// script the next N awaited results in order. The select/selectDistinctOn
// chain object is a thenable — its `then` shifts the next queued value, which
// lets paths that terminate on `.where()` or `.orderBy()` or `.groupBy()` all
// resolve transparently.

let selectQueue: unknown[] = [];

type SelectChain = {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => unknown) => unknown;
};

const selectChain: SelectChain = {
  from: vi.fn(),
  where: vi.fn(),
  groupBy: vi.fn(),
  orderBy: vi.fn(),
  then(resolve) {
    const next = selectQueue.length > 0 ? selectQueue.shift() : [];
    return Promise.resolve(next).then(resolve);
  },
};
selectChain.from.mockReturnValue(selectChain);
selectChain.where.mockReturnValue(selectChain);
selectChain.groupBy.mockReturnValue(selectChain);
selectChain.orderBy.mockReturnValue(selectChain);

/* eslint-disable @typescript-eslint/no-unused-vars */
const selectMock = vi.fn((_arg?: unknown) => selectChain);
const selectDistinctOnMock = vi.fn(
  (_cols?: unknown, _projection?: unknown) => selectChain
);
/* eslint-enable @typescript-eslint/no-unused-vars */
const countMock = vi.fn();

const portfolioSnapshotsFindFirst = vi.fn();

const insertValues = vi.fn().mockResolvedValue(undefined);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const insertMock = vi.fn((_arg?: unknown) => ({ values: insertValues }));

const deleteWhere = vi.fn().mockResolvedValue(undefined);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const deleteMock = vi.fn((_arg?: unknown) => ({ where: deleteWhere }));

vi.mock("@/db", () => ({
  db: {
    select: (arg?: unknown) => selectMock(arg),
    selectDistinctOn: (cols?: unknown, projection?: unknown) =>
      selectDistinctOnMock(cols, projection),
    $count: (...args: unknown[]) => countMock(...args),
    insert: (arg?: unknown) => insertMock(arg),
    delete: (arg?: unknown) => deleteMock(arg),
    query: {
      portfolioSnapshots: {
        findFirst: (...args: unknown[]) => portfolioSnapshotsFindFirst(...args),
      },
    },
  },
}));

import {
  createApprovalSnapshot,
  createDailySnapshots,
  createManualSnapshot,
  createManualSnapshotsForAllPortfolios,
  deleteManualSnapshots,
  deleteManualSnapshotsForAllPortfolios,
} from "./snapshot-service";

const PORTFOLIO_A = "00000000-0000-0000-0000-0000000000aa";
const PORTFOLIO_B = "00000000-0000-0000-0000-0000000000bb";

beforeEach(() => {
  selectQueue = [];
});

afterEach(() => {
  vi.clearAllMocks();
  // Restore wiring after clearAllMocks reset call counts and implementations.
  selectChain.from.mockReturnValue(selectChain);
  selectChain.where.mockReturnValue(selectChain);
  selectChain.groupBy.mockReturnValue(selectChain);
  selectChain.orderBy.mockReturnValue(selectChain);
  selectMock.mockImplementation(() => selectChain);
  selectDistinctOnMock.mockImplementation(() => selectChain);
  insertValues.mockResolvedValue(undefined);
  insertMock.mockImplementation(() => ({ values: insertValues }));
  deleteWhere.mockResolvedValue(undefined);
  deleteMock.mockImplementation(() => ({ where: deleteWhere }));
  countMock.mockReset();
  portfolioSnapshotsFindFirst.mockReset();
});

// ---------- createDailySnapshots ----------

describe("createDailySnapshots", () => {
  it("returns zero counts when no portfolios have approved buys", async () => {
    // 1st select call: balances aggregation → empty.
    selectQueue = [[]];
    countMock.mockResolvedValueOnce(7);

    const result = await createDailySnapshots();

    expect(result.snapshotsCreated).toBe(0);
    expect(result.totalPortfolios).toBe(7);
    expect(result.errors).toEqual([]);
    expect(result.date).toBeInstanceOf(Date);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("inserts one row per portfolio with positive balance", async () => {
    // 1st: balances. 2nd: latest snapshots (none).
    selectQueue = [
      [
        { portfolioId: PORTFOLIO_A, totalValue: "1500.5", txCount: 2 },
        { portfolioId: PORTFOLIO_B, totalValue: "0", txCount: 1 },
      ],
      [],
    ];

    const result = await createDailySnapshots();

    expect(result.snapshotsCreated).toBe(1);
    expect(result.totalPortfolios).toBe(2);
    expect(insertMock).toHaveBeenCalledOnce();
    expect(insertValues).toHaveBeenCalledOnce();

    const rows = insertValues.mock.calls[0][0] as Array<{
      portfolioId: string;
      totalValue: string;
      source: string;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].portfolioId).toBe(PORTFOLIO_A);
    expect(rows[0].totalValue).toBe("1500.50");
    expect(rows[0].source).toBe("system_cron");
  });

  it("emits a zero-value snapshot when the previous snapshot was non-zero (real transition)", async () => {
    selectQueue = [
      [{ portfolioId: PORTFOLIO_A, totalValue: "0", txCount: 1 }],
      [{ portfolioId: PORTFOLIO_A, totalValue: "1200.00" }],
    ];

    const result = await createDailySnapshots();

    expect(result.snapshotsCreated).toBe(1);
    const rows = insertValues.mock.calls[0][0] as Array<{ totalValue: string }>;
    expect(rows[0].totalValue).toBe("0.00");
  });

  it("does NOT emit a zero-value snapshot when the previous was already zero", async () => {
    selectQueue = [
      [{ portfolioId: PORTFOLIO_A, totalValue: "0", txCount: 1 }],
      [{ portfolioId: PORTFOLIO_A, totalValue: "0.00" }],
    ];

    const result = await createDailySnapshots();

    expect(result.snapshotsCreated).toBe(0);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("does NOT emit a zero-value snapshot when there is no previous snapshot", async () => {
    selectQueue = [
      [{ portfolioId: PORTFOLIO_A, totalValue: "0", txCount: 1 }],
      [],
    ];

    const result = await createDailySnapshots();

    expect(result.snapshotsCreated).toBe(0);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("handles a mix of positive + transitioning-to-zero + already-zero portfolios", async () => {
    const PORTFOLIO_C = "00000000-0000-0000-0000-0000000000cc";
    selectQueue = [
      [
        { portfolioId: PORTFOLIO_A, totalValue: "500", txCount: 1 },
        { portfolioId: PORTFOLIO_B, totalValue: "0", txCount: 1 }, // transitions
        { portfolioId: PORTFOLIO_C, totalValue: "0", txCount: 1 }, // already 0
      ],
      [
        { portfolioId: PORTFOLIO_B, totalValue: "800.00" },
        { portfolioId: PORTFOLIO_C, totalValue: "0.00" },
      ],
    ];

    const result = await createDailySnapshots();

    expect(result.snapshotsCreated).toBe(2);
    expect(result.totalPortfolios).toBe(3);
    const rows = insertValues.mock.calls[0][0] as Array<{
      portfolioId: string;
      totalValue: string;
    }>;
    const ids = rows.map((r) => r.portfolioId).sort();
    expect(ids).toEqual([PORTFOLIO_A, PORTFOLIO_B].sort());
  });
});

// ---------- createApprovalSnapshot / createManualSnapshot ----------
//
// Both delegate to the same internal helper, which:
//   1. select sum + count of matching approved buys
//   2. (if total=0) select count of future approved buys
//   3. (if total=0) db.query.portfolioSnapshots.findFirst for the last snapshot
//   4. insert if shouldCreate

describe("createApprovalSnapshot", () => {
  it("creates a snapshot for a positive balance using the supplied date and admin_approval source", async () => {
    selectQueue = [[{ totalValue: "2500.00", count: 3 }]];

    const date = new Date("2026-03-15T12:00:00Z");
    await createApprovalSnapshot(PORTFOLIO_A, date);

    expect(insertMock).toHaveBeenCalledOnce();
    const payload = insertValues.mock.calls[0][0] as {
      portfolioId: string;
      date: Date;
      totalValue: string;
      source: string;
    };
    expect(payload.portfolioId).toBe(PORTFOLIO_A);
    expect(payload.date).toBe(date);
    expect(payload.totalValue).toBe("2500.00");
    expect(payload.source).toBe("admin_approval");
  });

  it("skips when there are no matching transactions at all", async () => {
    selectQueue = [[{ totalValue: "0", count: 0 }]];

    await createApprovalSnapshot(PORTFOLIO_A, new Date());

    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("createManualSnapshot", () => {
  it("returns { created: true, totalValue } and inserts on positive balance", async () => {
    selectQueue = [[{ totalValue: "999.99", count: 1 }]];

    const result = await createManualSnapshot(PORTFOLIO_A);

    expect(result).toEqual({ created: true, totalValue: 999.99 });
    expect(insertMock).toHaveBeenCalledOnce();
    const payload = insertValues.mock.calls[0][0] as {
      source: string;
      totalValue: string;
    };
    expect(payload.source).toBe("manual");
    expect(payload.totalValue).toBe("999.99");
  });

  it("returns { created: false } when no transactions match the date filter", async () => {
    selectQueue = [[{ totalValue: "0", count: 0 }]];

    const result = await createManualSnapshot(PORTFOLIO_A, new Date());

    expect(result).toEqual({ created: false, totalValue: 0 });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("skips zero-value when there are future transactions (pre-history snapshot)", async () => {
    selectQueue = [
      [{ totalValue: "0", count: 2 }], // current sum is zero, but 2 tx today
      [{ count: 5 }], // future buys exist → skip
    ];

    const result = await createManualSnapshot(PORTFOLIO_A, new Date());

    expect(result).toEqual({ created: false, totalValue: 0 });
    expect(insertMock).not.toHaveBeenCalled();
    // findFirst should never be reached because we bailed out earlier.
    expect(portfolioSnapshotsFindFirst).not.toHaveBeenCalled();
  });

  it("creates a zero-value snapshot when last snapshot was non-zero (real transition)", async () => {
    selectQueue = [
      [{ totalValue: "0", count: 1 }],
      [{ count: 0 }], // no future tx
    ];
    portfolioSnapshotsFindFirst.mockResolvedValueOnce({
      totalValue: "1234.56",
    });

    const result = await createManualSnapshot(PORTFOLIO_A, new Date());

    expect(result.created).toBe(true);
    expect(result.totalValue).toBe(0);
    expect(insertMock).toHaveBeenCalledOnce();
    const payload = insertValues.mock.calls[0][0] as { totalValue: string };
    expect(payload.totalValue).toBe("0.00");
  });

  it("creates a zero-value snapshot for manual source when no prior snapshot exists", async () => {
    selectQueue = [
      [{ totalValue: "0", count: 1 }],
      [{ count: 0 }],
    ];
    portfolioSnapshotsFindFirst.mockResolvedValueOnce(undefined);

    const result = await createManualSnapshot(PORTFOLIO_A, new Date(), "manual");

    expect(result.created).toBe(true);
    expect(insertMock).toHaveBeenCalledOnce();
  });

  it("does NOT create a zero-value snapshot for non-manual sources without a prior non-zero snapshot", async () => {
    selectQueue = [
      [{ totalValue: "0", count: 1 }],
      [{ count: 0 }],
    ];
    // No previous snapshot at all → no real transition, non-manual source.
    portfolioSnapshotsFindFirst.mockResolvedValueOnce(undefined);

    const result = await createManualSnapshot(
      PORTFOLIO_A,
      new Date(),
      "admin_approval"
    );

    expect(result.created).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("does NOT create when admin_enforce sees a previous zero snapshot (no transition)", async () => {
    selectQueue = [
      [{ totalValue: "0", count: 1 }],
      [{ count: 0 }],
    ];
    portfolioSnapshotsFindFirst.mockResolvedValueOnce({ totalValue: "0" });

    const result = await createManualSnapshot(
      PORTFOLIO_A,
      new Date(),
      "admin_enforce"
    );

    expect(result.created).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("forwards the chosen source through to the inserted row", async () => {
    selectQueue = [[{ totalValue: "100.00", count: 1 }]];

    await createManualSnapshot(PORTFOLIO_A, new Date(), "admin_enforce");

    const payload = insertValues.mock.calls[0][0] as { source: string };
    expect(payload.source).toBe("admin_enforce");
  });

  it("treats missing/null sum string as 0", async () => {
    // Simulate a result row without a totalValue key (e.g. raw empty aggregate).
    selectQueue = [[{ count: 1 }]];
    portfolioSnapshotsFindFirst.mockResolvedValueOnce(undefined);
    // Need the second select (future tx) to also resolve.
    selectQueue.push([{ count: 0 }]);

    const result = await createManualSnapshot(PORTFOLIO_A, new Date(), "manual");

    // 0 sum + manual + no prior → shouldCreate true.
    expect(result.created).toBe(true);
    expect(result.totalValue).toBe(0);
  });
});

// ---------- deleteManualSnapshots ----------

describe("deleteManualSnapshots", () => {
  it("issues a delete scoped to the portfolio and source=manual", async () => {
    await deleteManualSnapshots(PORTFOLIO_A);

    expect(deleteMock).toHaveBeenCalledOnce();
    expect(deleteWhere).toHaveBeenCalledOnce();
  });
});

// ---------- createManualSnapshotsForAllPortfolios ----------

describe("createManualSnapshotsForAllPortfolios", () => {
  it("throws when there are no portfolios", async () => {
    selectQueue = [[]];

    await expect(
      createManualSnapshotsForAllPortfolios(new Date())
    ).rejects.toThrow("No portfolios found");
  });

  it("sums totalValue across created snapshots and counts only created ones", async () => {
    const date = new Date("2026-04-30T00:00:00Z");
    selectQueue = [
      // 1. portfolio listing
      [{ id: PORTFOLIO_A }, { id: PORTFOLIO_B }],
      // 2. createManualSnapshot for A: sum query → 500 created
      [{ totalValue: "500.00", count: 2 }],
      // 3. createManualSnapshot for B: sum query → 0 count, skip
      [{ totalValue: "0", count: 0 }],
    ];

    const result = await createManualSnapshotsForAllPortfolios(date);

    expect(result.portfoliosProcessed).toBe(2);
    expect(result.snapshotsCreated).toBe(1);
    expect(result.totalValue).toBe(500);
    expect(insertMock).toHaveBeenCalledOnce();
    const payload = insertValues.mock.calls[0][0] as {
      source: string;
      date: Date;
    };
    expect(payload.source).toBe("manual");
    expect(payload.date).toBe(date);
  });

  it("forwards the source override into every snapshot", async () => {
    selectQueue = [
      [{ id: PORTFOLIO_A }],
      [{ totalValue: "10.00", count: 1 }],
    ];

    const result = await createManualSnapshotsForAllPortfolios(
      new Date(),
      "admin_enforce"
    );

    expect(result.snapshotsCreated).toBe(1);
    const payload = insertValues.mock.calls[0][0] as { source: string };
    expect(payload.source).toBe("admin_enforce");
  });
});

// ---------- deleteManualSnapshotsForAllPortfolios ----------

describe("deleteManualSnapshotsForAllPortfolios", () => {
  it("returns processed count of 0 when no portfolios exist", async () => {
    selectQueue = [[]];

    const result = await deleteManualSnapshotsForAllPortfolios();

    expect(result).toEqual({ portfoliosProcessed: 0 });
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("issues one delete per portfolio", async () => {
    selectQueue = [[{ id: PORTFOLIO_A }, { id: PORTFOLIO_B }]];

    const result = await deleteManualSnapshotsForAllPortfolios();

    expect(result).toEqual({ portfoliosProcessed: 2 });
    expect(deleteMock).toHaveBeenCalledTimes(2);
    expect(deleteWhere).toHaveBeenCalledTimes(2);
  });
});
