import { describe, expect, it } from "vitest";

import { __testing } from "./jolpica-f1-service";

const { mergePodiumSteps, tallyPodiums, mapRaces } = __testing;

const driver = (code: string) => ({
  driverId: code.toLowerCase(),
  code,
  givenName: code,
  familyName: code,
  nationality: "Italian",
});

const race = (round: string, results: Array<[string, string, string]>) => ({
  season: "2026",
  round,
  raceName: `Race ${round}`,
  date: "2026-10-11",
  Circuit: { circuitName: "Marina Bay", Location: { locality: "Singapore", country: "Singapore" } },
  Results: results.map(([position, code, team]) => ({
    position,
    Driver: driver(code),
    Constructor: { constructorId: team.toLowerCase(), name: team },
  })),
});

// What `results/1`, `results/2` and `results/3` each return: one row per race.
const steps = [
  [race("1", [["1", "RUS", "Mercedes"]]), race("17", [["1", "VER", "Red Bull"]])],
  [race("1", [["2", "ANT", "Mercedes"]]), race("17", [["2", "NOR", "McLaren"]])],
  [race("1", [["3", "LEC", "Ferrari"]]), race("17", [["3", "ANT", "Mercedes"]])],
];

describe("mergePodiumSteps", () => {
  it("rebuilds every race's top three, the last round included", () => {
    // `results.json?limit=300` was capped at 100 rows and stopped at round 5;
    // round 17 is exactly what used to come back blank.
    const merged = mergePodiumSteps(steps as never);
    expect(merged.map((r) => r.round)).toEqual(["1", "17"]);
    expect(merged[1].Results!.map((r) => r.Driver.code)).toEqual(["VER", "NOR", "ANT"]);
  });

  it("orders by position whatever order the calls come back in", () => {
    const merged = mergePodiumSteps([steps[2], steps[0], steps[1]] as never);
    expect(merged[0].Results!.map((r) => r.position)).toEqual(["1", "2", "3"]);
  });
});

describe("tallyPodiums", () => {
  it("counts a podium in every race, not only the first five", () => {
    const { driverPodiums, constructorPodiums } = tallyPodiums(mergePodiumSteps(steps as never));
    expect(driverPodiums.get("ANT")).toBe(2);
    expect(constructorPodiums.get("Mercedes")).toBe(3);
  });
});

describe("mapRaces", () => {
  it("shows the podium of a late-season race", () => {
    const { resultsByRound } = tallyPodiums(mergePodiumSteps(steps as never));
    const [singapore] = mapRaces([race("17", [])] as never, resultsByRound);
    expect(singapore.status).toBe("completed");
    expect(singapore.podium).toEqual(["VER", "NOR", "ANT"]);
  });

  it("leaves the podium out when a step failed and only two places are known", () => {
    const { resultsByRound } = tallyPodiums(mergePodiumSteps([steps[0], steps[1]] as never));
    const [singapore] = mapRaces([race("17", [])] as never, resultsByRound);
    expect(singapore.podium).toBeUndefined();
  });
});
