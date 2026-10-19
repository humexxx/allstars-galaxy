import { getTableName, type SQL } from "drizzle-orm";
import { PgDialect, type PgTable } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `backfillTransactionAllocations` is a handful of reads, a loop and one
 * insert. The reads are stubbed at the `@/db` boundary per table; the
 * `transactions` stub applies the statuses the real query asks for, which is
 * the part under test.
 */

type Row = Record<string, unknown>;

const OWNER = "00000000-0000-4000-8000-0000000000aa";
const METHOD = "00000000-0000-4000-8000-000000000001";
const SPY = "00000000-0000-4000-8000-0000000000a1";

let ledger: Row[] = [];
const inserted: Row[] = [];
const dialect = new PgDialect();

function statusesAskedFor(where: SQL | undefined): unknown[] {
  return where ? dialect.sqlToQuery(where).params : [];
}

function rowsFor(table: PgTable, where: SQL | undefined): Row[] {
  switch (getTableName(table)) {
    case "investment_methods":
      return [{ id: METHOD }];
    case "method_allocations":
      return [{ methodId: METHOD, assetId: SPY, percent: "100.000", symbol: "SPY", name: "SPDR" }];
    case "transactions": {
      const asked = statusesAskedFor(where);
      return ledger.filter((t) => asked.includes(t.status));
    }
    case "transaction_allocations":
      return [];
    case "price_assets":
      return [{ id: SPY, symbol: "SPY", name: "SPDR", externalId: "SPY", source: "massive" }];
    default:
      throw new Error(`unexpected table ${getTableName(table)}`);
  }
}

function chain(table: PgTable): unknown {
  let where: SQL | undefined;
  const self = {
    innerJoin: () => self,
    where: (predicate: SQL) => {
      where = predicate;
      return self;
    },
    then: (resolve: (rows: Row[]) => unknown) => Promise.resolve(rowsFor(table, where)).then(resolve),
  };
  return self;
}

vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: (table: PgTable) => chain(table) }),
    insert: () => ({
      values: (rows: Row[]) => {
        inserted.push(...rows);
        return { onConflictDoNothing: async () => undefined };
      },
    }),
  },
}));

vi.mock("./price-providers/massive", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./price-providers/massive")>()),
  fetchDailyCloses: vi.fn(async () => ({
    bars: [
      { day: "2026-03-02", close: 100 },
      { day: "2026-03-09", close: 125 },
    ],
    error: null,
  })),
}));

import { backfillTransactionAllocations } from "./allocation-service";

afterEach(() => {
  inserted.length = 0;
  ledger = [];
});

describe("backfillTransactionAllocations", () => {
  it("prices a buy withdrawn to zero before a policy existed, not only its withdrawal", async () => {
    // Withdrawing the whole buy flipped it to "closed". Holdings, the investor
    // breakdown and the unpriced badge all count closed buys; pricing did not,
    // so the withdrawal's negative units stood alone and the method showed a
    // negative position.
    ledger = [
      {
        id: "buy",
        methodId: METHOD,
        date: new Date("2026-03-02T15:00:00Z"),
        type: "buy",
        total: "1000.00",
        status: "closed",
      },
      {
        id: "wd",
        methodId: METHOD,
        date: new Date("2026-03-09T15:00:00Z"),
        type: "withdrawal",
        total: "1250.00",
        status: "approved",
      },
      // No money moved, so nothing was bought.
      {
        id: "rejected",
        methodId: METHOD,
        date: new Date("2026-03-03T15:00:00Z"),
        type: "buy",
        total: "500.00",
        status: "rejected",
      },
    ];

    const result = await backfillTransactionAllocations(OWNER);

    expect(inserted.map((r) => r.transactionId).sort()).toEqual(["buy", "wd"]);
    const units = inserted.reduce((sum, r) => sum + parseFloat(r.quantity as string), 0);
    expect(units).toBeCloseTo(0, 8);
    expect(result).toMatchObject({ priced: 2, skipped: 0 });
  });
});
