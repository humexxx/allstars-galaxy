import { describe, expect, it } from "vitest";

import { __testing } from "./lolesports-service";

const {
  buildLolBracket,
  buildSwissStage,
  isBracketStage,
  isCurrentEvent,
  pickActiveTournament,
  toTeam,
  withinTournament,
} = __testing;

const team = (code: string, gameWins?: number) => ({
  name: code,
  code,
  result: gameWins === undefined ? null : { gameWins },
});

const tie = (id: string, home: string, away: string, score?: [number, number]) => ({
  id,
  teams: [team(home, score?.[0]), team(away, score?.[1])],
});

describe("toTeam", () => {
  it("puts a logo on a dark disc, whatever the team's own colour", () => {
    // T1's red logo on T1's red disc could not be seen.
    expect(toTeam({ name: "T1", code: "T1", image: "https://static.lolesports.com/teams/t1.png" }))
      .toMatchObject({ logoUrl: "https://static.lolesports.com/teams/t1.png", primaryColor: "#222" });
    expect(toTeam({ name: "Fnatic", code: "FNC", image: "https://static.lolesports.com/teams/fnc.png" }))
      .toMatchObject({ primaryColor: "#222" });
  });

  it("keeps the team's colour for a badge drawn as its initials", () => {
    expect(toTeam({ name: "T1", code: "T1" })).toMatchObject({ logoUrl: undefined, primaryColor: "#E2012D" });
    expect(toTeam({ name: "Unknown", code: "UNK" }).primaryColor).toBe("#222");
  });
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

describe("buildSwissStage", () => {
  const played = (home: string, away: string, score: [number, number]) => ({
    id: `${home}-${away}`,
    state: "completed" as const,
    teams: [team(home, score[0]), team(away, score[1])],
  });
  const pending = (id: string, home = "TBD", away = "TBD") => ({
    id,
    state: "unstarted" as const,
    teams: [team(home, home === "TBD" ? undefined : 0), team(away, away === "TBD" ? undefined : 0)],
  });

  // Worlds 2025's Swiss stage, in the order the API lists it: round by round,
  // best record first within a round.
  const worlds2025 = [
    played("VKS", "TSW", [0, 1]), played("FNC", "CFO", [0, 1]), played("MKOI", "KT", [0, 1]),
    played("100T", "BLG", [1, 0]), played("T1", "FLY", [1, 0]), played("AL", "HLE", [1, 0]),
    played("TES", "G2", [1, 0]), played("PSG", "GEN", [0, 1]),
    played("TSW", "KT", [0, 1]), played("100T", "TES", [0, 1]), played("T1", "CFO", [0, 1]),
    played("AL", "GEN", [1, 0]), played("FLY", "VKS", [1, 0]), played("G2", "MKOI", [1, 0]),
    played("FNC", "BLG", [0, 1]), played("PSG", "HLE", [0, 1]),
    played("TES", "KT", [0, 2]), played("AL", "CFO", [2, 1]), played("TSW", "FLY", [0, 1]),
    played("T1", "GEN", [0, 1]), played("G2", "BLG", [1, 0]), played("100T", "HLE", [0, 1]),
    played("FNC", "MKOI", [1, 2]), played("VKS", "PSG", [2, 1]),
    played("HLE", "CFO", [2, 0]), played("G2", "FLY", [2, 1]), played("TES", "GEN", [0, 2]),
    played("TSW", "MKOI", [1, 2]), played("VKS", "BLG", [0, 2]), played("T1", "100T", [2, 0]),
    played("FLY", "CFO", [0, 2]), played("BLG", "TES", [1, 2]), played("T1", "MKOI", [2, 0]),
  ];

  const shape = (stage: NonNullable<ReturnType<typeof buildSwissStage>>) =>
    stage.rounds.map((round) => round.map((p) => `${p.wins}-${p.losses}×${p.matches.length}`));

  it("draws a finished stage as its record pools, and who went through on what", () => {
    const stage = buildSwissStage(worlds2025)!;
    expect(stage).toMatchObject({ winsToAdvance: 3, lossesToExit: 3 });
    expect(shape(stage)).toEqual([
      ["0-0×8"],
      ["1-0×4", "0-1×4"],
      ["2-0×2", "1-1×4", "0-2×2"],
      ["2-1×3", "1-2×3"],
      ["2-2×3"],
    ]);
    expect(stage.exits.map((e) => [`${e.wins}-${e.losses}`, e.advanced, e.slots, e.teamIds])).toEqual([
      ["3-0", true, 2, ["kt", "al"]],
      ["3-1", true, 3, ["hle", "g2", "gen"]],
      ["3-2", true, 3, ["cfo", "tes", "t1"]],
      ["2-3", false, 3, ["fly", "blg", "mkoi"]],
      ["1-3", false, 3, ["tsw", "vks", "100t"]],
      ["0-3", false, 2, ["fnc", "psg"]],
    ]);
    expect(stage.rounds[4][0].matches[2]).toMatchObject({
      homeTeamId: "t1",
      awayTeamId: "mkoi",
      winnerTeamId: "t1",
      status: "ft",
    });
  });

  it("draws a stage nobody has played yet from its first-round pairings", () => {
    const draw = [
      pending("r1-1", "GEN", "IG"), pending("r1-2", "TLAW", "CFO"), pending("r1-3", "AL", "KC"),
      pending("r1-4", "G2", "DK"), pending("r1-5", "HLE", "TES"), pending("r1-6", "LOS", "T1"),
      pending("r1-7", "TSW", "LYON"), pending("r1-8", "BLG", "MKOI"),
      ...Array.from({ length: 25 }, (_, i) => pending(`later-${i}`)),
    ];
    const schedule = new Map([["r1-1", { date: "2026-10-23T17:00:00Z", bestOf: 1 as const }]]);
    const stage = buildSwissStage(draw, schedule)!;

    expect(shape(stage)).toEqual([
      ["0-0×8"],
      ["1-0×4", "0-1×4"],
      ["2-0×2", "1-1×4", "0-2×2"],
      ["2-1×3", "1-2×3"],
      ["2-2×3"],
    ]);
    expect(stage.exits.every((e) => e.teamIds.length === 0)).toBe(true);
    expect(stage.rounds[0][0].matches[0]).toMatchObject({
      homeTeamId: "gen",
      awayTeamId: "ig",
      status: "scheduled",
      date: "2026-10-23T17:00:00Z",
      bestOf: 1,
    });
    expect(stage.rounds[1][0].matches[0]).toMatchObject({ homeTeamId: null, awayTeamId: null });
  });

  it("draws nothing rather than a team in the wrong pool", () => {
    // A 0-1 team listed among the 1-0 matches: the order is not the one the
    // pools are read from.
    const shuffled = [...worlds2025];
    [shuffled[8], shuffled[12]] = [shuffled[12], shuffled[8]];
    expect(buildSwissStage(shuffled)).toBeNull();
  });

  it("draws nothing for a stage that is not a Swiss one", () => {
    expect(buildSwissStage([])).toBeNull();
    expect(buildSwissStage(worlds2025.slice(0, 7))).toBeNull();
  });
});
