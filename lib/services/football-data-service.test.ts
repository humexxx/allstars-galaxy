import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getFootballLeague } from "@/lib/data/sports/football";
import type { Team } from "@/types/sports";

import { __testing, getFootballLeagueData } from "./football-data-service";

const { goalsOf, mapMatches, buildKnockoutBracket, noteBudget, budget } =
  __testing;

const team = (name: string, tla: string) => ({ id: tla.length, name, shortName: name, tla });

type MatchInput = {
  id: number;
  home: string;
  away: string;
  utcDate?: string;
  stage?: string;
  status?: "FINISHED" | "TIMED" | "IN_PLAY";
  score?: Record<string, unknown>;
};

const match = ({
  id,
  home,
  away,
  utcDate = "2026-07-01T19:00:00Z",
  stage = "REGULAR_SEASON",
  status = "FINISHED",
  score = { duration: "REGULAR", fullTime: { home: 1, away: 0 } },
}: MatchInput) => ({
  id,
  utcDate,
  status,
  stage,
  matchday: 1,
  score,
  homeTeam: team(home, home.slice(0, 3).toUpperCase()),
  awayTeam: team(away, away.slice(0, 3).toUpperCase()),
});

// The shape football-data sends for a shoot-out, copied from the 2026 World
// Cup: 1–1 after 120 minutes, 3–4 on penalties, and `fullTime` adding the two.
const SHOOTOUT = {
  winner: "AWAY_TEAM",
  duration: "PENALTY_SHOOTOUT",
  fullTime: { home: 4, away: 5 },
  regularTime: { home: 1, away: 1 },
  extraTime: { home: 0, away: 0 },
  penalties: { home: 3, away: 4 },
};

describe("goalsOf", () => {
  it("takes the shoot-out back out of the score", () => {
    expect(goalsOf(SHOOTOUT as never)).toEqual({
      home: 1,
      away: 1,
      penalties: { home: 3, away: 4 },
    });
  });

  it("subtracts the penalties when the provider sends no regular time", () => {
    const bare = { ...SHOOTOUT, regularTime: undefined, extraTime: undefined };
    expect(goalsOf(bare as never)).toMatchObject({ home: 1, away: 1 });
  });

  it("keeps extra-time goals, which are part of the result", () => {
    expect(
      goalsOf({
        duration: "EXTRA_TIME",
        fullTime: { home: 3, away: 2 },
        regularTime: { home: 2, away: 2 },
        extraTime: { home: 1, away: 0 },
        penalties: null,
      } as never)
    ).toEqual({ home: 3, away: 2 });
  });
});

describe("mapMatches", () => {
  it("prints a shoot-out as the draw it was, with the penalties beside it", () => {
    const [m] = mapMatches(
      [match({ id: 7, home: "Germany", away: "Paraguay", stage: "LAST_32", score: SHOOTOUT })] as never,
      new Map<string, Team>()
    );
    expect(m).toMatchObject({
      homeScore: 1,
      awayScore: 1,
      penalties: { home: 3, away: 4 },
      status: "pen",
      stageLabel: "Round of 32",
    });
  });
});

describe("buildKnockoutBracket", () => {
  it("leaves a leg-two shoot-out out of the aggregate and still names the winner", () => {
    const legs = [
      match({
        id: 1,
        home: "Arsenal",
        away: "Inter",
        stage: "LAST_16",
        utcDate: "2027-03-03T20:00:00Z",
        score: { winner: "DRAW", duration: "REGULAR", fullTime: { home: 1, away: 1 } },
      }),
      match({
        id: 2,
        home: "Inter",
        away: "Arsenal",
        stage: "LAST_16",
        utcDate: "2027-03-11T20:00:00Z",
        score: {
          winner: "HOME_TEAM",
          duration: "PENALTY_SHOOTOUT",
          fullTime: { home: 5, away: 3 },
          regularTime: { home: 0, away: 0 },
          extraTime: { home: 0, away: 0 },
          penalties: { home: 5, away: 3 },
        },
      }),
    ];
    legs[1].matchday = 2;
    const [round] = buildKnockoutBracket(legs as never, new Map())!;
    expect(round.matches[0]).toMatchObject({
      aggregateHome: 1,
      aggregateAway: 1,
      winnerTeamId: "inter",
    });
  });
  it("names no winner of a one-leg final still being played", () => {
    const live = match({
      id: 3,
      home: "Argentina",
      away: "France",
      stage: "FINAL",
      status: "IN_PLAY",
      score: { winner: "HOME_TEAM", duration: "REGULAR", fullTime: { home: 1, away: 0 } },
    });
    const [final] = buildKnockoutBracket([live] as never, new Map())!;
    expect(final.id).toBe("final");
    expect(final.matches[0]).toMatchObject({ homeScore: 1, awayScore: 0, winnerTeamId: null });
  });

  it("carries a final's shoot-out beside the draw it settled", () => {
    const decided = match({ id: 4, home: "Argentina", away: "France", stage: "FINAL", score: SHOOTOUT });
    const [final] = buildKnockoutBracket([decided] as never, new Map())!;
    expect(final.matches[0]).toMatchObject({
      homeScore: 1,
      awayScore: 1,
      penalties: { home: 3, away: 4 },
      winnerTeamId: "france",
    });
  });
});

describe("noteBudget", () => {
  beforeEach(() => {
    budget.spentUntil = 0;
  });

  const response = (status: number, headers: Record<string, string>) =>
    new Response(null, { status, headers });

  it("stops asking until the provider's counter resets after a 429", () => {
    noteBudget(response(429, { "x-requestcounter-reset": "42" }), 1_000);
    expect(budget.spentUntil).toBe(43_000);
  });

  it("stops before the 429 when the minute reports nothing left", () => {
    noteBudget(
      response(200, { "x-requests-available-minute": "0", "x-requestcounter-reset": "10" }),
      0
    );
    expect(budget.spentUntil).toBe(10_000);
  });

  it("ignores a response that carries no counter at all", () => {
    // `Number(null)` is 0 — reading a missing header as "none left" would
    // have stopped every request after the first.
    noteBudget(response(200, {}), 0);
    expect(budget.spentUntil).toBe(0);
  });
});

describe("getFootballLeagueData", () => {
  const standings = {
    season: { startDate: "2026-08-21", endDate: "2027-05-30" },
    standings: [
      {
        stage: "REGULAR_SEASON",
        type: "TOTAL",
        group: "Matchday",
        table: [
          {
            position: 1,
            team: team("Arsenal", "ARS"),
            playedGames: 1,
            won: 1,
            draw: 0,
            lost: 0,
            goalsFor: 1,
            goalsAgainst: 0,
            points: 3,
          },
        ],
      },
    ],
  };
  const matches = {
    matches: [match({ id: 1, home: "Arsenal", away: "Chelsea", utcDate: "2026-09-01T15:00:00Z" })],
  };
  const json = (body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status: 200, headers });

  beforeEach(() => {
    budget.spentUntil = 0;
    vi.stubEnv("FOOTBALL_DATA_API_KEY", "test-key");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("fetch is disabled in unit tests"))));
  });

  it("maps the live table", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(url.includes("/standings") ? json(standings) : json(matches))
      )
    );
    const data = await getFootballLeagueData("premier-league");
    expect(data.league.season).toBe("2026–27");
    expect(data.standings[0]).toMatchObject({ teamId: "arsenal", points: 3 });
    expect(data.matches).toHaveLength(1);
  });

  it("falls back to the fixture when a call is refused, rather than caching half a league", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes("/standings")
            ? json(standings)
            : new Response("", { status: 429, headers: { "x-requestcounter-reset": "30" } })
        )
      )
    );
    // The fixture, not a live table with no matches in it.
    await expect(getFootballLeagueData("premier-league")).resolves.toBe(
      getFootballLeague("premier-league")
    );
    expect(budget.spentUntil).toBeGreaterThan(Date.now());
  });

  it("does not spend a request into a minute the provider says is gone", async () => {
    budget.spentUntil = Date.now() + 60_000;
    const fetchSpy = vi.fn(() => Promise.resolve(json(standings)));
    vi.stubGlobal("fetch", fetchSpy);
    await getFootballLeagueData("premier-league");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
