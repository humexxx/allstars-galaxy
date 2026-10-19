import { describe, expect, it } from "vitest";

import { __testing } from "./jolpica-f1-service";

const { mergePodiumSteps, tallyPodiums, mapRaces, mapDrivers, mapConstructors, portraitLookup } =
  __testing;

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

describe("portraitLookup", () => {
  // ESPN's faces, as `getF1DriverPortraits` hands them over.
  const face = (code: string | undefined, name: string) => ({
    code,
    name,
    imageUrl: `https://img/${name}.png`,
    flagUrl: `https://flag/${name}.png`,
  });
  const jolpica = (givenName: string, familyName: string, code?: string) => ({
    driverId: familyName.toLowerCase(),
    code,
    givenName,
    familyName,
    nationality: "Italian",
  });

  it("matches on the race code both feeds use", () => {
    const lookup = portraitLookup([face("VER", "Max Verstappen")]);
    expect(lookup(jolpica("Max", "Verstappen", "VER"))?.name).toBe("Max Verstappen");
  });

  it("falls back to the name, whatever the accents", () => {
    const lookup = portraitLookup([face(undefined, "Nico Hulkenberg")]);
    expect(lookup(jolpica("Nico", "Hülkenberg"))?.name).toBe("Nico Hulkenberg");
  });

  it("finds a driver ESPN names differently by his surname", () => {
    // ESPN says "Kimi Antonelli"; Jolpica says "Andrea Kimi Antonelli".
    const lookup = portraitLookup([face(undefined, "Kimi Antonelli")]);
    expect(lookup(jolpica("Andrea Kimi", "Antonelli"))?.name).toBe("Kimi Antonelli");
  });

  it("gives nobody somebody else's face", () => {
    // Two ESPN drivers share the surname, and neither code nor name settles it.
    const lookup = portraitLookup([
      face(undefined, "Mick Schumacher"),
      face(undefined, "Ralf Schumacher"),
    ]);
    expect(lookup(jolpica("Michael", "Schumacher"))).toBeUndefined();
    expect(portraitLookup([])(jolpica("Max", "Verstappen", "VER"))).toBeUndefined();
  });
});

describe("mapDrivers", () => {
  // Jolpica's 2026 standings, trimmed to what the mapper reads.
  const standings = [
    {
      position: "1",
      points: "340",
      wins: "8",
      Driver: {
        driverId: "antonelli",
        code: "ANT",
        givenName: "Andrea Kimi",
        familyName: "Antonelli",
        nationality: "Italian",
      },
      Constructors: [{ constructorId: "mercedes", name: "Mercedes" }],
    },
    {
      position: "9",
      points: "75",
      wins: "0",
      Driver: {
        driverId: "lawson",
        code: "LAW",
        givenName: "Liam",
        familyName: "Lawson",
        nationality: "New Zealander",
      },
      Constructors: [{ constructorId: "rb", name: "RB F1 Team" }],
    },
  ];

  it("keeps Jolpica's table and adds ESPN's pictures where they match", () => {
    const lookup = portraitLookup([
      { code: "ANT", name: "Kimi Antonelli", imageUrl: "https://img/ant.png", flagUrl: "https://flag/ita.png" },
    ]);
    const [antonelli, lawson] = mapDrivers(standings, new Map([["ANT", 14]]), lookup);
    expect(antonelli).toMatchObject({
      position: 1,
      points: 340,
      podiums: 14,
      imageUrl: "https://img/ant.png",
      flagUrl: "https://flag/ita.png",
    });
    expect(lawson).toMatchObject({ position: 9, team: "RB" });
    expect(lawson.imageUrl).toBeUndefined();
  });

  it("has no pictures at all when ESPN had nothing to say", () => {
    const drivers = mapDrivers(standings, new Map());
    expect(drivers.every((d) => d.imageUrl === undefined && d.flagUrl === undefined)).toBe(true);
  });
});

describe("mapConstructors", () => {
  it("gives every team with a published mark its logo, by Jolpica's name", () => {
    const row = (name: string) => ({
      position: "1",
      points: "0",
      wins: "0",
      Constructor: { constructorId: name.toLowerCase(), name },
    });
    const teams = mapConstructors(
      [row("Mercedes"), row("RB F1 Team"), row("Cadillac F1 Team")],
      new Map()
    );
    expect(teams.map((t) => t.logoUrl)).toEqual([
      "/f1/teams/mercedes.png",
      "/f1/teams/racing-bulls.png",
      // None published yet: the view draws the livery instead.
      undefined,
    ]);
  });
});
