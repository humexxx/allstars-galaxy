import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NBA_DATA } from "@/lib/data/sports/nba";
import type { BracketMatch, BracketRound, Match, MatchStatus } from "@/types/sports";

import gamesOct18 from "./__fixtures__/balldontlie-nba-games-2026-10-18.json";
import postseason2026 from "./__fixtures__/espn-nba-postseason-2026.json";
import preseason2026 from "./__fixtures__/espn-nba-preseason-2026.json";
import { __testing, getNbaData } from "./balldontlie-nba-service";

const {
  currentSeason,
  seasonLabel,
  recentAndNext,
  statusFrom,
  gameWindow,
  standingsFrom,
  teamFrom,
  logoFor,
  playoffYear,
  playoffsFrom,
  tipOffFrom,
  championFrom,
  preseasonFrom,
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

type PageGame = (typeof gamesOct18.data)[number];

/**
 * balldontlie's page on 2026-10-18, trimmed: 2025–26's five finals games
 * (Knicks 4–1 Spurs) and the first ten of 2026–27, from Boston at Detroit.
 */
const pageOct18: PageGame[] = gamesOct18.data;

/** The same page once the opening night has been played. */
const pageOct21: PageGame[] = pageOct18.map((g) =>
  g.date === "2026-10-20"
    ? { ...g, status: "Final", status_state: "final", home_team_score: 110, visitor_team_score: 104 }
    : g
);

describe("currentSeason", () => {
  it("names a season by the year it starts in", () => {
    // The NBA labels 2026–27 as "2026", and before October the season that
    // matters is still the previous one.
    expect(currentSeason(new Date("2026-08-24"))).toBe(2025);
    expect(currentSeason(new Date("2026-10-20"))).toBe(2026);
  });

  it("flips on October 1, the day ESPN's season starts", () => {
    expect(currentSeason(new Date(2026, 8, 30, 12))).toBe(2025);
    expect(currentSeason(new Date(2026, 9, 1, 12))).toBe(2026);
  });

  it("spans the new year", () => {
    expect(seasonLabel(2025)).toBe("2025–26");
    expect(seasonLabel(2099)).toBe("2099–00");
  });
});

describe("recentAndNext", () => {
  const match = (kickoff: string, status: MatchStatus = "scheduled"): Match => ({
    id: kickoff,
    homeTeamId: "DET",
    awayTeamId: "BOS",
    homeScore: null,
    awayScore: null,
    kickoff,
    status,
  });

  it("keeps the last results and the next fixtures out of one window", () => {
    // Before the opener the nearest games are on either side of it: the
    // preseason behind, the opening week ahead.
    const games = [
      ...["2026-10-15T23:00:00Z", "2026-10-16T23:00:00Z", "2026-10-17T02:30:00Z"].map((k) => match(k, "ft")),
      ...["2026-10-20T19:00:00.000Z", "2026-10-20T23:00:00.000Z"].map((k) => match(k)),
    ];

    expect(recentAndNext(games).map((g) => g.kickoff)).toEqual([
      "2026-10-15T23:00:00Z",
      "2026-10-16T23:00:00Z",
      "2026-10-17T02:30:00Z",
      "2026-10-20T19:00:00.000Z",
      "2026-10-20T23:00:00.000Z",
    ]);
  });

  it("keeps two weeks of results and a week of fixtures out of a long season", () => {
    // A game a night from Dec 20: three weeks played, then January ahead.
    const games = Array.from({ length: 40 }, (_, i) => {
      const day = new Date(Date.UTC(2025, 11, 20 + i, 0, 30));
      return match(day.toISOString().replace(".000", ""), i < 21 ? "ft" : "scheduled");
    });
    const out = recentAndNext(games).map((g) => g.kickoff.slice(0, 10));

    // The last played is Jan 9; two weeks back is Dec 27, a week on Jan 16.
    expect(out[0]).toBe("2025-12-27");
    expect(out.at(-1)).toBe("2026-01-16");
    expect(out).toHaveLength(21);
  });

  it("lists every game of a busy week ahead, not one night's worth", () => {
    // Twelve games a night: six by count was today alone.
    const night = (day: string): Match[] =>
      Array.from({ length: 12 }, (_, i) => ({ ...match(`2026-10-${day}T23:00:00Z`), id: `${day}-${i}` }));
    const games = ["23", "24", "25", "26", "27", "28", "29", "30", "31"].flatMap(night);

    const days = new Set(recentAndNext(games).map((g) => g.kickoff.slice(0, 10)));

    expect([...days]).toEqual([
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
    ]);
  });

  it("interleaves ESPN's preseason and balldontlie's games by kickoff", () => {
    const out = recentAndNext([
      match("2026-10-21T00:00:00.000Z"),
      match("2026-10-17T02:30:00Z", "ft"),
      match("2026-10-20T23:30:00Z"),
    ]);
    expect(out.map((g) => g.kickoff)).toEqual([
      "2026-10-17T02:30:00Z",
      "2026-10-20T23:30:00Z",
      "2026-10-21T00:00:00.000Z",
    ]);
  });

  it("drops a cancelled game instead of listing it as next", () => {
    const out = recentAndNext([match("2026-10-10T23:00:00Z", "cancelled"), match("2026-10-20T19:00:00Z")]);
    expect(out.map((g) => g.status)).toEqual(["scheduled"]);
  });
});

describe("tipOffFrom", () => {
  const season2026 = (page: PageGame[]): PageGame[] => page.filter((g) => g.season === 2026);
  // The off-season page starts at June 1, before the season does.
  const tipOff = (games: Parameters<typeof tipOffFrom>[0]): string | undefined =>
    tipOffFrom(games, 2026, "2026-06-01");

  it("is the first regular-season game while none has been played", () => {
    expect(tipOff(season2026(pageOct18))).toBe("2026-10-20T19:00:00.000Z");
  });

  it("is gone once the opening night has been played", () => {
    expect(tipOff(season2026(pageOct21))).toBeUndefined();
  });

  it("is gone while a game is in progress", () => {
    const live = season2026(pageOct18).map((g, i) => (i === 0 ? { ...g, status_state: "in" } : g));
    expect(tipOff(live)).toBeUndefined();
  });

  it("stays a calendar day when balldontlie has no time for it", () => {
    // A made-up UTC midnight would read as Oct 19 in Costa Rica.
    const untimed = season2026(pageOct18).map((g) => ({ ...g, datetime: null }));
    expect(tipOff(untimed)).toBe("2026-10-20");
  });

  it("is undefined with no games of the season", () => {
    expect(tipOff([])).toBeUndefined();
  });

  it("reads nothing off a page that starts after the season did", () => {
    // Across the All-Star break the in-season page (Feb 13–21) holds only
    // fixtures, and the first of them is not the opener.
    const afterBreak = season2026(pageOct18).map((g) => ({ ...g, season: 2025 }));
    expect(tipOffFrom(afterBreak, 2025, "2026-02-13")).toBeUndefined();
    expect(tipOffFrom(season2026(pageOct18), 2026, "2026-10-24")).toBeUndefined();
  });
});

describe("championFrom", () => {
  it("names last season's champion and the finals in games, off the page alone", () => {
    expect(championFrom(pageOct18, 2025)?.champion).toEqual({
      season: "2025–26",
      teamId: "NYK",
      summary: "New York Knicks, 4–1 over San Antonio",
    });
  });

  it("leaves the score out rather than print a series it cannot see whole", () => {
    const short = pageOct18.filter((g) => g.date !== "2026-06-03");
    expect(championFrom(short, 2025)?.champion.summary).toBe("New York Knicks over San Antonio");
  });

  it("names nobody without that season's postseason on the page", () => {
    expect(championFrom(pageOct18, 2026)).toBeUndefined();
    expect(championFrom([], 2025)).toBeUndefined();
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
  it("asks for two weeks back and a week ahead in season", () => {
    // One page is the OLDEST hundred games in the range. ±130 days in
    // December would have stopped at the season's first fortnight.
    expect(gameWindow(new Date(2026, 11, 15, 12))).toEqual({
      start: "2026-12-01",
      end: "2026-12-22",
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
      start: "2026-10-14",
      end: "2026-11-04",
    });
  });

  it("stays narrow while the finals are still being played", () => {
    expect(gameWindow(new Date(2026, 5, 10, 12)).start).toBe("2026-05-27");
  });
});

// ESPN's standings, trimmed: stats arrive by `name`, except "Last Ten Games",
// which is only findable by its `type`.
const entry = (abbreviation: string, stats: Record<string, string>) => ({
  team: { abbreviation, displayName: `${abbreviation} full`, shortDisplayName: abbreviation },
  stats: Object.entries(stats).map(([key, displayValue]) =>
    key === "lasttengames"
      ? { name: "Last Ten Games", type: "lasttengames", displayValue }
      : { name: key, type: key.toLowerCase(), displayValue, value: Number(displayValue) }
  ),
});

const noRecord = {
  playoffSeed: "0",
  wins: "0",
  losses: "0",
  winPercent: ".000",
  gamesBehind: "-",
  streak: "-",
};

/** 2026–27's table before the opener, as ESPN sends it: everyone 0–0, in ESPN's team order. */
const zeroTable = {
  children: [
    { abbreviation: "East", standings: { entries: [entry("ATL", noRecord), entry("BOS", noRecord)] } },
    { abbreviation: "West", standings: { entries: [entry("NO", noRecord), entry("DAL", noRecord)] } },
  ],
};

/** The same table after the opening night: Detroit beat Boston, everyone else 0–0. */
const openingNightTable = {
  children: [
    {
      abbreviation: "East",
      standings: {
        entries: [
          entry("DET", { ...noRecord, wins: "1", winPercent: "1.000" }),
          entry("ATL", noRecord),
          entry("BOS", { ...noRecord, losses: "1", gamesBehind: "1" }),
        ],
      },
    },
    { abbreviation: "West", standings: { entries: [entry("NO", noRecord)] } },
  ],
};

describe("standingsFrom", () => {
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

  it("has no table before anybody has played", () => {
    // Read as a table, ESPN's 0–0 put New Orleans top of the West in bold.
    expect(standingsFrom(zeroTable)).toEqual({ standings: [], teams: [] });
  });

  it("keeps the teams still on 0–0 once the season has a result", () => {
    const { standings } = standingsFrom(openingNightTable);
    expect(standings.map((s) => [s.teamId, s.won, s.lost])).toEqual([
      ["DET", 1, 0],
      ["ATL", 0, 0],
      ["BOS", 0, 1],
      ["NOP", 0, 0],
    ]);
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

describe("playoffYear", () => {
  const finals = { ...game("2026-06-10", true), postseason: true };
  const opener = { ...game("2026-10-20"), season: 2026 };

  it("asks for no bracket out of season", () => {
    const december = { ...game("2026-12-14", true), season: 2026 };
    expect(playoffYear(new Date(2026, 11, 15, 12), [december] as never, 2026)).toBeNull();
    expect(playoffYear(new Date(2027, 2, 20, 12), [], 2026)).toBeNull();
    expect(playoffYear(new Date(2027, 3, 9, 12), [], 2026)).toBeNull();
    expect(playoffYear(new Date(2026, 6, 1, 12), [], 2025)).toBeNull();
  });

  it("reads one from the regular season's last week to the end of June", () => {
    expect(playoffYear(new Date(2027, 3, 10, 12), [], 2026)).toBe(2027);
    expect(playoffYear(new Date(2027, 4, 20, 12), [], 2026)).toBe(2027);
    expect(playoffYear(new Date(2027, 5, 30, 12), [], 2026)).toBe(2027);
  });

  it("keeps it all summer while the page holds the season's finals, openers or not", () => {
    // The old rule locked it once 2026–27's openers reached the page, which
    // they do from June: in August the heading still said 2025–26 and its
    // bracket was gone.
    expect(playoffYear(new Date(2026, 7, 1, 12), [finals, opener] as never, 2025)).toBe(2026);
  });

  it("locks on October 1, when the season shown moves on", () => {
    expect(playoffYear(new Date(2026, 9, 18, 12), [finals, opener] as never, 2026)).toBeNull();
  });
});

describe("preseasonFrom", () => {
  type Header = Parameters<typeof preseasonFrom>[0];
  const header = preseason2026 as Header;
  const events = header.sports?.[0]?.leagues?.[0]?.events ?? [];
  const only = (list: typeof events): Header => ({ sports: [{ leagues: [{ events: list }] }] });
  const { games, teams } = preseasonFrom(header);

  it("lists ESPN's preseason as finished games, labelled as such", () => {
    expect(games).toHaveLength(12);
    expect(games.every((g) => g.status === "ft" && g.stageLabel === "Preseason")).toBe(true);
    expect(games[0]).toEqual({
      id: "espn-401902644",
      homeTeamId: "TOR",
      awayTeamId: "MIA",
      homeScore: 105,
      awayScore: 129,
      kickoff: "2026-10-03T23:00:00Z",
      status: "ft",
      stageLabel: "Preseason",
    });
  });

  it("keys ESPN's teams the way the games and the table do", () => {
    // SA, UTAH, NO, GS and WSH on ESPN are SAS, UTA, NOP, GSW and WAS on
    // balldontlie.
    const ids = games.flatMap((g) => [g.homeTeamId, g.awayTeamId]);
    expect(ids).toEqual(expect.arrayContaining(["SAS", "UTA", "NOP", "GSW", "WAS"]));
    expect(ids).not.toContain("SA");
    expect(teams.find((t) => t.id === "UTA")).toMatchObject({ name: "Utah Jazz", logoUrl: logo("utah") });
  });

  it("gives a side outside the NBA a monogram, not a guessed logo", () => {
    expect(teams.find((t) => t.id === "LON")).toEqual({
      id: "LON",
      name: "London Lions",
      shortName: "Lions",
      code: "LON",
      logoUrl: undefined,
      primaryColor: undefined,
    });
  });

  it("drops the regular season when tomorrow reaches the opener", () => {
    const opener = { ...events[0], id: "401", seasonType: "2" };
    expect(preseasonFrom(only([opener])).games).toEqual([]);
  });

  it("scores a game in progress and leaves a fixture blank", () => {
    const [first] = events;
    const live = { ...first, fullStatus: { type: { name: "STATUS_IN_PROGRESS", state: "in" as const } } };
    const ahead = {
      ...first,
      id: "402",
      fullStatus: { type: { name: "STATUS_SCHEDULED", state: "pre" as const } },
      competitors: first.competitors?.map((c) => ({ ...c, score: "0", winner: false })),
    };
    const canceled = {
      ...first,
      id: "403",
      fullStatus: { type: { name: "STATUS_CANCELED", state: "post" as const } },
    };
    const { games: mapped } = preseasonFrom(only([live, ahead, canceled]));
    expect(mapped.map((g) => [g.status, g.homeScore, g.awayScore])).toEqual([
      ["live", 105, 129],
      ["scheduled", null, null],
      ["cancelled", null, null],
    ]);
  });
});

type ScoreboardHeader = Parameters<typeof playoffsFrom>[0];

// ESPN's 2025–26 postseason as the scoreboard header sent it, trimmed to what
// the mapper reads, with the play-in and the regular season's last night.
const fixtureEvents = (postseason2026 as ScoreboardHeader).sports?.[0]?.leagues?.[0]?.events ?? [];
type HeaderEvent = (typeof fixtureEvents)[number];
type HeaderCompetitor = NonNullable<HeaderEvent["competitors"]>[number];

const board = (events: HeaderEvent[]): ScoreboardHeader => ({ sports: [{ leagues: [{ events }] }] });

const withCompetitors = (
  event: HeaderEvent,
  change: (c: HeaderCompetitor) => HeaderCompetitor
): HeaderEvent => ({ ...event, competitors: (event.competitors ?? []).map(change) });

/** A game as ESPN lists it before tip-off: nobody has won it, no series record. */
const unplayed = (event: HeaderEvent): HeaderEvent => ({
  ...withCompetitors(event, (c) => ({ ...c, winner: false, seriesRecord: undefined })),
  fullStatus: { type: { name: "STATUS_SCHEDULED", state: "pre" } },
});

/** The first round as it stood at `cutoff`; the later rounds were not drawn yet. */
const firstRoundAt = (cutoff: string): HeaderEvent[] =>
  fixtureEvents
    .filter((e) => e.note?.includes("1st Round"))
    .map((e) => ((e.date ?? "") < cutoff ? e : unplayed(e)));

const line = (m: BracketMatch): string => {
  const [home, away] = [m.homeTeamId ?? "TBD", m.awayTeamId ?? "TBD"];
  return typeof m.homeScore === "number" && typeof m.awayScore === "number"
    ? `${home} ${m.homeScore}–${m.awayScore} ${away}`
    : `${home} v ${away}`;
};
const lines = (round: BracketRound): string[] => round.matches.map(line);

describe("playoffsFrom", () => {
  const { rounds, teams } = playoffsFrom(board(fixtureEvents));

  it("draws the 2025–26 postseason as four rounds of series", () => {
    expect(rounds.map((r) => [r.id, r.label, r.matches.length])).toEqual([
      ["round-of-16", "First Round", 8],
      ["quarter-final", "Conference Semifinals", 4],
      ["semi-final", "Conference Finals", 2],
      ["final", "NBA Finals", 1],
    ]);
  });

  it("scores each series in wins and names its winner", () => {
    // East then West; in each half 1v8, 4v5, 3v6, 2v7 with the higher seed
    // first. The ids are balldontlie's: ESPN's NY and SA are NYK and SAS.
    expect(rounds.map(lines)).toEqual([
      ["DET 4–3 ORL", "CLE 4–3 TOR", "NYK 4–2 ATL", "BOS 3–4 PHI", "OKC 4–0 PHX", "LAL 4–2 HOU", "DEN 2–4 MIN", "SAS 4–1 POR"],
      ["DET 3–4 CLE", "NYK 4–0 PHI", "OKC 4–0 LAL", "MIN 2–4 SAS"],
      ["CLE 0–4 NYK", "OKC 3–4 SAS"],
      ["NYK 4–1 SAS"],
    ]);
    expect(rounds.map((r) => r.matches.map((m) => m.winnerTeamId))).toEqual([
      ["DET", "CLE", "NYK", "PHI", "OKC", "LAL", "MIN", "SAS"],
      ["CLE", "NYK", "OKC", "SAS"],
      ["NYK", "SAS"],
      ["NYK"],
    ]);
  });

  it("puts the two series that feed a later one side by side, its home team's on top", () => {
    // KnockoutBracket's treeOrder pairs ties by team: the later tie's home
    // side's feeder above, its away side's below. Home being the upper
    // feeder's team, the order survives it — East over West, 1v8 over 4v5.
    for (let r = 1; r < rounds.length; r++) {
      rounds[r].matches.forEach((m, k) => {
        const upper = rounds[r - 1].matches[2 * k];
        const lower = rounds[r - 1].matches[2 * k + 1];
        expect([upper.homeTeamId, upper.awayTeamId]).toContain(m.homeTeamId);
        expect([lower.homeTeamId, lower.awayTeamId]).toContain(m.awayTeamId);
      });
    }
  });

  it("dates a finished series by its deciding game, and every series is a best of seven", () => {
    expect(rounds[0].matches[0].date).toBe("2026-05-03T19:30:00Z"); // DET–ORL, game 7
    expect(rounds[3].matches[0].date).toBe("2026-06-14T00:30:00Z"); // the finals, game 5
    expect(rounds.flatMap((r) => r.matches).every((m) => m.bestOf === 7)).toBe(true);
  });

  it("gives every slot an id of its own", () => {
    const ids = rounds.flatMap((r) => r.matches.map((m) => m.id));
    expect(new Set(ids).size).toBe(15);
    expect(ids[0]).toBe("nba-round-of-16-east-0");
    expect(ids[4]).toBe("nba-round-of-16-west-0");
    expect(ids[14]).toBe("nba-final");
  });

  it("leaves the play-in out and brings the sixteen teams with their logos", () => {
    // Miami and Charlotte only played the play-in; Orlando and Phoenix came
    // through it into the bracket.
    const ids = teams.map((t) => t.id);
    expect(ids).toHaveLength(16);
    expect(ids).not.toContain("MIA");
    expect(ids).not.toContain("CHA");
    expect(teams.find((t) => t.id === "NYK")).toMatchObject({
      name: "New York Knicks",
      shortName: "Knicks",
      code: "NYK",
      logoUrl: logo("ny"),
      primaryColor: "#006BB6",
    });
  });

  it("counts the wins itself when ESPN leaves the series record out", () => {
    const bare = fixtureEvents.map((e) => withCompetitors(e, (c) => ({ ...c, seriesRecord: undefined })));
    expect(playoffsFrom(board(bare)).rounds.map(lines)).toEqual(rounds.map(lines));
  });

  it("dates a series still going by its next game, and draws the rest of the tree TBD", () => {
    const { rounds: early } = playoffsFrom(board(firstRoundAt("2026-04-28T00:00:00Z")));
    expect(lines(early[0])).toEqual([
      "DET 1–2 ORL", "CLE 2–2 TOR", "NYK 2–2 ATL", "BOS 3–1 PHI", "OKC 3–0 PHX", "LAL 3–1 HOU", "DEN 1–3 MIN", "SAS 3–1 POR",
    ]);
    expect(early[0].matches.map((m) => m.date)).toEqual([
      "2026-04-28T00:00:00Z", "2026-04-29T23:30:00Z", "2026-04-29T00:00:00Z", "2026-04-28T23:00:00Z",
      "2026-04-28T01:30:00Z", "2026-04-30T02:00:00Z", "2026-04-28T02:30:00Z", "2026-04-29T01:30:00Z",
    ]);
    expect(early[0].matches.every((m) => m.winnerTeamId === null)).toBe(true);
    expect(early.slice(1).map(lines)).toEqual([
      ["TBD v TBD", "TBD v TBD", "TBD v TBD", "TBD v TBD"],
      ["TBD v TBD", "TBD v TBD"],
      ["TBD v TBD"],
    ]);
  });

  it("writes a first-round winner into the next round before ESPN draws it", () => {
    // Oklahoma City swept Phoenix and San Antonio beat Portland in five while
    // the other six were still going.
    const { rounds: later } = playoffsFrom(board(firstRoundAt("2026-04-29T12:00:00Z")));
    expect(later[0].matches[4]).toMatchObject({
      winnerTeamId: "OKC",
      homeScore: 4,
      awayScore: 0,
      date: "2026-04-28T01:30:00Z",
    });
    expect(lines(later[1])).toEqual(["TBD v TBD", "TBD v TBD", "OKC v TBD", "TBD v SAS"]);
  });

  it("carries no winner on from a first round it could not seed", () => {
    // Without seeds the order inside a half is a guess, and a guess must not
    // pair two winners who were never going to meet.
    const unseeded = firstRoundAt("2026-04-29T12:00:00Z").map((e) =>
      withCompetitors(e, (c) => ({ ...c, recordStats: undefined }))
    );
    const { rounds: guessed } = playoffsFrom(board(unseeded));
    expect(guessed[0].matches.map((m) => m.winnerTeamId).filter(Boolean)).toEqual(["OKC", "SAS"]);
    expect(lines(guessed[1])).toEqual(["TBD v TBD", "TBD v TBD", "TBD v TBD", "TBD v TBD"]);
  });

  it("draws a first round still waiting on the play-in", () => {
    // Until the play-in settles the eighth seeds, their series are against a
    // "TBD" team.
    const waiting = firstRoundAt("2026-04-01T00:00:00Z").map((e) =>
      withCompetitors(e, (c) =>
        c.abbreviation === "ORL" || c.abbreviation === "PHX"
          ? { ...c, abbreviation: "TBD", displayName: "TBD", name: "TBD" }
          : c
      )
    );
    const { rounds: drawn, teams: known } = playoffsFrom(board(waiting));
    expect(lines(drawn[0])).toEqual([
      "DET v TBD", "CLE v TOR", "NYK v ATL", "BOS v PHI", "OKC v TBD", "LAL v HOU", "DEN v MIN", "SAS v POR",
    ]);
    expect(drawn[0].matches[0].date).toBe("2026-04-19T22:30:00Z"); // Detroit's game 1
    expect(known.map((t) => t.id)).not.toContain("TBD");
  });

  it("has no rounds before the postseason, the play-in included", () => {
    expect(playoffsFrom(board(fixtureEvents.filter((e) => e.seasonType !== "3")))).toEqual({
      rounds: [],
      teams: [],
    });
    expect(playoffsFrom({})).toEqual({ rounds: [], teams: [] });
  });
});

describe("getNbaData through the year", () => {
  const STANDINGS = (season: number): string =>
    `https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=${season}&seasontype=2`;
  const HEADER = (dates: string): string =>
    `https://site.web.api.espn.com/apis/v2/scoreboard/header?sport=basketball&league=nba&dates=${dates}&limit=300`;

  const bdlTeam = (abbreviation: string) => ({
    id: 1,
    full_name: abbreviation,
    name: abbreviation,
    abbreviation,
    conference: "East",
  });
  const bdlGame = (date: string, postseason: boolean, season = 2025) => ({
    ...game(date, true),
    season,
    postseason,
    home_team: bdlTeam("NYK"),
    visitor_team: bdlTeam("CLE"),
  });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  /** balldontlie's page, ESPN's table and ESPN's scoreboard; returns the ESPN calls made. */
  const stubFeeds = ({
    games,
    standings = () => json({ children: [] }),
    header = () => json({}, 404),
  }: {
    games: unknown[];
    standings?: () => Response;
    header?: () => Response;
  }): (() => string[]) => {
    const spy = vi.fn((url: string) =>
      Promise.resolve(
        url.includes("api.balldontlie.io")
          ? json({ data: games })
          : url.includes("/standings")
            ? standings()
            : header()
      )
    );
    vi.stubGlobal("fetch", spy);
    return () => spy.mock.calls.map(([url]) => url).filter((url) => !url.includes("api.balldontlie.io"));
  };

  const fixtures = (data: { games: Match[] }): string[] =>
    data.games.map((g) => `${g.awayTeamId}@${g.homeTeamId}`);

  beforeEach(() => {
    vi.stubEnv("BALLDONTLIE_API_KEY", "test-key");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("fetch is disabled in unit tests"))));
  });

  it("opens 2026–27 in its preseason: ESPN's exhibitions, the champion, no table yet", async () => {
    vi.setSystemTime(new Date(2026, 9, 18, 12));
    const calls = stubFeeds({
      games: pageOct18,
      standings: () => json(zeroTable),
      header: () => json(preseason2026),
    });
    const data = await getNbaData();

    expect(calls()).toHaveLength(2);
    expect(calls()).toEqual(expect.arrayContaining([STANDINGS(2027), HEADER("20261001-20261019")]));
    expect(data.season).toBe("2026–27");
    // The preseason's last two weeks of results, then the opening week;
    // June's finals belong to 2025–26 and are not listed.
    expect(fixtures(data)).toEqual([
      "MIA@TOR", "HOU@DAL", "LON@POR", "MIL@IND", "ATL@DAL", "SAC@SAS", "CHA@MEM", "WAS@NOP", "MIN@CHI",
      "POR@GSW", "UTA@PHX", "DEN@LAL",
      "BOS@DET", "PHI@NYK", "OKC@SAS", "ATL@ORL", "MIL@WAS", "MIN@MIA", "CHA@BKN", "CHI@TOR", "UTA@MEM",
      "GSW@LAL",
    ]);
    expect(data.games.map((g) => g.stageLabel ?? "")).toEqual([
      ...Array(12).fill("Preseason"),
      ...Array(10).fill(""),
    ]);
    expect(data.champion).toEqual({
      season: "2025–26",
      teamId: "NYK",
      summary: "New York Knicks, 4–1 over San Antonio",
    });
    expect(data.tipOff).toBe("2026-10-20T19:00:00.000Z");
    expect(data.standings).toEqual([]);
    expect(data.playoffs).toEqual([]);
    // Every team the view will draw resolves, the champion included.
    const ids = new Set(data.teams.map((t) => t.id));
    expect(data.games.every((g) => ids.has(g.homeTeamId) && ids.has(g.awayTeamId))).toBe(true);
    expect(data.teams.find((t) => t.id === "NYK")?.name).toBe("New York Knicks");
  });

  it("still lists balldontlie's fixtures when ESPN's preseason does not answer", async () => {
    vi.setSystemTime(new Date(2026, 9, 18, 12));
    stubFeeds({ games: pageOct18, standings: () => json(zeroTable), header: () => json({}, 502) });
    const data = await getNbaData();

    expect(data).not.toBe(NBA_DATA);
    expect(fixtures(data)).toEqual([
      "BOS@DET", "PHI@NYK", "OKC@SAS", "ATL@ORL", "MIL@WAS", "MIN@MIA", "CHA@BKN", "CHI@TOR", "UTA@MEM",
      "GSW@LAL",
    ]);
    expect(data.champion?.teamId).toBe("NYK");
    expect(data.tipOff).toBe("2026-10-20T19:00:00.000Z");
  });

  it("drops the preseason and the champion from the opener on, and the table starts", async () => {
    vi.setSystemTime(new Date(2026, 9, 21, 12));
    const calls = stubFeeds({
      games: pageOct21,
      standings: () => json(openingNightTable),
      header: () => json(preseason2026),
    });
    const data = await getNbaData();

    expect(calls()).toEqual([STANDINGS(2027)]);
    expect(data.season).toBe("2026–27");
    expect(data.games.slice(0, 3).map((g) => g.status)).toEqual(["ft", "ft", "ft"]);
    expect(data.games).toHaveLength(10);
    expect(data.games.some((g) => g.stageLabel)).toBe(false);
    expect(data.champion).toBeUndefined();
    expect(data.tipOff).toBeUndefined();
    expect(data.standings.map((s) => s.teamId)).toEqual(["DET", "ATL", "BOS", "NOP"]);
  });

  it("stays on 2025–26 all summer: its finals alone, its table and its bracket", async () => {
    vi.setSystemTime(new Date(2026, 6, 15, 12));
    const calls = stubFeeds({ games: pageOct18, header: () => json(postseason2026) });
    const data = await getNbaData();

    expect(calls()).toHaveLength(2);
    expect(calls()).toEqual(expect.arrayContaining([STANDINGS(2026), HEADER("20260410-20260731")]));
    expect(data.season).toBe("2025–26");
    expect(fixtures(data)).toEqual(["NYK@SAS", "NYK@SAS", "SAS@NYK", "SAS@NYK", "NYK@SAS"]);
    expect(data.games.every((g) => g.stageLabel === "Playoffs")).toBe(true);
    expect(data.champion).toBeUndefined();
    expect(data.tipOff).toBeUndefined();
    expect(data.playoffs?.map((r) => r.matches.length)).toEqual([8, 4, 2, 1]);
  });

  it("reads the bracket of the season being played in May", async () => {
    vi.setSystemTime(new Date(2027, 4, 20, 12));
    const calls = stubFeeds({
      games: [bdlGame("2027-05-19", true, 2026)],
      header: () => json(postseason2026),
    });
    const data = await getNbaData();

    expect(calls()).toHaveLength(2);
    expect(calls()).toEqual(expect.arrayContaining([STANDINGS(2027), HEADER("20270410-20270731")]));
    expect(data.season).toBe("2026–27");
    expect(data.games).toHaveLength(1);
    expect(data.tipOff).toBeUndefined();
  });

  it("names no tip-off and no champion across the All-Star break", async () => {
    vi.setSystemTime(new Date(2026, 1, 17, 12));
    const fixture = (date: string) => ({
      ...bdlGame(date, false),
      datetime: `${date}T00:30:00Z`,
      status: `${date}T00:30:00Z`,
      status_state: "scheduled",
    });
    const calls = stubFeeds({
      games: [fixture("2026-02-19"), fixture("2026-02-20"), fixture("2026-02-21")],
      header: () => json(preseason2026),
    });
    const data = await getNbaData();

    expect(data).not.toBe(NBA_DATA);
    expect(data.season).toBe("2025–26");
    expect(data.games).toHaveLength(3);
    expect(data.tipOff).toBeUndefined();
    expect(data.champion).toBeUndefined();
    expect(calls()).toEqual([STANDINGS(2026)]);
  });

  it("makes no extra request in the middle of the season", async () => {
    vi.setSystemTime(new Date(2026, 11, 15, 12));
    const calls = stubFeeds({
      games: [bdlGame("2026-12-14", false, 2026)],
      header: () => json(postseason2026),
    });
    const data = await getNbaData();

    expect(data).not.toBe(NBA_DATA);
    expect(calls()).toEqual([STANDINGS(2027)]);
    expect(data.playoffs).toEqual([]);
  });

  it("reads the whole bracket in one request while there is a postseason", async () => {
    vi.setSystemTime(new Date(2026, 4, 20, 12));
    const calls = stubFeeds({ games: [bdlGame("2026-05-19", true)], header: () => json(postseason2026) });
    const data = await getNbaData();

    expect(calls().filter((url) => url.includes("/scoreboard"))).toEqual([HEADER("20260410-20260731")]);
    expect(data.playoffs?.map((r) => r.matches.length)).toEqual([8, 4, 2, 1]);
    // The table came back empty, and every team in the bracket still resolves.
    expect(data.teams.find((t) => t.id === "SAS")?.logoUrl).toBe(logo("sa"));
  });

  it("keeps the games when the bracket's request fails", async () => {
    vi.setSystemTime(new Date(2026, 4, 20, 12));
    stubFeeds({ games: [bdlGame("2026-05-19", true)], header: () => json({}, 500) });
    const data = await getNbaData();

    expect(data).not.toBe(NBA_DATA);
    expect(data.games).toHaveLength(1);
    expect(data.playoffs).toEqual([]);
  });
});
