import { z } from "zod";

/**
 * Where a finance-plan snapshot came from. Values map 1:1 to the Postgres
 * `finance_snapshot_source` enum in db/schema.ts.
 */
export const financeSnapshotSourceSchema = z.enum([
  "system_cron",
  "confirmation",
  "manual",
  "movement",
]);

export type FinanceSnapshotSource = z.infer<typeof financeSnapshotSourceSchema>;
