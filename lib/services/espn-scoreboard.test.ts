import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchHeaderDays,
  groupSeries,
  headerMatch,
  headerStatus,
  headerTeam,
  headerUrl,
  seriesBracket,
  seriesTie,
  weekChunks,
  type HeaderEvent,
  type SeriesGame,
  type SeriesRound,
} from "./espn-scoreboard";

const MLB = { sport: "baseball", league: "mlb" };

const status = (name: string, state: "pre" | "in" | "post", detail = "") => ({
  type: { name, state, completed: state === "post", detail, shortDetail: detail },
});

// The World Series' Game 2 as the scores bar sent it (Oct 25, 2026), trimmed to what is read.
const worldSeriesGame2: HeaderEvent = {
  id: "401908043",
  date: "2026-10-25T00:00:00Z",
  season: 2026,
  seasonType: "3",
  note: "World Series - Game 2",
  fullStatus: { period: 9, periodPrefix: "Top", ...status("STATUS_FINAL", "post", "Final") },
  broadcast: "Fox",
  broadcasts: [
    { name: "Fox", type: "TV" },
    { name: "ESPN Radio", type: "Radio" },
  ],
  competitors: [
    {
      id: "30",
      homeAway: "away",
      abbreviation: "TB",
      displayName: "Tampa Bay Rays",
      name: "Rays",
      color: "092c5c",
      logo: "https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/tb.png",
      score: "4",
      winner: false,
    },
    {
      id: "8",
      homeAway: "home",
      abbreviation: "MIL",
      displayName: "Milwaukee Brewers",
      name: "Brewers",
      color: "13294b",
      logo: "https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/mil.png",
      score: "5",
      winner: true,
    },
  ],
};

// Game 3, two days on: no score yet, "" rather than "0".
const worldSeriesGame3: HeaderEvent = {
  ...worldSeriesGame2,
  id: "401908044",
  date: "2026-10-27T00:00:00Z",
  note: "World Series - Game 3",
  fullStatus: { period: 1, periodPrefix: "Top", ...status("STATUS_SCHEDULED", "pre", "10/26 - 8:00 PM EDT") },
  competitors: worldSeriesGame2.competitors!.map((c) => ({
    ...c,
    homeAway: c.homeAway === "home" ? ("away" as const) : ("home" as const),
    score: "",
    winner: false,
  })),
};

describe("headerUrl", () => {
  it("asks for the days as one range, with a limit the feed answers", () => {
    expect(headerUrl(MLB, "2026-09-26", "2026-11-15")).toBe(
      "https://site.web.api.espn.com/apis/v2/scoreboard/header?sport=baseball&league=mlb&dates=20260926-20261115&limit=200"
    );
  });

  it("refuses a range of more than two months, which the feed answers with a 502", () => {
    expect(() => headerUrl(MLB, "2026-08-01", "2026-10-15")).toThrow(/1–62 days/);
    expect(() => headerUrl(MLB, "2026-10-15", "2026-10-14")).toThrow();
  });
});

describe("weekChunks", () => {
  it("splits four weeks into four requests, the last as short as the range", () => {
    expect(weekChunks("2026-10-11", "2026-11-07")).toEqual([
      { from: "2026-10-11", to: "2026-10-17" },
      { from: "2026-10-18", to: "2026-10-24" },
      { from: "2026-10-25", to: "2026-10-31" },
      { from: "2026-11-01", to: "2026-11-07" },
    ]);
    expect(weekChunks("2026-10-30", "2026-11-02")).toEqual([{ from: "2026-10-30", to: "2026-11-02" }]);
  });
});

describe("fetchHeaderDays", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads a week a request, past Next's cache, and leaves out a week that failed", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("dates=20261018-20261024")
        ? ({ ok: false, status: 502 } as Response)
        : ({
            ok: true,
            json: async () => ({
              sports: [{ leagues: [{ events: [url.includes("20261025") ? worldSeriesGame3 : worldSeriesGame2] }] }],
            }),
          } as Response)
    );
    vi.stubGlobal("fetch", fetchMock);

    const events = await fetchHeaderDays(MLB, "2026-10-11", "2026-10-31");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => url.match(/dates=([\d-]+)/)?.[1])).toEqual([
      "20261011-20261017",
      "20261018-20261024",
      "20261025-20261031",
    ]);
    expect((fetchMock.mock.calls[0] as unknown[])[1]).toMatchObject({ cache: "no-store" });
    expect(events.map((e) => e.id)).toEqual(["401908043", "401908044"]);
  });

  it("fails when every week failed, so the cache keeps its last good answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 502 }) as Response));
    await expect(fetchHeaderDays(MLB, "2026-10-11", "2026-10-31")).rejects.toThrow(/every week/);
  });
});

describe("headerStatus", () => {
  it("reads a postponement and a cancellation by name, though ESPN calls both over", () => {
    expect(headerStatus(status("STATUS_POSTPONED", "post", "Postponed"))).toBe("postponed");
    expect(headerStatus(status("STATUS_CANCELED", "post", "Canceled"))).toBe("cancelled");
    expect(headerStatus(status("STATUS_SUSPENDED", "post", "Suspended"))).toBe("postponed");
  });

  it("is live while in play, a rain delay included, and over after extra innings or overtime", () => {
    expect(headerStatus(status("STATUS_IN_PROGRESS", "in", "Top 7th"))).toBe("live");
    expect(headerStatus(status("STATUS_RAIN_DELAY", "in", "Rain Delay"))).toBe("live");
    expect(headerStatus(status("STATUS_FINAL", "post", "Final/10"))).toBe("ft");
    expect(headerStatus(status("STATUS_FINAL", "post", "Final/OT"))).toBe("ft");
    expect(headerStatus(status("STATUS_SCHEDULED", "pre"))).toBe("scheduled");
    expect(headerStatus(undefined)).toBe("scheduled");
  });
});

describe("headerTeam", () => {
  it("keys a club by its abbreviation, named by its nickname, its logo at the size drawn", () => {
    expect(headerTeam(worldSeriesGame2.competitors![0])).toEqual({
      id: "tb",
      name: "Tampa Bay Rays",
      shortName: "Rays",
      code: "TB",
      logoUrl: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/mlb/500/scoreboard/tb.png&w=96&h=96&scale=crop",
      primaryColor: "#092c5c",
    });
  });

  it("treats ESPN's TBD placeholder as nobody", () => {
    expect(headerTeam({ abbreviation: "TBD", displayName: "TBD" })).toBeNull();
    expect(headerTeam(undefined)).toBeNull();
  });
});

describe("headerMatch", () => {
  it("maps a finished game: sides, score, winner and channels", () => {
    const mapped = headerMatch(worldSeriesGame2)!;
    expect(mapped.match).toEqual({
      id: "401908043",
      homeTeamId: "mil",
      awayTeamId: "tb",
      homeScore: 5,
      awayScore: 4,
      kickoff: "2026-10-25T00:00:00Z",
      status: "ft",
      broadcasts: ["Fox"],
    });
    expect(mapped.winnerTeamId).toBe("mil");
    expect(mapped.teams.map((t) => t.id)).toEqual(["mil", "tb"]);
  });

  it("leaves a game still to come without a score or a winner", () => {
    const mapped = headerMatch(worldSeriesGame3)!;
    expect(mapped.match).toMatchObject({ homeTeamId: "tb", homeScore: null, awayScore: null, status: "scheduled" });
    expect(mapped.winnerTeamId).toBeNull();
  });

  it("keeps no score for a postponed game, though ESPN sends 0–0", () => {
    const postponed: HeaderEvent = {
      ...worldSeriesGame2,
      fullStatus: status("STATUS_POSTPONED", "post", "Postponed"),
      competitors: worldSeriesGame2.competitors!.map((c) => ({ ...c, score: "0", winner: false })),
    };
    expect(headerMatch(postponed)!.match).toMatchObject({ status: "postponed", homeScore: null, awayScore: null });
  });

  it("drops a channel that carries every game, and is left with none when that was all", () => {
    const streamed: HeaderEvent = {
      ...worldSeriesGame2,
      broadcast: "ESPN Unlmtd/MLB.TV",
      broadcasts: [{ name: "MLB.TV", type: "Streaming" }],
    };
    expect(headerMatch(streamed, { exclude: ["MLB.TV"] })!.match.broadcasts).toEqual(["ESPN Unlmtd"]);
    const onlyMlbTv = { ...streamed, broadcast: "MLB.TV" };
    expect(headerMatch(onlyMlbTv, { exclude: ["MLB.TV"] })!.match).not.toHaveProperty("broadcasts");
  });

  it("names the winner by the score when ESPN leaves the flag off", () => {
    const unflagged: HeaderEvent = {
      ...worldSeriesGame2,
      competitors: worldSeriesGame2.competitors!.map((c) => ({ ...c, winner: undefined })),
    };
    expect(headerMatch(unflagged)!.winnerTeamId).toBe("mil");
  });

  it("skips a game with a side still to be decided", () => {
    const tbd: HeaderEvent = {
      ...worldSeriesGame3,
      competitors: [{ homeAway: "home", abbreviation: "TBD" }, worldSeriesGame3.competitors![1]],
    };
    expect(headerMatch(tbd)).toBeNull();
  });
});

describe("series", () => {
  const game = (
    round: number,
    half: 0 | 1 | null,
    date: string,
    home: string,
    away: string,
    winner: string | null,
    state: SeriesGame["status"] = winner ? "ft" : "scheduled"
  ): SeriesGame => ({ round, half, date, homeTeamId: home, awayTeamId: away, status: state, winnerTeamId: winner });

  // The 2026 ALCS, rained out once: Game 4 came back as a game of its own.
  const alcs = [
    game(2, 0, "2026-10-13T00:00:00Z", "tb", "cle", "cle"),
    game(2, 0, "2026-10-14T00:00:00Z", "tb", "cle", "tb"),
    game(2, 0, "2026-10-15T17:00:00Z", "cle", "tb", "cle"),
    game(2, 0, "2026-10-17T00:00:00Z", "cle", "tb", null, "postponed"),
    game(2, 0, "2026-10-18T00:00:00Z", "cle", "tb", "tb"),
    game(2, 0, "2026-10-18T21:00:00Z", "cle", "tb", "tb"),
    game(2, 0, "2026-10-20T00:00:00Z", "tb", "cle", "tb"),
  ];

  it("groups the games of a pair in a round, game one's home side first, without the rainout", () => {
    const [series, ...rest] = groupSeries([...alcs].reverse());
    expect(rest).toEqual([]);
    expect(series.teamIds).toEqual(["tb", "cle"]);
    expect(series.games).toHaveLength(6);
  });

  it("scores a series in wins and decides it at the majority of its length", () => {
    const [series] = groupSeries(alcs);
    expect(seriesTie(series, "alcs", 7)).toEqual({
      id: "alcs",
      homeTeamId: "tb",
      awayTeamId: "cle",
      homeScore: 4,
      awayScore: 2,
      winnerTeamId: "tb",
      date: "2026-10-20T00:00:00Z",
      bestOf: 7,
    });
    // Two wins take a best-of-three Wild Card.
    const [wildCard] = groupSeries([
      game(0, 0, "2026-09-29T21:00:00Z", "hou", "chw", "chw"),
      game(0, 0, "2026-09-30T21:00:00Z", "hou", "chw", "chw"),
    ]);
    expect(seriesTie(wildCard, "wc", 3)).toMatchObject({ homeScore: 0, awayScore: 2, winnerTeamId: "chw" });
  });

  it("leaves a series under way undecided, dated by its next game", () => {
    const [worldSeries] = groupSeries([
      game(3, null, "2026-10-24T00:00:00Z", "mil", "tb", "mil"),
      game(3, null, "2026-10-25T00:00:00Z", "mil", "tb", "mil"),
      game(3, null, "2026-10-27T00:00:00Z", "tb", "mil", null),
      game(3, null, "2026-10-28T00:00:00Z", "tb", "mil", null),
    ]);
    expect(seriesTie(worldSeries, "ws", 7)).toMatchObject({
      homeTeamId: "mil",
      homeScore: 2,
      awayScore: 0,
      winnerTeamId: null,
      date: "2026-10-27T00:00:00Z",
    });
  });

  it("has no score before the first game, and a TBD slot without a series", () => {
    const [unplayed] = groupSeries([game(3, null, "2026-10-24T00:00:00Z", "mil", "tb", null)]);
    expect(seriesTie(unplayed, "ws", 7)).toMatchObject({ homeScore: null, awayScore: null });
    expect(seriesTie(undefined, "ws", 7)).toEqual({
      id: "ws",
      homeTeamId: null,
      awayTeamId: null,
      homeScore: null,
      awayScore: null,
      winnerTeamId: null,
      bestOf: 7,
    });
  });

  const ROUNDS: SeriesRound[] = [
    { id: "quarter-final", label: "Division Series", size: 4, bestOf: 5 },
    { id: "semi-final", label: "Championship Series", size: 2, bestOf: 7 },
    { id: "final", label: "World Series", size: 1, bestOf: 7 },
  ];

  it("puts each round's top half first, and keeps the rounds still to come as TBD", () => {
    const rounds = seriesBracket(
      groupSeries([
        // The NL's series are listed first, and the AL has only one so far.
        game(0, 1, "2026-10-03T20:00:00Z", "lad", "atl", "lad"),
        game(0, 1, "2026-10-04T00:30:00Z", "mil", "sd", "mil"),
        game(0, 0, "2026-10-03T22:30:00Z", "tb", "nyy", "tb"),
      ]),
      ROUNDS,
      "mlb"
    );
    expect(rounds.map((r) => [r.id, r.label, r.matches.length])).toEqual([
      ["quarter-final", "Division Series", 4],
      ["semi-final", "Championship Series", 2],
      ["final", "World Series", 1],
    ]);
    expect(rounds[0].matches.map((m) => [m.id, m.homeTeamId])).toEqual([
      ["mlb-quarter-final-0", "tb"],
      ["mlb-quarter-final-1", null],
      ["mlb-quarter-final-2", "lad"],
      ["mlb-quarter-final-3", "mil"],
    ]);
    expect(rounds[2].matches[0]).toMatchObject({ id: "mlb-final", homeTeamId: null, bestOf: 7 });
  });

  it("puts the final's top-half side first, though game one was at the bottom half's park", () => {
    const rounds = seriesBracket(
      groupSeries([
        game(1, 0, "2026-10-13T00:00:00Z", "tb", "cle", "tb"),
        game(1, 1, "2026-10-12T00:00:00Z", "mil", "lad", "mil"),
        game(2, null, "2026-10-24T00:00:00Z", "mil", "tb", "mil"),
        game(2, null, "2026-10-27T00:00:00Z", "tb", "mil", null),
      ]),
      ROUNDS,
      "mlb"
    );
    expect(rounds[1].matches[0]).toMatchObject({ id: "mlb-final", homeTeamId: "tb", awayTeamId: "mil", homeScore: 0, awayScore: 1 });
  });

  it("has no rounds without a series", () => {
    expect(seriesBracket([], ROUNDS, "mlb")).toEqual([]);
  });
});
