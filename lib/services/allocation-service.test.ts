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
const BTC = "00000000-0000-4000-8000-0000000000a2";

const SPY_ASSET = { id: SPY, symbol: "SPY", name: "SPDR", externalId: "SPY", source: "massive" };
const SPY_ONLY = [{ methodId: METHOD, assetId: SPY, percent: "100.000", symbol: "SPY", name: "SPDR" }];

let ledger: Row[] = [];
let methods: Row[] = [{ id: METHOD }];
let policy: Row[] = SPY_ONLY;
let priced: Row[] = [];
let assets: Row[] = [SPY_ASSET];
const inserted: Row[] = [];
const dialect = new PgDialect();

function statusesAskedFor(where: SQL | undefined): unknown[] {
  return where ? dialect.sqlToQuery(where).params : [];
}

function rowsFor(table: PgTable, where: SQL | undefined): Row[] {
  switch (getTableName(table)) {
    case "investment_methods":
      return methods;
    case "method_allocations":
      return policy;
    case "transactions": {
      const asked = statusesAskedFor(where);
      return ledger.filter((t) => asked.includes(t.status));
    }
    case "transaction_allocations":
      return priced;
    case "price_assets":
      return assets;
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

import { fetchDailyCloses } from "./price-providers/massive";
import { backfillAllOwners, backfillTransactionAllocations } from "./allocation-service";

afterEach(() => {
  inserted.length = 0;
  ledger = [];
  methods = [{ id: METHOD }];
  policy = SPY_ONLY;
  priced = [];
  assets = [SPY_ASSET];
  vi.mocked(fetchDailyCloses).mockClear();
});

const buy = (id: string, total: string, over: Row = {}): Row => ({
  id,
  methodId: METHOD,
  date: new Date("2026-03-09T15:00:00Z"),
  type: "buy",
  total,
  status: "approved",
  ...over,
});

const HALF_AND_HALF = [
  { methodId: METHOD, assetId: SPY, percent: "50.000", symbol: "SPY", name: "SPDR" },
  { methodId: METHOD, assetId: BTC, percent: "50.000", symbol: "BTC", name: "Bitcoin" },
];
const BTC_MASSIVE = { id: BTC, symbol: "BTC", name: "Bitcoin", externalId: "X:BTCUSD", source: "massive" };

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

  it("prices the half of a split contribution whose lookup failed last time", async () => {
    // Keyed on the transaction alone, the SPY row made the whole buy count as
    // done and the BTC half was never priced.
    ledger = [buy("split", "1000.00")];
    policy = HALF_AND_HALF;
    assets = [BTC_MASSIVE];
    priced = [{ transactionId: "split", assetId: SPY, amount: "500.00" }];

    const result = await backfillTransactionAllocations(OWNER);

    expect(inserted).toEqual([
      expect.objectContaining({ transactionId: "split", assetId: BTC, amount: "500.00", priceAtPurchase: "125.00000000" }),
    ]);
    expect(vi.mocked(fetchDailyCloses)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchDailyCloses).mock.calls[0][0]).toBe("X:BTCUSD");
    expect(result).toMatchObject({ priced: 1, skipped: 0 });
  });

  it("leaves a fully priced contribution alone, even after the policy changed", async () => {
    ledger = [buy("done", "1000.00")];
    policy = HALF_AND_HALF;
    priced = [{ transactionId: "done", assetId: SPY, amount: "1000.00" }];

    const result = await backfillTransactionAllocations(OWNER);

    expect(inserted).toEqual([]);
    expect(fetchDailyCloses).not.toHaveBeenCalled();
    expect(result.errors).toEqual([]);
  });

  it("refuses to complete a partly priced contribution under a different split", async () => {
    // 50/50 now, but the stored row was 70% of the buy: a 50% BTC slice would
    // leave 200 of the money unaccounted for.
    ledger = [buy("partial", "1000.00")];
    policy = HALF_AND_HALF;
    priced = [{ transactionId: "partial", assetId: SPY, amount: "700.00" }];

    const result = await backfillTransactionAllocations(OWNER);

    expect(inserted).toEqual([]);
    expect(result.errors.join(" ")).toContain("different allocation policy");
  });

  it("completes the missing half of a withdrawal with negative units", async () => {
    ledger = [buy("wd", "250.00", { type: "withdrawal" })];
    policy = HALF_AND_HALF;
    assets = [BTC_MASSIVE];
    priced = [{ transactionId: "wd", assetId: SPY, amount: "-125.00" }];

    await backfillTransactionAllocations(OWNER);

    expect(inserted).toEqual([expect.objectContaining({ assetId: BTC, amount: "-125.00", quantity: "-1.00000000" })]);
  });

  it("reports a CoinGecko asset's history as unsupported instead of asking Massive for it", async () => {
    ledger = [buy("btc", "1000.00")];
    policy = [{ methodId: METHOD, assetId: BTC, percent: "100.000", symbol: "BTC", name: "Bitcoin" }];
    assets = [{ id: BTC, symbol: "BTC", name: "Bitcoin", externalId: "bitcoin", source: "coingecko" }];

    const result = await backfillTransactionAllocations(OWNER);

    expect(fetchDailyCloses).not.toHaveBeenCalled();
    expect(inserted).toEqual([]);
    expect(result.errors).toEqual(["BTC: historical pricing unsupported for source coingecko"]);
    expect(result.skipped).toBe(1);
  });
});

describe("backfillAllOwners", () => {
  it("reads each asset's history once however many owners hold it, and says what it spent", async () => {
    const OTHER = "00000000-0000-4000-8000-000000000002";
    methods = [{ id: METHOD }, { id: OTHER }];
    policy = [...SPY_ONLY, { methodId: OTHER, assetId: SPY, percent: "100.000", symbol: "SPY", name: "SPDR" }];
    ledger = [buy("a", "100.00"), buy("b", "200.00", { methodId: OTHER })];

    const result = await backfillAllOwners();

    expect(fetchDailyCloses).toHaveBeenCalledTimes(1);
    expect(inserted.map((r) => r.transactionId).sort()).toEqual(["a", "b"]);
    expect(result).toMatchObject({ priced: 2, massiveCalls: 1 });
  });

  it("stops at the run's Massive budget and defers the rest", async () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: `00000000-0000-4000-8000-0000000001${i}0`,
      symbol: `T${i}`,
      name: `T${i}`,
      externalId: `T${i}`,
      source: "massive",
    }));
    assets = many;
    policy = many.map((a, i) => ({
      methodId: METHOD,
      assetId: a.id,
      percent: i === 5 ? "16.665" : "16.667",
      symbol: a.symbol,
      name: a.name,
    }));
    ledger = [buy("wide", "600.00")];

    const result = await backfillAllOwners();

    expect(fetchDailyCloses).toHaveBeenCalledTimes(5);
    expect(result.massiveCalls).toBe(5);
    expect(result.errors).toContain("T5: rate limit, history deferred to the next run");
    expect(inserted).toHaveLength(5);
  });
});
