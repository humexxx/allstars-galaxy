import { calendarDayInTimeZone } from "@/lib/utils/date";
import type { Match } from "@/types/sports";

export type MatchDay = { day: string; matches: Match[] };

/** The calendar day a kickoff falls on in `timeZone`, as YYYY-MM-DD. */
export function matchDay(kickoff: string, timeZone: string): string {
  return calendarDayInTimeZone(new Date(kickoff), timeZone).toISOString().slice(0, 10);
}

/**
 * Matches by the reader's calendar day, oldest day first and each day in
 * kickoff order, optionally only one team's. A late kickoff in UTC is the
 * evening before west of Greenwich, so the day is the reader's, not UTC's.
 */
export function matchDays(matches: Match[], timeZone: string, teamId?: string | null): MatchDay[] {
  const shown = teamId
    ? matches.filter((m) => m.homeTeamId === teamId || m.awayTeamId === teamId)
    : matches;
  const sorted = [...shown].sort(
    (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
  );
  const byDay = new Map<string, Match[]>();
  for (const match of sorted) {
    const day = matchDay(match.kickoff, timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), match]);
  }
  return [...byDay.entries()].map(([day, list]) => ({ day, matches: list }));
}
