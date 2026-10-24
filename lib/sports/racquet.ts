import type { RacquetTournament } from "@/types/sports";

/**
 * Which tournament each part of a racquet view is about.
 *
 * Shared by the feeds, which ship a draw only for the featured and the current
 * tournament, and by the view, which shows them: had the two picked
 * differently, the view would open on a draw that was never sent.
 *
 * Every list here runs in date order, the bigger draw first on a day.
 */

type Dated = Pick<RacquetTournament, "id" | "status" | "startDate" | "endDate">;

/** The one to show big: the tournament being played, else the next to start. */
export function featuredTournament<T extends Dated>(list: T[]): T | undefined {
  return list.find((t) => t.status === "live") ?? list.find((t) => t.status === "upcoming");
}

/** The one whose draw Overview opens on: being played, else just finished. */
export function currentTournament<T extends Dated>(list: T[]): T | undefined {
  return list.find((t) => t.status === "live") ?? justFinished(list, 1)[0];
}

/** The latest finals first; on the same day, the list's own order (bigger draw first). */
export function justFinished<T extends Dated>(list: T[], count: number): T[] {
  return list
    .filter((t) => t.status === "completed")
    .sort((a, b) => b.endDate.localeCompare(a.endDate))
    .slice(0, count);
}

/** What starts after the featured tournament, soonest first. */
export function comingUp<T extends Dated>(list: T[], count: number, featuredId?: string): T[] {
  return list.filter((t) => t.status === "upcoming" && t.id !== featuredId).slice(0, count);
}

/** The ids whose draws travel with the feed. */
export function drawsShipped<T extends Dated>(list: T[]): Set<string> {
  return new Set(
    [featuredTournament(list)?.id, currentTournament(list)?.id].filter(
      (id): id is string => Boolean(id)
    )
  );
}

/** A calendar day's state against today, for an event no feed has scored. */
export function statusByDates(
  startDate: string,
  endDate: string,
  today: string
): RacquetTournament["status"] {
  if (endDate < today) return "completed";
  if (startDate > today) return "upcoming";
  return "live";
}

/** How far ahead of its first day a draw is looked for: it is published a day or two before. */
export const DRAW_LEAD_DAYS = 3;

/**
 * Whether a draw can exist yet. Asking a provider for one any earlier spends a
 * request on an empty answer — and padel's requests are counted by the day.
 */
export function drawIsOut(
  status: RacquetTournament["status"],
  startDate: string,
  today: string
): boolean {
  return status !== "upcoming" || startDate <= addDays(today, DRAW_LEAD_DAYS);
}

/** `day` moved inside [start, end]: any day of an event finds it on a scoreboard. */
export function clampDay(day: string, start: string, end: string): string {
  if (day < start) return start;
  if (day > end) return end;
  return day;
}

/** `YYYY-MM-DD`, `days` after `day`. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
