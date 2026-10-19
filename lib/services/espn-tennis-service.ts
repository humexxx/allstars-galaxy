import "server-only";

import { TENNIS_DATA } from "@/lib/data/sports/tennis";
import { espnImage } from "@/lib/sports/espn-images";
import type {
  BracketMatch,
  BracketRound,
  BracketRoundId,
  PlayerRanking,
  RacquetData,
  RacquetTournament,
  Team,
  TennisData,
} from "@/types/sports";
import { cachedFeed, upstreamSignal } from "./upstream";

const BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/tennis";
const REVALIDATE_SECONDS = 300;
const RANKING_LIMIT = 20;
/** Two weeks either side: what just finished, what is on, what is next. */
const CALENDAR_DAYS = 14;

type EspnTour = "atp" | "wta";

type EspnAthlete = {
  id?: string;
  displayName?: string;
  shortName?: string;
  flag?: { alt?: string; href?: string };
};

type EspnCompetitor = {
  id?: string;
  winner?: boolean;
  athlete?: EspnAthlete;
  curatedRank?: { current?: number };
  linescores?: Array<{ value?: number }>;
};

type EspnCompetition = {
  id: string;
  date?: string;
  status?: { type?: { state?: "pre" | "in" | "post"; completed?: boolean } };
  round?: { displayName?: string };
  competitors?: EspnCompetitor[];
};

type EspnGrouping = {
  grouping?: { slug?: string; displayName?: string };
  competitions?: EspnCompetition[];
};

type EspnEvent = {
  id: string;
  name?: string;
  date?: string;
  endDate?: string;
  venue?: { displayName?: string; fullName?: string; address?: { city?: string } };
  groupings?: EspnGrouping[];
};

type EspnScoreboard = {
  events?: EspnEvent[];
  leagues?: Array<{ season?: { year?: number } }>;
};

type EspnRank = {
  current?: number;
  previous?: number;
  points?: number;
  athlete?: {
    /** The same id the scoreboard gives a draw's competitor. */
    id?: string;
    displayName?: string;
    shortname?: string;
    flagAltText?: string;
    citizenshipCountry?: string;
    /** Present only for a player ESPN has a photo of. */
    headshot?: string;
  };
};

type EspnRankings = { rankings?: Array<{ ranks?: EspnRank[] }> };

/**
 * ESPN's round names, mapped onto the ids the bracket already knows.
 *
 * Only the main draw: qualifying is not the tournament. Anything unmapped is
 * dropped.
 */
const ROUND_IDS: Record<string, BracketRoundId> = {
  "Round 1": "round-of-128",
  "Round 2": "round-of-64",
  "Round 3": "round-of-32",
  "Round 4": "round-of-16",
  Quarterfinal: "quarter-final",
  Semifinal: "semi-final",
  Final: "final",
};

const ROUND_LABELS: Record<string, string> = {
  "Round 1": "Round 1",
  "Round 2": "Round 2",
  "Round 3": "Round 3",
  "Round 4": "Round of 16",
  Quarterfinal: "Quarter-finals",
  Semifinal: "Semi-finals",
  Final: "Final",
};

/** ESPN gives a country name; the draw and the rankings want a flag. */
const FLAGS: Record<string, string> = {
  Argentina: "🇦🇷", Armenia: "🇦🇲", Australia: "🇦🇺", Austria: "🇦🇹",
  Belarus: "🇧🇾", Belgium: "🇧🇪", Bolivia: "🇧🇴",
  "Bosnia and Herzegovina": "🇧🇦", Brazil: "🇧🇷", Bulgaria: "🇧🇬",
  Canada: "🇨🇦", Chile: "🇨🇱", China: "🇨🇳", "China PR": "🇨🇳",
  "Chinese Taipei": "🇹🇼", Colombia: "🇨🇴", Croatia: "🇭🇷", Cyprus: "🇨🇾",
  Czechia: "🇨🇿", Denmark: "🇩🇰", Ecuador: "🇪🇨", Egypt: "🇪🇬",
  Estonia: "🇪🇪", Finland: "🇫🇮", France: "🇫🇷", Georgia: "🇬🇪",
  Germany: "🇩🇪", "Great Britain": "🇬🇧", Greece: "🇬🇷", "Hong Kong": "🇭🇰",
  Hungary: "🇭🇺", India: "🇮🇳", Indonesia: "🇮🇩", Israel: "🇮🇱",
  Italy: "🇮🇹", Japan: "🇯🇵", Kazakhstan: "🇰🇿", Latvia: "🇱🇻",
  Lithuania: "🇱🇹", Mexico: "🇲🇽", Moldova: "🇲🇩", Monaco: "🇲🇨",
  Netherlands: "🇳🇱", "New Zealand": "🇳🇿", Norway: "🇳🇴", Paraguay: "🇵🇾",
  Peru: "🇵🇪", Philippines: "🇵🇭", Poland: "🇵🇱", Portugal: "🇵🇹",
  Romania: "🇷🇴", Russia: "🇷🇺", Serbia: "🇷🇸", Slovakia: "🇸🇰",
  Slovenia: "🇸🇮", "South Africa": "🇿🇦", Spain: "🇪🇸", Sweden: "🇸🇪",
  Switzerland: "🇨🇭", Taiwan: "🇹🇼", Thailand: "🇹🇭", Tunisia: "🇹🇳",
  Turkey: "🇹🇷", Türkiye: "🇹🇷", Ukraine: "🇺🇦", USA: "🇺🇸",
  Uruguay: "🇺🇾", Uzbekistan: "🇺🇿", Venezuela: "🇻🇪",
};

function playerFrom(c: EspnCompetitor): Team | null {
  const athlete = c.athlete;
  const name = athlete?.shortName || athlete?.displayName;
  const id = athlete?.id ?? c.id;
  if (!name || !id) return null;
  const country = athlete?.flag?.alt ?? "";
  const seed = c.curatedRank?.current;
  return {
    id,
    // The draw card reads `name` as the flag and `code` as the seed — see
    // `playerEntry` in draw-match-card.tsx for the one place that is written
    // down.
    name: FLAGS[country] ?? "",
    shortName: name,
    code: seed ? String(seed) : "",
  };
}

function matchFrom(c: EspnCompetition): { match: BracketMatch; players: Team[] } | null {
  const [home, away] = c.competitors ?? [];
  const homePlayer = home ? playerFrom(home) : null;
  const awayPlayer = away ? playerFrom(away) : null;

  const sets = Math.max(
    home?.linescores?.length ?? 0,
    away?.linescores?.length ?? 0
  );
  const legs = Array.from({ length: sets }, (_, i) => ({
    homeScore: home?.linescores?.[i]?.value ?? null,
    awayScore: away?.linescores?.[i]?.value ?? null,
  }));

  const winnerId = home?.winner
    ? (homePlayer?.id ?? null)
    : away?.winner
      ? (awayPlayer?.id ?? null)
      : null;

  return {
    match: {
      id: c.id,
      homeTeamId: homePlayer?.id ?? null,
      awayTeamId: awayPlayer?.id ?? null,
      legs: legs.length > 0 ? legs : undefined,
      winnerTeamId: winnerId,
      date: c.date?.slice(0, 10),
    },
    players: [homePlayer, awayPlayer].filter((p): p is Team => p !== null),
  };
}

/**
 * Where the tournament is in its draw, read off the matches themselves.
 *
 * Not the event's own `status`: ESPN reported Ningbo as completed with 27 of
 * its 45 matches still to play. Qualifying counts — the tournament is on once
 * its week has started. Without per-match states, the dates decide.
 */
function statusOf(
  event: EspnEvent,
  competitions: EspnCompetition[],
  now: number
): RacquetTournament["status"] {
  const states = competitions
    .map((c) => c.status?.type?.state)
    .filter((s): s is "pre" | "in" | "post" => Boolean(s));
  if (states.length > 0) {
    if (states.every((s) => s === "post")) return "completed";
    return states.some((s) => s !== "pre") ? "live" : "upcoming";
  }
  const start = Date.parse(event.date ?? "");
  const end = Date.parse(event.endDate ?? "");
  if (!Number.isNaN(end) && end < now) return "completed";
  if (!Number.isNaN(start) && start > now) return "upcoming";
  return "live";
}

/** "Tokyo, Japan" → "Tokyo". */
function locationOf(event: EspnEvent): string {
  const place =
    event.venue?.displayName ?? event.venue?.address?.city ?? event.venue?.fullName;
  return place?.split(",")[0]?.trim() || "—";
}

/** Champion and runner-up, once the final has been played. */
function finalistsOf(
  competitions: EspnCompetition[]
): Pick<RacquetTournament, "champion" | "runnerUp"> {
  const final = competitions.find((c) => c.round?.displayName === "Final");
  if (final?.status?.type?.state !== "post") return {};
  const winner = final.competitors?.find((c) => c.winner);
  const loser = final.competitors?.find((c) => c !== winner);
  const name = (c?: EspnCompetitor) => c?.athlete?.shortName ?? c?.athlete?.displayName;
  return winner ? { champion: name(winner), runnerUp: name(loser) } : {};
}

export type EspnDraw = {
  tournament: RacquetTournament;
  players: Team[];
};

/**
 * One tournament of a tour, with its main draw when there is one to show.
 *
 * Returns null for an event the tour has no singles draw in — ESPN lists the
 * same city twice when it hosts two events in one week.
 */
/**
 * A slot ESPN cancelled: "post" but never completed, TBD against TBD. Basel
 * carried three of them beside its real quarter-finals, which added empty
 * ties to the draw and read the tournament as under way a week early.
 * Walkovers and retirements are completed, so they stay.
 */
function isCancelled(c: EspnCompetition): boolean {
  return c.status?.type?.state === "post" && c.status.type.completed === false;
}

function tournamentFrom(event: EspnEvent, slug: string, now = Date.now()): EspnDraw | null {
  const grouping = event.groupings?.find((g) => g.grouping?.slug === slug);
  const competitions = (grouping?.competitions ?? []).filter((c) => !isCancelled(c));
  if (competitions.length === 0) return null;

  const mainDraw = competitions.filter((c) => ROUND_IDS[c.round?.displayName ?? ""]);
  const byRound = new Map<string, EspnCompetition[]>();
  for (const c of mainDraw) {
    const name = c.round?.displayName ?? "";
    byRound.set(name, [...(byRound.get(name) ?? []), c]);
  }

  const players = new Map<string, Team>();
  const rounds: BracketRound[] = [];
  for (const name of Object.keys(ROUND_IDS)) {
    const comps = byRound.get(name);
    if (!comps) continue;
    const matches: BracketMatch[] = [];
    for (const c of comps) {
      const mapped = matchFrom(c);
      if (!mapped) continue;
      matches.push(mapped.match);
      for (const p of mapped.players) players.set(p.id, p);
    }
    if (matches.length > 0) {
      rounds.push({ id: ROUND_IDS[name], label: ROUND_LABELS[name] ?? name, matches });
    }
  }

  return {
    tournament: {
      id: `espn-${event.id}-${slug}`,
      name: event.name ?? "Tournament",
      location: locationOf(event),
      startDate: (event.date ?? "").slice(0, 10),
      endDate: (event.endDate ?? event.date ?? "").slice(0, 10),
      status: statusOf(event, competitions, now),
      ...finalistsOf(competitions),
      bracket: rounds.length > 0 ? rounds : undefined,
    },
    players: [...players.values()],
  };
}

/**
 * A player's photo, from the field ESPN sends with it — never built from the
 * id. The id-shaped path 404s for every player without one (close to half of
 * the top twenty), which would put a broken image where the flag used to be.
 */
function photoOf(rank: EspnRank): string | undefined {
  return espnImage(rank.athlete?.headshot);
}

function rankingFrom(rank: EspnRank): PlayerRanking | null {
  const athlete = rank.athlete;
  const name = athlete?.displayName;
  if (!name || !rank.current) return null;
  return {
    position: rank.current,
    name,
    shortName: athlete?.shortname ?? name,
    countryCode: athlete?.citizenshipCountry ?? "",
    flagEmoji: FLAGS[athlete?.flagAltText ?? ""] ?? "",
    points: rank.points ?? 0,
    movement: rank.previous ? rank.previous - rank.current : 0,
    photoUrl: photoOf(rank),
  };
}

/**
 * Photos for a draw's players, by athlete id.
 *
 * The scoreboard names its competitors but carries no photo, while the
 * rankings already fetched carry one for each of the top 150 ESPN has a
 * picture of — and key them by the same id. Anybody else keeps the flag.
 */
function photosById(rankings: EspnRankings): Map<string, string> {
  const photos = new Map<string, string>();
  for (const rank of rankings.rankings?.[0]?.ranks ?? []) {
    const photo = photoOf(rank);
    if (rank.athlete?.id && photo) photos.set(rank.athlete.id, photo);
  }
  return photos;
}

/**
 * A tour's calendar, draws and rankings.
 *
 * Tournaments run in date order; on the same day the bigger draw goes first,
 * so the dashboard's "first live event" is the Masters rather than the 250
 * that happens to share its week.
 */
function tourFrom(
  tour: EspnTour,
  board: EspnScoreboard,
  rankings: EspnRankings,
  now = Date.now()
): RacquetData {
  const slug = tour === "atp" ? "mens-singles" : "womens-singles";
  const photos = photosById(rankings);
  const players = new Map<string, Team>();
  const entries: Array<{ tournament: RacquetTournament; size: number }> = [];
  for (const event of board.events ?? []) {
    const mapped = tournamentFrom(event, slug, now);
    if (!mapped) continue;
    for (const p of mapped.players) {
      // The draw card reads `logoUrl` as the player's photo.
      const photo = photos.get(p.id);
      players.set(p.id, photo ? { ...p, logoUrl: photo } : p);
    }
    const size = mapped.tournament.bracket?.reduce((n, r) => n + r.matches.length, 0) ?? 0;
    entries.push({ tournament: mapped.tournament, size });
  }
  entries.sort(
    (a, b) =>
      a.tournament.startDate.localeCompare(b.tournament.startDate) || b.size - a.size
  );

  return {
    tour,
    season: board.leagues?.[0]?.season?.year ?? new Date(now).getFullYear(),
    rankings: (rankings.rankings?.[0]?.ranks ?? [])
      .map(rankingFrom)
      .filter((r): r is PlayerRanking => r !== null)
      .slice(0, RANKING_LIMIT),
    tournaments: entries.map((e) => e.tournament),
    drawPlayers: [...players.values()],
  };
}

function yyyymmdd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function calendarRange(now: Date): string {
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - CALENDAR_DAYS);
  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + CALENDAR_DAYS);
  return `${yyyymmdd(from)}-${yyyymmdd(to)}`;
}

async function fetchEspn<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { signal: upstreamSignal() });
  if (!res.ok) throw new Error(`espn tennis ${res.status} on ${path}`);
  return (await res.json()) as T;
}

/**
 * Both tours from ESPN's public API — the same endpoints espn.com reads, no key.
 *
 * It replaced TheSportsDB, whose free key "3" was switched off: every call
 * answered 403, so the calendar fell back to the fixture and October showed
 * Roland Garros as live. ESPN also publishes the rankings, which were a
 * fixture all along. Four calls: one scoreboard over a date range and one
 * rankings table per tour.
 */
async function fetchTennisFromApi(): Promise<TennisData> {
  const now = new Date();
  const range = calendarRange(now);
  const [atpBoard, atpRankings, wtaBoard, wtaRankings] = await Promise.all([
    fetchEspn<EspnScoreboard>(`/atp/scoreboard?dates=${range}`),
    fetchEspn<EspnRankings>(`/atp/rankings`),
    fetchEspn<EspnScoreboard>(`/wta/scoreboard?dates=${range}`),
    fetchEspn<EspnRankings>(`/wta/rankings`),
  ]);
  const atp = tourFrom("atp", atpBoard, atpRankings, now.getTime());
  const wta = tourFrom("wta", wtaBoard, wtaRankings, now.getTime());
  if (atp.rankings.length === 0 && wta.rankings.length === 0) {
    throw new Error("espn tennis returned no rankings");
  }
  return { atp, wta };
}

export const getTennisData = cachedFeed(
  "espn tennis",
  fetchTennisFromApi,
  () => TENNIS_DATA,
  ["espn:tennis-data"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:tennis"] }
);

/** Pure mappers, exported for their tests — nothing here touches the network. */
export const __testing = {
  tournamentFrom,
  matchFrom,
  playerFrom,
  rankingFrom,
  photosById,
  tourFrom,
  calendarRange,
  ROUND_IDS,
};
