"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { requireAdminCached } from "@/lib/services/auth-server";
import { applyMonthlyInterest, markInterestApplied } from "@/lib/services/interest-service";
import {
  createManualSnapshotsForAllPortfolios,
  deleteManualSnapshotsForAllPortfolios,
} from "@/lib/services/snapshot-service";
import {
  manualSnapshotFormSchema,
  type ManualSnapshotFormData,
} from "@/schemas/snapshot";

/**
 * Create a manual snapshot for all portfolios.
 * Optionally applies monthly interest first (affects every portfolio).
 * Admin only.
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
      await applyMonthlyInterest(validated.date);
      // Otherwise the cron applies the same month again on the 1st.
      await markInterestApplied();
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
