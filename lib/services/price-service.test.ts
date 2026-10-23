import { getTableName, type SQL } from "drizzle-orm";
import { PgDialect, type PgTable } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `refreshHeldPrices` is reads, a decision, a cooldown claim and the cron's
 * own refresh. The reads are stubbed at `@/db` per table; the providers are
 * mocked, so what is under test is which assets reach them and when.
 */

type Row = Record<string, unknown>;

const OWNER = "00000000-0000-4000-8000-0000000000aa";
const ADA = "00000000-0000-4000-8000-0000000000a1";
const SPY = "00000000-0000-4000-8000-0000000000a2";
const NOW = new Date("2026-10-20T15:00:00Z");

const dialect = new PgDialect();
const paramsOf = (where: SQL | undefined): unknown[] =>
  where ? dialect.sqlToQuery(where).params : [];

let held: Row[] = [];
let quotes: Row[] = [];
let claimRows: Row[] = [];
let lastClaimAt: Date | null = null;
const assetQueries: unknown[][] = [];
const insertedQuotes: Row[] = [];
const claims: Row[] = [];

const ASSETS: Row[] = [
  { id: ADA, symbol: "ADA", source: "massive", externalId: "X:ADAUSD" },
  { id: SPY, symbol: "SPY", source: "massive", externalId: "SPY" },
];

function chain(rows: (where: SQL | undefined) => Row[]): unknown {
  let where: SQL | undefined;
  const self = {
    innerJoin: () => self,
    where: (predicate: SQL) => {
      where = predicate;
      return self;
    },
    orderBy: () => self,
    then: (resolve: (r: Row[]) => unknown) => Promise.resolve(rows(where)).then(resolve),
  };
  return self;
}

vi.mock("@/db", () => ({
  db: {
    selectDistinct: () => ({ from: () => chain(() => held) }),
    selectDistinctOn: () => ({ from: () => chain(() => quotes) }),
    select: () => ({
      from: (table: PgTable) =>
        chain((where) => {
          if (getTableName(table) !== "price_assets") throw new Error("unexpected table");
          const asked = paramsOf(where);
          assetQueries.push(asked);
          return ASSETS.filter((a) => asked.includes(a.id));
        }),
    }),
    insert: (table: PgTable) => ({
      values: (values: Row | Row[]) => {
        if (getTableName(table) === "price_quotes") {
          insertedQuotes.push(...(values as Row[]));
          return Promise.resolve();
        }
        claims.push(values as Row);
        return { onConflictDoUpdate: () => ({ returning: async () => claimRows }) };
      },
    }),
    query: {
      appState: { findFirst: async () => (lastClaimAt ? { updatedAt: lastClaimAt } : undefined) },
    },
  },
}));

vi.mock("./price-providers/massive", () => ({
  fetchMassivePrices: vi.fn(async (assets: { id: string }[]) => ({
    prices: new Map(assets.map((a) => [a.id, 0.25])),
    skipped: 0,
    errors: [],
  })),
}));
vi.mock("./price-providers/coingecko", () => ({ fetchCoinGeckoPrices: vi.fn() }));

import { fetchMassivePrices } from "./price-providers/massive";
import { priceCronSchedule, refreshHeldPrices } from "./price-service";

beforeEach(() => {
  held = [
    { id: ADA, symbol: "ADA", source: "massive" },
    { id: SPY, symbol: "SPY", source: "massive" },
  ];
  claimRows = [{ key: "last_manual_price_refresh" }];
  lastClaimAt = null;
});

afterEach(() => {
  vi.clearAllMocks();
  assetQueries.length = 0;
  insertedQuotes.length = 0;
  claims.length = 0;
});

describe("refreshHeldPrices", () => {
  it("fetches only the stale prices behind the book, through the cron's path", async () => {
    quotes = [
      { assetId: ADA, price: "0.2", fetchedAt: new Date("2026-10-20T00:30:00Z") },
      { assetId: SPY, price: "760", fetchedAt: new Date("2026-10-18T00:30:00Z") },
    ];

    const result = await refreshHeldPrices(OWNER, NOW);

    expect(result).toEqual({ status: "refreshed", requested: 1, fetched: 1, skipped: 0, errors: [] });
    expect(assetQueries[0]).toContain(SPY);
    expect(assetQueries[0]).not.toContain(ADA);
    expect(vi.mocked(fetchMassivePrices).mock.calls[0][0]).toEqual([
      { id: SPY, symbol: "SPY", externalId: "SPY" },
    ]);
    expect(insertedQuotes).toEqual([{ assetId: SPY, price: "0.25000000" }]);
    expect(claims).toHaveLength(1);
  });

  it("spends no request and no cooldown when every price is already the latest close", async () => {
    quotes = [
      { assetId: ADA, price: "0.2", fetchedAt: new Date("2026-10-20T00:30:00Z") },
      { assetId: SPY, price: "760", fetchedAt: new Date("2026-10-20T00:30:00Z") },
    ];

    const result = await refreshHeldPrices(OWNER, NOW);

    expect(result).toEqual({ status: "current", newerAt: new Date("2026-10-21T00:00:00Z") });
    expect(claims).toHaveLength(0);
    expect(fetchMassivePrices).not.toHaveBeenCalled();
  });

  it("refuses inside the cooldown and says when it frees up", async () => {
    quotes = [{ assetId: SPY, price: "760", fetchedAt: new Date("2026-10-18T00:30:00Z") }];
    claimRows = [];
    lastClaimAt = new Date("2026-10-20T14:58:00Z");

    const result = await refreshHeldPrices(OWNER, NOW);

    expect(result).toEqual({ status: "cooldown", retryAt: new Date("2026-10-20T15:03:00Z") });
    expect(fetchMassivePrices).not.toHaveBeenCalled();
  });

  it("has nothing to refresh for someone whose methods hold nothing", async () => {
    held = [];
    expect(await refreshHeldPrices(OWNER, NOW)).toEqual({ status: "nothing-held" });
    expect(claims).toHaveLength(0);
  });
});

describe("priceCronSchedule", () => {
  it("can read the price cron in vercel.json", () => {
    // The page promises "next in …" from this. If the cron line changes to
    // something the parser cannot read, this fails rather than the label
    // silently disappearing.
    expect(priceCronSchedule()).not.toBeNull();
  });
});
