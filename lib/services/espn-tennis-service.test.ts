import { describe, expect, it } from "vitest";

import { __testing } from "./espn-tennis-service";

const { tournamentFrom, matchFrom, playerFrom, rankingFrom, photosById, tourFrom, calendarRange } =
  __testing;

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

  it("collects every draw's players for the view's lookup", () => {
    const tour = tourFrom("atp", board as never, { rankings: [] }, NOW);
    expect(tour.drawPlayers!.map((p) => p.id).sort()).toEqual(["a-A", "a-B", "a-TBD"]);
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
