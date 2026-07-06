import "server-only";

import { eq } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

import { db } from "@/db";

type OwnedTable = PgTable & { $inferSelect: { userId: string } };

/**
 * Canonical ownership check for user-owned rows. Loads the row by id and
 * throws `"<entity> not found"` when it is missing OR belongs to another
 * user — deliberately the same error for both cases so callers never leak
 * whether a foreign id exists. Returns the row so callers can reuse fields
 * without a second query.
 */
export async function ensureOwnedRow<TTable extends OwnedTable>(opts: {
  table: TTable;
  idColumn: AnyPgColumn;
  id: string;
  userId: string;
  entity: string;
}): Promise<TTable["$inferSelect"]> {
  const rows = (await db
    .select()
    .from(opts.table as PgTable)
    .where(eq(opts.idColumn, opts.id))) as TTable["$inferSelect"][];
  const [row] = rows;
  if (!row || row.userId !== opts.userId) {
    throw new Error(`${opts.entity} not found`);
  }
  return row;
}
