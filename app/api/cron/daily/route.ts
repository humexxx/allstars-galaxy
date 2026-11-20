import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getAppStateValue, setAppState } from "@/lib/services/app-state-service";
import { applyMonthlyInterest, LAST_INTEREST_RUN_KEY } from "@/lib/services/interest-service";
import { createDailySnapshots } from "@/lib/services/snapshot-service";
import { refreshF1News } from "@/lib/services/rapidapi-f1-news-service";

// Interest, the portfolio snapshots and an upstream fetch run back to back.
// 300 s is the most a Hobby function gets (under Fluid compute, Vercel's
// default); vercel.json sets no duration of its own.
export const maxDuration = 300;

const LAST_F1_NEWS_RUN_KEY = "last_f1_news_run";

type InterestRun = { applied: boolean; result: { processed: number; closed: number } | null };
type SnapshotRun = Awaited<ReturnType<typeof createDailySnapshots>>;
type F1NewsRun = Awaited<ReturnType<typeof refreshF1News>>;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

/**
 * Once per calendar month, whatever day the job happens to run.
 *
 * `applyMonthlyInterest` claims the month and compounds in one transaction,
 * so a retry, a manual trigger, a double fire or the admin's manual snapshot
 * finds the month taken and compounds nothing. With no record yet, only the
 * 1st starts the first month — a deploy mid-month must not compound on day
 * one. That read only ever skips; the claim is what guards the month.
 */
async function processMonthlyInterest(today: Date): Promise<InterestRun> {
  try {
    if (today.getUTCDate() !== 1 && !(await getAppStateValue(LAST_INTEREST_RUN_KEY))) {
      return { applied: false, result: null };
    }

    const run = await applyMonthlyInterest(today);
    if (!run.applied) {
      return { applied: false, result: null };
    }

    return { applied: true, result: { processed: run.processed, closed: run.closed } };
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


/**
 * Pull the day's F1 news, once a UTC day.
 *
 * This used to be a Cloud Function in the humex-champions Firebase project on
 * its own 08:00 UTC schedule. It lives here now so one app owns the RapidAPI
 * quota and the archive.
 *
 * The quota is 40 requests a month, so a manual re-run or a double fire must
 * not spend another. Only a success is stamped on `last_f1_news_run`; a
 * failure goes to its own key, as interest's does, so it is retried the same
 * day rather than read as the day's run.
 */
async function processF1News(today: Date): Promise<F1NewsRun> {
  const day = today.toISOString().slice(0, 10);
  const lastRun = await getAppStateValue(LAST_F1_NEWS_RUN_KEY);
  if (lastRun?.slice(0, 10) === day) return { fetched: 0, stored: 0, skipped: true };
  try {
    const result = await refreshF1News();
    await setAppState(LAST_F1_NEWS_RUN_KEY, today.toISOString());
    return result;
  } catch (error) {
    console.error("Failed to refresh F1 news:", error);
    await setAppState("last_f1_news_error", today.toISOString(), messageOf(error));
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
    // No finance plan snapshots here: a plan's history is written when the
    // user confirms a period or edits the plan, never by the day. Its
    // position today is computed on every read.
    const f1News = await step("f1_news", () => processF1News(today), failed);

    return NextResponse.json({
      success: failed.length === 0,
      date: today.toISOString(),
      interestApplied: interest?.applied ?? false,
      interestResult: interest?.result,
      snapshotsCreated: snapshots?.snapshotsCreated ?? 0,
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
