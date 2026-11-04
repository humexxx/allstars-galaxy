import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  refresh: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/impersonation", () => ({
  requireEffectiveContext: vi.fn(),
  logImpersonatedMutation: vi.fn(),
}));

vi.mock("@/lib/services/sports-service", () => ({
  setSportFavorite: vi.fn(),
  setSportCompetition: vi.fn(),
  setSportTeamFilter: vi.fn(),
}));

import { refresh, revalidatePath } from "next/cache";
import {
  logImpersonatedMutation,
  requireEffectiveContext,
} from "@/lib/services/impersonation";
import {
  setSportCompetition,
  setSportFavorite,
  setSportTeamFilter,
} from "@/lib/services/sports-service";

import {
  setSportCompetitionAction,
  setSportFavoriteAction,
  setSportTeamFilterAction,
} from "./sports";

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

describe("setSportCompetitionAction", () => {
  const ROW = {
    id: "22222222-2222-2222-2222-222222222222",
    userId: USER_ID,
    sportId: "lol",
    competition: "lck",
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.mocked(setSportCompetition).mockResolvedValue(ROW);
  });

  it("stores the championship on the caller's favourite and refreshes the dashboard", async () => {
    const result = await setSportCompetitionAction({ sportId: "lol", competition: "lck" });

    expect(result).toEqual({ success: true });
    expect(setSportCompetition).toHaveBeenCalledWith(USER_ID, "lol", "lck");
    expect(logImpersonatedMutation).toHaveBeenCalledWith({
      action: "sportFavorite.competition",
      entityTable: "user_sports_preferences",
      entityId: ROW.id,
      metadata: { sportId: "lol", competition: "lck" },
    });
    // Re-rendered, not revalidated: expiring /portal would expire the cached
    // provider feeds the dashboard reads along with it.
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("stores null to hand the card back its own pick", async () => {
    const result = await setSportCompetitionAction({ sportId: "lol", competition: null });

    expect(result).toEqual({ success: true });
    expect(setSportCompetition).toHaveBeenCalledWith(USER_ID, "lol", null);
  });

  it.each([
    [{ sportId: "football", competition: "lck" }],
    // Men only: tennis and padel have no tour to pick.
    [{ sportId: "tennis", competition: "wta" }],
    [{ sportId: "padel", competition: "women" }],
    [{ sportId: "football", competition: "eredivisie" }],
    [{ sportId: "nba", competition: null }],
    [{ sportId: "cricket", competition: null }],
    [{ sportId: "padel" }],
  ])("refuses %j through the zod schema", async (input) => {
    const result = await setSportCompetitionAction(input as never);

    expect(result).toEqual({ success: false, error: "Unknown championship" });
    expect(setSportCompetition).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says so when the sport is not a favourite, and refreshes nothing", async () => {
    vi.mocked(setSportCompetition).mockResolvedValueOnce(null);

    const result = await setSportCompetitionAction({ sportId: "lol", competition: "lpl" });

    expect(result).toEqual({ success: false, error: "Add this sport to your favorites first" });
    expect(logImpersonatedMutation).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("turns an unauthenticated request into the generic error, before validating", async () => {
    vi.mocked(requireEffectiveContext).mockRejectedValueOnce(new Error("Unauthorized"));

    const result = await setSportCompetitionAction({ sportId: "lol", competition: "lck" });

    expect(result).toEqual({ success: false, error: "Action failed" });
    expect(setSportCompetition).not.toHaveBeenCalled();
  });

  it("swallows a service failure into the error envelope", async () => {
    vi.mocked(setSportCompetition).mockRejectedValueOnce(new Error("pg boom"));

    const result = await setSportCompetitionAction({ sportId: "lol", competition: "lck" });

    expect(result).toEqual({ success: false, error: "Action failed" });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("sets the impersonated user's card, not the admin's", async () => {
    const IMPERSONATED = "11111111-1111-1111-1111-111111111111";
    vi.mocked(requireEffectiveContext).mockResolvedValueOnce({
      realUser: { id: USER_ID } as never,
      realRole: "admin",
      impersonatedUser: { id: IMPERSONATED, email: "x@y.com", fullName: "X" },
      effectiveUserId: IMPERSONATED,
      isImpersonating: true,
    });

    await setSportCompetitionAction({ sportId: "football", competition: "la-liga" });

    expect(setSportCompetition).toHaveBeenCalledWith(IMPERSONATED, "football", "la-liga");
  });
});

describe("setSportTeamFilterAction", () => {
  it("remembers the caller's teams for that list and re-renders the page", async () => {
    vi.mocked(setSportTeamFilter).mockResolvedValueOnce({
      id: "f",
      teamIds: ["arsenal", "chelsea"],
    } as never);

    const result = await setSportTeamFilterAction({
      sportId: "football",
      competition: "premier-league",
      teamIds: ["arsenal", "chelsea"],
    });

    expect(result).toEqual({ success: true });
    expect(setSportTeamFilter).toHaveBeenCalledWith(
      USER_ID,
      { sportId: "football", competition: "premier-league" },
      ["arsenal", "chelsea"]
    );
    expect(logImpersonatedMutation).toHaveBeenCalledWith({
      action: "sportTeamFilter.set",
      entityTable: "user_sports_team_filters",
      entityId: "f",
      metadata: { sportId: "football", competition: "premier-league", teams: 2 },
    });
    // A re-render, not revalidatePath: that would expire the provider feeds.
    expect(refresh).toHaveBeenCalledOnce();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("clears the list back to every team", async () => {
    vi.mocked(setSportTeamFilter).mockResolvedValueOnce(null);

    const result = await setSportTeamFilterAction({ sportId: "nba", competition: "nba", teamIds: [] });

    expect(result).toEqual({ success: true });
    expect(setSportTeamFilter).toHaveBeenCalledWith(USER_ID, { sportId: "nba", competition: "nba" }, []);
  });

  it("refuses a list that is not the sport's", async () => {
    const result = await setSportTeamFilterAction({
      sportId: "nba",
      competition: "premier-league",
      teamIds: [],
    } as never);

    expect(result).toEqual({ success: false, error: "Invalid team filter" });
    expect(setSportTeamFilter).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("writes the impersonated user's teams, not the admin's", async () => {
    const IMPERSONATED = "11111111-1111-1111-1111-111111111111";
    vi.mocked(requireEffectiveContext).mockResolvedValueOnce({
      realUser: { id: USER_ID } as never,
      realRole: "admin",
      impersonatedUser: { id: IMPERSONATED, email: "x@y.com", fullName: "X" },
      effectiveUserId: IMPERSONATED,
      isImpersonating: true,
    });

    await setSportTeamFilterAction({ sportId: "nfl", competition: "nfl", teamIds: ["kc"] });

    expect(setSportTeamFilter).toHaveBeenCalledWith(IMPERSONATED, { sportId: "nfl", competition: "nfl" }, ["kc"]);
  });
});
