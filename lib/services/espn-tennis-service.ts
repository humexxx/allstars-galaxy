import "server-only";

import { TENNIS_DATA } from "@/lib/data/sports/tennis";
import { espnImage } from "@/lib/sports/espn-images";
import { clampDay, drawIsOut, drawsShipped, statusByDates } from "@/lib/sports/racquet";
import type {
  BracketMatch,
  BracketRound,
  BracketRoundId,
  PlayerRanking,
  RacquetCalendarEntry,
  RacquetData,
  RacquetDraw,
  RacquetTournament,
  Team,
  TennisData,
} from "@/types/sports";
import { cachedFeed, upstreamSignal } from "./upstream";

const BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/tennis";
const CORE_URL = "https://sports.core.api.espn.com/v2/sports/tennis/leagues";
const REVALIDATE_SECONDS = 300;
/** The season's calendar is published once and barely moves. */
const CALENDAR_SECONDS = 86_400;
/** A finished draw never changes again. */
const FINISHED_DRAW_SECONDS = 86_400;
const RANKING_LIMIT = 20;
/** Two weeks either side: what just finished, what is on, what is next. */
const CALENDAR_DAYS = 14;

/** The men's tour only: the hub follows no women's tour. */
type EspnTour = "atp";

const SLUGS: Record<EspnTour, string> = { atp: "mens-singles" };

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
  /** A set; `tiebreak` is this player's points in it when it went to one. */
  linescores?: Array<{ value?: number; tiebreak?: number }>;
};

type EspnCompetition = {
  id: string;
  date?: string;
  status?: {
    type?: {
      /** STATUS_FINAL, STATUS_WALKOVER, STATUS_RETIRED, STATUS_CANCELED… */
      name?: string;
      state?: "pre" | "in" | "post";
      completed?: boolean;
    };
  };
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
  /** A Grand Slam — the only tier ESPN flags. */
  major?: boolean;
  venue?: { displayName?: string; fullName?: string; address?: { city?: string } };
  /** Last edition's champions, one per draw. */
  previousWinners?: Array<{
    displayName?: string;
    shortDisplayName?: string;
    type?: { slug?: string };
  }>;
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

type EspnCalendar = {
  sections?: Array<{
    label?: string;
    startDate?: string;
    endDate?: string;
    /** `…/leagues/atp/events/315-2026?lang=en` — the scoreboard's event id. */
    event?: { $ref?: string };
  }>;
};

/** A calendar line before the feed has said how it stands. */
type CalendarSeed = Pick<RacquetCalendarEntry, "id" | "name" | "startDate" | "endDate">;

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
  const legs = Array.from({ length: sets }, (_, i) => {
    const homeTiebreak = home?.linescores?.[i]?.tiebreak;
    const awayTiebreak = away?.linescores?.[i]?.tiebreak;
    return {
      homeScore: home?.linescores?.[i]?.value ?? null,
      awayScore: away?.linescores?.[i]?.value ?? null,
      ...(homeTiebreak !== undefined && { homeTiebreak }),
      ...(awayTiebreak !== undefined && { awayTiebreak }),
    };
  });
  const status = c.status?.type?.name;

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
      ...(status === "STATUS_WALKOVER" && { outcome: "walkover" as const }),
      ...(status === "STATUS_RETIRED" && { outcome: "retired" as const }),
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

/**
 * The calendar day an ESPN boundary names.
 *
 * ESPN dates an event by its local midnights in a US zone — Shanghai runs
 * `2026-10-05T04:00Z` to `2026-10-19T03:59Z` on the scoreboard and
 * `T07:00Z` to `T06:59Z` on the calendar — so the end's UTC date is a day
 * late ("Oct 5 – 19" for a final on the 18th). Twelve hours into the event
 * from either edge is the right day for any zone in the Americas.
 */
function espnDay(instant: string | undefined, edge: "start" | "end"): string {
  const time = Date.parse(instant ?? "");
  if (Number.isNaN(time)) return (instant ?? "").slice(0, 10);
  const shifted = time + (edge === "start" ? 12 : -12) * 3_600_000;
  return new Date(shifted).toISOString().slice(0, 10);
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
 * A slot ESPN cancelled: "post" but never completed, TBD against TBD. Basel
 * carried three of them beside its real quarter-finals, which added empty
 * ties to the draw and read the tournament as under way a week early.
 * Walkovers and retirements are completed, so they stay.
 */
function isCancelled(c: EspnCompetition): boolean {
  return c.status?.type?.state === "post" && c.status.type.completed === false;
}

/**
 * One tournament of a tour, with its main draw when there is one to show.
 *
 * Returns null for an event the tour has no singles draw in — ESPN lists the
 * same city twice when it hosts two events in one week.
 */
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

  const place = event.venue?.displayName;
  const defending = event.previousWinners?.find((w) => w.type?.slug === slug);
  return {
    tournament: {
      id: `espn-${event.id}-${slug}`,
      name: event.name ?? "Tournament",
      location: locationOf(event),
      startDate: espnDay(event.date, "start"),
      endDate: espnDay(event.endDate ?? event.date, "end"),
      status: statusOf(event, competitions, now),
      ...finalistsOf(competitions),
      bracket: rounds.length > 0 ? rounds : undefined,
      tier: event.major ? "Grand Slam" : undefined,
      // The full place, where it says more than the city: "Shanghai, China PR".
      venue: place?.includes(",") ? place : undefined,
      defendingChampion: defending?.shortDisplayName ?? defending?.displayName,
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

/** A draw's players with the photos the rankings have for them. */
function withPhotos(players: Team[], photos: Map<string, string>): Team[] {
  // The draw card reads `logoUrl` as the player's photo.
  return players.map((p) => {
    const photo = photos.get(p.id);
    return photo ? { ...p, logoUrl: photo } : p;
  });
}

/**
 * The season's calendar, joined to what the scoreboard has scored.
 *
 * A line the scoreboard covers takes its state and champion from the matches;
 * any other is placed by its dates. The join falls back to the name and the
 * first day, since ESPN lists one week's event twice in a city hosting two
 * (Lyon as 110-2026 and 452-2026) and only one of the ids has a draw.
 */
function calendarWith(
  seeds: CalendarSeed[],
  tournaments: RacquetTournament[],
  today: string
): RacquetCalendarEntry[] {
  const byId = new Map(tournaments.map((t) => [t.id, t]));
  const byName = new Map(tournaments.map((t) => [`${t.name}|${t.startDate}`, t]));
  return seeds.map((seed) => {
    const scored = byId.get(seed.id) ?? byName.get(`${seed.name}|${seed.startDate}`);
    return scored
      ? { ...seed, id: scored.id, status: scored.status, champion: scored.champion }
      : { ...seed, status: statusByDates(seed.startDate, seed.endDate, today) };
  });
}

/**
 * A tour's fortnight of tournaments, their draws and the rankings.
 *
 * Tournaments run in date order; on the same day the bigger draw goes first,
 * so the dashboard's "first live event" is the Masters rather than the 250
 * that happens to share its week. Only the featured and the current
 * tournament keep their draws — the rest load when opened — so the page does
 * not carry a fortnight of brackets nobody asked for.
 */
function tourFrom(
  tour: EspnTour,
  board: EspnScoreboard,
  rankings: EspnRankings,
  now = Date.now()
): RacquetData {
  const slug = SLUGS[tour];
  const photos = photosById(rankings);
  const entries: Array<{ tournament: RacquetTournament; players: Team[]; size: number }> = [];
  for (const event of board.events ?? []) {
    const mapped = tournamentFrom(event, slug, now);
    if (!mapped) continue;
    const size = mapped.tournament.bracket?.reduce((n, r) => n + r.matches.length, 0) ?? 0;
    entries.push({ ...mapped, size });
  }
  entries.sort(
    (a, b) =>
      a.tournament.startDate.localeCompare(b.tournament.startDate) || b.size - a.size
  );

  const shipped = drawsShipped(entries.map((e) => e.tournament));
  const players = new Map<string, Team>();
  const tournaments = entries.map(({ tournament, players: drawn }) => {
    if (!shipped.has(tournament.id)) return { ...tournament, bracket: undefined };
    for (const p of withPhotos(drawn, photos)) players.set(p.id, p);
    return tournament;
  });

  return {
    tour,
    season: board.leagues?.[0]?.season?.year ?? new Date(now).getFullYear(),
    rankings: (rankings.rankings?.[0]?.ranks ?? [])
      .map(rankingFrom)
      .filter((r): r is PlayerRanking => r !== null)
      .slice(0, RANKING_LIMIT),
    tournaments,
    drawPlayers: [...players.values()],
  };
}

/** A tour with its season's calendar joined in. */
function withCalendar(data: RacquetData, seeds: CalendarSeed[], today: string): RacquetData {
  return { ...data, calendar: calendarWith(seeds, data.tournaments, today) };
}

/**
 * The season's lines from ESPN's calendar: one per event, by the id the
 * scoreboard uses, deduplicated by name and first day.
 */
function calendarFrom(calendar: EspnCalendar, slug: string): CalendarSeed[] {
  const seen = new Set<string>();
  const seeds: CalendarSeed[] = [];
  for (const section of calendar.sections ?? []) {
    const eventId = section.event?.$ref?.match(/\/events\/([^/?]+)/)?.[1];
    if (!eventId || !section.label || !section.startDate) continue;
    const startDate = espnDay(section.startDate, "start");
    const key = `${section.label}|${startDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    seeds.push({
      id: `espn-${eventId}-${slug}`,
      name: section.label,
      startDate,
      endDate: espnDay(section.endDate ?? section.startDate, "end"),
    });
  }
  return seeds.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/**
 * The one event a draw is read from, holding only the one draw.
 *
 * A scoreboard day returns every event spanning it with every grouping —
 * the US Open's final day is 1.76 MB, near the 2 MB Next's cache refuses —
 * and only this event's singles are ever drawn.
 */
function eventFrom(board: EspnScoreboard, eventId: string, slug: string): EspnEvent | null {
  const event = board.events?.find((e) => e.id === eventId);
  if (!event) return null;
  return { ...event, groupings: (event.groupings ?? []).filter((g) => g.grouping?.slug === slug) };
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

async function fetchEspn<T>(url: string, cache?: RequestCache): Promise<T> {
  const res = await fetch(url.startsWith("http") ? url : `${BASE_URL}${url}`, {
    signal: upstreamSignal(),
    ...(cache && { cache }),
  });
  if (!res.ok) throw new Error(`espn tennis ${res.status} on ${url}`);
  return (await res.json()) as T;
}

/**
 * A tour's season calendar, the previous season's while the new one is still
 * empty — in January `?dates=2027` had no sections. One call a day per tour.
 */
async function fetchCalendarFromApi(tour: EspnTour, year: number): Promise<CalendarSeed[]> {
  for (const season of [year, year - 1]) {
    const calendar = await fetchEspn<EspnCalendar>(
      `${CORE_URL}/${tour}/calendar/whitelist?dates=${season}`
    );
    const seeds = calendarFrom(calendar, SLUGS[tour]);
    if (seeds.length > 0) return seeds;
  }
  return [];
}

const getTennisCalendar = cachedFeed<[EspnTour, number], CalendarSeed[]>(
  "espn tennis calendar",
  fetchCalendarFromApi,
  () => [],
  ["espn:tennis-calendar"],
  { revalidate: CALENDAR_SECONDS, tags: ["sports:tennis"] }
);

/**
 * The ATP from ESPN's public API — the same endpoints espn.com reads, no key.
 *
 * It replaced TheSportsDB, whose free key "3" was switched off: every call
 * answered 403, so the calendar fell back to the fixture and October showed
 * Roland Garros as live. ESPN also publishes the rankings, which were a
 * fixture all along. Two calls: one scoreboard over a date range and the
 * rankings table. The season's calendar is joined in by
 * `getTennisData`, from a cache of its own.
 */
async function fetchTennisFromApi(): Promise<TennisData> {
  const now = new Date();
  const range = calendarRange(now);
  const [board, rankings] = await Promise.all([
    fetchEspn<EspnScoreboard>(`/atp/scoreboard?dates=${range}`),
    fetchEspn<EspnRankings>(`/atp/rankings`),
  ]);
  const atp = tourFrom("atp", board, rankings, now.getTime());
  if (atp.rankings.length === 0) throw new Error("espn tennis returned no rankings");
  return { atp };
}

const getTennisFeed = cachedFeed(
  "espn tennis",
  fetchTennisFromApi,
  () => TENNIS_DATA,
  ["espn:tennis-data"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:tennis"] }
);

/**
 * The ATP, with its season's calendar.
 *
 * The calendars are read out here, never inside the feed's cached function:
 * Next skips the read of an `unstable_cache` nested in another, so the
 * day-long calendar cache would never have served — one more call on every
 * five-minute refresh, two in January — and a calendar that failed once
 * would have been stored with the feed, empty, for five minutes.
 */
export async function getTennisData(): Promise<TennisData> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const [feed, seeds] = await Promise.all([getTennisFeed(), getTennisCalendar("atp", year)]);
  if (feed === TENNIS_DATA) return feed;
  return { atp: withCalendar(feed.atp, seeds, now.toISOString().slice(0, 10)) };
}

/**
 * One event's draw, read off the scoreboard for one of its days.
 *
 * Any day of an event returns its whole draw (the `event=` parameter is
 * ignored), so the day is the final for a finished one. The raw day skips
 * Next's fetch cache — a Grand Slam's runs to 1.76 MB — and only the mapped
 * draw of the one event is cached.
 */
async function fetchTennisDraw(tour: EspnTour, eventId: string, day: string): Promise<RacquetDraw> {
  const slug = SLUGS[tour];
  const [board, rankings] = await Promise.all([
    fetchEspn<EspnScoreboard>(`/${tour}/scoreboard?dates=${day.replaceAll("-", "")}`, "no-store"),
    fetchEspn<EspnRankings>(`/${tour}/rankings`),
  ]);
  const event = eventFrom(board, eventId, slug);
  if (!event) throw new Error(`espn tennis: event ${eventId} is not on ${day}`);
  const tournamentId = `espn-${eventId}-${slug}`;
  const mapped = tournamentFrom(event, slug);
  if (!mapped) return { tournamentId, rounds: [], players: [] };
  return {
    tournamentId,
    rounds: mapped.tournament.bracket ?? [],
    players: withPhotos(mapped.players, photosById(rankings)),
    champion: mapped.tournament.champion,
    runnerUp: mapped.tournament.runnerUp,
  };
}

const getLiveDraw = cachedFeed<[EspnTour, string, string], RacquetDraw | null>(
  "espn tennis draw",
  fetchTennisDraw,
  () => null,
  ["espn:tennis-draw:live"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:tennis"] }
);

const getFinishedDraw = cachedFeed<[EspnTour, string, string], RacquetDraw | null>(
  "espn tennis draw",
  fetchTennisDraw,
  () => null,
  ["espn:tennis-draw:finished"],
  { revalidate: FINISHED_DRAW_SECONDS, tags: ["sports:tennis"] }
);

/**
 * One tournament's draw for the details sheet, by the id the view knows it by.
 *
 * Only an event on the tour's calendar is read — the id arrives from the
 * browser — and the feed's own draw is reused when it shipped one. Null when
 * the event is unknown or ESPN did not answer.
 */
export async function getTennisDraw(tournamentId: string): Promise<RacquetDraw | null> {
  const parsed = /^espn-(\d+-\d{4})-mens-singles$/.exec(tournamentId);
  if (!parsed) return null;
  const section = (await getTennisData()).atp;
  const scored = section.tournaments.find((t) => t.id === tournamentId);
  if (scored?.bracket?.length) {
    const used = new Set(
      scored.bracket.flatMap((r) => r.matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]))
    );
    return {
      tournamentId,
      rounds: scored.bracket,
      players: (section.drawPlayers ?? []).filter((p) => used.has(p.id)),
      champion: scored.champion,
      runnerUp: scored.runnerUp,
    };
  }
  const known = scored ?? section.calendar?.find((t) => t.id === tournamentId);
  if (!known) return null;

  const empty: RacquetDraw = { tournamentId, rounds: [], players: [] };
  const today = new Date().toISOString().slice(0, 10);
  if (!drawIsOut(known.status, known.startDate, today)) return empty;
  const day = clampDay(today, known.startDate, known.endDate);
  const load = known.status === "completed" ? getFinishedDraw : getLiveDraw;
  const draw = await load("atp", parsed[1], day);
  // An event days away may not be on the scoreboard yet: nothing drawn, not a failure.
  return draw ?? (known.status === "upcoming" ? empty : null);
}

/** Pure mappers, exported for their tests — nothing here touches the network. */
export const __testing = {
  tournamentFrom,
  matchFrom,
  playerFrom,
  rankingFrom,
  photosById,
  tourFrom,
  calendarRange,
  calendarFrom,
  calendarWith,
  withCalendar,
  eventFrom,
  espnDay,
  fetchCalendarFromApi,
  fetchTennisDraw,
  ROUND_IDS,
};
