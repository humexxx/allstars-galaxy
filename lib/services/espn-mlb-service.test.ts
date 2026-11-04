import { afterEach, describe, expect, it, vi } from "vitest";

import { MLB_DATA } from "@/lib/data/sports/mlb";

import type { HeaderEvent } from "./espn-scoreboard";
import { __testing, getMlbData } from "./espn-mlb-service";

const { gameFrom, mlbDataFrom, playoffsFrom, postseasonYear, stageLabel, standingsFrom, statusText, teamsFrom } =
  __testing;

type Status = "FINAL" | "POSTPONED" | "SCHEDULED" | "IN_PROGRESS";

/**
 * One game as the scores bar sends it, trimmed to what is read: the id, the
 * start, ESPN's note, the away side and its runs, the home side and its runs,
 * the status and the inning it stands in.
 */
function event(
  [id, date, note, away, awayScore, home, homeScore, name, period]: [
    string, string, string, string, string, string, string, Status, number,
  ],
  extra: Partial<HeaderEvent> = {}
): HeaderEvent {
  const state = name === "FINAL" || name === "POSTPONED" ? "post" : name === "IN_PROGRESS" ? "in" : "pre";
  const final = name === "FINAL";
  const side = (homeAway: "home" | "away", code: string, score: string, other: string) => ({
    homeAway,
    abbreviation: code,
    displayName: `${code} full`,
    name: code.toLowerCase(),
    color: "123456",
    score,
    winner: final && Number(score) > Number(other),
  });
  return {
    id,
    date,
    season: 2026,
    seasonType: "3",
    note,
    notes: [{ headline: note }],
    broadcast: "Fox",
    fullStatus: {
      period,
      periodPrefix: "Top",
      type: { name: `STATUS_${name}`, state, detail: final ? (period === 9 ? "Final" : `Final/${period}`) : name },
    },
    competitors: [side("away", away, awayScore, homeScore), side("home", home, homeScore, awayScore)],
    ...extra,
  };
}

// The 2026 postseason through Game 2 of the World Series, as ESPN had it on Oct 25.
const POSTSEASON: HeaderEvent[] = (
  [
    ["401907965", "2026-09-29T18:00:00Z", "NLWC - Game 1", "PHI", "3", "ATL", "5", "FINAL", 9],
    ["401907896", "2026-09-29T21:00:00Z", "ALWC - Game 1", "CHW", "6", "HOU", "3", "FINAL", 9],
    ["401907924", "2026-09-30T00:00:00Z", "ALWC - Game 1", "BOS", "0", "NYY", "9", "FINAL", 9],
    ["401907974", "2026-09-30T02:00:00Z", "NLWC - Game 1", "CHC", "0", "SD", "8", "FINAL", 9],
    ["401907972", "2026-09-30T18:00:00Z", "NLWC - Game 2", "PHI", "4", "ATL", "3", "FINAL", 10],
    ["401907897", "2026-09-30T21:00:00Z", "ALWC - Game 2", "CHW", "7", "HOU", "3", "FINAL", 9],
    ["401907963", "2026-10-01T00:00:00Z", "ALWC - Game 2", "BOS", "2", "NYY", "9", "FINAL", 9],
    ["401907975", "2026-10-01T02:00:00Z", "NLWC - Game 2", "CHC", "1", "SD", "4", "FINAL", 9],
    ["401907973", "2026-10-02T00:00:00Z", "NLWC - Game 3", "PHI", "2", "ATL", "6", "FINAL", 9],
    ["401907990", "2026-10-03T17:00:00Z", "ALDS - Game 1", "CHW", "3", "CLE", "0", "FINAL", 9],
    ["401908007", "2026-10-03T20:00:00Z", "NLDS - Game 1", "ATL", "3", "LAD", "5", "FINAL", 9],
    ["401907985", "2026-10-03T22:30:00Z", "ALDS - Game 1", "NYY", "0", "TB", "1", "FINAL", 9],
    ["401908002", "2026-10-04T00:30:00Z", "NLDS - Game 1", "SD", "2", "MIL", "3", "FINAL", 9],
    ["401908003", "2026-10-04T20:00:00Z", "NLDS - Game 2", "SD", "3", "MIL", "4", "FINAL", 9],
    ["401908014", "2026-10-05T00:00:00Z", "NLDS - Game 2", "ATL", "3", "LAD", "2", "FINAL", 9],
    ["401907991", "2026-10-05T21:00:00Z", "ALDS - Game 2", "CHW", "4", "CLE", "3", "FINAL", 9],
    ["401907986", "2026-10-06T00:00:00Z", "ALDS - Game 2", "NYY", "2", "TB", "5", "FINAL", 9],
    ["401908015", "2026-10-06T22:00:00Z", "NLDS - Game 3", "LAD", "3", "ATL", "1", "FINAL", 9],
    ["401908004", "2026-10-07T01:30:00Z", "NLDS - Game 3", "MIL", "3", "SD", "4", "FINAL", 9],
    ["401907992", "2026-10-07T20:00:00Z", "ALDS - Game 3", "CLE", "9", "CHW", "3", "FINAL", 9],
    ["401908016", "2026-10-07T22:00:00Z", "NLDS - Game 4", "LAD", "4", "ATL", "1", "FINAL", 9],
    ["401907987", "2026-10-08T00:00:00Z", "ALDS - Game 3", "TB", "4", "NYY", "3", "FINAL", 9],
    ["401908005", "2026-10-08T02:00:00Z", "NLDS - Game 4", "MIL", "3", "SD", "1", "FINAL", 9],
    ["401907993", "2026-10-09T00:00:00Z", "ALDS - Game 4", "CLE", "9", "CHW", "5", "FINAL", 9],
    ["401907994", "2026-10-11T00:00:00Z", "ALDS - Game 5", "CHW", "0", "CLE", "2", "FINAL", 9],
    ["401908030", "2026-10-12T00:00:00Z", "NLCS - Game 1", "LAD", "1", "MIL", "2", "FINAL", 9],
    ["401908031", "2026-10-12T21:00:00Z", "NLCS - Game 2", "LAD", "4", "MIL", "7", "FINAL", 9],
    ["401908023", "2026-10-13T00:00:00Z", "ALCS - Game 1", "CLE", "7", "TB", "3", "FINAL", 9],
    ["401908024", "2026-10-14T00:00:00Z", "ALCS - Game 2", "CLE", "1", "TB", "3", "FINAL", 9],
    ["401908032", "2026-10-15T00:00:00Z", "NLCS - Game 3", "MIL", "6", "LAD", "2", "FINAL", 9],
    ["401908025", "2026-10-15T17:00:00Z", "ALCS - Game 3", "TB", "2", "CLE", "3", "FINAL", 9],
    ["401908033", "2026-10-16T00:00:00Z", "NLCS - Game 4", "MIL", "6", "LAD", "4", "FINAL", 9],
    ["401908026", "2026-10-17T00:00:00Z", "ALCS - Game 4 Rain - Makeup on Oct 18", "TB", "0", "CLE", "0", "POSTPONED", 1],
    ["401908027", "2026-10-18T00:00:00Z", "ALCS - Game 4", "TB", "7", "CLE", "3", "FINAL", 9],
    ["401930515", "2026-10-18T21:00:00Z", "ALCS - Game 5", "TB", "3", "CLE", "1", "FINAL", 9],
    ["401908028", "2026-10-20T00:00:00Z", "ALCS - Game 6", "CLE", "3", "TB", "7", "FINAL", 9],
    ["401908042", "2026-10-24T00:00:00Z", "World Series - Game 1", "TB", "2", "MIL", "3", "FINAL", 9],
    ["401908043", "2026-10-25T00:00:00Z", "World Series - Game 2", "TB", "4", "MIL", "5", "FINAL", 9],
    ["401908044", "2026-10-27T00:00:00Z", "World Series - Game 3", "MIL", "", "TB", "", "SCHEDULED", 1],
    ["401908045", "2026-10-28T00:00:00Z", "World Series - Game 4", "MIL", "", "TB", "", "SCHEDULED", 1],
    ["401908046", "2026-10-29T00:00:00Z", "World Series - Game 5 If Necessary", "MIL", "", "TB", "", "SCHEDULED", 1],
    ["401908047", "2026-10-31T00:00:00Z", "World Series - Game 6 If Necessary", "TB", "", "MIL", "", "SCHEDULED", 1],
    ["401908048", "2026-11-01T00:00:00Z", "World Series - Game 7 If Necessary", "TB", "", "MIL", "", "SCHEDULED", 1],
  ] as const
).map((row) => event([...row]));

const byId = (id: string): HeaderEvent => POSTSEASON.find((e) => e.id === id)!;

describe("gameFrom", () => {
  it("labels a postseason game by its round and game, without ESPN's dash", () => {
    const { match, teams } = gameFrom(byId("401908043"))!;
    expect(match).toMatchObject({
      homeTeamId: "mil",
      awayTeamId: "tb",
      homeScore: 5,
      awayScore: 4,
      status: "ft",
      stageLabel: "World Series · Game 2",
      broadcasts: ["Fox"],
    });
    // Nine innings: the plain FT.
    expect(match).not.toHaveProperty("statusText");
    expect(teams.map((t) => t.id)).toEqual(["mil", "tb"]);
  });

  it("says when a final went to extra innings", () => {
    expect(gameFrom(byId("401907972"))!.match.statusText).toEqual({
      short: "F/10",
      spoken: "Final after 10 innings",
    });
  });

  it("keeps the rainout as postponed, without its 0–0 or its makeup note", () => {
    expect(gameFrom(byId("401908026"))!.match).toMatchObject({
      status: "postponed",
      homeScore: null,
      awayScore: null,
      stageLabel: "ALCS · Game 4",
    });
  });

  it("drops MLB.TV, which streams nearly every game", () => {
    const regular = event(["1", "2026-08-01T23:05:00Z", "", "NYY", "3", "BOS", "2", "FINAL", 9], {
      seasonType: "2",
      broadcast: "MLB.TV/FS1",
    });
    expect(gameFrom(regular)!.match.broadcasts).toEqual(["FS1"]);
    const streamedOnly = { ...regular, broadcast: "MLB.TV" };
    expect(gameFrom(streamedOnly)!.match).not.toHaveProperty("broadcasts");
  });

  it("leaves the All-Star Game out: neither side is a club", () => {
    const allStar = event(["2", "2026-07-15T00:00:00Z", "", "AL", "4", "NL", "3", "FINAL", 9], { seasonType: "2" });
    allStar.competitors = allStar.competitors!.map((c, i) => ({ ...c, id: i === 0 ? "31" : "32" }));
    expect(gameFrom(allStar)).toBeNull();
  });

  it("gives a club whose logo is drawn in its own colour a white disc", () => {
    const { teams } = gameFrom(byId("401908030"))!;
    expect(teams.find((t) => t.id === "lad")!.primaryColor).toBe("#FFFFFF");
    expect(teams.find((t) => t.id === "mil")!.primaryColor).toBe("#123456");
  });
});

describe("statusText", () => {
  const live = (periodPrefix: string, period: number) => ({
    period,
    periodPrefix,
    type: { name: "STATUS_IN_PROGRESS", state: "in" as const, shortDetail: `${periodPrefix} ${period}th` },
  });

  it("names the half-inning while a game is on, in words for a listener", () => {
    expect(statusText(live("Top", 7), "live")).toEqual({ short: "Top 7th", spoken: "Top of the 7th inning" });
    expect(statusText(live("Bot", 7), "live")).toEqual({ short: "Bot 7th", spoken: "Bottom of the 7th inning" });
    expect(statusText(live("Mid", 3), "live")).toEqual({ short: "Mid 3rd", spoken: "Middle of the 3rd inning" });
    expect(statusText(live("End", 1), "live")).toEqual({ short: "End 1st", spoken: "End of the 1st inning" });
    expect(statusText(live("Bottom", 11), "live")).toEqual({ short: "Bot 11th", spoken: "Bottom of the 11th inning" });
  });

  it("reads the half-inning off ESPN's short line when the prefix is missing", () => {
    expect(
      statusText({ type: { name: "STATUS_IN_PROGRESS", state: "in", shortDetail: "Bot 2nd" } }, "live")
    ).toEqual({ short: "Bot 2nd", spoken: "Bottom of the 2nd inning" });
  });

  it("says a delay is one", () => {
    expect(statusText({ type: { name: "STATUS_RAIN_DELAY", state: "in" } }, "live")).toEqual({
      short: "Delay",
      spoken: "Rain delay",
    });
    expect(statusText({ type: { name: "STATUS_DELAYED", state: "in" } }, "live")).toEqual({
      short: "Delay",
      spoken: "Delayed",
    });
  });

  it("counts the innings of a final that was not nine, a rain-shortened one too", () => {
    const final = (detail: string, period: number) => ({
      period,
      type: { name: "STATUS_FINAL", state: "post" as const, detail },
    });
    expect(statusText(final("Final/13", 13), "ft")).toEqual({ short: "F/13", spoken: "Final after 13 innings" });
    expect(statusText(final("Final/6", 6), "ft")).toEqual({ short: "F/6", spoken: "Final after 6 innings" });
    expect(statusText(final("Final", 9), "ft")).toBeUndefined();
    expect(statusText({ period: 1, type: { name: "STATUS_SCHEDULED", state: "pre" } }, "scheduled")).toBeUndefined();
  });
});

describe("stageLabel", () => {
  it("spells out a Wild Card and marks a game that may not be needed", () => {
    expect(stageLabel(byId("401907973"))).toBe("NL Wild Card · Game 3");
    expect(stageLabel(byId("401907994"))).toBe("ALDS · Game 5");
    expect(stageLabel(byId("401908047"))).toBe("World Series · Game 6, if necessary");
  });

  it("has none in the regular season, whose notes are doubleheaders and makeups, and names spring training", () => {
    const regular = event(["3", "2026-08-12T23:05:00Z", "Makeup from June 21", "NYY", "3", "BOS", "2", "FINAL", 9], {
      seasonType: "2",
    });
    expect(stageLabel(regular)).toBeUndefined();
    expect(stageLabel({ ...regular, seasonType: "1", note: undefined, notes: [] })).toBe("Spring Training");
  });
});

describe("playoffsFrom", () => {
  const rounds = playoffsFrom(POSTSEASON).rounds;
  const pairs = (i: number) =>
    rounds[i].matches.map((m) => [m.homeTeamId, m.homeScore, m.awayScore, m.awayTeamId, m.winnerTeamId]);

  it("builds every round as series of its own length, the AL's half first", () => {
    expect(rounds.map((r) => [r.id, r.label, r.matches.map((m) => m.bestOf)])).toEqual([
      ["round-of-16", "Wild Card", [3, 3, 3, 3]],
      ["quarter-final", "Division Series", [5, 5, 5, 5]],
      ["semi-final", "Championship Series", [7, 7]],
      ["final", "World Series", [7]],
    ]);
    expect(pairs(0)).toEqual([
      ["hou", 0, 2, "chw", "chw"],
      ["nyy", 2, 0, "bos", "nyy"],
      ["atl", 2, 1, "phi", "atl"],
      ["sd", 2, 0, "chc", "sd"],
    ]);
    expect(pairs(1)).toEqual([
      ["cle", 3, 2, "chw", "cle"],
      ["tb", 3, 0, "nyy", "tb"],
      ["lad", 3, 1, "atl", "lad"],
      ["mil", 3, 1, "sd", "mil"],
    ]);
  });

  it("counts the rained-out ALCS game once, by its makeup", () => {
    expect(pairs(2)).toEqual([
      ["tb", 4, 2, "cle", "tb"],
      ["mil", 4, 0, "lad", "mil"],
    ]);
    expect(rounds[2].matches[0].date).toBe("2026-10-20T00:00:00Z");
  });

  it("leaves the World Series open at 2–0, dated by its next game, the AL's champion first", () => {
    // It opened at Milwaukee: by game one's home side, the NL would be drawn on the AL's side.
    expect(rounds[3].matches[0]).toEqual({
      id: "mlb-final",
      homeTeamId: "tb",
      awayTeamId: "mil",
      homeScore: 0,
      awayScore: 2,
      winnerTeamId: null,
      date: "2026-10-27T00:00:00Z",
      bestOf: 7,
    });
  });

  it("keeps the later rounds as TBD once the Wild Card has started", () => {
    const wildCardDay = playoffsFrom(POSTSEASON.slice(0, 4)).rounds;
    expect(wildCardDay.map((r) => r.matches.length)).toEqual([4, 4, 2, 1]);
    expect(wildCardDay[1].matches.every((m) => m.homeTeamId === null)).toBe(true);
  });

  it("places a game by its round's type when ESPN's note does not name the league", () => {
    const series = POSTSEASON.filter((e) => e.notes?.[0]?.headline?.startsWith("ALDS")).map((e) => ({
      ...e,
      note: "",
      notes: [],
      competitionType: { abbreviation: "DIV" },
    }));
    const divisionSeries = playoffsFrom(series).rounds;
    expect(divisionSeries.map((r) => r.id)).toEqual(["quarter-final", "semi-final", "final"]);
    expect(divisionSeries[0].matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]).filter(Boolean).sort()).toEqual(
      ["chw", "cle", "nyy", "tb"]
    );
  });

  it("has no bracket from the regular season", () => {
    const regular = POSTSEASON.slice(0, 4).map((e) => ({ ...e, seasonType: "2" }));
    expect(playoffsFrom(regular).rounds).toEqual([]);
  });
});

describe("standingsFrom", () => {
  const entry = (abbreviation: string, stats: Record<string, number | string>) => ({
    team: {
      abbreviation,
      displayName: `${abbreviation} full`,
      shortDisplayName: abbreviation.toLowerCase(),
      logos: [{ href: `https://a.espncdn.com/i/teamlogos/mlb/500/${abbreviation.toLowerCase()}.png` }],
    },
    stats: Object.entries(stats).map(([name, v]) => ({
      name,
      displayValue: String(v),
      value: typeof v === "number" ? v : null,
    })),
  });
  const row = (seed: number, w: number, l: number, pct: number, gb: number | "-", streak: string) => ({
    playoffSeed: seed,
    wins: w,
    losses: l,
    winPercent: pct,
    // The leader's reads "-" with a value of 0.
    divisionGamesBehind: gb,
    streak,
  });

  // `standings?level=3` at the end of the 2026 regular season, trimmed: the AL East
  // in ESPN's order, its leader last.
  const table = {
    children: [
      {
        abbreviation: "AL",
        children: [
          {
            abbreviation: "ALE",
            standings: {
              season: 2026,
              entries: [
                entry("NYY", row(4, 93, 68, 0.5776, 4.5, "W1")),
                entry("BOS", row(5, 87, 75, 0.537, 11, "L1")),
                entry("TB", row(1, 98, 64, 0.6049, "-", "L1")),
              ],
            },
          },
          {
            abbreviation: "ALC",
            standings: { entries: [entry("CLE", row(2, 85, 77, 0.5247, 0, "L1"))] },
          },
        ],
      },
      {
        abbreviation: "NL",
        children: [
          {
            abbreviation: "NLC",
            standings: {
              entries: [entry("CHC", row(5, 89, 73, 0.5494, 14, "W1")), entry("MIL", row(1, 103, 59, 0.6358, 0, "W5"))],
            },
          },
        ],
      },
    ],
  };

  it("places each team at its league seed, in its division, the leader no games behind", () => {
    const { standings, teams, season } = standingsFrom(table);
    expect(standings.map((s) => [s.league, s.position, s.teamId, s.division, s.gamesBehind])).toEqual([
      ["al", 1, "tb", "al-east", 0],
      ["al", 2, "cle", "al-central", 0],
      ["al", 3, "nyy", "al-east", 4.5],
      ["al", 4, "bos", "al-east", 11],
      ["nl", 1, "mil", "nl-central", 0],
      ["nl", 2, "chc", "nl-central", 14],
    ]);
    expect(standings[0]).toMatchObject({ wins: 98, losses: 64, pct: 0.6049, streak: "L1" });
    expect(teams).toHaveLength(6);
    expect(season).toBe(2026);
  });

  it("orders by winning percentage before the seeds are out", () => {
    const unseeded = structuredClone(table);
    for (const league of unseeded.children) {
      for (const division of league.children) {
        for (const e of division.standings.entries) e.stats = e.stats.filter((s) => s.name !== "playoffSeed");
      }
    }
    expect(standingsFrom(unseeded).standings.filter((s) => s.league === "al").map((s) => s.teamId)).toEqual([
      "tb",
      "nyy",
      "bos",
      "cle",
    ]);
  });
});

describe("teamsFrom", () => {
  it("takes every club with its colour and default logo, and white where the logo is drawn in it", () => {
    const teams = teamsFrom({
      sports: [
        {
          leagues: [
            {
              teams: [
                {
                  team: {
                    abbreviation: "ARI",
                    displayName: "Arizona Diamondbacks",
                    shortDisplayName: "Diamondbacks",
                    color: "aa182c",
                    logos: [{ href: "https://a.espncdn.com/i/teamlogos/mlb/500/ari.png" }],
                  },
                },
                { team: { abbreviation: "NYY", displayName: "New York Yankees", shortDisplayName: "Yankees", color: "132448" } },
              ],
            },
          ],
        },
      ],
    });
    expect(teams).toEqual([
      {
        id: "ari",
        name: "Arizona Diamondbacks",
        shortName: "Diamondbacks",
        code: "ARI",
        logoUrl: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/mlb/500/ari.png&w=96&h=96&scale=crop",
        primaryColor: "#aa182c",
      },
      { id: "nyy", name: "New York Yankees", shortName: "Yankees", code: "NYY", logoUrl: undefined, primaryColor: "#FFFFFF" },
    ]);
  });
});

describe("mlbDataFrom", () => {
  const today = new Date("2026-10-25T20:00:00Z");
  const days = POSTSEASON.filter((e) => e.date! >= "2026-10-11");

  it("lists the days' games once each, the live and next first, with the bracket", () => {
    const data = mlbDataFrom({ teams: null, standings: null, days: [...days, byId("401908043")], postseason: POSTSEASON }, today);
    expect(data.season).toBe(2026);
    expect(data.games).toHaveLength(days.length);
    expect(data.games[0]).toMatchObject({ id: "401908044", status: "scheduled" });
    expect(data.playoffs.map((r) => r.id)).toEqual(["round-of-16", "quarter-final", "semi-final", "final"]);
    // A Wild Card club out of the window still has its badge in the bracket.
    expect(data.teams.map((t) => t.id)).toContain("hou");
  });

  it("gives up for the hand-written season when there are neither games nor a table", () => {
    expect(() => mlbDataFrom({ teams: null, standings: null, days: [], postseason: POSTSEASON }, today)).toThrow(
      /neither games nor standings/
    );
  });
});

describe("postseasonYear", () => {
  it("reads this year's postseason from late September, and last year's through the winter", () => {
    expect(postseasonYear(new Date("2026-10-25T12:00:00Z"))).toBe(2026);
    expect(postseasonYear(new Date("2026-09-26T00:00:00Z"))).toBe(2026);
    expect(postseasonYear(new Date("2027-01-20T12:00:00Z"))).toBe(2026);
  });

  it("asks for none from spring training through the regular season", () => {
    expect(postseasonYear(new Date("2027-02-20T12:00:00Z"))).toBeNull();
    expect(postseasonYear(new Date("2026-07-04T12:00:00Z"))).toBeNull();
  });
});

describe("getMlbData", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reads the teams, the table, four weeks of days and the postseason, and maps them", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-25T20:00:00Z"), toFake: ["Date"] });
    const fetchMock = vi.fn(async (url: string) => {
      const events = url.includes("20260926-20261115")
        ? POSTSEASON
        : url.includes("20261025-20261031")
          ? POSTSEASON.filter((e) => e.date! >= "2026-10-25")
          : [];
      const json = url.includes("scoreboard/header") ? { sports: [{ leagues: [{ events }] }] } : {};
      return { ok: true, json: async () => json } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await getMlbData();

    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toContain("https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams");
    expect(urls).toContain("https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings?level=3");
    expect(urls.flatMap((u) => u.match(/dates=([\d-]+)/)?.[1] ?? [])).toEqual([
      "20261011-20261017",
      "20261018-20261024",
      "20261025-20261031",
      "20261101-20261107",
      "20260926-20261115",
    ]);
    expect(data).not.toBe(MLB_DATA);
    // What is next soonest first, then the latest result.
    expect(data.games.map((g) => g.id)).toEqual([
      "401908044",
      "401908045",
      "401908046",
      "401908047",
      "401908048",
      "401908043",
    ]);
    expect(data.playoffs).toHaveLength(4);
  });

  it("fails rather than cache a season without its games when only the scores bar is down", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-25T20:00:00Z"), toFake: ["Date"] });
    const standings = {
      children: [
        {
          abbreviation: "AL",
          children: [
            {
              abbreviation: "ALE",
              standings: { season: 2026, entries: [{ team: { abbreviation: "TB" }, stats: [{ name: "wins", value: 98 }] }] },
            },
          ],
        },
      ],
    };
    const answer = (scoresBar: "up" | "postseason down" | "down") =>
      vi.fn(async (url: string) => {
        const header = url.includes("scoreboard/header");
        const down = header && (scoresBar === "down" || (scoresBar === "postseason down" && url.includes("20260926")));
        if (down) return { ok: false, status: 502 } as Response;
        const json = header ? { sports: [] } : url.includes("standings") ? standings : {};
        return { ok: true, json: async () => json } as Response;
      });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // The table alone is an answer while the scores bar answers, empty.
    vi.stubGlobal("fetch", answer("up"));
    expect((await getMlbData()).standings.map((s) => s.teamId)).toEqual(["tb"]);

    vi.stubGlobal("fetch", answer("down"));
    expect(await getMlbData()).toBe(MLB_DATA);
    vi.stubGlobal("fetch", answer("postseason down"));
    expect(await getMlbData()).toBe(MLB_DATA);
  });

  it("falls back to the hand-written season when ESPN does not answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 }) as Response));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await getMlbData()).toBe(MLB_DATA);
  });
});
