import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cron-auth", () => ({ isCronAuthorized: () => true }));
vi.mock("@/lib/services/app-state-service", () => ({
  getAppStateValue: vi.fn(),
  setAppState: vi.fn(),
}));
vi.mock("@/lib/services/interest-service", () => ({
  applyMonthlyInterest: vi.fn(),
  LAST_INTEREST_RUN_KEY: "last_interest_run",
}));
vi.mock("@/lib/services/snapshot-service", () => ({
  createDailySnapshots: vi.fn(async () => ({ snapshotsCreated: 0 })),
}));
vi.mock("@/lib/services/finance-snapshot-service", () => ({
  createDailyFinanceSnapshots: vi.fn(async () => ({
    totalPlans: 0,
    snapshotsCreated: 0,
    errors: [],
  })),
}));
vi.mock("@/lib/services/task-automation-service", () => ({
  createAutomatedTasksForAllUsers: vi.fn(async () => ({ created: [], failedUserIds: [] })),
}));
vi.mock("@/lib/services/rapidapi-f1-news-service", () => ({
  refreshF1News: vi.fn(async () => ({ fetched: 0, stored: 0 })),
}));

import { getAppStateValue, setAppState } from "@/lib/services/app-state-service";
import { applyMonthlyInterest } from "@/lib/services/interest-service";

import { GET } from "./route";

const OCT_1 = new Date("2026-10-01T06:00:00Z");
const OCT_16 = new Date("2026-10-16T06:00:00Z");

async function run(): Promise<Record<string, unknown>> {
  const response = await GET(
    new NextRequest("http://localhost/api/cron/daily", {
      headers: { authorization: "Bearer test" },
    })
  );
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("GET /api/cron/daily — monthly interest", () => {
  it("claims and compounds in one call, and writes no separate record", async () => {
    vi.setSystemTime(OCT_1);
    vi.mocked(getAppStateValue).mockResolvedValue("2026-09-01T06:00:00.000Z");
    vi.mocked(applyMonthlyInterest).mockResolvedValueOnce({
      applied: true,
      month: "2026-10",
      processed: 3,
      closed: 0,
    });

    const body = await run();

    expect(body.interestApplied).toBe(true);
    expect(body.interestResult).toEqual({ processed: 3, closed: 0 });
    expect(applyMonthlyInterest).toHaveBeenCalledWith(OCT_1);
    // A record written after the compounding committed could fail on its own
    // and leave the month open for the next run to compound again.
    const recordWrites = vi
      .mocked(setAppState)
      .mock.calls.filter(([key]) => key === "last_interest_run");
    expect(recordWrites).toEqual([]);
  });

  it("compounds nothing when the month was already claimed", async () => {
    // A retry, a double fire, or the admin's manual snapshot got there first.
    vi.setSystemTime(OCT_16);
    vi.mocked(getAppStateValue).mockResolvedValue("2026-10-01T06:00:00.000Z");
    vi.mocked(applyMonthlyInterest).mockResolvedValueOnce({
      applied: false,
      month: "2026-10",
    });

    const body = await run();

    expect(body.interestApplied).toBe(false);
    expect(body.interestResult).toBeNull();
    expect(body.failedOperations).toEqual([]);
  });

  it("with nothing on record, does not start the first month mid-month", async () => {
    vi.setSystemTime(OCT_16);
    vi.mocked(getAppStateValue).mockResolvedValue(null);

    const body = await run();

    expect(applyMonthlyInterest).not.toHaveBeenCalled();
    expect(body.interestApplied).toBe(false);
  });

  it("with nothing on record, starts on the 1st", async () => {
    vi.setSystemTime(OCT_1);
    vi.mocked(getAppStateValue).mockResolvedValue(null);
    vi.mocked(applyMonthlyInterest).mockResolvedValueOnce({
      applied: true,
      month: "2026-10",
      processed: 0,
      closed: 0,
    });

    const body = await run();

    expect(applyMonthlyInterest).toHaveBeenCalledWith(OCT_1);
    expect(body.interestApplied).toBe(true);
  });

  it("records a failure under its own key, never as the month's run", async () => {
    vi.setSystemTime(OCT_1);
    vi.mocked(getAppStateValue).mockResolvedValue("2026-09-01T06:00:00.000Z");
    vi.mocked(applyMonthlyInterest).mockRejectedValueOnce(new Error("lock timeout"));

    const body = await run();

    expect(body.failedOperations).toEqual(["monthly_interest"]);
    expect(setAppState).toHaveBeenCalledWith(
      "last_interest_error",
      OCT_1.toISOString(),
      "lock timeout"
    );
  });
});
