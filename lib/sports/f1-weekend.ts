import type { F1Race, F1Session, F1SessionKind } from "@/types/sports";

/**
 * What an F1 weekend is doing at a given moment, and how the calendar splits
 * around it.
 *
 * Nothing here reads the clock: every rule takes `now`. The feed is cached for
 * five minutes, and a "Qualifying in 3h" worked out inside it would still say
 * so three hours later. The dashboard passes the request's time; the Races tab
 * passes the browser's, after mount, so the server's render never disagrees
 * with the one that hydrates it.
 */

export const SESSION_LABEL: Record<F1SessionKind, string> = {
  fp1: "Practice 1",
  fp2: "Practice 2",
  fp3: "Practice 3",
  "sprint-qualifying": "Sprint Qualifying",
  sprint: "Sprint",
  qualifying: "Qualifying",
  race: "Race",
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * How long a session holds the track. The race gets three hours, the window
 * the feed already calls it live for: red flags stretch a two-hour race.
 */
const SESSION_MINUTES: Record<F1SessionKind, number> = {
  fp1: 60,
  fp2: 60,
  fp3: 60,
  "sprint-qualifying": 45,
  sprint: 60,
  qualifying: 60,
  race: 180,
};

/** The weekend's sessions, or just the race when the feed had no timetable. */
export function raceSessions(race: F1Race): F1Session[] {
  if (race.sessions && race.sessions.length > 0) return race.sessions;
  return race.startsAt ? [{ kind: "race", startsAt: race.startsAt }] : [];
}

export type WeekendNow = {
  /** On track right now. */
  live?: F1Session;
  /** The first session still to start. */
  next?: F1Session;
};

export function weekendNow(race: F1Race, now: number): WeekendNow {
  const state: WeekendNow = {};
  for (const session of raceSessions(race)) {
    const start = Date.parse(session.startsAt);
    if (Number.isNaN(start)) continue;
    if (start > now) {
      state.next ??= session;
    } else if (now < start + SESSION_MINUTES[session.kind] * MINUTE) {
      state.live = session;
    }
  }
  return state;
}

/** "in 45m", "in 3h", "in 6d". */
export function startsIn(startsAt: string, now: number): string {
  const minutes = Math.max(1, Math.round((Date.parse(startsAt) - now) / MINUTE));
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}

/**
 * Between the first session's start and the end of the race: the stretch the
 * view calls a race weekend.
 */
export function isRaceWeekend(race: F1Race, now: number): boolean {
  const sessions = raceSessions(race);
  const first = sessions[0];
  const last = sessions.at(-1);
  if (!first || !last) return false;
  const end = Date.parse(last.startsAt) + SESSION_MINUTES[last.kind] * MINUTE;
  return Date.parse(first.startsAt) <= now && now < end;
}

export type WeekendPhrase = {
  text: string;
  /** `live` while a session runs, `soon` within two days, `later` beyond. */
  tone: "live" | "soon" | "later";
};

/** "Qualifying live", "Qualifying in 3h", "Practice 1 in 6d" — or nothing once it is over. */
export function weekendPhrase(race: F1Race, now: number): WeekendPhrase | null {
  const { live, next } = weekendNow(race, now);
  if (live) return { text: `${SESSION_LABEL[live.kind]} live`, tone: "live" };
  if (!next) return null;
  const soon = Date.parse(next.startsAt) - now < 48 * HOUR;
  return {
    text: `${SESSION_LABEL[next.kind]} ${startsIn(next.startsAt, now)}`,
    tone: soon ? "soon" : "later",
  };
}

/** The race to lead with: one on now, else the next, else the last one run. */
export function leadRace(races: F1Race[]): F1Race | undefined {
  return (
    races.find((r) => r.status === "live") ??
    races.find((r) => r.status === "upcoming") ??
    races.findLast((r) => r.status === "completed")
  );
}

const COMING_UP = 3;
const JUST_FINISHED = 3;

export type RacesTabGroups = {
  /** On now or next; none once the season is over. */
  featured?: F1Race;
  /** The races after it. */
  comingUp: F1Race[];
  /** The latest results, most recent first. */
  justFinished: F1Race[];
};

/** The Races tab's split of the calendar. Races arrive in round order. */
export function racesTabGroups(races: F1Race[]): RacesTabGroups {
  const featured = races.find((r) => r.status === "live") ?? races.find((r) => r.status === "upcoming");
  const comingUp = races
    .filter((r) => r.status === "upcoming" && r !== featured)
    .slice(0, COMING_UP);
  const justFinished = races
    .filter((r) => r.status === "completed")
    .slice(-JUST_FINISHED)
    .reverse();
  return { featured, comingUp, justFinished };
}
