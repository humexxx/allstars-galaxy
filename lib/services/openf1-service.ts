import "server-only";

import type {
  F1SessionKind,
  F1SessionResult,
  F1SessionResultRow,
  F1WeekendResults,
} from "@/types/sports";

import { cachedFeed, rateLimiter, upstreamSignal } from "./upstream";

/**
 * OpenF1 (https://openf1.org): every session's order — practice included,
 * which Jolpica does not carry — with best laps and gaps. No key; a session's
 * results are there once it has finished.
 */
const BASE_URL = "https://api.openf1.org/v1";
const REVALIDATE_SECONDS = 300;
const DAY_SECONDS = 24 * 60 * 60;
/** Jolpica's settling window: by then the stewards are done with the weekend. */
const SETTLING_MS = 48 * 60 * 60 * 1000;

// About three requests a second without a key. A weekend is at most seven
// calls (its sessions, its drivers, five results), queued rather than burst.
const openF1Slot = rateLimiter(3, 1_100);

type OpenF1Session = {
  session_key: number;
  session_name: string;
  date_start: string;
  date_end?: string | null;
  meeting_key: number;
};

type OpenF1Gap = number | string | null;

type OpenF1Result = {
  position: number | null;
  driver_number: number;
  number_of_laps?: number | null;
  dnf?: boolean;
  dns?: boolean;
  dsq?: boolean;
  /** Seconds: the best lap, or the race time; one per part of qualifying. */
  duration?: number | Array<number | null> | null;
  /** Seconds, or "+2 LAPS"; one per part of qualifying. */
  gap_to_leader?: OpenF1Gap | OpenF1Gap[];
};

type OpenF1Driver = {
  driver_number: number;
  name_acronym?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  broadcast_name?: string | null;
  team_name?: string | null;
  team_colour?: string | null;
};

/** OpenF1's session names; the 2023 sprint qualifying was a "Shootout". */
const SESSION_KINDS: Record<string, F1SessionKind> = {
  "Practice 1": "fp1",
  "Practice 2": "fp2",
  "Practice 3": "fp3",
  "Sprint Qualifying": "sprint-qualifying",
  "Sprint Shootout": "sprint-qualifying",
  Sprint: "sprint",
  Qualifying: "qualifying",
  Race: "race",
};

const RUNS_A_DISTANCE: ReadonlySet<F1SessionKind> = new Set(["sprint", "race"]);
const SEGMENTS = ["Q1", "Q2", "Q3"] as const;

/** 95.291 → "1:35.291"; 5599.273 → "1:33:19.273". */
function clock(seconds: number): string {
  // Rounded whole, then split: rounding the fraction alone turned 59.9996
  // into "0:59.1000".
  const total = Math.round(seconds * 1000);
  const millis = total % 1000;
  const whole = (total - millis) / 1000;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const tail = `${String(s).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${tail}` : `${m}:${tail}`;
}

function gapText(gap: OpenF1Gap | undefined): string | undefined {
  if (gap === null || gap === undefined || gap === 0) return undefined;
  if (typeof gap === "number") return `+${gap.toFixed(3)}`;
  // "+2 LAPS" → "+2 laps"
  return gap.replace(/LAPS?/, (word) => word.toLowerCase());
}

function nameOf(driver: OpenF1Driver | undefined, number: number): string {
  if (!driver) return `#${number}`;
  const last = driver.last_name?.trim();
  const first = driver.first_name?.trim();
  if (last) return first ? `${first[0]}. ${last}` : last;
  return driver.broadcast_name ?? `#${number}`;
}

/**
 * One session's order. Qualifying sends a time and a gap per part; a car
 * shows the last part it reached, which is where it was placed.
 */
function sessionRows(
  kind: F1SessionKind,
  results: OpenF1Result[],
  drivers: Map<number, OpenF1Driver>
): F1SessionResultRow[] {
  const placed = [...results].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  return placed.map((result) => {
    const driver = drivers.get(result.driver_number);
    const durations = Array.isArray(result.duration) ? result.duration : [result.duration ?? null];
    const gaps = Array.isArray(result.gap_to_leader) ? result.gap_to_leader : [result.gap_to_leader ?? null];
    let part = durations.length - 1;
    while (part > 0 && (durations[part] === null || durations[part] === undefined)) part--;
    const seconds = durations[part];
    const out = result.dsq ? "DSQ" : result.dns ? "DNS" : result.dnf ? "DNF" : null;
    const leader = result.position === 1;
    const row: F1SessionResultRow = {
      position: out ?? (result.position ? String(result.position) : "NC"),
      code: driver?.name_acronym ?? String(result.driver_number),
      name: nameOf(driver, result.driver_number),
      team: driver?.team_name ?? "",
    };
    if (driver?.team_colour) row.teamColor = `#${driver.team_colour}`;
    if (result.number_of_laps) row.laps = result.number_of_laps;
    // Over a distance only the winner's time means anything; the rest are gaps.
    if (typeof seconds === "number" && (!RUNS_A_DISTANCE.has(kind) || leader)) {
      row.time = clock(seconds);
    }
    if (!out) {
      const gap = gapText(gaps[part] ?? null);
      if (gap && !leader) row.gap = gap;
    }
    if (kind === "qualifying" || kind === "sprint-qualifying") {
      if (Array.isArray(result.duration) && typeof seconds === "number") row.segment = SEGMENTS[part];
    }
    return row;
  });
}

async function fetchOpenF1<T>(path: string): Promise<T> {
  const signal = upstreamSignal();
  await openF1Slot();
  const res = await fetch(`${BASE_URL}${path}`, {
    signal,
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new Error(`OpenF1 ${res.status} on ${path}`);
  return (await res.json()) as T;
}

/**
 * The finished sessions between `from` and `to` (a weekend's first session
 * and its race), each with its order. A session still to run, or running,
 * is left out: OpenF1 has its order only once it is over.
 */
async function fetchWeekendResults(
  season: number,
  round: number,
  from: string,
  to: string,
  now = Date.now()
): Promise<F1WeekendResults> {
  // Half a day either side: the timetable is the calendar's, not OpenF1's.
  const start = new Date(Date.parse(from) - 43_200_000).toISOString();
  const end = new Date(Date.parse(to) + 43_200_000).toISOString();
  const sessions = (
    await fetchOpenF1<OpenF1Session[]>(
      `/sessions?year=${season}&date_start%3E=${start}&date_start%3C=${end}`
    )
  )
    .filter((s) => SESSION_KINDS[s.session_name] && Date.parse(s.date_end ?? s.date_start) <= now)
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));
  if (sessions.length === 0) return { season, round, sessions: [] };

  const drivers = new Map<number, OpenF1Driver>();
  for (const driver of await fetchOpenF1<OpenF1Driver[]>(`/drivers?meeting_key=${sessions[0].meeting_key}`)) {
    drivers.set(driver.driver_number, { ...drivers.get(driver.driver_number), ...driver });
  }

  const results: F1SessionResult[] = [];
  for (const session of sessions) {
    const rows = await fetchOpenF1<OpenF1Result[]>(`/session_result?session_key=${session.session_key}`);
    // A finished session with nothing in yet is skipped, not shown empty.
    if (rows.length === 0) continue;
    const kind = SESSION_KINDS[session.session_name];
    results.push({ kind, rows: sessionRows(kind, rows, drivers) });
  }
  return { season, round, sessions: results };
}

async function fetchSettledWeekend(
  season: number,
  round: number,
  from: string,
  to: string
): Promise<F1WeekendResults> {
  const weekend = await fetchWeekendResults(season, round, from, to);
  // Thrown, not returned: an empty answer would be kept for a day.
  if (weekend.sessions.length === 0) throw new Error(`OpenF1 has no sessions for ${season} round ${round}`);
  return weekend;
}

const noWeekend = (season: number, round: number): F1WeekendResults => ({ season, round, sessions: [] });

const recentWeekend = cachedFeed(
  "OpenF1 weekend",
  (season: number, round: number, from: string, to: string) =>
    fetchWeekendResults(season, round, from, to),
  noWeekend,
  ["openf1:weekend"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:f1"] }
);

const settledWeekend = cachedFeed(
  "OpenF1 weekend",
  fetchSettledWeekend,
  noWeekend,
  ["openf1:weekend-settled"],
  { revalidate: DAY_SECONDS, tags: ["sports:f1"] }
);

/**
 * One weekend's session results: five minutes at a time while it gains a
 * session every few hours, a day at a time once it has settled (two days
 * after its race) and no longer changes. Nothing on a failure, so the card
 * and the race page simply go without.
 */
export async function getF1WeekendResults(
  season: number,
  round: number,
  from: string,
  to: string,
  now: number = Date.now()
): Promise<F1WeekendResults> {
  return now - Date.parse(to) > SETTLING_MS
    ? settledWeekend(season, round, from, to)
    : recentWeekend(season, round, from, to);
}

/** Pure helpers, exported for their tests — nothing here touches the network. */
export const __testing = { clock, gapText, nameOf, sessionRows, fetchWeekendResults };
