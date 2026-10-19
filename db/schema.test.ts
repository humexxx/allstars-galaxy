import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "./schema";

// Supabase's Data API serves every `public` table to anyone holding the
// publishable key, which ships in the browser bundle. RLS with no policies is
// what turns those requests away; the app reads through Drizzle as the tables'
// owner, so it is unaffected. Until 0053 no table had it.
describe("db schema", () => {
  it("enables row-level security on every public table", () => {
    const publicTables = (Object.values(schema) as unknown[])
      .filter((value): value is PgTable => is(value, PgTable))
      .map((table) => getTableConfig(table))
      .filter((config) => config.schema === undefined);

    expect(publicTables.length).toBeGreaterThan(0);
    expect(publicTables.filter((config) => !config.enableRLS).map((config) => config.name)).toEqual([]);
  });
});
