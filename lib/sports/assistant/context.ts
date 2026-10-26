import "server-only";

import { DEFAULT_SPORT, SPORTS_BY_ID } from "@/lib/data/sports/registry";
import { FOOTBALL_COMPETITIONS } from "@/lib/services/football-service";
import { listUserSportsFavorites } from "@/lib/services/sports-service";
import { footballLeagueFrom } from "@/lib/sports/load";
import { SPORTS_PATH } from "@/lib/sports/paths";
import { isSportId } from "@/lib/sports/payload";
import { getRequestTodayIso } from "@/lib/utils/request-today";
import type { SportId } from "@/types/sports";

/** Today on the reader's calendar, the page they have open and their favourites. */
export async function sportsContextNote(userId: string, timeZone: string, path: string): Promise<string> {
  const [today, rows] = await Promise.all([getRequestTodayIso(), listUserSportsFavorites(userId)]);
  const favorites = rows.map((r) => r.sportId).filter((id): id is SportId => isSportId(id));
  const liked = favorites.length
    ? `Their favourite sports: ${favorites.map((id) => SPORTS_BY_ID.get(id)?.label ?? id).join(", ")}.`
    : "They have no favourite sports yet.";
  return `Today is ${today} (time zone ${timeZone}). ${describePage(path, favorites)} ${liked}`;
}

/** The page as the hub reads its address: no sport named is the first favourite's. */
export function describePage(path: string, favorites: SportId[]): string {
  const url = new URL(path, "http://app.local");
  const at = `The user has ${url.pathname}${url.search} open`;
  if (url.pathname === SPORTS_PATH) {
    const named = url.searchParams.get("sport") ?? undefined;
    const sport = isSportId(named) ? named : (favorites[0] ?? DEFAULT_SPORT);
    const league = url.searchParams.get("league") ?? undefined;
    const parts = [`sport ${sport}`];
    if (sport === "football") {
      const id = footballLeagueFrom(league);
      parts.push(`competition ${id} (${FOOTBALL_COMPETITIONS.find((c) => c.id === id)?.name})`);
    } else if (league) parts.push(`competition ${league}`);
    parts.push(`tab ${url.searchParams.get("tab") ?? "the page's default"}`);
    return `${at}: the sports hub, ${parts.join(", ")}.`;
  }
  const detail = url.pathname.slice(SPORTS_PATH.length + 1).split("/");
  if (url.pathname.startsWith(`${SPORTS_PATH}/`) && detail.length === 2) {
    const [sport, id] = detail;
    if (sport === "f1") return `${at}: the page of F1 round ${id}.`;
    if (sport === "padel" || sport === "tennis") {
      return `${at}: the page of the ${sport} tournament with id ${decodeURIComponent(id)}.`;
    }
  }
  return `${at}.`;
}
