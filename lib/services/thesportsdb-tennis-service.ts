import "server-only";

import { unstable_cache } from "next/cache";

import { TENNIS_DATA } from "@/lib/data/sports/tennis";
import type {
  RacquetData,
  RacquetTour,
  RacquetTournament,
  TennisData,
} from "@/types/sports";

const BASE_URL = "https://www.thesportsdb.com/api/v1/json/3";
const REVALIDATE_SECONDS = 1800;
const ATP_LEAGUE_ID = "4464";
const WTA_LEAGUE_ID = "4517";

type TsdEvent = {
  idEvent: string;
  strEvent: string;
  dateEvent: string;
  strVenue?: string | null;
  strHomeTeam?: string | null;
  strAwayTeam?: string | null;
};

type TsdEventsResponse = { events: TsdEvent[] | null };

/**
 * TheSportsDB tennis events are named "<Tournament> <PlayerA first> <PlayerA
 * last> vs <PlayerB first> <PlayerB last>" — e.g. "Roland Garros Flavio Cobolli
 * vs Matteo Arnaldi". Strip the trailing "<vs> <2 words>" and the last 2 words
 * of what's left (PlayerA) to recover the tournament prefix. Fragile on
 * single-name players, but they're rare on ATP/WTA tours.
 */
function extractTournamentName(strEvent: string): string {
  const vsIdx = strEvent.lastIndexOf(" vs ");
  if (vsIdx < 0) return strEvent.trim();
  const beforeVs = strEvent.slice(0, vsIdx).trim();
  const tokens = beforeVs.split(/\s+/);
  if (tokens.length <= 2) return beforeVs;
  return tokens.slice(0, -2).join(" ");
}

async function fetchTsd<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new Error(`thesportsdb ${res.status} on ${path}`);
  return (await res.json()) as T;
}

function buildTour(
  tour: RacquetTour,
  fallback: RacquetData,
  next: TsdEvent[] | null,
  past: TsdEvent[] | null,
): RacquetData {
  const nextEvents = next ?? [];
  const pastEvents = past ?? [];
  if (nextEvents.length === 0 && pastEvents.length === 0) return fallback;

  const grouped = new Map<
    string,
    { dates: string[]; venue?: string; hasUpcoming: boolean; hasPast: boolean }
  >();

  const ingest = (events: TsdEvent[], kind: "past" | "upcoming") => {
    for (const e of events) {
      const name = extractTournamentName(e.strEvent);
      if (!name) continue;
      const bucket =
        grouped.get(name) ??
        { dates: [], venue: e.strVenue ?? undefined, hasUpcoming: false, hasPast: false };
      if (e.dateEvent) bucket.dates.push(e.dateEvent);
      if (kind === "upcoming") bucket.hasUpcoming = true;
      else bucket.hasPast = true;
      if (!bucket.venue && e.strVenue) bucket.venue = e.strVenue;
      grouped.set(name, bucket);
    }
  };

  ingest(pastEvents, "past");
  ingest(nextEvents, "upcoming");

  const tournaments: RacquetTournament[] = [];
  for (const [name, info] of grouped) {
    const sortedDates = info.dates
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const status: RacquetTournament["status"] =
      info.hasUpcoming && info.hasPast
        ? "live"
        : info.hasUpcoming
          ? "upcoming"
          : "completed";
    tournaments.push({
      id: `tsd-${tour}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      location: info.venue ?? "—",
      startDate: sortedDates[0] ?? new Date().toISOString().slice(0, 10),
      endDate:
        sortedDates[sortedDates.length - 1] ??
        new Date().toISOString().slice(0, 10),
      status,
    });
  }

  return {
    tour,
    season: new Date().getFullYear(),
    rankings: fallback.rankings,
    tournaments,
  };
}

async function fetchTennisFromApi(): Promise<TennisData> {
  const safeFetch = (path: string) =>
    fetchTsd<TsdEventsResponse>(path).catch((err) => {
      console.warn(`thesportsdb fetch failed on ${path}:`, err);
      return { events: null } as TsdEventsResponse;
    });

  const [atpNext, atpPast, wtaNext, wtaPast] = await Promise.all([
    safeFetch(`/eventsnextleague.php?id=${ATP_LEAGUE_ID}`),
    safeFetch(`/eventspastleague.php?id=${ATP_LEAGUE_ID}`),
    safeFetch(`/eventsnextleague.php?id=${WTA_LEAGUE_ID}`),
    safeFetch(`/eventspastleague.php?id=${WTA_LEAGUE_ID}`),
  ]);

  return {
    atp: buildTour("atp", TENNIS_DATA.atp, atpNext.events, atpPast.events),
    wta: buildTour("wta", TENNIS_DATA.wta, wtaNext.events, wtaPast.events),
  };
}

export const getTennisData = unstable_cache(
  async (): Promise<TennisData> => {
    try {
      return await fetchTennisFromApi();
    } catch (err) {
      console.warn(
        "thesportsdb tennis unavailable, falling back to TENNIS_DATA mock:",
        err,
      );
      return TENNIS_DATA;
    }
  },
  ["thesportsdb:tennis-data"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:tennis"] },
);
