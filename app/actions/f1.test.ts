import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/auth-server", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/services/jolpica-f1-service", () => ({
  getF1RaceClassification: vi.fn(),
}));

import { requireAuth } from "@/lib/services/auth-server";
import { getF1RaceClassification } from "@/lib/services/jolpica-f1-service";
import type { F1RaceClassification } from "@/types/sports";

import { getF1RaceClassificationAction } from "./f1";

const CLASSIFICATION: F1RaceClassification = {
  season: 2026,
  round: 17,
  rows: [
    {
      position: "1",
      code: "VER",
      name: "M. Verstappen",
      team: "Red Bull",
      grid: 1,
      laps: 62,
      result: "1:42:00.785",
      points: 25,
    },
  ],
};

beforeEach(() => {
  vi.mocked(requireAuth).mockResolvedValue({ id: "user-1" } as never);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getF1RaceClassificationAction", () => {
  it("returns the race's classification", async () => {
    vi.mocked(getF1RaceClassification).mockResolvedValueOnce(CLASSIFICATION);

    const result = await getF1RaceClassificationAction({ season: 2026, round: 17 });

    expect(result).toEqual({ success: true, data: CLASSIFICATION });
    expect(getF1RaceClassification).toHaveBeenCalledWith(2026, 17);
  });

  it("says so when Jolpica has nothing for the race yet", async () => {
    vi.mocked(getF1RaceClassification).mockResolvedValueOnce(null);

    const result = await getF1RaceClassificationAction({ season: 2026, round: 18 });

    expect(result).toEqual({ success: false, error: "The classification isn't available yet" });
  });

  it.each([
    [{ season: 2026, round: 0 }],
    [{ season: 2026, round: 1.5 }],
    [{ season: 1900, round: 3 }],
    [{ season: "2026/../drivers", round: 1 }],
  ])("refuses %j before it reaches the provider", async (input) => {
    const result = await getF1RaceClassificationAction(input as never);

    expect(result).toEqual({ success: false, error: "Invalid race" });
    expect(getF1RaceClassification).not.toHaveBeenCalled();
  });

  it("refuses somebody who is not signed in", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error("Unauthorized"));

    const result = await getF1RaceClassificationAction({ season: 2026, round: 17 });

    expect(result).toEqual({ success: false, error: "Action failed" });
    expect(getF1RaceClassification).not.toHaveBeenCalled();
  });
});
