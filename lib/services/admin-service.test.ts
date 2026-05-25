import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// admin-service builds one big select chain:
//   db.select({...}).from().leftJoin()×5.$dynamic()[.where()].orderBy()
//
// The terminal call is always `.orderBy(...)` (whether or not `.where()` is
// invoked), so we make every builder method return `this` and resolve the
// terminal `orderBy` to whatever `selectResult` is set to for the test.

let selectResult: unknown = [];

const selectChain: {
  from: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  $dynamic: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
} = {
  from: vi.fn(),
  leftJoin: vi.fn(),
  $dynamic: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
};

function wireChain() {
  selectChain.from.mockReturnValue(selectChain);
  selectChain.leftJoin.mockReturnValue(selectChain);
  selectChain.$dynamic.mockReturnValue(selectChain);
  selectChain.where.mockReturnValue(selectChain);
  selectChain.orderBy.mockImplementation(() => Promise.resolve(selectResult));
}
wireChain();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const selectMock = vi.fn((_arg?: unknown) => selectChain);

vi.mock("@/db", () => ({
  db: {
    select: (arg?: unknown) => selectMock(arg),
  },
}));

import { getAdminTransactions } from "./admin-service";
import type { AdminTransactionRow } from "@/types";

const USER_ID = "00000000-0000-0000-0000-000000000001";

function makeRow(overrides: Partial<AdminTransactionRow> = {}): AdminTransactionRow {
  return {
    id: "tx-1",
    amount: "100.00",
    fee: "0.00",
    total: "100.00",
    date: new Date("2026-01-01"),
    status: "approved",
    type: "buy",
    notes: null,
    user: {
      id: USER_ID,
      email: "user@example.com",
      fullName: "Test User",
      avatarUrl: null,
    },
    method: { id: "method-1", name: "Stocks" },
    portfolioName: "Main Portfolio",
    approvedAt: new Date("2026-01-02"),
    approvedBy: {
      id: "admin-1",
      email: "admin@example.com",
      fullName: "Admin",
    },
    rejectedAt: null,
    rejectedBy: null,
    ...overrides,
  } as unknown as AdminTransactionRow;
}

beforeEach(() => {
  selectResult = [];
});

afterEach(() => {
  vi.clearAllMocks();
  // Restore wiring after clearAllMocks reset implementations.
  wireChain();
  selectMock.mockImplementation(() => selectChain);
});

// ---------- getAdminTransactions ----------

describe("getAdminTransactions", () => {
  it("returns rows ordered by date desc when no filters are passed", async () => {
    const rows = [
      makeRow({ id: "tx-2", date: new Date("2026-03-01") }),
      makeRow({ id: "tx-1", date: new Date("2026-01-01") }),
    ];
    selectResult = rows;

    const result = await getAdminTransactions();

    expect(result).toEqual(rows);
    expect(selectMock).toHaveBeenCalledOnce();
    expect(selectChain.from).toHaveBeenCalledOnce();
    // 5 leftJoins: portfolios, users, investmentMethods, approvedByUser, rejectedByUser.
    expect(selectChain.leftJoin).toHaveBeenCalledTimes(5);
    expect(selectChain.$dynamic).toHaveBeenCalledOnce();
    // No filters → .where should NOT be called.
    expect(selectChain.where).not.toHaveBeenCalled();
    expect(selectChain.orderBy).toHaveBeenCalledOnce();
  });

  it("returns an empty array when there are no transactions", async () => {
    selectResult = [];

    await expect(getAdminTransactions()).resolves.toEqual([]);
    expect(selectChain.where).not.toHaveBeenCalled();
  });

  it("returns an empty array when an empty filter object is passed", async () => {
    selectResult = [];

    const result = await getAdminTransactions({});

    expect(result).toEqual([]);
    // Empty object means no conditions are pushed → .where should be skipped.
    expect(selectChain.where).not.toHaveBeenCalled();
  });

  it("invokes .where exactly once when a userId filter is provided", async () => {
    selectResult = [makeRow()];

    await getAdminTransactions({ userId: USER_ID });

    expect(selectChain.where).toHaveBeenCalledOnce();
    expect(selectChain.orderBy).toHaveBeenCalledOnce();
  });

  it("invokes .where exactly once when a status filter is provided", async () => {
    selectResult = [makeRow({ status: "pending" })];

    const result = await getAdminTransactions({ status: "pending" });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("pending");
    expect(selectChain.where).toHaveBeenCalledOnce();
  });

  it("invokes .where exactly once when a type filter is provided", async () => {
    selectResult = [makeRow({ type: "withdrawal" })];

    const result = await getAdminTransactions({ type: "withdrawal" });

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("withdrawal");
    expect(selectChain.where).toHaveBeenCalledOnce();
  });

  it("invokes .where once with a single and(...) clause when multiple filters are combined", async () => {
    selectResult = [
      makeRow({ id: "tx-1", status: "approved", type: "buy" }),
    ];

    await getAdminTransactions({
      userId: USER_ID,
      status: "approved",
      type: "buy",
    });

    // All three filters collapse into one .where(and(...)) call.
    expect(selectChain.where).toHaveBeenCalledOnce();
    expect(selectChain.orderBy).toHaveBeenCalledOnce();
  });

  it("propagates joined rows where the user / method joins did not match (null)", async () => {
    const orphan = makeRow({
      id: "tx-orphan",
      user: null,
      method: null,
      portfolioName: null,
      approvedAt: null,
      approvedBy: null,
    });
    selectResult = [orphan];

    const result = await getAdminTransactions();

    expect(result).toEqual([orphan]);
    expect(result[0].user).toBeNull();
    expect(result[0].method).toBeNull();
  });
});
