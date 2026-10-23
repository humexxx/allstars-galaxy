import "server-only";

import { F1_DATA } from "@/lib/data/sports/f1";
import type {
  F1ClassificationRow,
  F1Constructor,
  F1Data,
  F1Driver,
  F1DriverPortrait,
  F1LapMark,
  F1PastWinner,
  F1Race,
  F1RaceClassification,
  F1Session,
  F1SessionKind,
} from "@/types/sports";
import { getF1DriverPortraits, teamLogo } from "./espn-f1-standings-service";
import { cachedFeed, rateLimiter, upstreamSignal } from "./upstream";

const JOLPICA_BASE_URL = "https://api.jolpi.ca/ergast/f1";
const REVALIDATE_SECONDS = 300;
/** A settled race's classification and last season's winners do not change. */
const DAY_SECONDS = 24 * 60 * 60;
/**
 * How long after the start a race's result can still move: stewards'
 * penalties and disqualifications land hours after the flag (both McLarens,
 * Las Vegas 2025).
 */
const SETTLING_MS = 48 * 60 * 60 * 1000;

type JolpicaDriver = {
  driverId: string;
  code?: string;
  givenName: string;
  familyName: string;
  nationality: string;
};

type JolpicaConstructor = {
  constructorId: string;
  name: string;
  nationality?: string;
};

type JolpicaDriverStanding = {
  position: string;
  points: string;
  wins: string;
  Driver: JolpicaDriver;
  Constructors: JolpicaConstructor[];
};

type JolpicaConstructorStanding = {
  position: string;
  points: string;
  wins: string;
  Constructor: JolpicaConstructor;
};

type JolpicaResult = {
  position: string;
  /** "1"…, or a letter for an unplaced car: R(etired), D(isqualified)… */
  positionText?: string;
  points?: string;
  grid?: string;
  laps?: string;
  status?: string;
  /** The winner's race time, everybody else's gap. */
  Time?: { millis?: string; time: string };
  FastestLap?: { rank?: string; lap?: string; Time?: { time: string } };
  Driver: JolpicaDriver;
  Constructor: JolpicaConstructor;
};

type JolpicaQualifyingResult = {
  position: string;
  Driver: JolpicaDriver;
  Q1?: string;
  Q2?: string;
  Q3?: string;
};

type JolpicaSession = { date: string; time?: string };

type JolpicaRace = {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit: {
    circuitId: string;
    circuitName: string;
    Location: {
      locality: string;
      country: string;
    };
  };
  FirstPractice?: JolpicaSession;
  SecondPractice?: JolpicaSession;
  ThirdPractice?: JolpicaSession;
  SprintQualifying?: JolpicaSession;
  /** 2023's name for sprint qualifying. */
  SprintShootout?: JolpicaSession;
  Sprint?: JolpicaSession;
  Qualifying?: JolpicaSession;
  Results?: JolpicaResult[];
  QualifyingResults?: JolpicaQualifyingResult[];
  SprintResults?: JolpicaResult[];
};

type JolpicaSeasonRacesResponse = {
  MRData: {
    RaceTable: { season: string; Races: JolpicaRace[] };
  };
};

type JolpicaDriverStandingsResponse = {
  MRData: {
    StandingsTable: {
      StandingsLists: Array<{
        season: string;
        round: string;
        DriverStandings: JolpicaDriverStanding[];
      }>;
    };
  };
};

type JolpicaConstructorStandingsResponse = {
  MRData: {
    StandingsTable: {
      StandingsLists: Array<{
        season: string;
        round: string;
        ConstructorStandings: JolpicaConstructorStanding[];
      }>;
    };
  };
};

type JolpicaAllResultsResponse = {
  MRData: { RaceTable: { Races: JolpicaRace[] } };
};

const NATIONALITY_FLAG: Record<string, string> = {
  Argentine: "🇦🇷",
  Australian: "🇦🇺",
  Austrian: "🇦🇹",
  Belgian: "🇧🇪",
  Brazilian: "🇧🇷",
  British: "🇬🇧",
  Canadian: "🇨🇦",
  Chinese: "🇨🇳",
  Colombian: "🇨🇴",
  Danish: "🇩🇰",
  Dutch: "🇳🇱",
  Finnish: "🇫🇮",
  French: "🇫🇷",
  German: "🇩🇪",
  Italian: "🇮🇹",
  Japanese: "🇯🇵",
  Mexican: "🇲🇽",
  "Monégasque": "🇲🇨",
  Monegasque: "🇲🇨",
  "New Zealander": "🇳🇿",
  Polish: "🇵🇱",
  Russian: "🇷🇺",
  Spanish: "🇪🇸",
  Swedish: "🇸🇪",
  Swiss: "🇨🇭",
  Thai: "🇹🇭",
  American: "🇺🇸",
  Venezuelan: "🇻🇪",
};

const NATIONALITY_CODE: Record<string, string> = {
  Argentine: "ARG",
  Australian: "AUS",
  Austrian: "AUT",
  Belgian: "BEL",
  Brazilian: "BRA",
  British: "GBR",
  Canadian: "CAN",
  Chinese: "CHN",
  Colombian: "COL",
  Danish: "DEN",
  Dutch: "NED",
  Finnish: "FIN",
  French: "FRA",
  German: "GER",
  Italian: "ITA",
  Japanese: "JPN",
  Mexican: "MEX",
  "Monégasque": "MON",
  Monegasque: "MON",
  "New Zealander": "NZL",
  Polish: "POL",
  Russian: "RUS",
  Spanish: "ESP",
  Swedish: "SWE",
  Swiss: "SUI",
  Thai: "THA",
  American: "USA",
  Venezuelan: "VEN",
};

const COUNTRY_FLAG: Record<string, string> = {
  Argentina: "🇦🇷",
  Australia: "🇦🇺",
  Austria: "🇦🇹",
  Azerbaijan: "🇦🇿",
  Bahrain: "🇧🇭",
  Belgium: "🇧🇪",
  Brazil: "🇧🇷",
  Canada: "🇨🇦",
  China: "🇨🇳",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Hungary: "🇭🇺",
  India: "🇮🇳",
  Italy: "🇮🇹",
  Japan: "🇯🇵",
  Korea: "🇰🇷",
  Malaysia: "🇲🇾",
  Mexico: "🇲🇽",
  Monaco: "🇲🇨",
  Morocco: "🇲🇦",
  Netherlands: "🇳🇱",
  Portugal: "🇵🇹",
  Qatar: "🇶🇦",
  Russia: "🇷🇺",
  "Saudi Arabia": "🇸🇦",
  Singapore: "🇸🇬",
  Spain: "🇪🇸",
  Sweden: "🇸🇪",
  Switzerland: "🇨🇭",
  Turkey: "🇹🇷",
  UAE: "🇦🇪",
  "United Arab Emirates": "🇦🇪",
  UK: "🇬🇧",
  "United Kingdom": "🇬🇧",
  USA: "🇺🇸",
  "United States": "🇺🇸",
  Vietnam: "🇻🇳",
};

const CONSTRUCTOR_COLOR: Record<string, string> = {
  Mercedes: "#27F4D2",
  "Red Bull": "#3671C6",
  "Red Bull Racing": "#3671C6",
  Ferrari: "#E80020",
  McLaren: "#FF8000",
  "Aston Martin": "#229971",
  Alpine: "#FF87BC",
  "Alpine F1 Team": "#FF87BC",
  Williams: "#64C4FF",
  RB: "#6692FF",
  AlphaTauri: "#6692FF",
  "Racing Bulls": "#6692FF",
  Sauber: "#52E252",
  "Kick Sauber": "#52E252",
  Audi: "#52E252",
  Haas: "#B6BABD",
  "Haas F1 Team": "#B6BABD",
  Cadillac: "#2C3E50",
};

function flagForNationality(n: string): string {
  return NATIONALITY_FLAG[n] ?? "🏁";
}

function codeForNationality(n: string): string {
  return NATIONALITY_CODE[n] ?? n.slice(0, 3).toUpperCase();
}

function flagForCountry(c: string): string {
  return COUNTRY_FLAG[c] ?? "🏁";
}

function colorForConstructor(name: string): string {
  if (CONSTRUCTOR_COLOR[name]) return CONSTRUCTOR_COLOR[name];
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(CONSTRUCTOR_COLOR)) {
    if (lower.includes(k.toLowerCase())) return v;
  }
  return "#666";
}

function shortConstructor(name: string): string {
  return name
    .replace(/\s*F1\s*Team\s*$/i, "")
    .replace(/\s*Racing\s*$/i, " Racing")
    .replace(/^Red Bull Racing$/i, "Red Bull")
    .trim();
}

function driverShortName(driver: JolpicaDriver): string {
  const given = driver.givenName;
  const initial = given ? `${given[0]}. ` : "";
  return `${initial}${driver.familyName}`;
}

function driverCode(driver: JolpicaDriver): string {
  return driver.code ?? driver.familyName.slice(0, 3).toUpperCase();
}

// A little over a second: requests started a second apart can still arrive
// closer together than that.
const jolpicaSlot = rateLimiter(4, 1_200);

async function fetchJolpica<T>(path: string, revalidate = REVALIDATE_SECONDS): Promise<T> {
  // Before the queue, not after it: a call that waits for a slot spends the
  // same budget, so a read still ends inside it however many calls it makes.
  const signal = upstreamSignal();
  await jolpicaSlot();
  const res = await fetch(`${JOLPICA_BASE_URL}${path}`, { signal, next: { revalidate } });
  if (!res.ok) throw new Error(`Jolpica ${res.status} on ${path}`);
  return (await res.json()) as T;
}

/** How long a race is called live after its start, red flags included. */
const RACE_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * `time` is Jolpica's race start (HH:MM:SSZ); without one the whole day is
 * treated as the live window. Nothing used to return "live" at all, so the
 * dashboard's Live pill for F1 was dead code.
 *
 * Past that window the race is over whether or not the results are in: they
 * land hours later, and until then it read as the next race for a day.
 */
function deriveRaceStatus(
  date: string,
  hasResults: boolean,
  time?: string | null,
  now: number = Date.now()
): F1Race["status"] {
  if (hasResults) return "completed";
  const start = Date.parse(time ? `${date}T${time}` : `${date}T00:00:00Z`);
  const end = time ? start + RACE_WINDOW_MS : Date.parse(`${date}T23:59:59Z`);
  if (Number.isNaN(start)) return "upcoming";
  if (now > end) return "completed";
  if (now >= start) return "live";
  return "upcoming";
}

/** A Jolpica date and time as an ISO instant; nothing without a time. */
function instant(date: string, time?: string): string | undefined {
  if (!time) return undefined;
  // Always UTC on Jolpica, but a bare time would be read in the server's zone.
  const ms = Date.parse(`${date}T${time.endsWith("Z") ? time : `${time}Z`}`);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

const SESSION_KEYS = [
  ["FirstPractice", "fp1"],
  ["SecondPractice", "fp2"],
  ["ThirdPractice", "fp3"],
  ["SprintQualifying", "sprint-qualifying"],
  ["SprintShootout", "sprint-qualifying"],
  ["Sprint", "sprint"],
  ["Qualifying", "qualifying"],
] as const satisfies ReadonlyArray<readonly [keyof JolpicaRace, F1SessionKind]>;

/**
 * The weekend in time order. Jolpica's keys are not: a sprint weekend lists
 * Qualifying before the Sprint that runs ahead of it.
 */
function mapSessions(race: JolpicaRace): F1Session[] {
  const sessions: F1Session[] = [];
  for (const [key, kind] of SESSION_KEYS) {
    const session = race[key];
    const startsAt = session && instant(session.date, session.time);
    if (startsAt) sessions.push({ kind, startsAt });
  }
  const start = instant(race.date, race.time);
  if (start) sessions.push({ kind: "race", startsAt: start });
  return sessions.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * The time column of a classification: the winner's time, a gap, laps down,
 * or why the car stopped.
 *
 * A lapped car's `Time` is not a gap to the winner — Jolpica gave the 11th
 * car in Singapore "+2.171" a lap down — so laps behind win over it.
 */
function resultText(result: JolpicaResult, leaderLaps: number | undefined): string {
  const status = result.status ?? "";
  const laps = toInt(result.laps);
  const behind = leaderLaps !== undefined && laps !== undefined ? leaderLaps - laps : 0;
  if ((status === "Lapped" || /^\+\d+ Laps?$/.test(status)) && behind > 0) {
    return `+${behind} ${behind === 1 ? "lap" : "laps"}`;
  }
  if (status === "Finished" && result.Time?.time) return result.Time.time;
  return status || "—";
}

/** Jolpica's letter for an unplaced car, as the sport writes it. */
const UNPLACED: Record<string, string> = {
  R: "DNF",
  D: "DSQ",
  E: "EX",
  W: "DNS",
  F: "DNQ",
  N: "NC",
};

function mapClassification(results: JolpicaResult[]): F1ClassificationRow[] {
  const leaderLaps = toInt(results[0]?.laps);
  return results.map((r) => {
    const text = r.positionText ?? r.position;
    return {
      position: UNPLACED[text] ?? text,
      code: driverCode(r.Driver),
      name: driverShortName(r.Driver),
      team: shortConstructor(r.Constructor.name),
      grid: toInt(r.grid),
      laps: toInt(r.laps),
      result: resultText(r, leaderLaps),
      points: parseFloat(r.points ?? "0") || 0,
      fastestLap: r.FastestLap?.rank === "1" || undefined,
    };
  });
}

/** Pole, the fastest lap and the sprint, each from one season-wide call. */
type RaceExtras = {
  poles: Map<string, F1LapMark>;
  fastestLaps: Map<string, F1LapMark>;
  sprintWinners: Map<string, { code: string; team: string }>;
};

/**
 * `qualifying/1` also returns whoever topped Q1 or Q2 when somebody else took
 * pole — 33 rows for 17 races — so only position 1 is kept. Pole is the
 * fastest time of the last part the driver reached.
 */
function polesByRound(races: JolpicaRace[]): Map<string, F1LapMark> {
  const poles = new Map<string, F1LapMark>();
  for (const race of races) {
    const pole = race.QualifyingResults?.find((q) => q.position === "1");
    if (pole) {
      poles.set(race.round, {
        code: driverCode(pole.Driver),
        time: pole.Q3 || pole.Q2 || pole.Q1 || undefined,
      });
    }
  }
  return poles;
}

function fastestLapsByRound(races: JolpicaRace[]): Map<string, F1LapMark> {
  const laps = new Map<string, F1LapMark>();
  for (const race of races) {
    const row = race.Results?.[0];
    if (row) {
      laps.set(race.round, {
        code: driverCode(row.Driver),
        lap: toInt(row.FastestLap?.lap),
        time: row.FastestLap?.Time?.time,
      });
    }
  }
  return laps;
}

function sprintWinnersByRound(races: JolpicaRace[]): Map<string, { code: string; team: string }> {
  const winners = new Map<string, { code: string; team: string }>();
  for (const race of races) {
    const row = race.SprintResults?.[0];
    if (row) {
      winners.set(race.round, {
        code: driverCode(row.Driver),
        team: shortConstructor(row.Constructor.name),
      });
    }
  }
  return winners;
}

const NO_EXTRAS: RaceExtras = {
  poles: new Map(),
  fastestLaps: new Map(),
  sprintWinners: new Map(),
};

/** "Nico Hülkenberg" → "nico hulkenberg", so two feeds' spellings meet. */
function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}

function surnameKey(name: string): string {
  return nameKey(name).split(" ").at(-1) ?? "";
}

type PortraitLookup = (driver: JolpicaDriver) => F1DriverPortrait | undefined;

/**
 * ESPN's faces, ready to look Jolpica's drivers up in. Jolpica stays the
 * table; ESPN only adds the pictures.
 *
 * By race code first — both feeds use the same three letters — then by full
 * name, then by surname: ESPN calls him "Kimi Antonelli", Jolpica "Andrea
 * Kimi Antonelli". A key two ESPN drivers share matches neither, so a driver
 * nobody matches keeps no picture rather than somebody else's.
 */
function portraitLookup(portraits: F1DriverPortrait[]): PortraitLookup {
  const unique = (key: (p: F1DriverPortrait) => string | undefined) => {
    const map = new Map<string, F1DriverPortrait | null>();
    for (const p of portraits) {
      const k = key(p);
      if (k) map.set(k, map.has(k) ? null : p);
    }
    return (k: string | undefined) => (k ? (map.get(k) ?? undefined) : undefined);
  };
  const byCode = unique((p) => p.code?.toUpperCase());
  const byName = unique((p) => nameKey(p.name));
  const bySurname = unique((p) => surnameKey(p.name));

  return (driver) =>
    byCode(driver.code?.toUpperCase()) ??
    byName(nameKey(`${driver.givenName} ${driver.familyName}`)) ??
    bySurname(surnameKey(driver.familyName));
}

function mapDrivers(
  standings: JolpicaDriverStanding[],
  podiumCounts: Map<string, number>,
  portraitOf: PortraitLookup = () => undefined,
): F1Driver[] {
  return standings.map((row) => {
    const code = driverCode(row.Driver);
    const team = row.Constructors[0]?.name ?? "—";
    const portrait = portraitOf(row.Driver);
    return {
      position: parseInt(row.position, 10),
      code,
      name: `${row.Driver.givenName} ${row.Driver.familyName}`,
      shortName: driverShortName(row.Driver),
      team: shortConstructor(team),
      nationality: codeForNationality(row.Driver.nationality),
      flagEmoji: flagForNationality(row.Driver.nationality),
      points: parseFloat(row.points),
      wins: parseInt(row.wins, 10),
      podiums: podiumCounts.get(code) ?? 0,
      imageUrl: portrait?.imageUrl,
      flagUrl: portrait?.flagUrl,
    };
  });
}

function mapConstructors(
  standings: JolpicaConstructorStanding[],
  podiumCounts: Map<string, number>,
): F1Constructor[] {
  return standings.map((row) => {
    const name = row.Constructor.name;
    return {
      position: parseInt(row.position, 10),
      name,
      shortName: shortConstructor(name),
      points: parseFloat(row.points),
      wins: parseInt(row.wins, 10),
      podiums: podiumCounts.get(name) ?? 0,
      primaryColor: colorForConstructor(name),
      // Vendored files, so a constructor's logo does not wait on ESPN.
      logoUrl: teamLogo(name),
    };
  });
}

function mapRaces(
  scheduleRaces: JolpicaRace[],
  resultsByRound: Map<string, JolpicaResult[]>,
  extras: RaceExtras = NO_EXTRAS,
  now: number = Date.now(),
): F1Race[] {
  return scheduleRaces.map((race) => {
    const results = resultsByRound.get(race.round);
    const status = deriveRaceStatus(race.date, !!results && results.length > 0, race.time, now);
    const done = status === "completed";
    const podium =
      done && results && results.length >= 3
        ? ([
            driverCode(results[0].Driver),
            driverCode(results[1].Driver),
            driverCode(results[2].Driver),
          ] as [string, string, string])
        : undefined;
    // The podium steps are separate calls; only a step that answered counts.
    const first = done ? results?.find((r) => r.position === "1") : undefined;
    const leaderLaps = toInt(first?.laps);
    const sessions = mapSessions(race);
    return {
      id: `r-${race.round}`,
      round: parseInt(race.round, 10),
      name: race.raceName,
      circuit: race.Circuit.circuitName,
      circuitId: race.Circuit.circuitId,
      location: race.Circuit.Location.locality,
      country: race.Circuit.Location.country,
      flagEmoji: flagForCountry(race.Circuit.Location.country),
      date: race.date,
      startsAt: instant(race.date, race.time),
      sprint: race.Sprint !== undefined,
      sessions: sessions.length > 0 ? sessions : undefined,
      status,
      podium,
      podiumGaps:
        podium && results
          ? [resultText(results[1], leaderLaps), resultText(results[2], leaderLaps)]
          : undefined,
      winner: first
        ? {
            code: driverCode(first.Driver),
            team: shortConstructor(first.Constructor.name),
            time: first.Time?.time,
            laps: leaderLaps,
            grid: toInt(first.grid),
          }
        : undefined,
      pole: extras.poles.get(race.round),
      fastestLap: done ? extras.fastestLaps.get(race.round) : undefined,
      sprintWinner: extras.sprintWinners.get(race.round),
    };
  });
}

/**
 * One race per round with its top three, from one call per podium step.
 *
 * Jolpica caps `limit` at 100 rows and a season runs to ~500 results, so the
 * old `results.json?limit=300` came back with the first five races and nothing
 * after: every podium from round six on was blank and the podium tallies
 * stopped in May. `results/{n}` returns one row per race whatever the round.
 */
function mergePodiumSteps(steps: JolpicaRace[][]): JolpicaRace[] {
  const byRound = new Map<string, JolpicaRace>();
  for (const races of steps) {
    for (const race of races) {
      const entry = byRound.get(race.round) ?? { ...race, Results: [] };
      entry.Results = [...(entry.Results ?? []), ...(race.Results ?? [])];
      byRound.set(race.round, entry);
    }
  }
  return [...byRound.values()].map((race) => ({
    ...race,
    Results: [...(race.Results ?? [])].sort(
      (a, b) => parseInt(a.position, 10) - parseInt(b.position, 10)
    ),
  }));
}

function tallyPodiums(racesWithResults: JolpicaRace[]): {
  driverPodiums: Map<string, number>;
  constructorPodiums: Map<string, number>;
  resultsByRound: Map<string, JolpicaResult[]>;
} {
  const driverPodiums = new Map<string, number>();
  const constructorPodiums = new Map<string, number>();
  const resultsByRound = new Map<string, JolpicaResult[]>();

  for (const race of racesWithResults) {
    if (!race.Results) continue;
    resultsByRound.set(race.round, race.Results);
    for (const result of race.Results.slice(0, 3)) {
      const dCode = driverCode(result.Driver);
      driverPodiums.set(dCode, (driverPodiums.get(dCode) ?? 0) + 1);
      const cName = result.Constructor.name;
      constructorPodiums.set(cName, (constructorPodiums.get(cName) ?? 0) + 1);
    }
  }

  return { driverPodiums, constructorPodiums, resultsByRound };
}

/** The calendar and both championships: what the view cannot do without. */
type F1Core = {
  season: number;
  races: JolpicaRace[];
  drivers: JolpicaDriverStanding[];
  constructors: JolpicaConstructorStanding[];
  portraits: F1DriverPortrait[];
};

async function fetchF1Core(): Promise<F1Core> {
  // Alongside Jolpica, not after it. Pictures are an extra: when ESPN fails
  // the table still refreshes, only without faces.
  const portraits = getF1DriverPortraits().catch((error): F1DriverPortrait[] => {
    console.warn("espn f1 portraits unavailable:", error);
    return [];
  });
  const [schedule, driverStandings, constructorStandings] = await Promise.all([
    fetchJolpica<JolpicaSeasonRacesResponse>(`/current.json`),
    fetchJolpica<JolpicaDriverStandingsResponse>(`/current/driverStandings.json`),
    fetchJolpica<JolpicaConstructorStandingsResponse>(`/current/constructorStandings.json`),
  ]);

  const drivers = driverStandings.MRData.StandingsTable.StandingsLists[0];
  const constructors = constructorStandings.MRData.StandingsTable.StandingsLists[0];
  if (!drivers || !constructors) {
    throw new Error("Jolpica returned empty standings");
  }

  return {
    season: parseInt(schedule.MRData.RaceTable.season, 10),
    races: schedule.MRData.RaceTable.Races,
    drivers: drivers.DriverStandings,
    constructors: constructors.ConstructorStandings,
    portraits: await portraits,
  };
}

const getF1Core = cachedFeed(
  "Jolpica F1",
  fetchF1Core,
  (): F1Core | null => null,
  ["jolpica:f1-core"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:f1"] },
);

async function fetchSeasonRaces(path: string): Promise<JolpicaRace[]> {
  const res = await fetchJolpica<JolpicaAllResultsResponse>(path);
  return res.MRData.RaceTable.Races;
}

/**
 * One season-wide list — a podium step, the poles, the fastest laps, the
 * sprints — in a cache entry of its own.
 *
 * They were caught inside the feed's cache, so a single 429 stored the feed
 * without that list over the good one for five minutes: every pole gone, or
 * with the winners' step, every result. Now a list that fails to refresh
 * keeps its last answer and holds nothing else back; only one never fetched
 * is missing, and the gap is not stored.
 */
const getSeasonRaces = cachedFeed(
  "Jolpica F1 season list",
  fetchSeasonRaces,
  (): JolpicaRace[] => [],
  ["jolpica:f1-season-races"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:f1"] },
);

/**
 * The season as of `now`, put together on every read from the cached parts,
 * all asked for at once.
 *
 * Each race's status is worked out here rather than in a cache: a cache entry
 * is served stale while it refreshes, so the first visit after a quiet
 * weekend got Friday's "upcoming" and Sunday's race was still the next one.
 */
export async function getF1Data(now: number = Date.now()): Promise<F1Data> {
  const [core, winners, seconds, thirds, qualifying, fastest, sprints] = await Promise.all([
    getF1Core(),
    getSeasonRaces(`/current/results/1.json?limit=100`),
    getSeasonRaces(`/current/results/2.json?limit=100`),
    getSeasonRaces(`/current/results/3.json?limit=100`),
    getSeasonRaces(`/current/qualifying/1.json?limit=100`),
    getSeasonRaces(`/current/fastest/1/results.json?limit=100`),
    getSeasonRaces(`/current/sprint/1.json?limit=100`),
  ]);
  if (!core) return F1_DATA;

  // Entries refresh on their own, so around a new season one can still hold
  // the last: its rounds are not this season's.
  const season = String(core.season);
  const ofSeason = (races: JolpicaRace[]): JolpicaRace[] => races.filter((r) => r.season === season);
  const podiums = tallyPodiums(mergePodiumSteps([winners, seconds, thirds].map(ofSeason)));

  return {
    season: core.season,
    drivers: mapDrivers(core.drivers, podiums.driverPodiums, portraitLookup(core.portraits)),
    constructors: mapConstructors(core.constructors, podiums.constructorPodiums),
    races: mapRaces(
      core.races,
      podiums.resultsByRound,
      {
        poles: polesByRound(ofSeason(qualifying)),
        fastestLaps: fastestLapsByRound(ofSeason(fastest)),
        sprintWinners: sprintWinnersByRound(ofSeason(sprints)),
      },
      now,
    ),
  };
}

async function fetchRaceClassification(
  season: number,
  round: number,
): Promise<F1RaceClassification | null> {
  const res = await fetchJolpica<JolpicaAllResultsResponse>(
    `/${season}/${round}/results.json?limit=100`,
  );
  const results = res.MRData.RaceTable.Races[0]?.Results ?? [];
  // Thrown, not returned: an empty answer kept in the cache would hide
  // results that land an hour after the flag.
  if (results.length === 0) throw new Error(`Jolpica has no results for ${season} round ${round}`);
  return { season, round, rows: mapClassification(results) };
}

const recentClassification = cachedFeed(
  "Jolpica F1 classification",
  fetchRaceClassification,
  () => null,
  ["jolpica:f1-classification-recent"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:f1"] },
);

const settledClassification = cachedFeed(
  "Jolpica F1 classification",
  fetchRaceClassification,
  () => null,
  ["jolpica:f1-classification-settled"],
  { revalidate: DAY_SECONDS, tags: ["sports:f1"] },
);

/**
 * A race's full order, only when somebody opens it (about 13 KB a race, so
 * not for every race in the season feed). Null when Jolpica has nothing or
 * does not answer.
 *
 * Kept for a day once the race has settled. Until then it is on the feed's
 * five minutes: a day-old order under the podium the feed has since
 * corrected would contradict it. A race the calendar cannot place counts as
 * recent.
 */
export async function getF1RaceClassification(
  season: number,
  round: number,
  now: number = Date.now(),
): Promise<F1RaceClassification | null> {
  const core = await getF1Core();
  const race =
    core?.season === season ? core.races.find((r) => r.round === String(round)) : undefined;
  const start = race ? Date.parse(instant(race.date, race.time) ?? `${race.date}T00:00:00Z`) : NaN;
  const settled = (core !== null && season < core.season) || now - start > SETTLING_MS;
  return settled ? settledClassification(season, round) : recentClassification(season, round);
}

async function fetchSeasonWinners(season: number): Promise<Record<string, F1PastWinner>> {
  const res = await fetchJolpica<JolpicaAllResultsResponse>(
    `/${season}/results/1.json?limit=100`,
    DAY_SECONDS,
  );
  const winners: Record<string, F1PastWinner> = {};
  // In round order, so a track raced twice in a season (2020) keeps the
  // later race.
  for (const race of res.MRData.RaceTable.Races) {
    const winner = race.Results?.[0];
    if (winner) {
      winners[race.Circuit.circuitId] = {
        season,
        code: driverCode(winner.Driver),
        name: driverShortName(winner.Driver),
        team: shortConstructor(winner.Constructor.name),
      };
    }
  }
  return winners;
}

/**
 * Who won at each circuit in `season`, keyed by circuit, for the dashboard's
 * next race. One call covers every track, so it can be asked for before the
 * next race is known. A circuit new to the calendar has nobody.
 */
export const getF1SeasonWinners = cachedFeed(
  "Jolpica F1 season winners",
  fetchSeasonWinners,
  (): Record<string, F1PastWinner> => ({}),
  ["jolpica:f1-season-winners"],
  { revalidate: DAY_SECONDS, tags: ["sports:f1"] },
);

/** Pure mappers, exported for their tests — nothing here touches the network. */
export const __testing = {
  mergePodiumSteps,
  tallyPodiums,
  mapRaces,
  mapDrivers,
  mapConstructors,
  portraitLookup,
  mapSessions,
  mapClassification,
  polesByRound,
  fastestLapsByRound,
  sprintWinnersByRound,
  deriveRaceStatus,
  rateLimiter,
};
