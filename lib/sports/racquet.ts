import type {
  BracketRound,
  DrawVariant,
  RacquetCalendarEntry,
  RacquetData,
  RacquetDraw,
  RacquetSport,
  RacquetTournament,
  Team,
} from "@/types/sports";

import { roundInPlay } from "./bracket";

/**
 * Which tournament each part of a racquet view is about.
 *
 * Shared by the feeds, which ship a draw only for the featured and the current
 * tournament, by the view, which features the same tournament, and by the
 * tournament pages, which reuse a shipped draw: had they picked differently,
 * each would ask a provider for a draw the feed already had.
 *
 * Every list here runs in date order, the bigger draw first on a day.
 */

type Dated = Pick<RacquetTournament, "id" | "status" | "startDate" | "endDate">;

/** The one to show big: the tournament being played, else the next to start. */
export function featuredTournament<T extends Dated>(list: T[]): T | undefined {
  return list.find((t) => t.status === "live") ?? list.find((t) => t.status === "upcoming");
}

/**
 * The other draw the feed ships: being played, else just finished, so the
 * page of last week's final needs no provider call.
 */
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

/** A calendar line in the shape the cards and the page read: no place, no draw. */
function fromCalendar(entry: RacquetCalendarEntry): RacquetTournament {
  return { ...entry, location: "" };
}

/**
 * The feed's tournaments with the rest of the season's calendar behind them,
 * in date order. Tennis's feed covers only a fortnight either side of today;
 * read off it alone, "coming up" would stop two weeks out.
 */
export function seasonOf(data: RacquetData): RacquetTournament[] {
  const listed = new Set(data.tournaments.map((t) => t.id));
  const rest = (data.calendar ?? []).filter((e) => !listed.has(e.id)).map(fromCalendar);
  return [...data.tournaments, ...rest].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** A tournament of the tour by id, from the feed or, failing that, the calendar. */
export function findTournament(data: RacquetData, id: string): RacquetTournament | undefined {
  const listed = data.tournaments.find((t) => t.id === id);
  if (listed) return listed;
  const entry = data.calendar?.find((e) => e.id === id);
  return entry ? fromCalendar(entry) : undefined;
}

/** How a sport's ties are drawn: singles players, or padel's pairs. */
/**
 * The line under the sport's name, in the hub and on a tournament's page.
 * Premier Padel, not World Padel Tour: WPT was absorbed into Premier Padel in
 * 2024, and padelapi.org covers Premier Padel and FIP.
 */
export function tourLine(sport: RacquetSport, season: number): string {
  return `${sport === "padel" ? "Premier Padel" : "ATP"} · Season ${season}`;
}

export function drawVariant(sport: RacquetSport): DrawVariant {
  return sport === "padel" ? "pair" : "player";
}

function drawnIds(rounds: BracketRound[]): Set<string | null> {
  return new Set(rounds.flatMap((r) => r.matches.flatMap((m) => [m.homeTeamId, m.awayTeamId])));
}

/**
 * The draw a tournament came with from the feed, its players narrowed to the
 * ones in it: the tour's list spans every draw the feed carries.
 */
export function shippedDraw(t: RacquetTournament, players: Team[]): RacquetDraw | undefined {
  if (!t.bracket?.length) return undefined;
  const drawn = drawnIds(t.bracket);
  return {
    tournamentId: t.id,
    rounds: t.bracket,
    players: players.filter((p) => drawn.has(p.id)),
    champion: t.champion,
    runnerUp: t.runnerUp,
  };
}

/** The draw's three best seeds, among the players in its own rounds. */
export function topSeeds(draw: Pick<RacquetDraw, "rounds" | "players">): Team[] {
  const drawn = drawnIds(draw.rounds);
  return draw.players
    .filter((p) => drawn.has(p.id) && /^\d+$/.test(p.code.trim()))
    .sort((a, b) => Number(a.code) - Number(b.code))
    .slice(0, 3);
}

/** The city, unless the feed has none for it ("—"). */
export function cityOf(t: Pick<RacquetTournament, "location">): string | undefined {
  return t.location && t.location !== "—" ? t.location : undefined;
}

/**
 * "Sheikh Saad Al-Abdullah Complex, Kuwait City"; the venue alone where it
 * already names the city ("Allianz Cloud Milano"); else the city alone.
 */
export function placeOf(t: RacquetTournament): string | null {
  const city = cityOf(t);
  if (t.venue && city && !t.venue.includes(city)) return `${t.venue}, ${city}`;
  return t.venue ?? city ?? null;
}

/** "Starts today", "Starts tomorrow", "Starts in 5 days", by the reader's calendar day. */
export function startsInDays(startDate: string, today: string): string {
  const days = Math.round((Date.parse(startDate) - Date.parse(today)) / 86_400_000);
  if (days <= 0) return "Starts today";
  if (days === 1) return "Starts tomorrow";
  return `Starts in ${days} days`;
}

/** Where play stands: the round under way, when it starts, or nothing to say. */
export function playLine(t: RacquetTournament, rounds: BracketRound[] | undefined, today: string): string | null {
  if (t.status === "upcoming") return startsInDays(t.startDate, today);
  const round = t.status === "live" && rounds ? roundInPlay(rounds) : undefined;
  return round ? `${round.label} under way` : null;
}
