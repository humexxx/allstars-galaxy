"use server";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { requireAdmin } from "@/lib/services/auth-server";
import { createDailyFinanceSnapshots } from "@/lib/services/finance-snapshot-service";
import { createDailySnapshots } from "@/lib/services/snapshot-service";

type RunDailySnapshotsResult = {
  finance: { created: number; total: number; errors: string[] };
  portfolio: { created: number; total: number };
};

/**
 * Dev/testing helper: run the same daily snapshot job the midnight cron runs
 * (finance plans + portfolios) on demand, so snapshot creation can be verified
 * without waiting for the schedule. Admin-only — the dev drawer that surfaces
 * it is dev-only, but the action itself is callable, so it's gated server-side.
 *
 * Note: finance snapshots are idempotent per calendar day (a system_cron row
 * already written today is skipped), so a second run the same day reports 0
 * created for finance — that's expected, not a failure.
 */
export async function runDailySnapshotsAction(): Promise<
  ActionResult<RunDailySnapshotsResult>
> {
  return safe("dev-tools:run-daily-snapshots", async () => {
    await requireAdmin();

    const today = new Date();
    const finance = await createDailyFinanceSnapshots(today);
    const portfolio = await createDailySnapshots();

    return {
      success: true,
      message: `Finance ${finance.snapshotsCreated}/${finance.totalPlans} · Portfolio ${portfolio.snapshotsCreated}/${portfolio.totalPortfolios}`,
      data: {
        finance: {
          created: finance.snapshotsCreated,
          total: finance.totalPlans,
          errors: finance.errors,
        },
        portfolio: {
          created: portfolio.snapshotsCreated,
          total: portfolio.totalPortfolios,
        },
      },
    };
  });
}
