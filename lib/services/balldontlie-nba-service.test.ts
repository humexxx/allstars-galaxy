import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NBA_DATA } from "@/lib/data/sports/nba";
import type { BracketMatch, BracketRound } from "@/types/sports";

import postseason2026 from "./__fixtures__/espn-nba-postseason-2026.json";
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

describe("playoffYear", () => {
  const finals = { ...game("2026-06-10", true), postseason: true };

  it("asks for no bracket out of season", () => {
    expect(playoffYear(new Date(2026, 11, 15, 12), [game("2026-12-14", true) as never])).toBeNull();
    expect(playoffYear(new Date(2027, 2, 20, 12), [])).toBeNull();
    expect(playoffYear(new Date(2027, 3, 9, 12), [])).toBeNull();
    expect(playoffYear(new Date(2026, 6, 1, 12), [])).toBeNull();
  });

  it("reads one from the regular season's last week to the end of June", () => {
    expect(playoffYear(new Date(2027, 3, 10, 12), [])).toBe(2027);
    expect(playoffYear(new Date(2027, 4, 20, 12), [])).toBe(2027);
    expect(playoffYear(new Date(2027, 5, 30, 12), [])).toBe(2027);
  });

  it("keeps it while balldontlie still shows the finals, named by their season", () => {
    // Mid-October the opener is days away, but the latest results are still
    // 2025–26's finals: a 2026 postseason, not a 2027 one.
    expect(playoffYear(new Date(2026, 9, 18, 12), [finals as never])).toBe(2026);
    expect(playoffYear(new Date(2026, 7, 1, 12), [finals as never])).toBe(2026);
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

describe("getNbaData's postseason", () => {
  const SCOREBOARD =
    "https://site.web.api.espn.com/apis/v2/scoreboard/header?sport=basketball&league=nba&dates=20260410-20260731&limit=300";

  const bdlTeam = (abbreviation: string) => ({
    id: 1,
    full_name: abbreviation,
    name: abbreviation,
    abbreviation,
    conference: "East",
  });
  const bdlGame = (date: string, postseason: boolean) => ({
    ...game(date, true),
    postseason,
    home_team: bdlTeam("NYK"),
    visitor_team: bdlTeam("CLE"),
  });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  const stubFetch = (games: unknown[], scoreboard: () => Response): (() => string[]) => {
    const spy = vi.fn((url: string) =>
      Promise.resolve(
        url.includes("api.balldontlie.io")
          ? json({ data: games })
          : url.includes("/standings")
            ? json({ children: [] })
            : scoreboard()
      )
    );
    vi.stubGlobal("fetch", spy);
    return () => spy.mock.calls.map(([url]) => url).filter((url) => url.includes("/scoreboard"));
  };

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

  it("makes no extra request out of season", async () => {
    vi.setSystemTime(new Date(2026, 11, 15, 12));
    const scoreboardCalls = stubFetch([bdlGame("2026-12-14", false)], () => json(postseason2026));
    const data = await getNbaData();
    expect(data).not.toBe(NBA_DATA);
    expect(scoreboardCalls()).toEqual([]);
    expect(data.playoffs).toEqual([]);
  });

  it("reads the whole bracket in one request while there is a postseason", async () => {
    vi.setSystemTime(new Date(2026, 4, 20, 12));
    const scoreboardCalls = stubFetch([bdlGame("2026-05-19", true)], () => json(postseason2026));
    const data = await getNbaData();
    expect(scoreboardCalls()).toEqual([SCOREBOARD]);
    expect(data.playoffs?.map((r) => r.matches.length)).toEqual([8, 4, 2, 1]);
    // The table came back empty, and every team in the bracket still resolves.
    expect(data.teams.find((t) => t.id === "SAS")?.logoUrl).toBe(logo("sa"));
  });

  it("keeps the games when the bracket's request fails", async () => {
    vi.setSystemTime(new Date(2026, 4, 20, 12));
    stubFetch([bdlGame("2026-05-19", true)], () => json({}, 500));
    const data = await getNbaData();
    expect(data).not.toBe(NBA_DATA);
    expect(data.games).toHaveLength(1);
    expect(data.playoffs).toEqual([]);
  });
});
