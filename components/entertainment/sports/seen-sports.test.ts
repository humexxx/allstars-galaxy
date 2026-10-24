import { beforeEach, describe, expect, it } from "vitest";

import { NBA_DATA } from "@/lib/data/sports/nba";
import type { SavedTeamFilter } from "@/types/sports";

import {
  forgetSeenSports,
  recallSport,
  rememberSport,
  rememberTeams,
  SEEN_MS,
  seenKey,
} from "./seen-sports";

const nbaList: SavedTeamFilter["list"] = { sportId: "nba", competition: "nba" };
const entry = (teamIds: string[] = []) => ({
  payload: { sport: "nba" as const, data: NBA_DATA },
  teamFilter: { list: nbaList, teamIds },
  today: "2026-10-23",
});

beforeEach(() => {
  forgetSeenSports();
});

describe("seen sports", () => {
  it("keys a sport by the address that asked for it", () => {
    expect(seenKey("nba", null)).toBe("nba|");
    expect(seenKey("football", "la-liga")).toBe("football|la-liga");
  });

  it("gives back a copy for half an hour, then forgets it", () => {
    rememberSport("me", "nba|", entry(), 0);
    expect(recallSport("me", "nba|", SEEN_MS)?.today).toBe("2026-10-23");
    expect(recallSport("me", "nba|", SEEN_MS + 1)).toBeUndefined();
    expect(recallSport("me", "nba|", 0)).toBeUndefined();
  });

  it("is emptied when another account is looked at", () => {
    rememberSport("admin", "nba|", entry());
    expect(recallSport("client", "nba|")).toBeUndefined();
    expect(recallSport("admin", "nba|")).toBeUndefined();
  });

  it("carries a team pick just saved into every copy of that list", () => {
    rememberSport("me", "nba|", entry(["PHI"]));
    rememberSport("me", "f1|", { ...entry(), teamFilter: null });
    rememberTeams(nbaList, ["PHI", "BOS"]);
    expect(recallSport("me", "nba|")?.teamFilter?.teamIds).toEqual(["PHI", "BOS"]);
    expect(recallSport("me", "f1|")?.teamFilter).toBeNull();
  });
});
