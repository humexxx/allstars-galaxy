import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/auth-server", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/services/lolesports-service", () => ({
  getLolSplit: vi.fn(),
}));

import { requireAuth } from "@/lib/services/auth-server";
import { getLolSplit } from "@/lib/services/lolesports-service";
import type { LolSplit } from "@/types/sports";

import { getLolSplitAction } from "./lol";

const SPLIT: LolSplit = {
  region: "lck",
  name: "LCK Split 1",
  season: "2026",
  tournamentId: "115548106590082745",
  teams: [],
  standings: [],
  matches: [],
};

beforeEach(() => {
  vi.mocked(requireAuth).mockResolvedValue({ id: "user-1" } as never);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getLolSplitAction", () => {
  it("reads another of a league's splits", async () => {
    vi.mocked(getLolSplit).mockResolvedValue(SPLIT);
    const result = await getLolSplitAction({ region: "lck", tournamentId: "115548106590082745" });
    expect(result).toEqual({ success: true, data: SPLIT });
    expect(getLolSplit).toHaveBeenCalledWith("lck", "115548106590082745");
  });

  it.each([
    ["an international event", { region: "worlds", tournamentId: "115660540725177488" }],
    ["an id that is not Lolesports' shape", { region: "lck", tournamentId: "lck_split_1/../standings" }],
  ])("refuses %s before Lolesports is asked", async (_label, input) => {
    // A server action is a public POST endpoint; the argument is whatever was sent.
    const result = await getLolSplitAction(input as never);
    expect(result).toEqual({ success: false, error: "Split not found" });
    expect(getLolSplit).not.toHaveBeenCalled();
  });

  it("says so when the split is not this season's or Lolesports failed", async () => {
    vi.mocked(getLolSplit).mockResolvedValue(null);
    const result = await getLolSplitAction({ region: "lck", tournamentId: "115548106590082745" });
    expect(result).toEqual({ success: false, error: "The split could not be loaded" });
  });

  it("asks Lolesports nothing for somebody signed out", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error("Unauthorized"));
    const result = await getLolSplitAction({ region: "lck", tournamentId: "115548106590082745" });
    expect(result).toEqual({ success: false, error: "Action failed" });
    expect(getLolSplit).not.toHaveBeenCalled();
  });
});
