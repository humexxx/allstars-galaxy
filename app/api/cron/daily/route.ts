import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getAppStateValue, setAppState } from "@/lib/services/app-state-service";
import {
  applyMonthlyInterest,
  interestAppliedThisMonth,
  LAST_INTEREST_RUN_KEY,
  markInterestApplied,
} from "@/lib/services/interest-service";
import { createDailySnapshots } from "@/lib/services/snapshot-service";
import { createDailyFinanceSnapshots } from "@/lib/services/finance-snapshot-service";
import {
  createAutomatedTasksForAllUsers,
  type AutomatedTasksRun,
} from "@/lib/services/task-automation-service";
import { refreshF1News } from "@/lib/services/rapidapi-f1-news-service";

// Interest, two snapshot passes, a per-user task loop and an upstream fetch
// run back to back; the platform default would cut that off. (Hobby caps a
// function at 60 s.)
export const maxDuration = 300;

type InterestRun = { applied: boolean; result: Awaited<ReturnType<typeof applyMonthlyInterest>> | null };
type SnapshotRun = Awaited<ReturnType<typeof createDailySnapshots>>;
type FinanceSnapshotRun = Awaited<ReturnType<typeof createDailyFinanceSnapshots>>;
type F1NewsRun = Awaited<ReturnType<typeof refreshF1News>>;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

/**
 * Once per calendar month, whatever day the job happens to run.
 *
 * The record in app_state is consulted on EVERY run, the 1st included: the
 * old "always apply on the 1st" shortcut meant a retry, a manual trigger or a
 * double fire on that day compounded a second month onto every position.
 * With no record yet, only the 1st counts as the first month's run.
 */
async function shouldRunMonthlyInterest(today: Date): Promise<boolean> {
  const lastInterestRun = await getAppStateValue(LAST_INTEREST_RUN_KEY);

  if (!lastInterestRun) {
    return today.getUTCDate() === 1;
  }

  return !interestAppliedThisMonth(lastInterestRun, today);
}

async function processMonthlyInterest(today: Date): Promise<InterestRun> {
  try {
    const shouldApply = await shouldRunMonthlyInterest(today);

    if (!shouldApply) {
      return { applied: false, result: null };
    }

    const result = await applyMonthlyInterest();
    await markInterestApplied(today);

    return { applied: true, result };
  } catch (error) {
    console.error("Failed to process monthly interest:", error);
    // A separate key: stamping last_interest_run on failure made the next run
    // believe the month was done and skip it.
    await setAppState("last_interest_error", today.toISOString(), messageOf(error));
    throw error;
  }
}

async function processDailySnapshots(today: Date): Promise<SnapshotRun> {
  try {
    const result = await createDailySnapshots();
    await setAppState("last_snapshot_run", today.toISOString());
    return result;
  } catch (error) {
    console.error("Failed to create daily snapshots:", error);
    await setAppState("last_snapshot_run", today.toISOString(), messageOf(error));
    throw error;
  }
}

async function processFinancePlanSnapshots(today: Date): Promise<FinanceSnapshotRun> {
  try {
    const result = await createDailyFinanceSnapshots(today);
    await setAppState("last_finance_snapshots_run", today.toISOString());
    return result;
  } catch (error) {
    console.error("Failed to capture finance plan snapshots:", error);
    await setAppState("last_finance_snapshots_run", today.toISOString(), messageOf(error));
    throw error;
  }
}

async function processAutomatedTasks(today: Date): Promise<AutomatedTasksRun> {
  try {
    const run = await createAutomatedTasksForAllUsers();
    await setAppState(
      "last_task_automation_run",
      today.toISOString(),
      run.failedUserIds.length > 0 ? `Failed for ${run.failedUserIds.length} user(s)` : null
    );
    return run;
  } catch (error) {
    console.error("Failed to process automated tasks:", error);
    await setAppState("last_task_automation_run", today.toISOString(), messageOf(error));
    throw error;
  }
}

/**
 * Pull the day's F1 news.
 *
 * This used to be a Cloud Function in the humex-champions Firebase project on
 * its own 08:00 UTC schedule. It lives here now so one app owns the RapidAPI
 * quota and the archive.
 */
async function processF1News(today: Date): Promise<F1NewsRun> {
  try {
    const result = await refreshF1News();
    await setAppState("last_f1_news_run", today.toISOString());
    return result;
  } catch (error) {
    console.error("Failed to refresh F1 news:", error);
    await setAppState("last_f1_news_run", today.toISOString(), messageOf(error));
    throw error;
  }
}

/**
 * Run one independent step. A failure is recorded by name only: the message
 * is already in the log and in app_state, and the response carries no driver
 * or constraint text.
 */
async function step<T>(
  operation: string,
  run: () => Promise<T>,
  errors: string[]
): Promise<T | undefined> {
  try {
    return await run();
  } catch {
    errors.push(operation);
    return undefined;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    if (!isCronAuthorized(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    const failed: string[] = [];

    const interest = await step("monthly_interest", () => processMonthlyInterest(today), failed);
    const snapshots = await step("daily_snapshots", () => processDailySnapshots(today), failed);
    const financeSnapshots = await step(
      "finance_plan_snapshots",
      () => processFinancePlanSnapshots(today),
      failed
    );
    const tasks = await step("automated_tasks", () => processAutomatedTasks(today), failed);
    const f1News = await step("f1_news", () => processF1News(today), failed);

    return NextResponse.json({
      success: failed.length === 0,
      date: today.toISOString(),
      interestApplied: interest?.applied ?? false,
      interestResult: interest?.result,
      snapshotsCreated: snapshots?.snapshotsCreated ?? 0,
      financePlanSnapshots: {
        totalPlans: financeSnapshots?.totalPlans ?? 0,
        snapshotsCreated: financeSnapshots?.snapshotsCreated ?? 0,
        // A count, not the strings: those are built from raw error messages.
        failed: financeSnapshots?.errors.length ?? 0,
      },
      taskCreationResults: tasks?.created ?? [],
      taskAutomationFailures: tasks?.failedUserIds.length ?? 0,
      f1News: f1News ?? { fetched: 0, stored: 0 },
      failedOperations: failed,
    });
  } catch (error) {
    console.error("Cron job error:", error);

    try {
      await setAppState("last_cron_error", new Date().toISOString(), messageOf(error));
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
