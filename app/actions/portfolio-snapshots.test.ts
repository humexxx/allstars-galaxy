import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/auth-server", () => ({
  requireAdminCached: vi.fn(),
}));

vi.mock("@/lib/services/interest-service", () => ({
  applyMonthlyInterest: vi.fn(),
  markInterestApplied: vi.fn(),
}));

vi.mock("@/lib/services/snapshot-service", () => ({
  createManualSnapshotsForAllPortfolios: vi.fn(),
  deleteManualSnapshotsForAllPortfolios: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { requireAdminCached } from "@/lib/services/auth-server";
import { applyMonthlyInterest } from "@/lib/services/interest-service";
import {
  createManualSnapshotsForAllPortfolios,
  deleteManualSnapshotsForAllPortfolios,
} from "@/lib/services/snapshot-service";

import {
  createManualSnapshotAction,
  deleteManualSnapshotsAction,
} from "./portfolio-snapshots";

// zod v4 enforces v4 UUIDs (version digit 4, variant digit 8-b).
const ADMIN_ID = "00000000-0000-4000-8000-0000000000aa";

beforeEach(() => {
  vi.mocked(requireAdminCached).mockResolvedValue({
    id: ADMIN_ID,
  } as unknown as Awaited<ReturnType<typeof requireAdminCached>>);
  // safe() logs unexpected failures; keep the test output quiet.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("createManualSnapshotAction", () => {
  it("creates manual snapshots without applying interest (happy path)", async () => {
    vi.mocked(createManualSnapshotsForAllPortfolios).mockResolvedValueOnce({
      snapshotsCreated: 3,
      totalValue: 12345.67,
      portfoliosProcessed: 5,
    });

    const date = new Date("2026-01-15T00:00:00Z");
    const result = await createManualSnapshotAction({
      date,
      applyInterest: false,
      source: "manual",
    });

    expect(result).toEqual({
      success: true,
      data: { totalValue: 12345.67, snapshotsCreated: 3 },
    });
    expect(requireAdminCached).toHaveBeenCalledTimes(1);
    expect(applyMonthlyInterest).not.toHaveBeenCalled();
    expect(createManualSnapshotsForAllPortfolios).toHaveBeenCalledWith(
      date,
      "manual",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/portal/portfolio");
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("applies monthly interest first when applyInterest=true", async () => {
    vi.mocked(applyMonthlyInterest).mockResolvedValueOnce({
      portfoliosProcessed: 2,
      totalInterestApplied: 50,
    } as unknown as Awaited<ReturnType<typeof applyMonthlyInterest>>);
    vi.mocked(createManualSnapshotsForAllPortfolios).mockResolvedValueOnce({
      snapshotsCreated: 2,
      totalValue: 500,
      portfoliosProcessed: 2,
    });

    const date = new Date("2026-02-01T00:00:00Z");
    const result = await createManualSnapshotAction({
      date,
      applyInterest: true,
      source: "admin_enforce",
    });

    expect(result).toEqual({
      success: true,
      data: { totalValue: 500, snapshotsCreated: 2 },
    });
    expect(applyMonthlyInterest).toHaveBeenCalledWith(date);
    expect(createManualSnapshotsForAllPortfolios).toHaveBeenCalledWith(
      date,
      "admin_enforce",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/portal/portfolio");
  });

  it("fails generically when the caller is not an admin and skips all work", async () => {
    vi.mocked(requireAdminCached).mockRejectedValueOnce(
      new Error("Forbidden: Admin access required"),
    );

    await expect(
      createManualSnapshotAction({
        date: new Date("2026-01-15T00:00:00Z"),
        applyInterest: false,
        source: "manual",
      }),
    ).resolves.toEqual({ success: false, error: "Action failed" });

    expect(applyMonthlyInterest).not.toHaveBeenCalled();
    expect(createManualSnapshotsForAllPortfolios).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a validation error when date is missing", async () => {
    await expect(
      createManualSnapshotAction({
        applyInterest: false,
        source: "manual",
      } as never),
    ).resolves.toMatchObject({ success: false });

    expect(applyMonthlyInterest).not.toHaveBeenCalled();
    expect(createManualSnapshotsForAllPortfolios).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a validation error when source is not a snapshot source", async () => {
    await expect(
      createManualSnapshotAction({
        date: new Date("2026-01-15T00:00:00Z"),
        applyInterest: false,
        source: "totally-bogus-source",
      } as never),
    ).resolves.toMatchObject({ success: false });

    expect(createManualSnapshotsForAllPortfolios).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("does not revalidate when the snapshot service throws", async () => {
    vi.mocked(createManualSnapshotsForAllPortfolios).mockRejectedValueOnce(
      new Error("pg boom"),
    );

    await expect(
      createManualSnapshotAction({
        date: new Date("2026-01-15T00:00:00Z"),
        applyInterest: false,
        source: "manual",
      }),
    ).resolves.toEqual({ success: false, error: "Action failed" });

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteManualSnapshotsAction", () => {
  it("deletes manual snapshots and revalidates the portfolio page", async () => {
    vi.mocked(deleteManualSnapshotsForAllPortfolios).mockResolvedValueOnce({
      portfoliosProcessed: 4,
    } as unknown as Awaited<ReturnType<typeof deleteManualSnapshotsForAllPortfolios>>);

    const result = await deleteManualSnapshotsAction();

    expect(result).toEqual({ success: true, data: { portfoliosProcessed: 4 } });
    expect(requireAdminCached).toHaveBeenCalledTimes(1);
    expect(deleteManualSnapshotsForAllPortfolios).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/portal/portfolio");
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("fails generically without deleting when the caller is not an admin", async () => {
    vi.mocked(requireAdminCached).mockRejectedValueOnce(
      new Error("Forbidden: Admin access required"),
    );

    await expect(deleteManualSnapshotsAction()).resolves.toEqual({
      success: false,
      error: "Action failed",
    });

    expect(deleteManualSnapshotsForAllPortfolios).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("does not revalidate when the service throws", async () => {
    vi.mocked(deleteManualSnapshotsForAllPortfolios).mockRejectedValueOnce(
      new Error("pg boom"),
    );

    await expect(deleteManualSnapshotsAction()).resolves.toEqual({
      success: false,
      error: "Action failed",
    });

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
