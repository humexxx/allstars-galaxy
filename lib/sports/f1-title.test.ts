import { describe, expect, it } from "vitest";

import type { F1Constructor, F1Data, F1Driver, F1Race } from "@/types/sports";

import { f1Champions } from "./f1-title";

const driver = (position: number, code: string, points: number): F1Driver => ({
  position,
  code,
  name: code,
  shortName: code,
  team: "Team",
  nationality: "",
  flagEmoji: "",
  points,
  wins: 0,
  podiums: 0,
});

const team = (position: number, name: string, points: number): F1Constructor => ({
  position,
  name,
  shortName: name,
  points,
  wins: 0,
  podiums: 0,
  primaryColor: "#000000",
});

type RaceOptions = { sprint?: boolean; status?: F1Race["status"] };

const race = (round: number, run: boolean, { sprint, status }: RaceOptions = {}): F1Race => ({
  id: `r-${round}`,
  round,
  name: `Round ${round}`,
  circuit: "",
  circuitId: "",
  location: "",
  flagEmoji: "",
  date: "2026-01-01",
  sprint,
  status: status ?? (run ? "completed" : "upcoming"),
  winner: run ? { code: "AAA", team: "Team" } : undefined,
});

/** Twenty rounds, `counted` of them in the table, with these rounds as sprint weekends. */
function season(
  counted: number | undefined,
  points: { drivers: [number, number]; teams?: [number, number] },
  sprints: number[] = [],
): F1Data {
  const teams = points.teams ?? [0, 0];
  return {
    season: 2026,
    standingsRound: counted,
    drivers: [driver(1, "AAA", points.drivers[0]), driver(2, "BBB", points.drivers[1])],
    constructors: [team(1, "Alpha", teams[0]), team(2, "Beta", teams[1])],
    races: Array.from({ length: 20 }, (_, i) =>
      race(i + 1, i + 1 <= (counted ?? 0), { sprint: sprints.includes(i + 1) }),
    ),
  };
}

describe("f1Champions", () => {
  it("marks nobody while second can still catch up", () => {
    // Two races left: 50 to a driver, 86 to a team.
    expect(f1Champions(season(18, { drivers: [400, 360], teams: [700, 640] }))).toEqual({});
  });

  it("marks the driver once the margin is more than a win in every race left", () => {
    expect(f1Champions(season(18, { drivers: [400, 349] })).driver).toBe("AAA");
  });

  it("does not call a margin equal to the points left: countback could still turn it", () => {
    expect(f1Champions(season(18, { drivers: [400, 350] })).driver).toBeUndefined();
    expect(f1Champions(season(18, { drivers: [0, 0], teams: [700, 614] })).constructorName).toBeUndefined();
  });

  it("gives a team a one-two in each race left: 43, not a driver's 25", () => {
    // One race left. 26 clear settles the drivers; the teams need more than 43.
    const open = f1Champions(season(19, { drivers: [400, 374], teams: [700, 657] }));
    expect(open).toEqual({ driver: "AAA" });
    const both = f1Champions(season(19, { drivers: [400, 374], teams: [700, 656] }));
    expect(both).toEqual({ driver: "AAA", constructorName: "Alpha" });
  });

  it("adds a sprint's 8 (15 to a team) for each sprint weekend left", () => {
    // Rounds 19 and 20 left, 19 a sprint: 25 + 8 + 25 = 58, and 43 + 15 + 43 = 101.
    expect(f1Champions(season(18, { drivers: [400, 342], teams: [700, 599] }, [19]))).toEqual({});
    expect(f1Champions(season(18, { drivers: [400, 341], teams: [700, 598] }, [19]))).toEqual({
      driver: "AAA",
      constructorName: "Alpha",
    });
  });

  it("leaves a sprint already run out of what is left", () => {
    // Round 10 was a sprint weekend; only rounds 19 and 20 count: 50.
    expect(f1Champions(season(18, { drivers: [400, 349] }, [10])).driver).toBe("AAA");
  });

  it("goes by the round the table counts, not by a race that only reads as completed", () => {
    // Round 19 is over on the calendar but its points are not in: the margin
    // is from before it, so both races are still to score.
    const data = season(18, { drivers: [400, 370] });
    data.races[18] = race(19, false, { status: "completed" });
    expect(f1Champions(data).driver).toBeUndefined();
    // With the calendar's word alone, 30 would have beaten the one race left.
    data.races[18] = race(19, true);
    data.standingsRound = 19;
    expect(f1Champions(data).driver).toBe("AAA");
  });

  it("keeps a sprint weekend whole while only its sprint has reached the table", () => {
    // The table says round 19, the race has no winner: 33 + 25 still open.
    const data = season(19, { drivers: [400, 345] }, [19]);
    data.races[18] = race(19, false, { sprint: true });
    expect(f1Champions(data).driver).toBeUndefined();
    data.drivers[1] = driver(2, "BBB", 341);
    expect(f1Champions(data).driver).toBe("AAA");
  });

  it("crowns the table's leaders once the season is over, level on points included", () => {
    expect(f1Champions(season(20, { drivers: [400, 400], teams: [700, 699] }))).toEqual({
      driver: "AAA",
      constructorName: "Alpha",
    });
  });

  it("reads the leader by position, whatever order the rows come in", () => {
    const data = season(20, { drivers: [400, 380] });
    data.drivers.reverse();
    expect(f1Champions(data).driver).toBe("AAA");
  });

  it("marks nobody without the table's round, or without a calendar", () => {
    expect(f1Champions(season(undefined, { drivers: [400, 0], teams: [700, 0] }))).toEqual({});
    expect(f1Champions({ ...season(20, { drivers: [400, 0] }), races: [] })).toEqual({});
  });
});
