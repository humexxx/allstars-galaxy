// One-off runner for the finance plan snapshot cron job. Lets us verify the
// service end-to-end against the local DIRECT_URL without depending on a
// Vercel deploy. Mirrors what /api/cron/daily would do for the finance
// snapshot leg only.
import { createDailyFinanceSnapshots } from "@/lib/services/finance-snapshot-service";

async function main(): Promise<void> {
  const start = Date.now();
  const today = new Date();
  console.log(`Running createDailyFinanceSnapshots for ${today.toISOString()}…`);

  const result = await createDailyFinanceSnapshots(today);

  console.log("\nResult:");
  console.log(`  totalPlans:        ${result.totalPlans}`);
  console.log(`  snapshotsCreated:  ${result.snapshotsCreated}`);
  if (result.errors.length > 0) {
    console.log(`  errors (${result.errors.length}):`);
    for (const e of result.errors) console.log(`    - ${e}`);
  } else {
    console.log("  errors:            (none)");
  }
  console.log(`\nFinished in ${Date.now() - start} ms.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Snapshot run failed:", err);
    process.exit(1);
  });
