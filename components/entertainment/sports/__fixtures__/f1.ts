import type { F1Data, F1Driver, F1Race } from "@/types/sports";

// A late-2026 calendar around Austin: four races run, Austin next, four after it.

const driver = (code: string, shortName: string, team: string): F1Driver => ({
  position: 1,
  code,
  name: shortName,
  shortName,
  team,
  nationality: "NED",
  flagEmoji: "🇳🇱",
  points: 0,
  wins: 0,
  podiums: 0,
});

export const DRIVERS: F1Driver[] = [
  driver("VER", "M. Verstappen", "Red Bull"),
  driver("LEC", "C. Leclerc", "Ferrari"),
  driver("NOR", "L. Norris", "McLaren"),
  driver("RUS", "G. Russell", "Mercedes"),
];

const base = (round: number, name: string, startsAt: string, circuitId: string): F1Race => ({
  id: `r-${round}`,
  round,
  name,
  circuit: `${name} circuit`,
  circuitId,
  location: name.split(" ")[0],
  country: "Somewhere",
  flagEmoji: "🏁",
  date: startsAt.slice(0, 10),
  startsAt,
  status: "upcoming",
});

const finished = (race: F1Race, winner: string, pole: string, fastest: string): F1Race => {
  const [second, third] = DRIVERS.map((d) => d.code).filter((code) => code !== winner);
  return {
    ...race,
    status: "completed",
    podium: [winner, second, third],
    podiumGaps: ["+5.402", "+11.237"],
    winner: { code: winner, team: "Red Bull", time: "1:32:11.902", laps: 56, grid: 2 },
    pole: { code: pole, time: "1:30.641" },
    fastestLap: { code: fastest, lap: 52, time: "1:33.418" },
  };
};

export const AUSTIN: F1Race = {
  ...base(18, "United States Grand Prix", "2026-10-25T20:00:00.000Z", "americas"),
  circuit: "Circuit of the Americas",
  location: "Austin",
  country: "USA",
  flagEmoji: "🇺🇸",
  sprint: true,
  sessions: [
    { kind: "fp1", startsAt: "2026-10-23T17:30:00.000Z" },
    { kind: "sprint-qualifying", startsAt: "2026-10-23T21:30:00.000Z" },
    { kind: "sprint", startsAt: "2026-10-24T17:00:00.000Z" },
    { kind: "qualifying", startsAt: "2026-10-24T21:00:00.000Z" },
    { kind: "race", startsAt: "2026-10-25T20:00:00.000Z" },
  ],
};

const singapore = base(17, "Singapore Grand Prix", "2026-10-11T12:00:00.000Z", "marina_bay");

export const SINGAPORE: F1Race = {
  ...finished(singapore, "VER", "RUS", "LEC"),
  sprint: true,
  sprintWinner: { code: "NOR", team: "McLaren" },
};

export const F1_SEASON: F1Data = {
  season: 2026,
  drivers: DRIVERS,
  constructors: [],
  races: [
    finished(base(14, "Dutch Grand Prix", "2026-08-23T13:00:00.000Z", "zandvoort"), "NOR", "NOR", "NOR"),
    finished(base(15, "Italian Grand Prix", "2026-09-06T13:00:00.000Z", "monza"), "LEC", "LEC", "VER"),
    finished(base(16, "Azerbaijan Grand Prix", "2026-09-27T11:00:00.000Z", "baku"), "RUS", "VER", "NOR"),
    SINGAPORE,
    AUSTIN,
    base(19, "Mexico City Grand Prix", "2026-11-01T20:00:00.000Z", "rodriguez"),
    base(20, "São Paulo Grand Prix", "2026-11-08T17:00:00.000Z", "interlagos"),
    base(21, "Las Vegas Grand Prix", "2026-11-21T04:00:00.000Z", "vegas"),
    base(22, "Qatar Grand Prix", "2026-11-29T16:00:00.000Z", "losail"),
  ],
};
