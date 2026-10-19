import { describe, expect, it } from "vitest";

import { __testing } from "./lolesports-service";

const { buildLolBracket, isBracketStage, isCurrentEvent, pickActiveTournament, withinTournament } =
  __testing;

const team = (code: string, gameWins?: number) => ({
  name: code,
  code,
  result: gameWins === undefined ? null : { gameWins },
});

const tie = (id: string, home: string, away: string, score?: [number, number]) => ({
  id,
  teams: [team(home, score?.[0]), team(away, score?.[1])],
});

describe("buildLolBracket", () => {
  // Worlds 2026's knockouts as the API sends them: ONE section, seven
  // matches, nobody drawn yet. The schedule names each match's block.
  const knockouts = {
    name: "Knockouts",
    matches: ["q1", "q2", "q3", "q4", "s1", "s2", "f"].map((id) => tie(id, "TBD", "TBD")),
  };
  const blocks = new Map([
    ["q1", "Quarterfinals"],
    ["q2", "Quarterfinals"],
    ["q3", "Quarterfinals"],
    ["q4", "Quarterfinals"],
    ["s1", "Semifinals"],
    ["s2", "Semifinals"],
    ["f", "Finals"],
  ]);

  it("splits a one-section playoff into the schedule's rounds", () => {
    const rounds = buildLolBracket([knockouts], blocks);
    expect(rounds.map((r) => [r.id, r.label, r.matches.length])).toEqual([
      ["quarter-final", "Quarterfinals", 4],
      ["semi-final", "Semifinals", 2],
      ["final", "Finals", 1],
    ]);
  });

  it("gives a regional playoff its final as its own round", () => {
    // LEC Split 3 2026: eight matches in one "Playoffs" section, the last
    // one scheduled as "Finals". It used to render as one column of eight.
    const section = {
      name: "Playoffs",
      matches: [
        tie("1", "KC", "GX", [3, 1]),
        tie("2", "G2", "VIT", [3, 0]),
        tie("8", "G2", "MKOI", [3, 0]),
      ],
    };
    const rounds = buildLolBracket(
      [section],
      new Map([
        ["1", "Playoffs"],
        ["2", "Playoffs"],
        ["8", "Finals"],
      ])
    );
    expect(rounds.map((r) => r.label)).toEqual(["Playoffs", "Finals"]);
    expect(rounds[1].matches[0]).toMatchObject({ winnerTeamId: "g2", homeScore: 3, awayScore: 0 });
  });

  it("keeps the section whole when the schedule says nothing about it", () => {
    expect(buildLolBracket([knockouts]).map((r) => r.label)).toEqual(["Knockouts"]);
  });

  it("keeps the section whole when its blocks interleave", () => {
    const rounds = buildLolBracket(
      [knockouts],
      new Map([
        ["q1", "Upper"],
        ["q2", "Lower"],
        ["q3", "Upper"],
      ])
    );
    expect(rounds.map((r) => r.label)).toEqual(["Knockouts"]);
  });
});

describe("isBracketStage", () => {
  it("draws the playoff stages, whatever the league calls them", () => {
    expect(isBracketStage("playoffs")).toBe(true);
    expect(isBracketStage("knockouts")).toBe(true);
    // LCK's playoff for Worlds seeding.
    expect(isBracketStage("regional_championship")).toBe(true);
  });

  it("leaves out the stages that are not a round of the bracket", () => {
    expect(isBracketStage("play_ins")).toBe(false);
    expect(isBracketStage("playoff_play_in_knights_rival")).toBe(false);
    expect(isBracketStage("swiss")).toBe(false);
    expect(isBracketStage("regular_season")).toBe(false);
  });
});

describe("isCurrentEvent", () => {
  const worlds = { id: "w", slug: "worlds_2026", startDate: "2026-10-15", endDate: "2026-11-15" };

  it("shows an international event while it is on", () => {
    expect(isCurrentEvent(worlds, "2026-10-18")).toBe(true);
  });

  it("keeps it for three weeks after the final, then lets it go", () => {
    expect(isCurrentEvent(worlds, "2026-12-06")).toBe(true);
    expect(isCurrentEvent(worlds, "2026-12-07")).toBe(false);
  });

  it("never shows one that has not started", () => {
    expect(isCurrentEvent(worlds, "2026-10-14")).toBe(false);
    expect(isCurrentEvent(null, "2026-10-18")).toBe(false);
  });
});

describe("pickActiveTournament", () => {
  it("falls back to the split that ended most recently", () => {
    const picked = pickActiveTournament(
      [
        { id: "2", slug: "lec_split_2_2026", startDate: "2026-03-27", endDate: "2026-06-07" },
        { id: "3", slug: "lec_split_3_2026", startDate: "2026-07-23", endDate: "2026-09-20" },
      ],
      "2026-10-18"
    );
    expect(picked?.id).toBe("3");
  });
});

describe("withinTournament", () => {
  const split = { id: "3", slug: "lec_split_3_2026", startDate: "2026-07-23", endDate: "2026-09-20" };

  it("drops another tournament's matches off the same schedule page", () => {
    expect(withinTournament("2026-04-20T17:15:00Z", split)).toBe(false);
    expect(withinTournament("2026-09-20T15:00:00Z", split)).toBe(true);
  });

  it("allows a day either side for time zones", () => {
    expect(withinTournament("2026-09-21T02:00:00Z", split)).toBe(true);
  });
});
