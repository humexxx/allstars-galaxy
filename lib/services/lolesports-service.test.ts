import { afterEach, describe, expect, it, vi } from "vitest";

import type { LolData, LolRegion, LolSplit } from "@/types/sports";

import { fakeLolesports, type FakeLolesportsOptions } from "./__fixtures__/lolesports";
import { __testing, getLolData } from "./lolesports-service";

const {
  buildLolBracket,
  buildStageBracket,
  buildSwissStage,
  flowBracket,
  findChampion,
  isBracketStage,
  isCurrentEvent,
  orderSplits,
  pickActiveTournament,
  pickNextTournament,
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

describe("flowBracket", () => {
  // Worlds 2026's play-ins, a double elimination of four, as Lolesports sends
  // them: one section, one schedule block, nothing linking a match to the
  // ones before it.
  const playIns = [
    tie("m1", "KC", "C9", [3, 2]),
    tie("m2", "MVK", "FUR", [3, 0]),
    tie("m3", "KC", "MVK", [3, 0]),
    tie("m6", "MVK", "FUR", [3, 1]),
    tie("m4", "FUR", "C9", [3, 1]),
    tie("m5", "KC", "MVK", [3, 0]),
  ];
  const schedule = new Map(
    [
      ["m1", "2026-10-15T18:00:00Z"],
      ["m2", "2026-10-15T23:00:00Z"],
      ["m3", "2026-10-16T18:00:00Z"],
      ["m4", "2026-10-16T23:00:00Z"],
      ["m6", "2026-10-17T18:00:00Z"],
      ["m5", "2026-10-18T18:00:00Z"],
    ].map(([id, date]) => [id, { date, bestOf: 5 as const }])
  );

  it("lays a double elimination out by where its teams went, in the order played", () => {
    const { rounds } = flowBracket(playIns, schedule);
    expect(rounds.map((r) => [r.label, r.matches.map((m) => m.id)])).toEqual([
      ["Round 1", ["m1", "m2"]],
      ["Round 2", ["m3", "m4"]],
      ["Round 3", ["m6"]],
      ["Final", ["m5"]],
    ]);
  });

  it("puts a match between two teams that have lost in the lower bracket", () => {
    const sides = Object.fromEntries(
      flowBracket(playIns, schedule).rounds.flatMap((r) => r.matches.map((m) => [m.id, m.side]))
    );
    expect(sides).toEqual({ m1: "upper", m2: "upper", m3: "upper", m4: "lower", m6: "lower", m5: "upper" });
  });

  it("links each winner to their next match, and no loser to theirs", () => {
    expect(flowBracket(playIns, schedule).links).toEqual([
      { from: "m1", to: "m3" },
      { from: "m2", to: "m3" },
      { from: "m4", to: "m6" },
      { from: "m3", to: "m5" },
      { from: "m6", to: "m5" },
    ]);
  });

  it("keeps a knockout's schedule blocks, and rebuilds a block that holds several rounds", () => {
    const knockout = buildStageBracket(
      [{ name: "Knockouts", matches: [tie("q1", "T1", "GEN"), tie("q2", "HLE", "KT"), tie("f", "TBD", "TBD")] }],
      new Map([["q1", "Semifinals"], ["q2", "Semifinals"], ["f", "Finals"]]),
      new Map()
    );
    expect(knockout.rounds.map((r) => r.label)).toEqual(["Semifinals", "Finals"]);
    expect(knockout.links).toBeUndefined();

    const rebuilt = buildStageBracket(
      [{ name: "Play-Ins", matches: playIns }],
      new Map(playIns.map((m) => [m.id, "Play-Ins"])),
      schedule
    );
    expect(rebuilt.rounds).toHaveLength(4);
    expect(rebuilt.links).toHaveLength(5);
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
  // The splits on now or last played: 2026's, then LCK's and LPL's 2027 ones.
  const season2026 = ["2026-07-23", "2026-07-25", "2026-07-28", "2026-07-21"];
  const lck2027Live = ["2026-07-23", "2026-07-25", "2027-01-13", "2027-01-13"];

  it("shows an international event while it is on", () => {
    expect(isCurrentEvent(worlds, season2026, "2026-10-18")).toBe(true);
  });

  it("keeps it after the final, however long, until a regional split starts after it", () => {
    expect(isCurrentEvent(worlds, season2026, "2026-11-20")).toBe(true);
    // The old 21-day grace let it go on December 7.
    expect(isCurrentEvent(worlds, season2026, "2026-12-10")).toBe(true);
    expect(isCurrentEvent(worlds, season2026, "2027-01-05")).toBe(true);
  });

  it("lets it go the day the first regional split after it begins", () => {
    expect(isCurrentEvent(worlds, lck2027Live, "2027-01-12")).toBe(true);
    expect(isCurrentEvent(worlds, lck2027Live, "2027-01-13")).toBe(false);
  });

  it("counts only a split that starts after the final", () => {
    // MSI 2026 ended July 12; LPL's split 3 began on the 21st.
    const msi = { id: "m", slug: "msi_2026", startDate: "2026-06-27", endDate: "2026-07-12" };
    expect(isCurrentEvent(msi, ["2026-03-31"], "2026-07-15")).toBe(true);
    expect(isCurrentEvent(msi, season2026, "2026-10-18")).toBe(false);
  });

  it("never shows one that has not started", () => {
    expect(isCurrentEvent(worlds, season2026, "2026-10-14")).toBe(false);
    expect(isCurrentEvent(null, season2026, "2026-10-18")).toBe(false);
  });
});

describe("pickNextTournament", () => {
  const lec = [
    { id: "3", slug: "lec_split_3_2026", startDate: "2026-07-23", endDate: "2026-09-20" },
    { id: "5", slug: "lec_split_2_2027", startDate: "2027-03-27", endDate: "2027-06-07" },
    { id: "4", slug: "lec_split_1_2027", startDate: "2027-01-16", endDate: "2027-03-01" },
  ];

  it("is the soonest tournament that has not started", () => {
    expect(pickNextTournament(lec, "2027-01-05")?.slug).toBe("lec_split_1_2027");
  });

  it("is nothing once the last one listed has started", () => {
    expect(pickNextTournament(lec, "2027-04-01")).toBeNull();
  });
});

describe("findChampion", () => {
  const round = (label: string, ...matches: ReturnType<typeof tie>[]) => ({ label, matches });
  const rounds = (...list: ReturnType<typeof round>[]) =>
    buildLolBracket(
      list.map((r) => ({ name: r.label, matches: r.matches })),
      new Map(list.flatMap((r) => r.matches.map((m) => [m.id, r.label] as const)))
    );

  it("reads the winner of the round named Finals, not of the last round", () => {
    // LPL Split 3 2026: AL won the final; IG won the Regional Qualifier after it.
    const lpl = rounds(
      round("Playoffs", tie("p", "IG", "AL", [2, 3])),
      round("Finals", tie("f", "AL", "BLG", [3, 1])),
      round("Regional Qualifier", tie("rq", "JDG", "IG", [1, 3]))
    );
    expect(findChampion(lpl)).toMatchObject({
      teamId: "al",
      final: { homeTeamId: "al", awayTeamId: "blg", homeScore: 3, awayScore: 1 },
    });
  });

  it("crowns nobody while the final is still being played", () => {
    const live = (score: [number, number], bestOf?: 1 | 3 | 5) =>
      findChampion(
        buildLolBracket(
          [{ name: "Finals", matches: [tie("f", "T1", "GEN", score)] }],
          new Map(),
          bestOf ? new Map([["f", { date: "2026-11-14T19:00:00Z", bestOf }]]) : new Map()
        )
      );
    // T1 lead the best-of-five 2–1: that is not a title.
    expect(live([2, 1], 5)).toBeNull();
    expect(live([3, 1], 5)?.teamId).toBe("t1");
    // Without the schedule, a final is a best-of-five.
    expect(live([2, 0])).toBeNull();
    expect(live([3, 2])?.teamId).toBe("t1");
    expect(live([2, 0], 3)?.teamId).toBe("t1");
  });

  it("is nobody until the final is decided, or without a round named Finals", () => {
    expect(findChampion(rounds(round("Finals", tie("f", "TBD", "TBD"))))).toBeNull();
    expect(findChampion(rounds(round("Playoffs", tie("p", "GEN", "HLE", [3, 1]))))).toBeNull();
    expect(findChampion(undefined)).toBeNull();
  });
});

describe("orderSplits", () => {
  const split = (region: LolRegion, international?: boolean) =>
    ({ region, international, name: region, season: "2026", teams: [], standings: [], matches: [] }) as LolSplit;
  const tournament = (startDate: string, endDate: string) => ({ id: startDate, slug: "t", startDate, endDate });
  const regions = (splits: LolSplit[]) => splits.map((s) => s.region);

  it("leads with the international event, then the rest by how recently they ended", () => {
    const ordered = orderSplits(
      [
        { split: split("worlds", true), tournament: tournament("2026-10-15", "2026-11-15") },
        { split: split("lec"), tournament: tournament("2026-07-23", "2026-09-20") },
        { split: split("lcs"), tournament: tournament("2026-07-25", "2026-10-05") },
        { split: split("lck"), tournament: tournament("2026-07-28", "2026-09-13") },
        { split: split("lpl"), tournament: tournament("2026-07-21", "2026-09-19") },
      ],
      "2026-11-20"
    );
    expect(regions(ordered)).toEqual(["worlds", "lcs", "lec", "lpl", "lck"]);
  });

  it("puts an international event that is over among the rest, by when it ended", () => {
    const ordered = orderSplits(
      [
        { split: split("worlds", true), tournament: tournament("2026-10-15", "2026-11-15") },
        { split: split("msi", true), tournament: tournament("2026-06-27", "2026-07-12"), over: true },
        { split: split("lec"), tournament: tournament("2026-07-23", "2026-09-20") },
        { split: split("lck"), tournament: tournament("2026-07-28", "2026-09-13") },
      ],
      "2026-10-23"
    );
    expect(regions(ordered)).toEqual(["worlds", "lec", "lck", "msi"]);
  });

  it("puts the splits being played today ahead of the finished ones", () => {
    const ordered = orderSplits(
      [
        { split: split("lec"), tournament: tournament("2026-07-23", "2026-09-20") },
        { split: split("lcs"), tournament: tournament("2026-07-25", "2026-10-05") },
        { split: split("lck"), tournament: tournament("2027-01-13", "2027-03-01") },
        { split: split("lpl"), tournament: tournament("2027-01-13", "2027-03-08") },
      ],
      "2027-01-14"
    );
    expect(regions(ordered)).toEqual(["lck", "lpl", "lcs", "lec"]);
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

describe("getLolData across the end of a season", () => {
  async function lolDataOn(now: string, options?: FakeLolesportsOptions): Promise<LolData> {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
    vi.stubGlobal("fetch", vi.fn(fakeLolesports(now, options)));
    return getLolData();
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("fetch is disabled in unit tests")))
    );
  });

  const regions = (data: LolData) => data.splits.map((s) => s.region);
  const split = (data: LolData, region: LolRegion) => data.splits.find((s) => s.region === region)!;
  const champions = (data: LolData) =>
    Object.fromEntries(data.splits.map((s) => [s.region, s.champion?.teamId ?? null]));

  it("leads with Worlds during its Swiss stage, the splits behind it by end date", async () => {
    const data = await lolDataOn("2026-10-23T23:00:00Z");

    expect(regions(data)).toEqual(["worlds", "lcs", "lec", "lpl", "lck"]);
    const worlds = split(data, "worlds");
    expect(worlds).toMatchObject({ name: "Worlds 2026", international: true });
    expect(worlds.champion).toBeUndefined();
    expect(worlds.swiss?.rounds[0][0].matches.filter((m) => m.status === "ft")).toHaveLength(4);
    expect(data.upcoming).toEqual([]);
  });

  it("keeps a finished Worlds first, with its champion and each region's", async () => {
    const data = await lolDataOn("2026-11-20T12:00:00Z");

    expect(regions(data)[0]).toBe("worlds");
    // LPL's last round is its Regional Qualifier, which IG won.
    expect(champions(data)).toEqual({ worlds: "t1", lcs: "tlaw", lec: "g2", lpl: "al", lck: "gen" });
    expect(split(data, "worlds").champion?.final).toMatchObject({
      homeTeamId: "t1",
      awayTeamId: "gen",
      homeScore: 3,
      awayScore: 2,
      date: "2026-11-14T19:00:00Z",
      bestOf: 5,
    });
  });

  it("still leads with Worlds in December, when the old three weeks were up", async () => {
    const data = await lolDataOn("2026-12-10T12:00:00Z");

    expect(regions(data)[0]).toBe("worlds");
    expect(data.upcoming).toEqual([]);
  });

  it("lists next season's splits once they are scheduled, and keeps the last ones' matches", async () => {
    const data = await lolDataOn("2027-01-05T12:00:00Z");

    expect(regions(data)[0]).toBe("worlds");
    expect(data.upcoming).toEqual([
      { region: "lck", name: "LCK Split 1", startDate: "2027-01-13" },
      { region: "lpl", name: "LPL Split 1", startDate: "2027-01-13" },
      { region: "lec", name: "LEC Split 1", startDate: "2027-01-16" },
      { region: "lcs", name: "LCS Split 1", startDate: "2027-01-24" },
    ]);
    // LEC's newest schedule page is all 2027; its split 3 matches are a page back.
    const lec = split(data, "lec");
    expect(lec.name).toBe("LEC Split 3");
    expect(lec.standings.length).toBeGreaterThan(0);
    expect(lec.matches.map((m) => m.stageLabel)).toEqual(["Finals", "Playoffs"]);
    const scheduleCalls = vi
      .mocked(fetch)
      .mock.calls.map(([url]) => String(url))
      .filter((url) => url.includes("getSchedule?leagueId=lec"));
    expect(scheduleCalls).toHaveLength(2);
    expect(scheduleCalls[1]).toContain("pageToken=older-1");
  });

  it("falls back to the tournament's completed events when the older page fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = await lolDataOn("2027-01-05T12:00:00Z", { olderPagesFail: true });

    const lec = split(data, "lec");
    expect(lec.name).toBe("LEC Split 3");
    expect(lec.matches.map((m) => [m.stageLabel, m.status])).toEqual([
      ["Finals", "ft"],
      ["Playoffs", "ft"],
    ]);
    // Still named and dated off those events, so the champion still reads.
    expect(lec.playoffs?.map((r) => r.label)).toEqual(["Playoffs", "Finals"]);
    expect(lec.champion?.teamId).toBe("g2");
    vi.mocked(console.warn).mockRestore();
  });

  it("keeps a split's standings and bracket when its matches cannot be found at all", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = await lolDataOn("2027-01-05T12:00:00Z", {
      olderPagesFail: true,
      completedEventsFail: true,
    });

    // Never next season's matches under last season's name.
    const lec = split(data, "lec");
    expect(lec.matches).toEqual([]);
    expect(lec.standings.length).toBeGreaterThan(0);
    expect(lec.playoffs?.flatMap((r) => r.matches)).toHaveLength(2);
    vi.mocked(console.warn).mockRestore();
  });

  it("lets Worlds go once LCK's new season is under way, and leads with the live splits", async () => {
    const data = await lolDataOn("2027-01-14T12:00:00Z");

    expect(regions(data)).toEqual(["lck", "lpl", "lcs", "lec"]);
    const lck = split(data, "lck");
    expect(lck).toMatchObject({ name: "LCK Split 1", season: "2027" });
    expect(lck.matches.map((m) => [m.id, m.status])).toEqual([
      ["lck27-3", "scheduled"],
      ["lck27-2", "ft"],
      ["lck27-1", "ft"],
    ]);
    expect(data.upcoming?.map((u) => u.region)).toEqual(["lec", "lcs"]);
  });
});
