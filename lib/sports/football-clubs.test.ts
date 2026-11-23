import { describe, expect, it } from "vitest";

import type { FootballLeagueData, FootballLeagueId, Match, Team } from "@/types/sports";

import { clubMatchesAcross, competitionStage, mergeClubMatches, withRegionalDerbies } from "./football-clubs";

const team = (id: string, name: string): Team => ({ id, name, shortName: name, code: id.toUpperCase() });

const game = (id: string, home: string, away: string, kickoff: string, stageLabel?: string): Match => ({
  id,
  homeTeamId: home,
  awayTeamId: away,
  homeScore: null,
  awayScore: null,
  kickoff,
  status: "scheduled",
  ...(stageLabel ? { stageLabel } : {}),
});

function competition(
  id: FootballLeagueId,
  shortName: string,
  teams: Team[],
  matches: Match[],
  providerTeamIds: Record<string, string>
): FootballLeagueData {
  return {
    league: { id, name: shortName, shortName, region: "CONCACAF", hasKnockout: true, season: "2026" },
    teams,
    matches,
    standings: [],
    providerTeamIds,
  };
}

// Costa Rica's league and the Central American Cup as ESPN keys them: the cup
// spells two clubs the same ("her" twice), so it tells them apart by number.
const COSTA_RICA = competition(
  "costa-rica",
  "Primera División",
  [team("ala", "Alajuelense"), team("car", "Cartaginés"), team("her", "Herediano")],
  [game("l1", "car", "ala", "2026-11-24T02:00:00Z"), game("l2", "her", "car", "2026-11-28T02:00:00Z")],
  { ala: "2057", car: "7239", her: "862" }
);

const CENTRAL_AMERICAN_CUP = competition(
  "concacaf-central-american-cup",
  "Central American Cup",
  [team("ala", "Alajuelense"), team("car", "Cartaginés"), team("mot", "Motagua"), team("her-131206", "Hércules")],
  [
    game("c1", "ala", "mot", "2026-10-30T02:00:00Z", "Semi-final · Leg 2"),
    game("c2", "ala", "car", "2026-12-03T01:00:00Z", "Final · Leg 1"),
    game("c3", "her-131206", "mot", "2026-08-13T02:00:00Z", "Group B"),
  ],
  { ala: "2057", car: "7239", mot: "7242", "her-131206": "131206" }
);

describe("withRegionalDerbies", () => {
  it("lists a cup game between two of the league's clubs, under the league's ids and the cup's name", () => {
    const data = withRegionalDerbies(COSTA_RICA, [CENTRAL_AMERICAN_CUP]);
    const final = data.matches.find((m) => m.id === "concacaf-central-american-cup:c2");
    expect(final).toMatchObject({
      homeTeamId: "ala",
      awayTeamId: "car",
      kickoff: "2026-12-03T01:00:00Z",
      stageLabel: "Central American Cup · Final · Leg 1",
    });
    // Alajuelense v Motagua names a club the league's table does not.
    expect(data.matches.some((m) => m.id.endsWith(":c1"))).toBe(false);
    expect(data.teams).toBe(COSTA_RICA.teams);
  });

  it("hands the league back as it was with no such game", () => {
    expect(withRegionalDerbies(COSTA_RICA, [])).toBe(COSTA_RICA);
  });
});

describe("clubMatchesAcross", () => {
  it("finds a club in every competition by its provider's number, each game led by its competition", () => {
    const club = clubMatchesAcross(COSTA_RICA, [CENTRAL_AMERICAN_CUP], ["ala"]);
    expect(club.teamIds).toEqual(["ala"]);
    const byId = new Map(club.matches.map((m) => [m.id, m]));
    expect(byId.get("l1")?.stageLabel).toBe("Primera División");
    expect(byId.get("concacaf-central-american-cup:c1")).toMatchObject({
      homeTeamId: "ala",
      awayTeamId: "concacaf-central-american-cup:mot",
      stageLabel: "Central American Cup · Semi-final · Leg 2",
    });
    expect(byId.get("concacaf-central-american-cup:c2")).toMatchObject({ homeTeamId: "ala", awayTeamId: "car" });
    expect(club.matches).toHaveLength(3);
    // The cup's Motagua is named apart from the league's clubs.
    expect(club.teams.find((t) => t.id === "concacaf-central-american-cup:mot")?.name).toBe("Motagua");
  });

  it("does not take another club of the same abbreviation for the one picked", () => {
    const club = clubMatchesAcross(COSTA_RICA, [CENTRAL_AMERICAN_CUP], ["her"]);
    expect(club.matches.map((m) => m.id)).toEqual(["l2"]);
  });

  it("reads a cup game the league already lists from the cup, once", () => {
    const home = withRegionalDerbies(COSTA_RICA, [CENTRAL_AMERICAN_CUP]);
    const club = clubMatchesAcross(home, [CENTRAL_AMERICAN_CUP], ["car"]);
    const finals = club.matches.filter((m) => m.id.endsWith(":c2"));
    expect(finals).toHaveLength(1);
    expect(finals[0].stageLabel).toBe("Central American Cup · Final · Leg 1");
    // Without the cup loaded, the league's copy stands as it was labelled.
    const alone = clubMatchesAcross(home, [], ["car"]);
    expect(alone.matches.find((m) => m.id.endsWith(":c2"))?.stageLabel).toBe("Central American Cup · Final · Leg 1");
  });
});

describe("mergeClubMatches", () => {
  it("lists each game once, for the clubs asked for", () => {
    const shared = game("m-1", "a", "b", "2026-11-24T20:00:00Z");
    const merged = mergeClubMatches(
      ["a", "b"],
      [
        { teamIds: ["a"], teams: [team("a", "A"), team("b", "B")], matches: [shared] },
        { teamIds: ["b"], teams: [team("b", "B")], matches: [shared, game("m-2", "b", "c", "2026-11-28T20:00:00Z")] },
      ]
    );
    expect(merged.teamIds).toEqual(["a", "b"]);
    expect(merged.matches.map((m) => m.id)).toEqual(["m-1", "m-2"]);
    expect(merged.teams.map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("competitionStage", () => {
  it("leads a stage with its competition, or says the competition alone", () => {
    expect(competitionStage("UCL", "Matchday 5")).toBe("UCL · Matchday 5");
    expect(competitionStage("La Liga", undefined)).toBe("La Liga");
  });
});
