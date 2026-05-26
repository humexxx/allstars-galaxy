import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/impersonation", () => ({
  requireEffectiveContext: vi.fn(),
  logImpersonatedMutation: vi.fn(),
}));

vi.mock("@/lib/services/sports-service", () => ({
  setSportFavorite: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import { setSportFavorite } from "@/lib/services/sports-service";

import { setSportFavoriteAction } from "./sports";

const USER_ID = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  vi.mocked(requireEffectiveContext).mockResolvedValue({
    realUser: { id: USER_ID } as never,
    realRole: "user",
    impersonatedUser: null,
    effectiveUserId: USER_ID,
    isImpersonating: false,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("setSportFavoriteAction", () => {
  it("upserts the favourite when isFavorite=true", async () => {
    const result = await setSportFavoriteAction({
      sportId: "football",
      isFavorite: true,
    });

    expect(result).toEqual({ success: true });
    expect(setSportFavorite).toHaveBeenCalledWith(USER_ID, "football", true);
    expect(logImpersonatedMutation).toHaveBeenCalledWith({
      action: "sportFavorite.add",
      entityTable: "user_sports_preferences",
      metadata: { sportId: "football" },
    });
  });

  it("deletes the favourite when isFavorite=false", async () => {
    const result = await setSportFavoriteAction({
      sportId: "nba",
      isFavorite: false,
    });

    expect(result).toEqual({ success: true });
    expect(setSportFavorite).toHaveBeenCalledWith(USER_ID, "nba", false);
    expect(logImpersonatedMutation).toHaveBeenCalledWith({
      action: "sportFavorite.remove",
      entityTable: "user_sports_preferences",
      metadata: { sportId: "nba" },
    });
  });

  it("revalidates both the sports page and the dashboard on success", async () => {
    await setSportFavoriteAction({ sportId: "f1", isFavorite: true });

    expect(revalidatePath).toHaveBeenCalledWith("/portal/entertainment/sports");
    expect(revalidatePath).toHaveBeenCalledWith("/portal");
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("rejects unknown sportIds via the zod schema", async () => {
    const result = await setSportFavoriteAction({
      sportId: "cricket" as never,
      isFavorite: true,
    });

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(setSportFavorite).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects malformed payloads (missing isFavorite)", async () => {
    const result = await setSportFavoriteAction({
      sportId: "football",
    } as never);

    expect(result).toEqual({ success: false, error: "Invalid input" });
    expect(setSportFavorite).not.toHaveBeenCalled();
  });

  it("surfaces unauthenticated requests as a thrown error swallowed by safe()", async () => {
    vi.mocked(requireEffectiveContext).mockRejectedValueOnce(
      new Error("Unauthorized")
    );

    const result = await setSportFavoriteAction({
      sportId: "football",
      isFavorite: true,
    });

    expect(result).toEqual({ success: false, error: "Action failed" });
    expect(setSportFavorite).not.toHaveBeenCalled();
  });

  it("swallows service-layer failures into the error envelope", async () => {
    vi.mocked(setSportFavorite).mockRejectedValueOnce(new Error("pg boom"));

    const result = await setSportFavoriteAction({
      sportId: "football",
      isFavorite: true,
    });

    expect(result).toEqual({ success: false, error: "Action failed" });
    // revalidate is only called after the service succeeds.
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("uses the impersonated effectiveUserId, not the admin's real id", async () => {
    const IMPERSONATED = "11111111-1111-1111-1111-111111111111";
    vi.mocked(requireEffectiveContext).mockResolvedValueOnce({
      realUser: { id: USER_ID } as never,
      realRole: "admin",
      impersonatedUser: {
        id: IMPERSONATED,
        email: "x@y.com",
        fullName: "X",
      },
      effectiveUserId: IMPERSONATED,
      isImpersonating: true,
    });

    await setSportFavoriteAction({ sportId: "padel", isFavorite: true });

    expect(setSportFavorite).toHaveBeenCalledWith(IMPERSONATED, "padel", true);
  });
});
