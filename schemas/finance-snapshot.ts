import { z } from "zod";

/**
 * Mirrors `snapshotSourceEnum` from /schemas/snapshot.ts for the finance plan
 * domain. Keep both files structurally identical so reviewers don't have to
 * second-guess where the canonical Zod enum lives.
 *
 * Values map 1:1 to the Postgres `finance_snapshot_source` enum.
 */
export const financeSnapshotSourceEnum = z.enum([
  "system_cron",
  "confirmation",
  "manual",
]);

export type FinanceSnapshotSource = z.infer<typeof financeSnapshotSourceEnum>;

export const manualFinanceSnapshotFormSchema = z.object({
  planId: z.string().uuid(),
  date: z.coerce.date(),
  source: financeSnapshotSourceEnum.default("manual"),
});

export type ManualFinanceSnapshotFormData = z.infer<
  typeof manualFinanceSnapshotFormSchema
>;
