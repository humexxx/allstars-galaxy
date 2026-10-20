import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/services/impersonation", () => ({
  requireEffectiveContext: vi.fn(),
  logImpersonatedMutation: vi.fn(),
}));

vi.mock("@/lib/services/travel-assistant-service", () => {
  class TravelChangeError extends Error {}
  return { TravelChangeError, applyTravelChanges: vi.fn(), undoTravelChanges: vi.fn() };
});

import { revalidatePath } from "next/cache";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import {
  applyTravelChanges,
  TravelChangeError,
  undoTravelChanges,
} from "@/lib/services/travel-assistant-service";

import { applyTravelChangesAction, undoTravelChangesAction } from "./travel-assistant";

const TRIP = "22222222-2222-4222-8222-222222222222";
const SET = {
  summary: "Tickets",
  changes: [{ op: "add_item" as const, tripId: TRIP, item: { title: "Universal", category: "activity" as const } }],
};

const as = (realRole: string): void => {
  vi.mocked(requireEffectiveContext).mockResolvedValue({
    effectiveUserId: "user-1",
    realRole,
  } as Awaited<ReturnType<typeof requireEffectiveContext>>);
};

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
});

describe("applyTravelChangesAction", () => {
  it("applies an approved proposal for the effective user and refreshes Travel", async () => {
    as("admin");
    vi.mocked(applyTravelChanges).mockResolvedValue({ lines: [], undoToken: "t" });
    const result = await applyTravelChangesAction(SET);
    expect(result).toEqual({ success: true, data: { lines: [], undoToken: "t" } });
    expect(applyTravelChanges).toHaveBeenCalledWith("user-1", expect.objectContaining({ summary: "Tickets" }));
    expect(revalidatePath).toHaveBeenCalledWith("/portal/entertainment/travel-planner", "layout");
  });

  it("is not open to accounts that are not admins", async () => {
    as("user");
    const result = await applyTravelChangesAction(SET);
    expect(result).toEqual({ success: false, error: "The travel assistant is not available" });
    expect(applyTravelChanges).not.toHaveBeenCalled();
  });

  it("is off on a server with no API key", async () => {
    as("admin");
    delete process.env.ANTHROPIC_API_KEY;
    expect((await applyTravelChangesAction(SET)).success).toBe(false);
  });

  it("passes a refusal through as the message to show", async () => {
    as("admin");
    vi.mocked(applyTravelChanges).mockRejectedValue(new TravelChangeError("Change 1 (add_item): trip not found"));
    expect(await applyTravelChangesAction(SET)).toEqual({
      success: false,
      error: "Change 1 (add_item): trip not found",
    });
  });

  it("re-checks the proposal instead of trusting the card", async () => {
    as("admin");
    const result = await applyTravelChangesAction({ summary: "x", changes: [] });
    expect(result.success).toBe(false);
    expect(applyTravelChanges).not.toHaveBeenCalled();
  });
});

describe("undoTravelChangesAction", () => {
  it("undoes with the receipt and refreshes Travel", async () => {
    as("admin");
    vi.mocked(undoTravelChanges).mockResolvedValue();
    expect(await undoTravelChangesAction("token")).toEqual({ success: true });
    expect(undoTravelChanges).toHaveBeenCalledWith("user-1", "token");
    expect(revalidatePath).toHaveBeenCalled();
  });
});
