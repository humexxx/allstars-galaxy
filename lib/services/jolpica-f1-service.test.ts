import { describe, expect, it, vi } from "vitest";

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
  Circuit: {
    circuitId: "marina_bay",
    circuitName: "Marina Bay",
    Location: { locality: "Singapore", country: "Singapore" },
  },
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

  it("keeps Jolpica's circuit key, which finds the track's outline", () => {
    const [singapore] = mapRaces([race("17", [])] as never, new Map());
    expect(singapore).toMatchObject({ circuitId: "marina_bay", circuit: "Marina Bay" });
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

const {
  mapSessions,
  mapClassification,
  polesByRound,
  fastestLapsByRound,
  sprintWinnersByRound,
  deriveRaceStatus,
  rateLimiter,
} = __testing;

// Jolpica's 2026 Chinese Grand Prix, a sprint weekend, with its keys in the
// order Jolpica sends them: Qualifying ahead of the Sprint that runs first.
const shanghai = {
  season: "2026",
  round: "2",
  raceName: "Chinese Grand Prix",
  date: "2026-03-15",
  time: "07:00:00Z",
  Circuit: {
    circuitId: "shanghai",
    circuitName: "Shanghai International Circuit",
    Location: { locality: "Shanghai", country: "China" },
  },
  FirstPractice: { date: "2026-03-13", time: "03:30:00Z" },
  Qualifying: { date: "2026-03-14", time: "07:00:00Z" },
  Sprint: { date: "2026-03-14", time: "03:00:00Z" },
  SprintQualifying: { date: "2026-03-13", time: "07:30:00Z" },
};

const classified = (
  position: string,
  code: string,
  team: string,
  extra: Record<string, unknown> = {}
) => ({
  position,
  positionText: position,
  points: "0",
  grid: "5",
  laps: "62",
  status: "Finished",
  Driver: driver(code),
  Constructor: { constructorId: team.toLowerCase(), name: team },
  ...extra,
});

describe("mapSessions", () => {
  it("puts a sprint weekend in time order, whatever order the keys come in", () => {
    expect(mapSessions(shanghai as never).map((s) => s.kind)).toEqual([
      "fp1",
      "sprint-qualifying",
      "sprint",
      "qualifying",
      "race",
    ]);
  });

  it("keeps each session's instant in UTC and drops one without a time", () => {
    const sessions = mapSessions({
      ...shanghai,
      FirstPractice: { date: "2026-03-13" },
    } as never);
    expect(sessions[0]).toEqual({ kind: "sprint-qualifying", startsAt: "2026-03-13T07:30:00.000Z" });
    expect(sessions.at(-1)).toEqual({ kind: "race", startsAt: "2026-03-15T07:00:00.000Z" });
  });
});

describe("deriveRaceStatus", () => {
  const start = Date.parse("2026-10-25T20:00:00Z");
  it.each([
    [start - 60_000, "upcoming"],
    [start + 60 * 60_000, "live"],
    // The flag fell hours ago and the results are not in yet: still over.
    [start + 4 * 60 * 60_000, "completed"],
  ] as const)("at %d → %s", (now, status) => {
    expect(deriveRaceStatus("2026-10-25", false, "20:00:00Z", now)).toBe(status);
  });

  it("is over the moment its results arrive", () => {
    expect(deriveRaceStatus("2026-10-25", true, "20:00:00Z", start - 60_000)).toBe("completed");
  });
});

describe("mapRaces, the weekend and its results", () => {
  const results = [
    classified("1", "VER", "Red Bull", {
      grid: "1",
      Time: { millis: "6120785", time: "1:42:00.785" },
    }),
    classified("2", "LEC", "Ferrari", { Time: { millis: "6128120", time: "+7.335" } }),
    classified("3", "ANT", "Mercedes", { laps: "61", status: "Lapped", Time: { time: "+2.171" } }),
  ];
  const extras = {
    poles: new Map([["2", { code: "RUS", time: "1:32.064" }]]),
    fastestLaps: new Map([["2", { code: "LEC", lap: 41, time: "1:35.202" }]]),
    sprintWinners: new Map([["2", { code: "RUS", team: "Mercedes" }]]),
  };

  it("carries the start, the country, the sprint and the timetable", () => {
    const [race] = mapRaces(
      [shanghai] as never,
      new Map(),
      undefined,
      Date.parse("2026-03-01T00:00:00Z")
    );
    expect(race).toMatchObject({
      status: "upcoming",
      startsAt: "2026-03-15T07:00:00.000Z",
      country: "China",
      location: "Shanghai",
      sprint: true,
    });
    expect(race.sessions).toHaveLength(5);
    expect(race.winner).toBeUndefined();
    expect(race.fastestLap).toBeUndefined();
  });

  it("reads the winner, the podium's gaps, pole, the fastest lap and the sprint", () => {
    const [race] = mapRaces([shanghai] as never, new Map([["2", results]]), extras as never);
    expect(race.status).toBe("completed");
    expect(race.winner).toEqual({
      code: "VER",
      team: "Red Bull",
      time: "1:42:00.785",
      laps: 62,
      grid: 1,
    });
    // A lapped car's Time is not a gap to the winner.
    expect(race.podiumGaps).toEqual(["+7.335", "+1 lap"]);
    expect(race.pole).toEqual({ code: "RUS", time: "1:32.064" });
    expect(race.fastestLap).toEqual({ code: "LEC", lap: 41, time: "1:35.202" });
    expect(race.sprintWinner).toEqual({ code: "RUS", team: "Mercedes" });
  });

  it("names no winner when the winner's step failed", () => {
    const [race] = mapRaces(
      [shanghai] as never,
      new Map([["2", results.slice(1)]]),
      extras as never,
      Date.parse("2026-03-16T00:00:00Z")
    );
    expect(race.status).toBe("completed");
    expect(race.winner).toBeUndefined();
    expect(race.podiumGaps).toBeUndefined();
  });

  it("is a normal weekend without a Sprint key", () => {
    const normal = { ...shanghai, Sprint: undefined, SprintQualifying: undefined };
    const [race] = mapRaces([normal] as never, new Map());
    expect(race.sprint).toBe(false);
  });
});

describe("polesByRound", () => {
  it("keeps only the pole sitter, not whoever topped Q1 or Q2", () => {
    // What `qualifying/1` returns: LEC topped Q1 in round 2, ANT took pole.
    const poles = polesByRound([
      {
        round: "2",
        QualifyingResults: [
          { position: "1", Driver: driver("ANT"), Q1: "1:33.305", Q2: "1:32.443", Q3: "1:32.064" },
          { position: "4", Driver: driver("LEC"), Q1: "1:33.175", Q2: "1:32.486", Q3: "1:32.428" },
        ],
      },
      // No Q3 lap set: pole is the Q2 time.
      {
        round: "3",
        QualifyingResults: [
          { position: "1", Driver: driver("RUS"), Q1: "1:40.100", Q2: "1:39.800", Q3: "" },
        ],
      },
    ] as never);
    expect(poles.get("2")).toEqual({ code: "ANT", time: "1:32.064" });
    expect(poles.get("3")).toEqual({ code: "RUS", time: "1:39.800" });
  });
});

describe("fastestLapsByRound and sprintWinnersByRound", () => {
  it("take the one row each race returns", () => {
    const laps = fastestLapsByRound([
      {
        round: "1",
        Results: [
          classified("6", "VER", "Red Bull", {
            FastestLap: { rank: "1", lap: "43", Time: { time: "1:22.091" } },
          }),
        ],
      },
    ] as never);
    expect(laps.get("1")).toEqual({ code: "VER", lap: 43, time: "1:22.091" });

    const sprints = sprintWinnersByRound([
      { round: "2", SprintResults: [classified("1", "RUS", "Mercedes")] },
      { round: "4", SprintResults: [] },
    ] as never);
    expect(sprints.get("2")).toEqual({ code: "RUS", team: "Mercedes" });
    expect(sprints.has("4")).toBe(false);
  });
});

describe("mapClassification", () => {
  it("writes each car's result as the sport does", () => {
    const rows = mapClassification([
      classified("1", "VER", "Red Bull", { points: "25", Time: { time: "1:42:00.785" } }),
      classified("2", "LEC", "Ferrari", {
        points: "18",
        Time: { time: "+7.335" },
        FastestLap: { rank: "1", lap: "41", Time: { time: "1:35.202" } },
      }),
      classified("11", "GAS", "Alpine F1 Team", {
        laps: "60",
        status: "Lapped",
        Time: { time: "+2.171" },
      }),
      {
        ...classified("20", "STR", "Aston Martin", { laps: "36", status: "Retired" }),
        positionText: "R",
      },
    ] as never);

    expect(rows.map((r) => [r.position, r.code, r.result, r.points])).toEqual([
      ["1", "VER", "1:42:00.785", 25],
      ["2", "LEC", "+7.335", 18],
      ["11", "GAS", "+2 laps", 0],
      ["DNF", "STR", "Retired", 0],
    ]);
    expect(rows[2].team).toBe("Alpine");
    expect(rows[1].fastestLap).toBe(true);
    expect(rows[0].fastestLap).toBeUndefined();
  });
});

describe("rateLimiter", () => {
  it("lets four through at once and holds the rest until the window has passed", async () => {
    vi.useFakeTimers();
    try {
      const slot = rateLimiter(4, 1_000);
      const started: number[] = [];
      const t0 = Date.now();
      const calls = Array.from({ length: 6 }, () =>
        slot().then(() => started.push(Date.now() - t0))
      );
      await vi.advanceTimersByTimeAsync(999);
      expect(started).toEqual([0, 0, 0, 0]);
      await vi.advanceTimersByTimeAsync(1);
      await Promise.all(calls);
      expect(started).toEqual([0, 0, 0, 0, 1_000, 1_000]);
    } finally {
      vi.useRealTimers();
    }
  });
});
