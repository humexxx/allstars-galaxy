"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { requireAdminCached } from "@/lib/services/auth-server";
import { applyMonthlyInterest, interestMonthOf } from "@/lib/services/interest-service";
import {
  createManualSnapshotsForAllPortfolios,
  deleteManualSnapshotsForAllPortfolios,
} from "@/lib/services/snapshot-service";
import { formatMonthLong } from "@/lib/utils/date";
import {
  manualSnapshotFormSchema,
  type ManualSnapshotFormData,
} from "@/schemas/snapshot";

/**
 * Create a manual snapshot for all portfolios.
 * Optionally applies monthly interest first (affects every portfolio), for
 * the snapshot's month — refused when that month was already compounded, by
 * this or the daily cron. Admin only.
 */
export async function createManualSnapshotAction(
  data: ManualSnapshotFormData,
): Promise<ActionResult<{ totalValue: number; snapshotsCreated: number }>> {
  return safe("portfolio-snapshots:create", async () => {
    await requireAdminCached();

    const parsed = manualSnapshotFormSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const validated = parsed.data;

    if (validated.applyInterest) {
      // Months up to the one on record count as done, so claiming a month
      // that has not started would make the cron skip every month up to it.
      if (interestMonthOf(validated.date) > interestMonthOf(new Date())) {
        return { success: false, error: "Interest can't be applied for a future month" };
      }
      const run = await applyMonthlyInterest(validated.date, validated.date);
      if (!run.applied) {
        return {
          success: false,
          error: `Interest for ${formatMonthLong(`${run.month}-01`)} has already been applied`,
        };
      }
    }

    const { snapshotsCreated, totalValue } =
      await createManualSnapshotsForAllPortfolios(validated.date, validated.source);

    revalidatePath("/portal/portfolio");

    return { success: true, data: { totalValue, snapshotsCreated } };
  });
}

/**
 * Delete all manual snapshots from ALL portfolios.
 * Admin only.
 */
export async function deleteManualSnapshotsAction(): Promise<
  ActionResult<{ portfoliosProcessed: number }>
> {
  return safe("portfolio-snapshots:delete", async () => {
    await requireAdminCached();

    const { portfoliosProcessed } = await deleteManualSnapshotsForAllPortfolios();

    revalidatePath("/portal/portfolio");

    return { success: true, data: { portfoliosProcessed } };
  });
}
