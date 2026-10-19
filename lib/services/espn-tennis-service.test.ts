import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __testing, getTennisDraw } from "./espn-tennis-service";

const {
  tournamentFrom,
  matchFrom,
  playerFrom,
  rankingFrom,
  photosById,
  tourFrom,
  calendarRange,
  calendarFrom,
  calendarWith,
  eventFrom,
  espnDay,
  fetchCalendarFromApi,
  fetchTennisDraw,
} = __testing;

afterEach(() => {
  vi.unstubAllGlobals();
});

const headshot = (id: string) => `https://a.espncdn.com/i/headshots/tennis/players/full/${id}.png`;
const resized = (id: string) =>
  `https://a.espncdn.com/combiner/i?img=/i/headshots/tennis/players/full/${id}.png&w=96&h=96&scale=crop`;

const NOW = Date.parse("2026-10-18T12:00:00Z");

const competitor = (
  name: string,
  country: string,
  seed?: number,
  sets: number[] = [],
  winner = false
) => ({
  id: `c-${name}`,
  winner,
  athlete: { id: `a-${name}`, shortName: name, flag: { alt: country } },
  curatedRank: seed ? { current: seed } : undefined,
  linescores: sets.map((v) => ({ value: v })),
});

const competition = (
  id: string,
  round: string,
  state: "pre" | "in" | "post",
  competitors = [competitor("TBD", ""), competitor("TBD", "")],
  completed = state === "post"
) => ({ id, round: { displayName: round }, status: { type: { state, completed } }, competitors });

describe("playerFrom", () => {
  it("carries the flag and the seed where the draw card reads them", () => {
    const p = playerFrom(competitor("J. Sinner", "Italy", 1) as never)!;
    expect(p.shortName).toBe("J. Sinner");
    expect(p.name).toBe("🇮🇹");
    expect(p.code).toBe("1");
  });

  it("leaves the seed blank for an unseeded player", () => {
    expect(playerFrom(competitor("A. Qualifier", "Spain") as never)!.code).toBe("");
  });
});

describe("matchFrom", () => {
  it("turns each set into a leg", () => {
    // A set is a leg under another name — that is why the bracket needed
    // nothing new to hold one.
    const { match } = matchFrom({
      id: "m1",
      date: "2026-08-31T18:00Z",
      competitors: [
        competitor("Lehecka", "Czechia", 18, [6, 7, 4, 6], true),
        competitor("Carreno Busta", "Spain", undefined, [1, 6, 6, 2]),
      ],
    } as never)!;

    expect(match.legs).toEqual([
      { homeScore: 6, awayScore: 1 },
      { homeScore: 7, awayScore: 6 },
      { homeScore: 4, awayScore: 6 },
      { homeScore: 6, awayScore: 2 },
    ]);
    expect(match.winnerTeamId).toBe("a-Lehecka");
    expect(match.date).toBe("2026-08-31");
  });

  it("leaves an unplayed tie without sets or a winner", () => {
    const { match } = matchFrom({
      id: "m2",
      competitors: [competitor("TBD", ""), competitor("TBD", "")],
    } as never)!;
    expect(match.legs).toBeUndefined();
    expect(match.winnerTeamId).toBeNull();
  });
});

describe("tournamentFrom", () => {
  // Trimmed from ESPN's real Shanghai payload: the place lives in
  // `venue.displayName`, and the event's own status is not to be trusted.
  const event = (competitions: unknown[]) => ({
    id: "315-2026",
    name: "Rolex Shanghai Masters",
    date: "2026-10-05T04:00Z",
    endDate: "2026-10-19T03:59Z",
    venue: { displayName: "Shanghai, China PR" },
    status: { type: { completed: true } },
    groupings: [{ grouping: { slug: "mens-singles" }, competitions }],
  });

  const played = [
    competition("r1", "Round 1", "post", [
      competitor("Paul", "USA", 20, [6, 6], true),
      competitor("Wong", "Hong Kong", undefined, [3, 4]),
    ]),
    competition("q1", "Qualifying 1st Round", "post", [
      competitor("X", "Spain"),
      competitor("Y", "France"),
    ]),
  ];

  it("keeps the main draw and drops qualifying", () => {
    const draw = tournamentFrom(
      event([...played, competition("f", "Final", "pre")]) as never,
      "mens-singles",
      NOW
    )!;
    expect(draw.tournament.bracket!.map((r) => r.label)).toEqual(["Round 1", "Final"]);
  });

  it("reads the state off the matches, not the event", () => {
    // ESPN marked Ningbo "completed" with 27 of its 45 matches still to play.
    const draw = tournamentFrom(
      event([...played, competition("f", "Final", "pre")]) as never,
      "mens-singles",
      NOW
    )!;
    expect(draw.tournament.status).toBe("live");
  });

  it("is under way once qualifying has started", () => {
    const draw = tournamentFrom(
      event([
        competition("q1", "Qualifying 1st Round", "post"),
        competition("r1", "Round 1", "pre"),
      ]) as never,
      "mens-singles",
      NOW
    )!;
    expect(draw.tournament.status).toBe("live");
  });

  it("drops the slots ESPN cancelled", () => {
    // Basel, a week out: three cancelled TBD quarter-finals beside the real
    // four, all "post" and none completed.
    const { tournament } = tournamentFrom(
      event([
        ...["1", "2", "3", "4"].map((n) => competition(`q${n}`, "Quarterfinal", "pre")),
        ...["5", "6", "7"].map((n) =>
          competition(`x${n}`, "Quarterfinal", "post", undefined, false)
        ),
      ]) as never,
      "mens-singles",
      NOW
    )!;
    expect(tournament.status).toBe("upcoming");
    expect(tournament.bracket![0].matches).toHaveLength(4);
  });

  it("is upcoming while every match is still to be played", () => {
    const draw = tournamentFrom(
      event([competition("f", "Final", "pre")]) as never,
      "mens-singles",
      NOW
    )!;
    expect(draw.tournament.status).toBe("upcoming");
  });

  it("names the champion and the runner-up once the final is over", () => {
    const final = competition("f", "Final", "post", [
      competitor("R. Jodar", "Spain", undefined, [6, 6, 4]),
      competitor("A. Davidovich Fokina", "Spain", undefined, [1, 7, 6], true),
    ]);
    const { tournament } = tournamentFrom(
      event([...played, final]) as never,
      "mens-singles",
      NOW
    )!;
    expect(tournament.status).toBe("completed");
    expect(tournament.champion).toBe("A. Davidovich Fokina");
    expect(tournament.runnerUp).toBe("R. Jodar");
  });

  it("takes the city from the venue's display name", () => {
    const { tournament } = tournamentFrom(event(played) as never, "mens-singles", NOW)!;
    expect(tournament.location).toBe("Shanghai");
    expect(tournament.startDate).toBe("2026-10-05");
  });

  it("returns nothing for a grouping that is not there", () => {
    expect(tournamentFrom(event(played) as never, "womens-singles", NOW)).toBeNull();
  });
});

describe("rankingFrom", () => {
  it("maps ESPN's ranking row, movement included", () => {
    expect(
      rankingFrom({
        current: 8,
        previous: 11,
        points: 3480,
        athlete: {
          displayName: "Novak Djokovic",
          shortname: "N. Djokovic",
          flagAltText: "Serbia",
          citizenshipCountry: "SER",
        },
      })
    ).toEqual({
      position: 8,
      name: "Novak Djokovic",
      shortName: "N. Djokovic",
      countryCode: "SER",
      flagEmoji: "🇷🇸",
      points: 3480,
      movement: 3,
    });
  });

  it("drops a row with nobody in it", () => {
    expect(rankingFrom({ current: 1 })).toBeNull();
  });

  it("carries the photo ESPN sends, resized", () => {
    const sinner = rankingFrom({
      current: 1,
      points: 11000,
      athlete: { id: "3623", displayName: "Jannik Sinner", headshot: headshot("3623") },
    });
    expect(sinner!.photoUrl).toBe(resized("3623"));
  });

  it("builds no photo from the id when ESPN sends none", () => {
    // Shelton's id-shaped path is a 404: a broken image where the flag was.
    const shelton = rankingFrom({
      current: 4,
      points: 4680,
      athlete: { id: "9250", displayName: "Ben Shelton" },
    });
    expect(shelton!.photoUrl).toBeUndefined();
  });
});

describe("photosById", () => {
  it("keeps only the players ESPN has a photo of, by athlete id", () => {
    const photos = photosById({
      rankings: [
        {
          ranks: [
            { current: 1, athlete: { id: "3623", displayName: "Jannik Sinner", headshot: headshot("3623") } },
            { current: 4, athlete: { id: "9250", displayName: "Ben Shelton" } },
          ],
        },
      ],
    });
    expect([...photos]).toEqual([["3623", resized("3623")]]);
  });
});

describe("tourFrom", () => {
  const board = {
    leagues: [{ season: { year: 2026 } }],
    events: [
      {
        id: "250",
        name: "Almaty Open",
        date: "2026-10-12T04:00Z",
        venue: { displayName: "Almaty, Kazakhstan" },
        groupings: [
          {
            grouping: { slug: "mens-singles" },
            competitions: [competition("a1", "Final", "pre")],
          },
        ],
      },
      {
        id: "1000",
        name: "Shanghai Masters",
        date: "2026-10-12T04:00Z",
        venue: { displayName: "Shanghai, China PR" },
        groupings: [
          {
            grouping: { slug: "mens-singles" },
            competitions: [
              competition("s1", "Semifinal", "post", [
                competitor("A", "Italy", 1, [6, 6], true),
                competitor("B", "Spain", 2, [4, 4]),
              ]),
              competition("s2", "Semifinal", "pre"),
              competition("s3", "Final", "pre"),
            ],
          },
        ],
      },
      { id: "wta-only", name: "Ningbo", groupings: [{ grouping: { slug: "womens-singles" } }] },
    ],
  };

  it("runs in date order, the bigger draw first on the same day", () => {
    const tour = tourFrom("atp", board as never, { rankings: [] }, NOW);
    expect(tour.tournaments.map((t) => t.name)).toEqual(["Shanghai Masters", "Almaty Open"]);
    expect(tour.season).toBe(2026);
  });

  it("ships the draw of the tournament being played, and loads the rest on demand", () => {
    const tour = tourFrom("atp", board as never, { rankings: [] }, NOW);
    const byName = new Map(tour.tournaments.map((t) => [t.name, t]));
    expect(byName.get("Shanghai Masters")!.bracket).toHaveLength(2);
    expect(byName.get("Almaty Open")!.bracket).toBeUndefined();
    // Only the shipped draw's players travel for the view's lookup.
    expect(tour.drawPlayers!.map((p) => p.id).sort()).toEqual(["a-A", "a-B", "a-TBD"]);
  });

  it("ships the featured draw and the one just finished when nothing is on", () => {
    const finished = competition("f", "Final", "post", [
      competitor("Winner", "Italy", 1, [6, 6], true),
      competitor("Loser", "Spain", 2, [3, 3]),
    ]);
    const quiet = {
      events: [
        { ...board.events[1], groupings: [{ grouping: { slug: "mens-singles" }, competitions: [finished] }] },
        board.events[0],
        { ...board.events[0], id: "later", name: "Later Open", date: "2026-10-26T04:00Z" },
      ],
    };
    const tour = tourFrom("atp", quiet as never, { rankings: [] }, NOW);
    expect(tour.tournaments.filter((t) => t.bracket).map((t) => t.name)).toEqual([
      "Shanghai Masters",
      "Almaty Open",
    ]);
  });

  it("joins the season's calendar to what the scoreboard has scored", () => {
    const seeds = [
      { id: "espn-1000-mens-singles", name: "Shanghai Masters", startDate: "2026-10-12", endDate: "2026-10-18" },
      { id: "espn-99-2026-mens-singles", name: "Australian Open", startDate: "2026-01-11", endDate: "2026-02-01" },
    ];
    const tour = tourFrom("atp", board as never, { rankings: [] }, NOW, seeds);
    expect(tour.calendar).toEqual([
      { ...seeds[0], status: "live", champion: undefined },
      { ...seeds[1], status: "completed" },
    ]);
  });

  it("gives a draw's ranked players their ranking photo", () => {
    // The scoreboard carries no photo; the rankings do, under the same id.
    const rankings = {
      rankings: [{ ranks: [{ current: 1, athlete: { id: "a-A", displayName: "A", headshot: headshot("1") } }] }],
    };
    const tour = tourFrom("atp", board as never, rankings, NOW);
    const byId = new Map(tour.drawPlayers!.map((p) => [p.id, p]));
    expect(byId.get("a-A")!.logoUrl).toBe(resized("1"));
    expect(byId.get("a-B")!.logoUrl).toBeUndefined();
  });

  it("keeps the top of the rankings", () => {
    const ranks = Array.from({ length: 30 }, (_, i) => ({
      current: i + 1,
      previous: i + 1,
      points: 1000 - i,
      athlete: { displayName: `Player ${i + 1}` },
    }));
    const tour = tourFrom("atp", board as never, { rankings: [{ ranks }] }, NOW);
    expect(tour.rankings).toHaveLength(20);
    expect(tour.rankings[0]).toMatchObject({ position: 1, movement: 0 });
  });
});

describe("calendarRange", () => {
  it("asks for two weeks either side of today", () => {
    expect(calendarRange(new Date(NOW))).toBe("20261004-20261101");
  });
});

describe("espnDay", () => {
  it("reads both of ESPN's ways of bounding Shanghai as Oct 5 – 18", () => {
    // The scoreboard bounds an event by US Eastern midnights, the calendar
    // by US Pacific ones; the end's UTC date is the 19th in both.
    expect(espnDay("2026-10-05T04:00Z", "start")).toBe("2026-10-05");
    expect(espnDay("2026-10-19T03:59Z", "end")).toBe("2026-10-18");
    expect(espnDay("2026-10-05T07:00Z", "start")).toBe("2026-10-05");
    expect(espnDay("2026-10-19T06:59Z", "end")).toBe("2026-10-18");
  });

  it("leaves a bare date as the day it names", () => {
    expect(espnDay("2026-10-05", "start")).toBe("2026-10-05");
    expect(espnDay(undefined, "end")).toBe("");
  });
});

describe("matchFrom, a set and a finish", () => {
  it("keeps each player's tie-break points with the set", () => {
    // Shanghai's final: Davidovich Fokina d. Jodar 1-6 7-6(5) 6-4.
    const { match } = matchFrom({
      id: "184947",
      competitors: [
        {
          ...competitor("A. Davidovich Fokina", "Spain", 25),
          winner: true,
          linescores: [{ value: 1 }, { value: 7, tiebreak: 7 }, { value: 6 }],
        },
        {
          ...competitor("R. Jodar", "Spain", 12),
          linescores: [{ value: 6 }, { value: 6, tiebreak: 5 }, { value: 4 }],
        },
      ],
    } as never)!;
    expect(match.legs).toEqual([
      { homeScore: 1, awayScore: 6 },
      { homeScore: 7, awayScore: 6, homeTiebreak: 7, awayTiebreak: 5 },
      { homeScore: 6, awayScore: 4 },
    ]);
  });

  it.each([
    ["STATUS_WALKOVER", "walkover"],
    ["STATUS_RETIRED", "retired"],
  ])("says when a tie ended in %s", (name, outcome) => {
    const { match } = matchFrom({
      id: "w",
      status: { type: { name, state: "post", completed: true } },
      competitors: [competitor("A", "Italy", 1, [], true), competitor("B", "Spain")],
    } as never)!;
    expect(match.outcome).toBe(outcome);
    expect(match.winnerTeamId).toBe("a-A");
  });

  it("leaves a played-out tie without one", () => {
    const { match } = matchFrom({
      id: "f",
      status: { type: { name: "STATUS_FINAL", state: "post", completed: true } },
      competitors: [competitor("A", "Italy", 1, [6, 6], true), competitor("B", "Spain", 2, [1, 1])],
    } as never)!;
    expect(match.outcome).toBeUndefined();
  });
});

describe("tournamentFrom, the details", () => {
  const slam = (extra: Record<string, unknown>) => ({
    id: "189-2026",
    name: "US Open",
    date: "2026-08-24T04:00Z",
    endDate: "2026-09-14T03:59Z",
    venue: { displayName: "New York, NY, USA" },
    groupings: [
      { grouping: { slug: "mens-singles" }, competitions: [competition("f", "Final", "pre")] },
    ],
    ...extra,
  });

  it("calls a major a Grand Slam and keeps the full place", () => {
    const { tournament } = tournamentFrom(slam({ major: true }) as never, "mens-singles", NOW)!;
    expect(tournament).toMatchObject({
      tier: "Grand Slam",
      location: "New York",
      venue: "New York, NY, USA",
      startDate: "2026-08-24",
      endDate: "2026-09-13",
    });
  });

  it("names last year's champion of this draw, not the doubles'", () => {
    const { tournament } = tournamentFrom(
      slam({
        previousWinners: [
          {
            displayName: "Kevin Krawietz / Tim Puetz",
            shortDisplayName: "K. Krawietz / T. Puetz",
            type: { slug: "mens-doubles" },
          },
          { displayName: "Carlos Alcaraz", shortDisplayName: "C. Alcaraz", type: { slug: "mens-singles" } },
        ],
      }) as never,
      "mens-singles",
      NOW
    )!;
    expect(tournament.defendingChampion).toBe("C. Alcaraz");
  });

  it("has no tier for an event ESPN does not flag", () => {
    const { tournament } = tournamentFrom(slam({ major: false }) as never, "mens-singles", NOW)!;
    expect(tournament.tier).toBeUndefined();
  });
});

const ref = (id: string) =>
  `http://sports.core.api.espn.com/v2/sports/tennis/leagues/atp/events/${id}?lang=en&region=us`;

// Four lines of the ATP's 2026 calendar as ESPN serves it, trimmed.
const CALENDAR = {
  sections: [
    {
      label: "BNP Paribas Fortis European Open",
      startDate: "2026-10-17T07:00Z",
      endDate: "2026-10-26T06:59Z",
      event: { $ref: ref("440-2026") },
    },
    {
      label: "Rolex Shanghai Masters",
      startDate: "2026-10-05T07:00Z",
      endDate: "2026-10-19T06:59Z",
      event: { $ref: ref("315-2026") },
    },
    {
      label: "Grand Prix Auvergne-Rhône-Alpes",
      startDate: "2026-10-18T07:00Z",
      endDate: "2026-10-26T06:59Z",
      event: { $ref: ref("110-2026") },
    },
    {
      label: "Grand Prix Auvergne-Rhône-Alpes",
      startDate: "2026-10-18T07:00Z",
      endDate: "2026-10-26T06:59Z",
      event: { $ref: ref("452-2026") },
    },
  ],
};

describe("calendarFrom", () => {
  it("lists each event once, by the scoreboard's id, on its own days", () => {
    expect(calendarFrom(CALENDAR, "mens-singles")).toEqual([
      {
        id: "espn-315-2026-mens-singles",
        name: "Rolex Shanghai Masters",
        startDate: "2026-10-05",
        endDate: "2026-10-18",
      },
      {
        id: "espn-440-2026-mens-singles",
        name: "BNP Paribas Fortis European Open",
        startDate: "2026-10-17",
        endDate: "2026-10-25",
      },
      // Lyon is listed twice, as 110 and 452; one line is enough.
      {
        id: "espn-110-2026-mens-singles",
        name: "Grand Prix Auvergne-Rhône-Alpes",
        startDate: "2026-10-18",
        endDate: "2026-10-25",
      },
    ]);
  });

  it("skips a line with no event to open", () => {
    expect(
      calendarFrom({ sections: [{ label: "Exhibition", startDate: "2026-12-01T08:00Z" }] }, "mens-singles")
    ).toEqual([]);
  });
});

describe("calendarWith", () => {
  it("finds the scored event by name when the calendar kept the other id", () => {
    const lyon = { id: "espn-452-2026-mens-singles", name: "Lyon", startDate: "2026-10-18", endDate: "2026-10-25" };
    const scored = {
      id: "espn-110-2026-mens-singles",
      name: "Lyon",
      location: "Lyon",
      startDate: "2026-10-18",
      endDate: "2026-10-25",
      status: "live" as const,
    };
    expect(calendarWith([lyon], [scored], "2026-10-18")).toEqual([
      { ...lyon, id: scored.id, status: "live", champion: undefined },
    ]);
  });

  it("places an event nobody has scored by its dates", () => {
    const seed = (startDate: string, endDate: string) => ({ id: startDate, name: startDate, startDate, endDate });
    const calendar = calendarWith(
      [seed("2026-10-05", "2026-10-18"), seed("2026-10-26", "2026-11-01")],
      [],
      "2026-10-19"
    );
    expect(calendar.map((c) => c.status)).toEqual(["completed", "upcoming"]);
  });
});

const respond = (body: unknown): Response => ({ ok: true, json: async () => body }) as Response;

describe("fetchCalendarFromApi", () => {
  it("reads the season asked for", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => respond(CALENDAR));
    vi.stubGlobal("fetch", fetchMock);
    const seeds = await fetchCalendarFromApi("atp", 2026);
    expect(seeds).toHaveLength(3);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://sports.core.api.espn.com/v2/sports/tennis/leagues/atp/calendar/whitelist?dates=2026"
    );
  });

  it("falls back to the previous season while the new one is empty", async () => {
    // January: `?dates=2027` answered with no sections at all.
    const fetchMock = vi.fn(async (url: string) =>
      respond(url.endsWith("dates=2027") ? { sections: [] } : CALENDAR)
    );
    vi.stubGlobal("fetch", fetchMock);
    const seeds = await fetchCalendarFromApi("atp", 2027);
    expect(seeds[0].id).toBe("espn-315-2026-mens-singles");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on a failed call, so the cache keeps its last good calendar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 }) as Response));
    await expect(fetchCalendarFromApi("atp", 2026)).rejects.toThrow("503");
  });
});

describe("eventFrom", () => {
  // A scoreboard day: every event spanning it, every grouping of each.
  const day = {
    events: [
      {
        id: "315-2026",
        name: "Rolex Shanghai Masters",
        groupings: [
          { grouping: { slug: "mens-singles" }, competitions: [competition("f", "Final", "post")] },
          { grouping: { slug: "mens-doubles" }, competitions: [competition("d", "Final", "post")] },
        ],
      },
      { id: "440-2026", name: "Brussels", groupings: [{ grouping: { slug: "mens-singles" } }] },
    ],
  };

  it("keeps the one event and its one draw", () => {
    const event = eventFrom(day as never, "315-2026", "mens-singles")!;
    expect(event.name).toBe("Rolex Shanghai Masters");
    expect(event.groupings!.map((g) => g.grouping?.slug)).toEqual(["mens-singles"]);
  });

  it("is nothing for an event that is not on that day", () => {
    expect(eventFrom(day as never, "189-2026", "mens-singles")).toBeNull();
  });
});

describe("fetchTennisDraw", () => {
  const scoreboard = {
    events: [
      {
        id: "315-2026",
        name: "Rolex Shanghai Masters",
        date: "2026-10-05T04:00Z",
        endDate: "2026-10-19T03:59Z",
        groupings: [
          {
            grouping: { slug: "mens-singles" },
            competitions: [
              competition("f", "Final", "post", [
                competitor("A. Davidovich Fokina", "Spain", 25, [1, 7, 6], true),
                competitor("R. Jodar", "Spain", 12, [6, 6, 4]),
              ]),
            ],
          },
          { grouping: { slug: "mens-doubles" }, competitions: [competition("d", "Final", "post")] },
        ],
      },
      { id: "440-2026", name: "Brussels", groupings: [] },
    ],
  };
  const rankings = {
    rankings: [
      {
        ranks: [
          { current: 20, athlete: { id: "a-R. Jodar", displayName: "Rafael Jodar", headshot: headshot("12657") } },
        ],
      },
    ],
  };

  it("reads the final day past Next's cache and keeps only the one draw", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) =>
      respond(url.includes("/scoreboard") ? scoreboard : rankings)
    );
    vi.stubGlobal("fetch", fetchMock);

    const draw = await fetchTennisDraw("atp", "315-2026", "2026-10-18");

    const scoreboardCall = fetchMock.mock.calls.find(([url]) => url.includes("/scoreboard"))!;
    expect(scoreboardCall[0]).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard?dates=20261018"
    );
    // A Grand Slam's day is 1.76 MB raw: it must never reach the fetch cache.
    expect(scoreboardCall[1]?.cache).toBe("no-store");
    expect(draw).toMatchObject({
      tournamentId: "espn-315-2026-mens-singles",
      champion: "A. Davidovich Fokina",
      runnerUp: "R. Jodar",
    });
    expect(draw.rounds.map((r) => r.id)).toEqual(["final"]);
    expect(draw.players.find((p) => p.id === "a-R. Jodar")!.logoUrl).toBe(resized("12657"));
  });

  it("throws when the event is not on that day, so nothing empty is cached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond({ events: [] })));
    await expect(fetchTennisDraw("atp", "315-2026", "2026-10-18")).rejects.toThrow("315-2026");
  });
});

describe("getTennisDraw", () => {
  const final = competition("f", "Final", "post", [
    competitor("A. Davidovich Fokina", "Spain", 25, [1, 7, 6], true),
    competitor("R. Jodar", "Spain", 12, [6, 6, 4]),
  ]);
  // The feed's fortnight: Shanghai, finished today.
  const fortnight = {
    leagues: [{ season: { year: 2026 } }],
    events: [
      {
        id: "315-2026",
        name: "Rolex Shanghai Masters",
        date: "2026-10-05T04:00Z",
        endDate: "2026-10-19T03:59Z",
        groupings: [{ grouping: { slug: "mens-singles" }, competitions: [final] }],
      },
    ],
  };
  // Wimbledon is three months gone: only the calendar still lists it.
  const wimbledonDay = {
    events: [
      {
        id: "188-2026",
        name: "Wimbledon",
        date: "2026-06-29T04:00Z",
        endDate: "2026-07-13T03:59Z",
        groupings: [
          {
            grouping: { slug: "mens-singles" },
            competitions: [
              competition("w", "Final", "post", [
                competitor("J. Sinner", "Italy", 1, [6, 6, 6], true),
                competitor("C. Alcaraz", "Spain", 2, [4, 4, 4]),
              ]),
            ],
          },
        ],
      },
    ],
  };
  const season = {
    sections: [
      { label: "Wimbledon", startDate: "2026-06-29T07:00Z", endDate: "2026-07-13T06:59Z", event: { $ref: ref("188-2026") } },
      { label: "Rolex Shanghai Masters", startDate: "2026-10-05T07:00Z", endDate: "2026-10-19T06:59Z", event: { $ref: ref("315-2026") } },
    ],
  };
  const rankings = { rankings: [{ ranks: [{ current: 1, athlete: { id: "a-J. Sinner", displayName: "Jannik Sinner" } }] }] };

  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
    if (url.includes("/calendar/")) return respond(url.includes("/atp/") ? season : { sections: [] });
    if (url.includes("/rankings")) return respond(url.includes("/atp/") ? rankings : { rankings: [] });
    if (url.includes("/atp/scoreboard?dates=20260712")) return respond(wimbledonDay);
    if (url.includes("/atp/scoreboard")) return respond(fortnight);
    return respond({ events: [] });
  });
  const dayCalls = (): string[] =>
    fetchMock.mock.calls.map(([url]) => url).filter((url) => /scoreboard\?dates=\d{8}$/.test(url));

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-10-18T12:00:00Z"), toFake: ["Date"] });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    fetchMock.mockClear();
  });

  it("hands back the draw the feed already carries, without another call", async () => {
    const draw = await getTennisDraw("atp", "espn-315-2026-mens-singles");
    expect(draw).toMatchObject({ champion: "A. Davidovich Fokina", runnerUp: "R. Jodar" });
    expect(draw!.rounds.map((r) => r.id)).toEqual(["final"]);
    expect(dayCalls()).toEqual([]);
  });

  it("reads an event only the calendar lists off its final day", async () => {
    const draw = await getTennisDraw("atp", "espn-188-2026-mens-singles");
    expect(dayCalls()).toEqual([
      "https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard?dates=20260712",
    ]);
    expect(draw).toMatchObject({
      tournamentId: "espn-188-2026-mens-singles",
      champion: "J. Sinner",
      runnerUp: "C. Alcaraz",
    });
  });

  it("refuses another tour's draw, or one on no calendar, before asking ESPN for it", async () => {
    expect(await getTennisDraw("wta", "espn-188-2026-mens-singles")).toBeNull();
    expect(await getTennisDraw("atp", "espn-999-2026-mens-singles")).toBeNull();
    expect(dayCalls()).toEqual([]);
  });
});
