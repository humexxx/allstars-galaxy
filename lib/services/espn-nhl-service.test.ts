import { afterEach, describe, expect, it, vi } from "vitest";

import { NHL_DATA } from "@/lib/data/sports/nhl";

import type { NhlDivision } from "@/types/sports";

import type { HeaderEvent } from "./espn-scoreboard";
import { __testing, getNhlData } from "./espn-nhl-service";

const { gameFrom, nhlDataFrom, playoffsFrom, postseasonYear, stageLabel, standingsFrom, statusText, teamFrom, teamsFrom } =
  __testing;

/** The scores bar's status, with the fields hockey reads that baseball does not. */
type EventStatus = NonNullable<HeaderEvent["fullStatus"]> & {
  displayPeriod?: string | null;
  type?: { altDetail?: string };
};

type Row = [
  id: string,
  date: string,
  note: string,
  away: string,
  awayScore: string,
  awayGroup: string,
  awaySeed: number,
  home: string,
  homeScore: string,
  homeGroup: string,
  homeSeed: number,
  /** ESPN's `altDetail` on a final past regulation: "OT", "2OT", "SO". */
  altDetail: string,
];

/**
 * One finished playoff game as the scores bar sends it, trimmed to what is
 * read: the id, the start, ESPN's note, each side with its goals, its
 * division's group id and its conference seed, and how the game ended.
 */
function playoffEvent([id, date, note, away, awayScore, awayGroup, awaySeed, home, homeScore, homeGroup, homeSeed, altDetail]: Row): HeaderEvent {
  const side = (homeAway: "home" | "away", code: string, score: string, other: string, group: string, seed: number) => ({
    id: code,
    homeAway,
    abbreviation: code,
    displayName: `${code} full`,
    name: code.toLowerCase(),
    color: "123456",
    logo: `https://a.espncdn.com/i/teamlogos/nhl/500/scoreboard/${code.toLowerCase()}.png`,
    score,
    winner: Number(score) > Number(other),
    group,
    recordStats: { playoffSeed: { value: seed } },
  });
  return {
    id,
    date,
    season: 2026,
    seasonType: "3",
    note,
    notes: [{ headline: note }],
    broadcast: "ESPN",
    fullStatus: {
      period: altDetail === "" ? 3 : altDetail === "OT" ? 4 : 5,
      type: {
        name: "STATUS_FINAL",
        state: "post",
        completed: true,
        detail: altDetail ? `Final/${altDetail}` : "Final",
        ...(altDetail ? { altDetail } : {}),
      },
    } satisfies EventStatus,
    competitors: [
      side("away", away, awayScore, homeScore, awayGroup, awaySeed),
      side("home", home, homeScore, awayScore, homeGroup, homeSeed),
    ],
  };
}

// The 2026 playoffs, every game, as `scoreboard/header` had them (dates=20260418-20260620).
const POSTSEASON: HeaderEvent[] = (
  [
    ["401869715", "2026-04-18T19:00:00Z", "East 1st Round - Game 1", "OTT", "0", "32", 6, "CAR", "2", "33", 1, ""],
    ["401869716", "2026-04-18T21:30:00Z", "West 1st Round - Game 1", "MIN", "6", "31", 3, "DAL", "1", "31", 2, ""],
    ["401869717", "2026-04-19T00:00:00Z", "East 1st Round - Game 1", "PHI", "3", "33", 8, "PIT", "2", "33", 7, ""],
    ["401869721", "2026-04-19T19:00:00Z", "West 1st Round - Game 1", "LA", "1", "30", 8, "COL", "2", "31", 1, ""],
    ["401869718", "2026-04-19T21:45:00Z", "East 1st Round - Game 1", "MTL", "4", "32", 4, "TB", "3", "32", 3, "OT"],
    ["401869719", "2026-04-19T23:30:00Z", "East 1st Round - Game 1", "BOS", "3", "32", 5, "BUF", "4", "32", 2, ""],
    ["401869720", "2026-04-20T02:22:00Z", "West 1st Round - Game 1", "UTA", "2", "31", 6, "VGK", "4", "30", 4, ""],
    ["401869794", "2026-04-20T23:00:00Z", "East 1st Round - Game 2", "PHI", "3", "33", 8, "PIT", "0", "33", 7, ""],
    ["401869781", "2026-04-20T23:30:00Z", "East 1st Round - Game 2", "OTT", "2", "32", 6, "CAR", "3", "33", 1, "2OT"],
    ["401869780", "2026-04-21T01:50:00Z", "West 1st Round - Game 2", "MIN", "2", "31", 3, "DAL", "4", "31", 2, ""],
    ["401869722", "2026-04-21T02:22:00Z", "West 1st Round - Game 1", "ANA", "3", "30", 7, "EDM", "4", "30", 5, ""],
    ["401869769", "2026-04-21T23:00:00Z", "East 1st Round - Game 2", "MTL", "2", "32", 4, "TB", "3", "32", 3, "OT"],
    ["401869757", "2026-04-21T23:30:00Z", "East 1st Round - Game 2", "BOS", "4", "32", 5, "BUF", "2", "32", 2, ""],
    ["401869756", "2026-04-22T01:52:00Z", "West 1st Round - Game 2", "UTA", "3", "31", 6, "VGK", "2", "30", 4, ""],
    ["401869792", "2026-04-22T02:22:00Z", "West 1st Round - Game 2", "LA", "1", "30", 8, "COL", "2", "31", 1, "OT"],
    ["401869796", "2026-04-22T23:00:00Z", "East 1st Round - Game 3", "PIT", "2", "33", 7, "PHI", "5", "33", 8, ""],
    ["401869782", "2026-04-23T01:30:00Z", "West 1st Round - Game 3", "DAL", "4", "31", 2, "MIN", "3", "31", 3, "2OT"],
    ["401869768", "2026-04-23T02:00:00Z", "West 1st Round - Game 2", "ANA", "6", "30", 7, "EDM", "4", "30", 5, ""],
    ["401869759", "2026-04-23T23:00:00Z", "East 1st Round - Game 3", "BUF", "3", "32", 2, "BOS", "1", "32", 5, ""],
    ["401869783", "2026-04-23T23:30:00Z", "East 1st Round - Game 3", "CAR", "2", "33", 1, "OTT", "1", "32", 6, ""],
    ["401869793", "2026-04-24T02:00:00Z", "West 1st Round - Game 3", "COL", "4", "31", 1, "LA", "2", "30", 8, ""],
    ["401869771", "2026-04-24T23:00:00Z", "East 1st Round - Game 3", "TB", "2", "32", 3, "MTL", "3", "32", 4, "OT"],
    ["401869758", "2026-04-25T01:30:00Z", "West 1st Round - Game 3", "VGK", "2", "30", 4, "UTA", "4", "31", 6, ""],
    ["401869770", "2026-04-25T02:00:00Z", "West 1st Round - Game 3", "EDM", "4", "30", 5, "ANA", "6", "30", 7, ""],
    ["401869786", "2026-04-25T19:00:00Z", "East 1st Round - Game 4", "CAR", "4", "33", 1, "OTT", "2", "32", 6, ""],
    ["401869784", "2026-04-25T21:30:00Z", "West 1st Round - Game 4", "DAL", "2", "31", 2, "MIN", "3", "31", 3, "OT"],
    ["401869799", "2026-04-26T00:00:00Z", "East 1st Round - Game 4", "PIT", "4", "33", 7, "PHI", "2", "33", 8, ""],
    ["401869762", "2026-04-26T18:00:00Z", "East 1st Round - Game 4", "BUF", "6", "32", 2, "BOS", "1", "32", 5, ""],
    ["401869795", "2026-04-26T20:30:00Z", "West 1st Round - Game 4", "COL", "5", "31", 1, "LA", "1", "30", 8, ""],
    ["401869773", "2026-04-26T23:00:00Z", "East 1st Round - Game 4", "TB", "3", "32", 3, "MTL", "2", "32", 4, ""],
    ["401869772", "2026-04-27T01:52:00Z", "West 1st Round - Game 4", "EDM", "3", "30", 5, "ANA", "4", "30", 7, "OT"],
    ["401869801", "2026-04-27T23:00:00Z", "East 1st Round - Game 5", "PHI", "2", "33", 8, "PIT", "3", "33", 7, ""],
    ["401869760", "2026-04-28T01:50:00Z", "West 1st Round - Game 4", "VGK", "5", "30", 4, "UTA", "4", "31", 6, "OT"],
    ["401869764", "2026-04-28T23:30:00Z", "East 1st Round - Game 5", "BOS", "2", "32", 5, "BUF", "1", "32", 2, "OT"],
    ["401869785", "2026-04-29T00:00:00Z", "West 1st Round - Game 5", "MIN", "4", "31", 3, "DAL", "2", "31", 2, ""],
    ["401869774", "2026-04-29T02:00:00Z", "West 1st Round - Game 5", "ANA", "1", "30", 7, "EDM", "4", "30", 5, ""],
    ["401869775", "2026-04-29T23:00:00Z", "East 1st Round - Game 5", "MTL", "3", "32", 4, "TB", "2", "32", 3, ""],
    ["401869802", "2026-04-29T23:30:00Z", "East 1st Round - Game 6", "PIT", "0", "33", 7, "PHI", "1", "33", 8, "OT"],
    ["401869761", "2026-04-30T02:00:00Z", "West 1st Round - Game 5", "UTA", "4", "31", 6, "VGK", "5", "30", 4, "2OT"],
    ["401869787", "2026-04-30T23:30:00Z", "West 1st Round - Game 6", "DAL", "2", "31", 2, "MIN", "5", "31", 3, ""],
    ["401869776", "2026-05-01T02:00:00Z", "West 1st Round - Game 6", "EDM", "2", "30", 5, "ANA", "5", "30", 7, ""],
    ["401869777", "2026-05-01T23:00:00Z", "East 1st Round - Game 6", "TB", "1", "32", 3, "MTL", "0", "32", 4, "OT"],
    ["401869765", "2026-05-01T23:30:00Z", "East 1st Round - Game 6", "BUF", "4", "32", 2, "BOS", "1", "32", 5, ""],
    ["401869763", "2026-05-02T02:20:00Z", "West 1st Round - Game 6", "VGK", "5", "30", 4, "UTA", "1", "31", 6, ""],
    ["401871166", "2026-05-03T00:00:00Z", "East 2nd Round - Game 1", "PHI", "0", "33", 8, "CAR", "3", "33", 1, ""],
    ["401869779", "2026-05-03T22:00:00Z", "East 1st Round - Game 7", "MTL", "2", "32", 4, "TB", "1", "32", 3, ""],
    ["401871302", "2026-05-04T01:00:00Z", "West 2nd Round - Game 1", "MIN", "6", "31", 3, "COL", "9", "31", 1, ""],
    ["401871411", "2026-05-04T23:00:00Z", "East 2nd Round - Game 2", "PHI", "2", "33", 8, "CAR", "3", "33", 1, "OT"],
    ["401871423", "2026-05-05T01:50:00Z", "West 2nd Round - Game 1", "ANA", "1", "30", 7, "VGK", "3", "30", 4, ""],
    ["401871417", "2026-05-06T00:00:00Z", "West 2nd Round - Game 2", "MIN", "2", "31", 3, "COL", "5", "31", 1, ""],
    ["401871404", "2026-05-06T23:00:00Z", "East 2nd Round - Game 1", "MTL", "2", "32", 4, "BUF", "4", "32", 2, ""],
    ["401871424", "2026-05-07T01:30:00Z", "West 2nd Round - Game 2", "ANA", "3", "30", 7, "VGK", "1", "30", 4, ""],
    ["401871412", "2026-05-08T00:00:00Z", "East 2nd Round - Game 3", "CAR", "4", "33", 1, "PHI", "1", "33", 8, ""],
    ["401871405", "2026-05-08T23:00:00Z", "East 2nd Round - Game 2", "MTL", "5", "32", 4, "BUF", "1", "32", 2, ""],
    ["401871425", "2026-05-09T01:30:00Z", "West 2nd Round - Game 3", "VGK", "6", "30", 4, "ANA", "2", "30", 7, ""],
    ["401871413", "2026-05-09T22:00:00Z", "East 2nd Round - Game 4", "CAR", "3", "33", 1, "PHI", "2", "33", 8, "OT"],
    ["401871418", "2026-05-10T01:00:00Z", "West 2nd Round - Game 3", "COL", "1", "31", 1, "MIN", "5", "31", 3, ""],
    ["401871406", "2026-05-10T23:00:00Z", "East 2nd Round - Game 3", "BUF", "2", "32", 2, "MTL", "6", "32", 4, ""],
    ["401871426", "2026-05-11T01:30:00Z", "West 2nd Round - Game 4", "VGK", "3", "30", 4, "ANA", "4", "30", 7, ""],
    ["401871419", "2026-05-12T00:00:00Z", "West 2nd Round - Game 4", "COL", "5", "31", 1, "MIN", "2", "31", 3, ""],
    ["401871407", "2026-05-12T23:00:00Z", "East 2nd Round - Game 4", "BUF", "3", "32", 2, "MTL", "2", "32", 4, ""],
    ["401871427", "2026-05-13T01:52:00Z", "West 2nd Round - Game 5", "ANA", "2", "30", 7, "VGK", "3", "30", 4, "OT"],
    ["401871420", "2026-05-14T00:00:00Z", "West 2nd Round - Game 5", "MIN", "3", "31", 3, "COL", "4", "31", 1, "OT"],
    ["401871408", "2026-05-14T23:00:00Z", "East 2nd Round - Game 5", "MTL", "6", "32", 4, "BUF", "3", "32", 2, ""],
    ["401871428", "2026-05-15T01:30:00Z", "West 2nd Round - Game 6", "VGK", "5", "30", 4, "ANA", "1", "30", 7, ""],
    ["401871409", "2026-05-17T00:00:00Z", "East 2nd Round - Game 6", "BUF", "8", "32", 2, "MTL", "3", "32", 4, ""],
    ["401871410", "2026-05-18T23:30:00Z", "East 2nd Round - Game 7", "MTL", "3", "32", 4, "BUF", "2", "32", 2, "OT"],
    ["401872903", "2026-05-21T00:00:00Z", "West Final - Game 1", "VGK", "4", "30", 4, "COL", "2", "31", 1, ""],
    // ESPN's own double space.
    ["401873383", "2026-05-22T00:00:00Z", "East Final -  Game 1", "MTL", "6", "32", 4, "CAR", "2", "33", 1, ""],
    ["401872904", "2026-05-23T00:00:00Z", "West Final - Game 2", "VGK", "3", "30", 4, "COL", "1", "31", 1, ""],
    ["401873384", "2026-05-23T23:00:00Z", "East Final - Game 2", "MTL", "2", "32", 4, "CAR", "3", "33", 1, "OT"],
    ["401872905", "2026-05-25T00:00:00Z", "West Final - Game 3", "COL", "3", "31", 1, "VGK", "5", "30", 4, ""],
    ["401873385", "2026-05-26T00:00:00Z", "East Final - Game 3", "CAR", "3", "33", 1, "MTL", "2", "32", 4, "OT"],
    ["401872906", "2026-05-27T01:00:00Z", "West Final - Game 4", "COL", "1", "31", 1, "VGK", "2", "30", 4, ""],
    ["401873386", "2026-05-28T00:00:00Z", "East Final - Game 4", "CAR", "4", "33", 1, "MTL", "0", "32", 4, ""],
    ["401873387", "2026-05-30T00:00:00Z", "East Final - Game 5", "MTL", "1", "32", 4, "CAR", "6", "33", 1, ""],
    ["401874171", "2026-06-03T00:00:00Z", "Stanley Cup Final - Game 1", "VGK", "5", "30", 4, "CAR", "4", "33", 1, ""],
    ["401874172", "2026-06-05T00:00:00Z", "Stanley Cup Final - Game 2", "VGK", "3", "30", 4, "CAR", "4", "33", 1, "OT"],
    ["401874173", "2026-06-07T00:00:00Z", "Stanley Cup Final - Game 3", "CAR", "4", "33", 1, "VGK", "5", "30", 4, "2OT"],
    ["401874174", "2026-06-10T00:00:00Z", "Stanley Cup Final - Game 4", "CAR", "5", "33", 1, "VGK", "3", "30", 4, ""],
    ["401874175", "2026-06-12T00:00:00Z", "Stanley Cup Final - Game 5", "VGK", "2", "30", 4, "CAR", "4", "33", 1, ""],
    ["401874176", "2026-06-15T00:00:00Z", "Stanley Cup Final - Game 6", "CAR", "3", "33", 1, "VGK", "0", "30", 4, ""],
  ] satisfies Row[]
).map(playoffEvent);

const playoffGame = (id: string): HeaderEvent => POSTSEASON.find((e) => e.id === id)!;

/** A regular-season game from `scoreboard/header` on Oct 25, 2026, trimmed. */
function regularEvent(
  id: string,
  date: string,
  [away, awayScore]: [string, string],
  [home, homeScore]: [string, string],
  fullStatus: EventStatus,
  extra: Partial<HeaderEvent> = {}
): HeaderEvent {
  const final = fullStatus?.type?.state === "post";
  const side = (homeAway: "home" | "away", code: string, score: string, other: string) => ({
    homeAway,
    abbreviation: code,
    displayName: `${code} full`,
    name: code.toLowerCase(),
    color: "e30426",
    logo: `https://a.espncdn.com/i/teamlogos/nhl/500/scoreboard/${code.toLowerCase()}.png`,
    score,
    winner: final && Number(score) > Number(other),
  });
  return {
    id,
    date,
    season: 2027,
    seasonType: "2",
    notes: [],
    broadcast: "ESPN+",
    fullStatus,
    competitors: [side("away", away, awayScore, homeScore), side("home", home, homeScore, awayScore)],
    ...extra,
  };
}

const FINAL = { name: "STATUS_FINAL", state: "post", completed: true } as const;

const REGULAR: Record<string, HeaderEvent> = {
  regulation: regularEvent("401892482", "2026-10-11T21:00:00Z", ["SEA", "5"], ["WSH", "3"], {
    period: 3,
    displayClock: "0:00",
    displayPeriod: "3rd",
    type: { ...FINAL, detail: "Final", shortDetail: "Final" },
  }),
  overtime: regularEvent(
    "401892488",
    "2026-10-13T22:00:00Z",
    ["NJ", "5"],
    ["DET", "4"],
    {
      period: 4,
      displayClock: "0:00",
      displayPeriod: "OT",
      type: { ...FINAL, detail: "Final/OT", shortDetail: "Final/OT", altDetail: "OT" },
    },
    { broadcast: "ESPN" }
  ),
  // The shootout's goal is in the score as ESPN sends it: 3–3 after overtime, 4–3 Montreal.
  shootout: regularEvent("401892490", "2026-10-13T22:30:00Z", ["BUF", "3"], ["MTL", "4"], {
    period: 5,
    displayClock: "0:00",
    displayPeriod: "SO",
    type: { ...FINAL, detail: "Final/SO", shortDetail: "Final/SO", altDetail: "SO" },
  }),
  live: regularEvent("401892578", "2026-10-25T19:00:00Z", ["FLA", "2"], ["CHI", "2"], {
    period: 2,
    displayClock: "5:38",
    displayPeriod: "2nd",
    type: { name: "STATUS_IN_PROGRESS", state: "in", completed: false, detail: "5:38 - 2nd Period", shortDetail: "5:38 - 2nd" },
  }),
  scheduled: regularEvent("401892579", "2026-10-25T22:00:00Z", ["NYI", ""], ["DAL", ""], {
    period: 0,
    displayClock: "0:00",
    displayPeriod: null,
    type: {
      name: "STATUS_SCHEDULED",
      state: "pre",
      completed: false,
      detail: "Sun, October 25th at 6:00 PM EDT",
      shortDetail: "10/25 - 6:00 PM EDT",
    },
  }),
  // The one postponement of 2025–26: a 0–0 that never happened, and its makeup date as the note.
  postponed: regularEvent(
    "401803179",
    "2026-01-27T00:00:00Z",
    ["LA", "0"],
    ["CBJ", "0"],
    {
      period: 0,
      displayClock: "0:00",
      type: { name: "STATUS_POSTPONED", state: "post", completed: false, detail: "Postponed", shortDetail: "Postponed" },
    },
    { season: 2026, notes: [{ headline: "Makeup date March 9" }] }
  ),
  outdoor: regularEvent(
    "401892600",
    "2026-10-26T00:00:00Z",
    ["WPG", ""],
    ["EDM", ""],
    { period: 0, type: { name: "STATUS_SCHEDULED", state: "pre", completed: false } },
    { notes: [{ headline: "Heritage Classic" }], broadcast: "Disney+/ESPN+/Hulu" }
  ),
};

describe("gameFrom", () => {
  it("keeps a regulation final as the plain FT, dropping ESPN+ from the channels", () => {
    const { match, teams } = gameFrom(REGULAR.regulation)!;
    expect(match).toEqual({
      id: "401892482",
      homeTeamId: "wsh",
      awayTeamId: "sea",
      homeScore: 3,
      awayScore: 5,
      kickoff: "2026-10-11T21:00:00Z",
      status: "ft",
    });
    expect(teams[0]).toEqual({
      id: "wsh",
      name: "WSH full",
      shortName: "wsh",
      code: "WSH",
      logoUrl: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/scoreboard/wsh.png&w=96&h=96&scale=crop",
      primaryColor: "#e30426",
    });
  });

  it("says how a final past regulation was decided, the shootout's goal in its score", () => {
    expect(gameFrom(REGULAR.overtime)!.match).toMatchObject({
      status: "ft",
      statusText: { short: "OT", spoken: "Final after overtime" },
      broadcasts: ["ESPN"],
    });
    expect(gameFrom(REGULAR.shootout)!.match).toMatchObject({
      homeScore: 4,
      awayScore: 3,
      status: "ft",
      statusText: { short: "SO", spoken: "Final after a shootout" },
    });
  });

  it("gives a live game its period and clock, and a fixture no score", () => {
    expect(gameFrom(REGULAR.live)!.match).toMatchObject({
      homeScore: 2,
      awayScore: 2,
      status: "live",
      statusText: { short: "P2 5:38", spoken: "Second period, 5:38 left" },
    });
    const fixture = gameFrom(REGULAR.scheduled)!.match;
    expect(fixture).toMatchObject({ status: "scheduled", homeScore: null, awayScore: null });
    expect(fixture).not.toHaveProperty("statusText");
  });

  it("keeps a postponement as postponed, without its 0–0 or its makeup note", () => {
    const { match } = gameFrom(REGULAR.postponed)!;
    expect(match).toMatchObject({ status: "postponed", homeScore: null, awayScore: null });
    expect(match).not.toHaveProperty("stageLabel");
    expect(match).not.toHaveProperty("statusText");
  });

  it("names an outdoor game, and keeps the streamers of an exclusive", () => {
    expect(gameFrom(REGULAR.outdoor)!.match).toMatchObject({
      stageLabel: "Heritage Classic",
      broadcasts: ["Disney+", "Hulu"],
    });
  });

  it("reads a playoff game's double overtime from ESPN's line, never its fifth period as a shootout", () => {
    expect(gameFrom(playoffGame("401869781"))!.match).toMatchObject({
      homeTeamId: "car",
      homeScore: 3,
      awayScore: 2,
      stageLabel: "East 1st Round · Game 2",
      statusText: { short: "2OT", spoken: "Final after 2 overtimes" },
    });
  });

  it("gives the Lightning a white disc: their bolt is drawn in their own blue", () => {
    const { teams } = gameFrom(playoffGame("401869718"))!;
    expect(teams.find((t) => t.id === "tb")!.primaryColor).toBe("#FFFFFF");
    expect(teams.find((t) => t.id === "mtl")!.primaryColor).toBe("#123456");
  });
});

describe("statusText", () => {
  const live = (
    fields: { period?: number; displayPeriod?: string; displayClock?: string },
    type: { name?: string; detail?: string; shortDetail?: string } = {}
  ): EventStatus => ({
    ...fields,
    type: { name: "STATUS_IN_PROGRESS", state: "in" as const, ...type },
  });

  it("names the period and the clock, overtime and the shootout included", () => {
    expect(statusText(live({ period: 1, displayPeriod: "1st", displayClock: "17:33" }), "live", false)).toEqual({
      short: "P1 17:33",
      spoken: "First period, 17:33 left",
    });
    expect(statusText(live({ period: 4, displayPeriod: "OT", displayClock: "3:21" }), "live", false)).toEqual({
      short: "OT 3:21",
      spoken: "Overtime, 3:21 left",
    });
    expect(statusText(live({ period: 5, displayPeriod: "SO", displayClock: "0:00" }), "live", false)).toEqual({
      short: "SO",
      spoken: "Shootout",
    });
  });

  it("falls back on ESPN's short line, then on the period number, which a playoff game counts in overtimes", () => {
    expect(statusText(live({ period: 3, displayClock: "1:02" }, { shortDetail: "1:02 - 3rd" }), "live", false)).toEqual({
      short: "P3 1:02",
      spoken: "Third period, 1:02 left",
    });
    expect(statusText(live({ period: 5, displayClock: "12:34" }), "live", true)).toEqual({
      short: "2OT 12:34",
      spoken: "Second overtime, 12:34 left",
    });
    expect(statusText(live({ period: 5 }), "live", false)).toEqual({ short: "SO", spoken: "Shootout" });
  });

  it("reads a live playoff overtime past the first as ESPN prints it, \"2nd OT\", never as the second period", () => {
    expect(statusText(live({ period: 5, displayPeriod: "2nd OT", displayClock: "12:34" }), "live", true)).toEqual({
      short: "2OT 12:34",
      spoken: "Second overtime, 12:34 left",
    });
    expect(statusText(live({ period: 6, displayClock: "4:10" }, { shortDetail: "4:10 - 3rd OT" }), "live", true)).toEqual({
      short: "3OT 4:10",
      spoken: "Third overtime, 4:10 left",
    });
    expect(
      statusText(
        live(
          { period: 5, displayPeriod: "2nd OT", displayClock: "0:00" },
          { detail: "End of 2nd OT", shortDetail: "End of 2nd OT" }
        ),
        "live",
        true
      )
    ).toEqual({ short: "End 2OT", spoken: "End of the second overtime" });
  });

  it("says an intermission is one, which ESPN marks only in its line, still in progress", () => {
    // NYI @ DAL on Oct 25, 2026, after the first period.
    const ended = (period: number, displayPeriod: string) =>
      live(
        { period, displayPeriod, displayClock: "0:00" },
        { detail: `End of ${displayPeriod} Period`, shortDetail: `End of ${displayPeriod}` }
      );
    expect(statusText(ended(1, "1st"), "live", false)).toEqual({ short: "1st INT", spoken: "First intermission" });
    expect(statusText(ended(2, "2nd"), "live", false)).toEqual({ short: "2nd INT", spoken: "Second intermission" });
    expect(statusText(ended(3, "3rd"), "live", true)).toEqual({ short: "End 3rd", spoken: "End of regulation" });
    expect(
      statusText(live({ period: 2, displayPeriod: "2nd", displayClock: "0:00" }, { detail: "2nd Intermission" }), "live", false)
    ).toEqual({ short: "2nd INT", spoken: "Second intermission" });
  });

  it("reads a final's overtime from the end of ESPN's line when there is no short form", () => {
    const final = (detail: string, period: number) => ({ period, type: { name: "STATUS_FINAL", state: "post" as const, detail } });
    expect(statusText(final("Final/OT", 4), "ft", false)).toEqual({ short: "OT", spoken: "Final after overtime" });
    expect(statusText(final("Final/3OT", 6), "ft", true)).toEqual({ short: "3OT", spoken: "Final after 3 overtimes" });
    expect(statusText(final("Final/SO", 5), "ft", false)).toEqual({ short: "SO", spoken: "Final after a shootout" });
    // Neither the period count nor a regulation final has words of its own.
    expect(statusText(final("Final", 5), "ft", true)).toBeUndefined();
    expect(statusText(final("Final", 3), "ft", false)).toBeUndefined();
    expect(statusText({ period: 0, type: { name: "STATUS_SCHEDULED", state: "pre" } }, "scheduled", false)).toBeUndefined();
  });
});

describe("stageLabel", () => {
  it("labels a playoff game by its round and game, without ESPN's dash or its double space", () => {
    expect(stageLabel(playoffGame("401873383"))).toBe("East Final · Game 1");
    expect(stageLabel(playoffGame("401874176"))).toBe("Stanley Cup Final · Game 6");
    const maybe = { ...playoffGame("401874176"), notes: [{ headline: "Stanley Cup Final - Game 7 If Necessary" }] };
    expect(stageLabel(maybe)).toBe("Stanley Cup Final · Game 7, if necessary");
  });

  it("names the preseason, and has none for a plain regular-season game", () => {
    expect(stageLabel(REGULAR.regulation)).toBeUndefined();
    expect(stageLabel({ ...REGULAR.regulation, seasonType: "1" })).toBe("Preseason");
  });
});

describe("playoffsFrom", () => {
  const { rounds, teams } = playoffsFrom(POSTSEASON);
  const pairs = (i: number) =>
    rounds[i].matches.map((m) => [m.homeTeamId, m.homeScore, m.awayScore, m.awayTeamId, m.winnerTeamId]);

  it("builds four rounds of best-of-seven, the East's half first", () => {
    expect(rounds.map((r) => [r.id, r.label, r.matches.length])).toEqual([
      ["round-of-16", "First Round", 8],
      ["quarter-final", "Second Round", 4],
      ["semi-final", "Conference Final", 2],
      ["final", "Stanley Cup Final", 1],
    ]);
    expect(rounds.flatMap((r) => r.matches).every((m) => m.bestOf === 7)).toBe(true);
    expect(new Set(teams.map((t) => t.id)).size).toBe(16);
  });

  it("draws the first round by division, each winner's series against a wild card above 2 v 3", () => {
    // Atlantic, Metropolitan, Central, Pacific. Ottawa and Los Angeles are wild
    // cards from the other division; the Atlantic's winner, Buffalo, is told
    // from Tampa by its seed, both series being within the division.
    expect(pairs(0)).toEqual([
      ["buf", 4, 2, "bos", "buf"],
      ["tb", 3, 4, "mtl", "mtl"],
      ["car", 4, 0, "ott", "car"],
      ["pit", 2, 4, "phi", "phi"],
      ["col", 4, 0, "la", "col"],
      ["dal", 2, 4, "min", "min"],
      ["vgk", 4, 2, "uta", "vgk"],
      ["edm", 2, 4, "ana", "ana"],
    ]);
  });

  it("places every later series under the two it came out of, the upper one's team first", () => {
    expect(pairs(1)).toEqual([
      ["buf", 3, 4, "mtl", "mtl"],
      ["car", 4, 0, "phi", "car"],
      ["col", 4, 1, "min", "col"],
      ["vgk", 4, 2, "ana", "vgk"],
    ]);
    expect(pairs(2)).toEqual([
      ["mtl", 1, 4, "car", "car"],
      ["col", 0, 4, "vgk", "vgk"],
    ]);
    expect(rounds[3].matches[0]).toEqual({
      id: "nhl-final",
      homeTeamId: "car",
      awayTeamId: "vgk",
      homeScore: 4,
      awayScore: 2,
      winnerTeamId: "car",
      date: "2026-06-15T00:00:00Z",
      bestOf: 7,
    });
  });

  it("places the first round from the table when the games name no division or seed", () => {
    const bare = POSTSEASON.map((e) => ({
      ...e,
      competitors: e.competitors!.map(({ id, homeAway, abbreviation, displayName, name, score, winner }) => ({
        id, homeAway, abbreviation, displayName, name, score, winner,
      })),
    }));
    const seedings = new Map(
      (
        [
          ["buf", "atlantic", 2], ["tb", "atlantic", 3], ["mtl", "atlantic", 4], ["bos", "atlantic", 5], ["ott", "atlantic", 6],
          ["car", "metropolitan", 1], ["pit", "metropolitan", 7], ["phi", "metropolitan", 8],
          ["col", "central", 1], ["dal", "central", 2], ["min", "central", 3], ["uta", "central", 6],
          ["vgk", "pacific", 4], ["edm", "pacific", 5], ["ana", "pacific", 7], ["la", "pacific", 8],
        ] as const
      ).map(([team, division, seed]): [string, { division: NhlDivision; seed: number }] => [team, { division, seed }])
    );
    expect(playoffsFrom(bare, seedings).rounds[0].matches.map((m) => m.homeTeamId)).toEqual([
      "buf", "tb", "car", "pit", "col", "dal", "vgk", "edm",
    ]);
  });

  it("carries a winner on before ESPN has drawn the next series, the later rounds TBD till then", () => {
    // The morning of Apr 29: Carolina and Colorado have swept, nobody else is through.
    const early = playoffsFrom(POSTSEASON.filter((e) => e.date! < "2026-04-29T12:00:00Z")).rounds;
    expect(early.map((r) => r.matches.length)).toEqual([8, 4, 2, 1]);
    expect(early[1].matches.map((m) => [m.homeTeamId, m.awayTeamId])).toEqual([
      [null, null],
      ["car", null],
      ["col", null],
      [null, null],
    ]);
    expect(early[1].matches[1]).toMatchObject({ homeScore: null, winnerTeamId: null });
    expect(early[3].matches[0]).toMatchObject({ homeTeamId: null, awayTeamId: null });
  });

  it("leaves a series open while it is played, dated by its next game", () => {
    // Game 6 as it stood the day before.
    const scheduled: HeaderEvent = {
      ...playoffGame("401874176"),
      fullStatus: { period: 0, type: { name: "STATUS_SCHEDULED", state: "pre" } },
      competitors: playoffGame("401874176").competitors!.map((c) => ({ ...c, score: "", winner: false })),
    };
    const throughGame5 = POSTSEASON.filter((e) => e.date! < "2026-06-13T00:00:00Z");
    const final = playoffsFrom([...throughGame5, scheduled]).rounds[3].matches[0];
    expect(final).toMatchObject({ homeTeamId: "car", homeScore: 3, awayScore: 2, winnerTeamId: null, date: "2026-06-15T00:00:00Z" });
  });

  it("has no bracket from the regular season", () => {
    expect(playoffsFrom(Object.values(REGULAR)).rounds).toEqual([]);
  });
});

describe("standingsFrom", () => {
  const entry = (abbreviation: string, stats: Record<string, number | string>) => ({
    team: {
      abbreviation,
      displayName: `${abbreviation} full`,
      shortDisplayName: abbreviation.toLowerCase(),
      logos: [
        { href: `https://a.espncdn.com/i/teamlogos/nhl/500/${abbreviation.toLowerCase()}.png`, rel: ["full", "default"] },
        { href: `https://a.espncdn.com/i/teamlogos/nhl/500-dark/scoreboard/${abbreviation.toLowerCase()}.png`, rel: ["full", "scoreboard", "dark"] },
      ],
    },
    stats: Object.entries(stats).map(([name, v]) => ({
      name,
      displayValue: String(v),
      value: typeof v === "number" ? v : null,
    })),
  });
  const row = (seed: number, gp: number, w: number, l: number, otl: number, pts: number, gf: number, ga: number, streak: string) => ({
    playoffSeed: seed,
    gamesPlayed: gp,
    wins: w,
    losses: l,
    otLosses: otl,
    points: pts,
    pointsFor: gf,
    pointsAgainst: ga,
    // ESPN's own, which never adds up to the games played.
    regLosses: l - 1,
    streak,
  });

  // `standings?level=3&seasontype=2` on Oct 25, 2026, trimmed: a few teams a
  // division, in ESPN's order rather than the table's.
  const table = {
    children: [
      {
        abbreviation: "East",
        children: [
          {
            abbreviation: "ATL",
            standings: {
              season: 2027,
              entries: [
                entry("OTT", row(3, 12, 8, 4, 0, 16, 38, 34, "W1")),
                entry("BOS", row(2, 12, 9, 2, 1, 19, 48, 26, "W2")),
                entry("TOR", row(4, 13, 7, 4, 2, 16, 50, 41, "W4")),
              ],
            },
          },
          {
            abbreviation: "MET",
            standings: { entries: [entry("NYR", row(6, 13, 7, 5, 1, 15, 41, 36, "L2")), entry("CAR", row(1, 13, 9, 2, 2, 20, 51, 33, "W1"))] },
          },
        ],
      },
      {
        abbreviation: "West",
        children: [
          { abbreviation: "CEN", standings: { entries: [entry("UTA", row(3, 12, 8, 4, 0, 16, 46, 40, "W1"))] } },
          {
            abbreviation: "PAC",
            standings: { entries: [entry("VGK", row(2, 13, 8, 4, 1, 17, 47, 38, "L3")), entry("EDM", row(1, 11, 8, 2, 1, 17, 49, 39, "L1"))] },
          },
        ],
      },
    ],
  };

  it("places each team at its conference seed, in its division, losses in regulation", () => {
    const { standings, teams, season } = standingsFrom(table);
    expect(standings.map((s) => [s.conference, s.position, s.teamId, s.division])).toEqual([
      ["east", 1, "car", "metropolitan"],
      ["east", 2, "bos", "atlantic"],
      ["east", 3, "ott", "atlantic"],
      ["east", 4, "tor", "atlantic"],
      ["east", 5, "nyr", "metropolitan"],
      ["west", 1, "edm", "pacific"],
      ["west", 2, "vgk", "pacific"],
      ["west", 3, "uta", "central"],
    ]);
    expect(standings[1]).toEqual({
      position: 2,
      teamId: "bos",
      conference: "east",
      division: "atlantic",
      gamesPlayed: 12,
      wins: 9,
      losses: 2,
      otLosses: 1,
      points: 19,
      goalsFor: 48,
      goalsAgainst: 26,
      streak: "W2",
    });
    expect(teams.find((t) => t.id === "bos")!.logoUrl).toBe(
      "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/bos.png&w=96&h=96&scale=crop"
    );
    expect(season).toBe(2027);
  });

  it("orders by points, then fewer games played, before the seeds are out", () => {
    const unseeded = structuredClone(table);
    for (const conference of unseeded.children) {
      for (const division of conference.children) {
        for (const e of division.standings.entries) e.stats = e.stats.filter((s) => s.name !== "playoffSeed");
      }
    }
    expect(standingsFrom(unseeded).standings.map((s) => s.teamId)).toEqual([
      "car", "bos", "ott", "tor", "nyr",
      "edm", "vgk", "uta",
    ]);
  });
});

describe("teamFrom / teamsFrom", () => {
  it("keys Utah as UTA, the code every other feed uses, with the keylined scores-bar logo", () => {
    const teams = teamsFrom({
      sports: [
        {
          leagues: [
            {
              teams: [
                {
                  team: {
                    abbreviation: "UTAH",
                    displayName: "Utah Mammoth",
                    shortDisplayName: "Mammoth",
                    color: "000000",
                    logos: [
                      { href: "https://a.espncdn.com/i/teamlogos/nhl/500/utah.png", rel: ["full", "default"] },
                      { href: "https://a.espncdn.com/i/teamlogos/nhl/500-dark/utah.png", rel: ["full", "dark"] },
                      { href: "https://a.espncdn.com/i/teamlogos/nhl/500/scoreboard/utah.png", rel: ["full", "scoreboard"] },
                    ],
                  },
                },
                { team: { abbreviation: "TB", displayName: "Tampa Bay Lightning", shortDisplayName: "Lightning", color: "003e7e" } },
              ],
            },
          ],
        },
      ],
    });
    expect(teams).toEqual([
      {
        id: "uta",
        name: "Utah Mammoth",
        shortName: "Mammoth",
        code: "UTA",
        logoUrl: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/scoreboard/utah.png&w=96&h=96&scale=crop",
        primaryColor: "#000000",
      },
      { id: "tb", name: "Tampa Bay Lightning", shortName: "Lightning", code: "TB", logoUrl: undefined, primaryColor: "#FFFFFF" },
    ]);
    expect(teamFrom({ abbreviation: "TBD" })).toBeNull();
  });
});

describe("nhlDataFrom", () => {
  const today = new Date("2026-10-25T20:00:00Z");
  const days = [REGULAR.regulation, REGULAR.overtime, REGULAR.shootout, REGULAR.live, REGULAR.scheduled, REGULAR.outdoor];

  it("lists the days' games once each, live first, and names the season by the year it starts", () => {
    const data = nhlDataFrom({ teams: null, standings: null, days: [...days, REGULAR.live], postseason: [] }, today);
    expect(data.season).toBe(2026);
    expect(data.games).toHaveLength(days.length);
    expect(data.games[0]).toMatchObject({ id: "401892578", status: "live" });
    expect(data.playoffs).toEqual([]);
    expect(data.teams.map((t) => t.id)).toContain("mtl");
  });

  it("leaves out a game that is not between two of the league's clubs", () => {
    const teams = {
      sports: [{ leagues: [{ teams: ["SEA", "WSH", "NJ", "DET"].map((abbreviation) => ({ team: { abbreviation } })) }] }],
    };
    const data = nhlDataFrom({ teams, standings: null, days, postseason: [] }, today);
    expect(data.games.map((g) => g.id).sort()).toEqual(["401892482", "401892488"]);
  });

  it("builds the bracket, and gives up for the hand-written season with neither games nor a table", () => {
    const data = nhlDataFrom({ teams: null, standings: null, days: POSTSEASON.slice(-3), postseason: POSTSEASON }, today);
    expect(data.season).toBe(2025);
    expect(data.playoffs.map((r) => r.id)).toEqual(["round-of-16", "quarter-final", "semi-final", "final"]);
    expect(() => nhlDataFrom({ teams: null, standings: null, days: [], postseason: POSTSEASON }, today)).toThrow(
      /neither games nor standings/
    );
  });
});

describe("postseasonYear", () => {
  it("reads this spring's playoffs from mid-April until the preseason opens", () => {
    expect(postseasonYear(new Date("2026-04-20T12:00:00Z"))).toBe(2026);
    expect(postseasonYear(new Date("2026-08-01T12:00:00Z"))).toBe(2026);
  });

  it("asks for none from the preseason to mid-April", () => {
    expect(postseasonYear(new Date("2026-10-25T12:00:00Z"))).toBeNull();
    expect(postseasonYear(new Date("2027-02-01T12:00:00Z"))).toBeNull();
    expect(postseasonYear(new Date("2027-04-10T12:00:00Z"))).toBeNull();
  });
});

describe("getNhlData", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reads the teams, the table and four weeks of days, and no playoffs in October", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-25T20:00:00Z"), toFake: ["Date"] });
    const fetchMock = vi.fn(async (url: string) => {
      const events = url.includes("20261025-20261031") ? [REGULAR.live, REGULAR.scheduled] : [];
      const json = url.includes("scoreboard/header") ? { sports: [{ leagues: [{ events }] }] } : {};
      return { ok: true, json: async () => json } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await getNhlData();

    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toContain("https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams");
    expect(urls).toContain("https://site.api.espn.com/apis/v2/sports/hockey/nhl/standings?level=3&seasontype=2");
    expect(urls.filter((u) => u.includes("sport=hockey&league=nhl")).map((u) => u.match(/dates=([\d-]+)/)?.[1])).toEqual([
      "20261011-20261017",
      "20261018-20261024",
      "20261025-20261031",
      "20261101-20261107",
    ]);
    expect(data).not.toBe(NHL_DATA);
    expect(data.games.map((g) => g.id)).toEqual(["401892578", "401892579"]);
  });

  it("reads the playoffs in two spans in the spring", async () => {
    vi.useFakeTimers({ now: new Date("2026-05-10T20:00:00Z"), toFake: ["Date"] });
    // Each request answered with the games of its own dates, as far as May 10.
    const fetchMock = vi.fn(async (url: string) => {
      const [, from, to] = /dates=(\d{8})-(\d{8})/.exec(url) ?? [];
      const day = (e: HeaderEvent): string => e.date!.slice(0, 10).replaceAll("-", "");
      const events = from ? POSTSEASON.filter((e) => e.date! < "2026-05-11" && day(e) >= from && day(e) <= to) : [];
      return { ok: true, json: async () => ({ sports: [{ leagues: [{ events }] }] }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await getNhlData();

    const spans = fetchMock.mock.calls.map(([url]) => url.match(/dates=([\d-]+)/)?.[1]);
    expect(spans).toContain("20260411-20260531");
    expect(spans).toContain("20260601-20260630");
    expect(data.playoffs[0].matches.every((m) => m.winnerTeamId)).toBe(true);
  });

  it("falls back rather than cache a May without its bracket when the playoff spans do not answer", async () => {
    vi.useFakeTimers({ now: new Date("2026-05-10T20:00:00Z"), toFake: ["Date"] });
    const fetchMock = vi.fn(async (url: string) => {
      if (/dates=20260411-20260531|dates=20260601-20260630/.test(url)) return { ok: false, status: 503 } as Response;
      const json = url.includes("scoreboard/header") ? { sports: [{ leagues: [{ events: [REGULAR.live] }] }] } : {};
      return { ok: true, json: async () => json } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(await getNhlData()).toBe(NHL_DATA);
  });

  it("falls back to the hand-written season when ESPN does not answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 }) as Response));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await getNhlData()).toBe(NHL_DATA);
  });
});
