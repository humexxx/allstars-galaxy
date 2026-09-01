import { describe, expect, it } from "vitest";

import { __testing } from "./espn-tennis-service";

const { drawFrom, matchFrom, playerFrom } = __testing;

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

describe("drawFrom", () => {
  const event = {
    id: "401",
    name: "US Open",
    date: "2026-08-24T04:00Z",
    endDate: "2026-09-14T03:59Z",
    venue: { address: { city: "New York" } },
    status: { type: { completed: false } },
    groupings: [
      {
        grouping: { slug: "mens-singles" },
        competitions: [
          {
            id: "r1",
            round: { displayName: "Round 1" },
            competitors: [
              competitor("Paul", "USA", 20, [6, 6, 6, 6], true),
              competitor("Wong", "Hong Kong", undefined, [7, 1, 3, 3]),
            ],
          },
          {
            id: "q1",
            round: { displayName: "Qualifying 1st Round" },
            competitors: [competitor("X", "Spain"), competitor("Y", "France")],
          },
          {
            id: "f",
            round: { displayName: "Final" },
            competitors: [competitor("TBD", ""), competitor("TBD", "")],
          },
        ],
      },
    ],
  };

  it("keeps the rounds a reader follows and drops qualifying", () => {
    // Qualifying is not the tournament, and a 128-draw's opening rounds are
    // long enough without it.
    const draw = drawFrom(event as never, "mens-singles")!;
    expect(draw.tournament.bracket!.map((r) => r.label)).toEqual(["Round 1", "Final"]);
  });

  it("reads a tournament still being played as live", () => {
    expect(drawFrom(event as never, "mens-singles")!.tournament.status).toBe("live");
    expect(drawFrom(event as never, "mens-singles")!.tournament.location).toBe("New York");
  });

  it("returns nothing for a grouping that is not there", () => {
    expect(drawFrom(event as never, "womens-singles")).toBeNull();
  });
});
