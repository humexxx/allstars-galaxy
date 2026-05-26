"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/services/auth-server";
import { applyMonthlyInterest } from "@/lib/services/interest-service";
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
): Promise<{
  success: true;
  totalValue: number;
  snapshotsCreated: number;
}> {
  await requireAdmin();

  const validated = manualSnapshotFormSchema.parse(data);

  if (validated.applyInterest) {
    await applyMonthlyInterest(validated.date);
  }

  const { snapshotsCreated, totalValue } =
    await createManualSnapshotsForAllPortfolios(validated.date, validated.source);

  revalidatePath("/portal/portfolio");

  return { success: true, totalValue, snapshotsCreated };
}

/**
 * Delete all manual snapshots from ALL portfolios.
 * Admin only.
 */
export async function deleteManualSnapshotsAction(): Promise<{
  success: true;
  portfoliosProcessed: number;
}> {
  await requireAdmin();

  const { portfoliosProcessed } = await deleteManualSnapshotsForAllPortfolios();

  revalidatePath("/portal/portfolio");

  return { success: true, portfoliosProcessed };
}
