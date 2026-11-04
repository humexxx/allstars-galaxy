import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/auth-server", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/services/padel-api-service", () => ({
  getPadelDraw: vi.fn(),
}));

vi.mock("@/lib/services/espn-tennis-service", () => ({
  getTennisDraw: vi.fn(),
}));

import { requireAuth } from "@/lib/services/auth-server";
import { getTennisDraw } from "@/lib/services/espn-tennis-service";
import { getPadelDraw } from "@/lib/services/padel-api-service";
import type { RacquetDraw } from "@/types/sports";

import { getRacquetDrawAction } from "./racquet";

const DRAW: RacquetDraw = { tournamentId: "padelapi-747", rounds: [], players: [] };

beforeEach(() => {
  vi.mocked(requireAuth).mockResolvedValue({ id: "user-1" } as never);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getRacquetDrawAction", () => {
  it("reads a padel draw", async () => {
    vi.mocked(getPadelDraw).mockResolvedValue(DRAW);
    const result = await getRacquetDrawAction({ sport: "padel", tournamentId: "padelapi-747" });
    expect(result).toEqual({ success: true, data: DRAW });
    expect(getPadelDraw).toHaveBeenCalledWith("padelapi-747");
    expect(getTennisDraw).not.toHaveBeenCalled();
  });

  it("reads a tennis draw", async () => {
    const draw = { ...DRAW, tournamentId: "espn-315-2026-mens-singles" };
    vi.mocked(getTennisDraw).mockResolvedValue(draw);
    const result = await getRacquetDrawAction({ sport: "tennis", tournamentId: "espn-315-2026-mens-singles" });
    expect(result).toEqual({ success: true, data: draw });
    expect(getTennisDraw).toHaveBeenCalledWith("espn-315-2026-mens-singles");
  });

  it.each([
    ["an id of the other sport's shape", { sport: "padel", tournamentId: "espn-315-2026-mens-singles" }],
    ["a women's draw", { sport: "tennis", tournamentId: "espn-315-2026-womens-singles" }],
    ["an unknown sport", { sport: "squash", tournamentId: "padelapi-1" }],
    ["a path in the id", { sport: "padel", tournamentId: "padelapi-1/../../rankings" }],
  ])("refuses %s before any provider is asked", async (_label, input) => {
    // A server action is a public POST endpoint; the argument is whatever was sent.
    const result = await getRacquetDrawAction(input as never);
    expect(result).toEqual({ success: false, error: "Tournament not found" });
    expect(getPadelDraw).not.toHaveBeenCalled();
    expect(getTennisDraw).not.toHaveBeenCalled();
  });

  it("says so when the draw is not on the calendar or the provider failed", async () => {
    vi.mocked(getPadelDraw).mockResolvedValue(null);
    const result = await getRacquetDrawAction({ sport: "padel", tournamentId: "padelapi-1" });
    expect(result).toEqual({ success: false, error: "The draw could not be loaded" });
  });

  it("asks nothing of a provider for somebody signed out", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error("Unauthorized"));
    const result = await getRacquetDrawAction({ sport: "padel", tournamentId: "padelapi-747" });
    expect(result).toEqual({ success: false, error: "Action failed" });
    expect(getPadelDraw).not.toHaveBeenCalled();
  });
});
