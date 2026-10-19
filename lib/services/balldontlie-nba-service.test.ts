import { describe, expect, it } from "vitest";

import { __testing } from "./balldontlie-nba-service";

const {
  currentSeason,
  seasonLabel,
  recentAndNext,
  statusFrom,
  gameWindow,
  standingsFrom,
  teamFrom,
  logoFor,
} = __testing;

const logo = (slug: string) =>
  `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/${slug}.png&w=96&h=96&scale=crop`;

const game = (date: string, final = false) => ({
    id: 1,
    date,
    datetime: `${date}T00:00:00Z`,
    season: 2025,
    status: final ? "Final" : date,
    status_state: final ? "final" : "scheduled",
    postseason: false,
    postponed: false,
    home_team_score: 0,
    visitor_team_score: 0,
});

describe("currentSeason", () => {
  it("names a season by the year it starts in", () => {
    // The NBA labels 2026–27 as "2026", and before October the season that
    // matters is still the previous one.
    expect(currentSeason(new Date("2026-08-24"))).toBe(2025);
    expect(currentSeason(new Date("2026-10-20"))).toBe(2026);
  });

  it("spans the new year", () => {
    expect(seasonLabel(2025)).toBe("2025–26");
    expect(seasonLabel(2099)).toBe("2099–00");
  });
});

describe("recentAndNext", () => {
  it("keeps the last results and the next fixtures out of one window", () => {
    // Out of season the nearest games are months away in BOTH directions:
    // June's finals behind, October's opener ahead. One wide request has to
    // serve both, because the free tier allows five a minute.
    const games = [
      ...["2026-06-03", "2026-06-05", "2026-06-08"].map((d) => game(d, true)),
      ...["2026-10-20", "2026-10-21"].map((d) => game(d)),
    ];
    const out = recentAndNext(games as never);

    expect(out.map((g) => g.date)).toEqual([
      "2026-06-03", "2026-06-05", "2026-06-08", "2026-10-20", "2026-10-21",
    ]);
  });

  it("trims a long season down to six either side of today", () => {
    const games = Array.from({ length: 20 }, (_, i) =>
      game(`2026-01-${String(i + 1).padStart(2, "0")}`, i < 10)
    );
    const out = recentAndNext(games as never);

    expect(out).toHaveLength(12);
    expect(out[0].date).toBe("2026-01-05");
  });
});

describe("statusFrom", () => {
  it("reads the state, not the human-readable clock", () => {
    expect(statusFrom(game("2026-06-03", true) as never)).toBe("ft");
    expect(statusFrom(game("2026-10-20") as never)).toBe("scheduled");
    expect(statusFrom({ ...game("2026-10-20"), status_state: "in" } as never)).toBe("live");
    expect(statusFrom({ ...game("2026-10-20"), postponed: true } as never)).toBe("postponed");
  });
});

describe("gameWindow", () => {
  it("asks for a few nights either side of today in season", () => {
    // One page is the OLDEST hundred games in the range. ±130 days in
    // December would have stopped at the season's first fortnight.
    expect(gameWindow(new Date(2026, 11, 15, 12))).toEqual({
      start: "2026-12-11",
      end: "2026-12-19",
    });
  });

  it("starts at the finals out of season, never on a March night", () => {
    expect(gameWindow(new Date(2026, 6, 1, 12))).toEqual({
      start: "2026-06-01",
      end: "2026-11-08",
    });
  });

  it("keeps the finals in view until the new season has a week of games", () => {
    expect(gameWindow(new Date(2026, 9, 18, 12)).start).toBe("2026-06-01");
    expect(gameWindow(new Date(2026, 9, 28, 12))).toEqual({
      start: "2026-10-24",
      end: "2026-11-01",
    });
  });

  it("stays narrow while the finals are still being played", () => {
    expect(gameWindow(new Date(2026, 5, 10, 12)).start).toBe("2026-06-06");
  });
});

describe("standingsFrom", () => {
  // ESPN's 2025–26 table, trimmed: stats arrive by `name`, except "Last Ten
  // Games", which is only findable by its `type`.
  const entry = (abbreviation: string, stats: Record<string, string>) => ({
    team: { abbreviation, displayName: `${abbreviation} full`, shortDisplayName: abbreviation },
    stats: Object.entries(stats).map(([key, displayValue]) =>
      key === "lasttengames"
        ? { name: "Last Ten Games", type: "lasttengames", displayValue }
        : { name: key, type: key.toLowerCase(), displayValue, value: Number(displayValue) }
    ),
  });

  const table = {
    children: [
      {
        abbreviation: "East",
        standings: {
          entries: [
            entry("NY", { playoffSeed: "2", wins: "53", losses: "29", winPercent: ".646", gamesBehind: "7", streak: "L1", lasttengames: "6-4" }),
            entry("DET", { playoffSeed: "1", wins: "60", losses: "22", winPercent: ".732", gamesBehind: "-", streak: "W3", lasttengames: "8-2" }),
          ],
        },
      },
      {
        abbreviation: "West",
        standings: {
          entries: [
            entry("GS", { playoffSeed: "1", wins: "50", losses: "32", winPercent: ".610", gamesBehind: "-", streak: "W1", lasttengames: "7-3" }),
          ],
        },
      },
    ],
  };

  it("joins ESPN's abbreviations onto balldontlie's teams", () => {
    // NY / GS on ESPN are NYK / GSW on balldontlie — the games' team ids.
    const { standings, teams } = standingsFrom(table);
    expect(standings.map((s) => s.teamId)).toEqual(["DET", "NYK", "GSW"]);
    expect(teams.find((t) => t.id === "NYK")?.primaryColor).toBe("#006BB6");
  });

  it("gives the table's teams the same logos as the games'", () => {
    const { teams } = standingsFrom(table);
    expect(teams.map((t) => t.logoUrl)).toEqual([logo("ny"), logo("det"), logo("gs")]);
  });

  it("maps the columns the table shows", () => {
    const [detroit, newYork] = standingsFrom(table).standings;
    expect(detroit).toMatchObject({
      position: 1,
      conference: "east",
      won: 60,
      lost: 22,
      played: 82,
      winPct: 0.732,
      gamesBehind: 0,
      streak: "W3",
      last10: "8-2",
    });
    expect(newYork.gamesBehind).toBe(7);
  });
});

describe("logoFor", () => {
  it("names the file the way ESPN names the team", () => {
    // The six balldontlie spells differently; ESPN's files go by ESPN's
    // abbreviation, and the naive "nop" / "uta" are 404s.
    expect(logoFor("GSW")).toBe(logo("gs"));
    expect(logoFor("NOP")).toBe(logo("no"));
    expect(logoFor("NYK")).toBe(logo("ny"));
    expect(logoFor("SAS")).toBe(logo("sa"));
    expect(logoFor("UTA")).toBe(logo("utah"));
    expect(logoFor("WAS")).toBe(logo("wsh"));
  });

  it("lower-cases everybody else's own abbreviation", () => {
    expect(logoFor("LAL")).toBe(logo("lal"));
    expect(logoFor("BKN")).toBe(logo("bkn"));
  });

  it("guesses nothing for a team it does not know", () => {
    expect(logoFor("EST")).toBeUndefined();
  });

  it("puts the logo on a game's teams", () => {
    // balldontlie's own team object, trimmed.
    const team = teamFrom({
      id: 10,
      full_name: "Golden State Warriors",
      name: "Warriors",
      abbreviation: "GSW",
      conference: "West",
    });
    expect(team).toMatchObject({ id: "GSW", logoUrl: logo("gs"), primaryColor: "#1D428A" });
  });
});
