import "server-only";

import { PADEL_DATA } from "@/lib/data/sports/padel";
import {
  addDays,
  currentTournament,
  drawIsOut,
  drawsShipped,
  featuredTournament,
  justFinished,
} from "@/lib/sports/racquet";
import type {
  BracketMatch,
  BracketRound,
  BracketRoundId,
  PadelData,
  PlayerRanking,
  RacquetCalendarEntry,
  RacquetData,
  RacquetDraw,
  RacquetTour,
  RacquetTournament,
  Team,
} from "@/types/sports";
import { cachedFeed, upstreamSignal } from "./upstream";

const BASE_URL = "https://padelapi.org/api";
const PHOTO_BASE_URL = "https://media.padelapi.org/player-api";
const REVALIDATE_SECONDS = 300;
/** A finished draw never changes again; a day keeps it well inside 2,000 requests a day. */
const FINISHED_DRAW_SECONDS = 86_400;
const RANKING_LIMIT = 15;
/** Premier Padel's own tiers; FIP events run alongside every week and drowned them. */
const PREMIER_LEVELS = "major,p1,p2,finals";
/** Far enough back to show the last few results next to what is coming. */
const CALENDAR_LOOKBACK_DAYS = 45;
/** The API's largest page: a whole season of Premier Padel is about 25 events. */
const PAGE_SIZE = 50;
/** Just-finished draws read for their finals' runners-up. */
const JUST_FINISHED = 3;
/** The draw starts at the round of 16: the byes are all in the rounds before it. */
const FIRST_BRACKET_ROUND = 8;
/** What the free plan sends in place of a result older than about six months. */
const HIDDEN = "hidden_free_plan";

type PadelCategory = "men" | "women";

type PadelApiPlayer = {
  id: number;
  name: string;
  category?: PadelCategory;
  nationality?: string;
  ranking: number;
  ranking_diff: number;
  points: number;
};

type PadelApiTournament = {
  id: number;
  name: string;
  location?: string;
  country?: string;
  level?: string;
  /** `pending | live | finished` today; the first two names are the old ones. */
  status?: "pending" | "live" | "finished" | "in_progress" | "completed";
  start_date: string;
  end_date: string;
  winners?: Partial<Record<PadelCategory, Array<{ name: string }>>> | null;
  venue?: { name?: string | null } | null;
  photo_url?: string | null;
  prize?: { amount?: number | null; currency?: string | null } | null;
};

type PadelApiMatchPlayer = {
  id: number;
  name: string;
  /** `/api/pairs/66-65`, in the match's order — so never a pair's key (see `pairOf`). */
  connections?: { pair?: string };
};

type PadelApiMatch = {
  id: number;
  category?: PadelCategory;
  draw?: string;
  /** How many matches the round has: 1 is the final, 8 the round of 16. */
  round: number;
  /** The slot within the round; (round, index) feeds (round / 2, index / 2). */
  index: number;
  seeds?: { team_1?: string | null; team_2?: string | null } | null;
  played_at?: string | null;
  scheduled_at?: string | null;
  status?: string;
  /** Per set, "6" or "6(3)" — or `hidden_free_plan` on an old draw. */
  score?: Array<{ team_1?: string | null; team_2?: string | null }> | string | null;
  winner?: "team_1" | "team_2" | string | null;
  players?: {
    team_1?: PadelApiMatchPlayer[] | null;
    team_2?: PadelApiMatchPlayer[] | null;
  } | null;
};

type PadelApiList<T> = { data: T[] };

/** Both categories' draws: the provider sends them in one list. */
export type PadelDraws = Record<PadelCategory, RacquetDraw>;

function flagFromIso2(code: string | undefined): string {
  if (!code || code.length !== 2) return "🏁";
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "🏁";
  return String.fromCodePoint(
    ...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/** Words that belong to the surname after them: "Martin Di Nenno". */
const SURNAME_PARTICLES = new Set(["de", "del", "di", "da", "dos", "la", "van", "von"]);

/**
 * "Tapia" from "Agustin Tapia", and "Triay" from "Gemma Triay Pons".
 *
 * The provider sends Spanish players with both surnames, and they go by the
 * first: taking the last word named every woman in the top fifteen after her
 * mother's family — Gemma Triay was "G. Pons".
 */
function surnameOf(name: string): string {
  const tokens = name.trim().split(/\s+/);
  if (tokens.length === 1) return tokens[0];
  const surname = [tokens[1]];
  for (let i = 1; SURNAME_PARTICLES.has(tokens[i].toLowerCase()) && tokens[i + 1]; i++) {
    surname.push(tokens[i + 1]);
  }
  return surname.join(" ");
}

/** "A. Tapia" from "Agustin Tapia", and "G. Triay" from "Gemma Triay Pons". */
function shortNameFor(name: string): string {
  const tokens = name.trim().split(/\s+/);
  if (tokens.length === 1) return tokens[0];
  return `${tokens[0][0]?.toUpperCase() ?? ""}. ${surnameOf(name)}`;
}

/**
 * The provider renamed its states to `live` / `finished`; read as the old
 * `in_progress` / `completed`, every tournament came out "upcoming" and the
 * dashboard billed last week's final as next.
 */
function mapStatus(s: PadelApiTournament["status"]): RacquetTournament["status"] {
  if (s === "live" || s === "in_progress") return "live";
  if (s === "finished" || s === "completed") return "completed";
  return "upcoming";
}

const TIERS: Record<string, string> = { major: "Major", p1: "P1", p2: "P2", finals: "Finals" };

/**
 * A player's photo on the provider's media host, spelled from the name.
 *
 * The rankings carry no photo; the player record does, as `photo_url`, and it
 * is named after the player: "Agustin Tapia" is `agustin-tapia.webp`. Reading
 * fifteen records per category on every refresh would spend thirty of the
 * month's requests on an address the name already in hand spells. Both top
 * fifteens answered in full when this was checked (October 2026); a photo
 * that ever 404s falls back to the flag in the view.
 */
function photoFor(name: string): string | undefined {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `${PHOTO_BASE_URL}/${slug}.webp` : undefined;
}

function mapRanking(player: PadelApiPlayer): PlayerRanking {
  return {
    position: player.ranking,
    name: player.name,
    shortName: shortNameFor(player.name),
    countryCode: player.nationality ?? "",
    flagEmoji: flagFromIso2(player.nationality),
    points: player.points,
    movement: -(player.ranking_diff ?? 0),
    photoUrl: photoFor(player.name),
  };
}

/** The pair that won this category, as "A. Coello / A. Tapia". */
function championOf(t: PadelApiTournament, category: PadelCategory): string | undefined {
  const pair = t.winners?.[category];
  if (!pair?.length) return undefined;
  return pair.map((p) => shortNameFor(p.name)).join(" / ");
}

function mapTournament(t: PadelApiTournament, category: PadelCategory): RacquetTournament {
  return {
    id: `padelapi-${t.id}`,
    name: t.name,
    location: t.location ?? t.country ?? "—",
    startDate: t.start_date,
    endDate: t.end_date,
    status: mapStatus(t.status),
    champion: championOf(t, category),
    tier: t.level ? TIERS[t.level] : undefined,
    imageUrl: t.photo_url ?? undefined,
    venue: t.venue?.name ?? undefined,
    prize:
      t.prize?.amount && t.prize.currency
        ? { amount: t.prize.amount, currency: t.prize.currency }
        : undefined,
  };
}

function calendarEntry(t: PadelApiTournament, category: PadelCategory): RacquetCalendarEntry {
  return {
    id: `padelapi-${t.id}`,
    name: t.name,
    startDate: t.start_date,
    endDate: t.end_date,
    status: mapStatus(t.status),
    champion: championOf(t, category),
  };
}

// ---------- Draws ----------

const ROUND_IDS: Record<number, BracketRoundId> = {
  1: "final",
  2: "semi-final",
  4: "quarter-final",
  8: "round-of-16",
  16: "round-of-32",
  32: "round-of-64",
  64: "round-of-128",
};

const ROUND_LABELS: Record<number, string> = {
  1: "Final",
  2: "Semi-finals",
  4: "Quarter-finals",
  8: "Round of 16",
};

/**
 * A pair as one bracket entry, keyed by its players' ids in order: "65-66".
 *
 * The same two players arrive in either order from one round to the next
 * (Coello / Tapia in the final, Tapia / Coello in the quarter-final), and the
 * provider's own pair link follows the match's order ("66-65" then "65-66"),
 * so neither can be the key: one pair would be two teams in the bracket.
 */
function pairOf(players: PadelApiMatchPlayer[] | null | undefined, seed?: string | null): Team | null {
  if (!players?.length) return null;
  const sorted = [...players].sort((a, b) => a.id - b.id);
  return {
    id: sorted.map((p) => p.id).join("-"),
    name: sorted.map((p) => shortNameFor(p.name)).join(" / "),
    shortName: sorted.map((p) => surnameOf(p.name)).join(" / "),
    code: seed?.trim() ?? "",
  };
}

/** "6(3)" → 6 games, 3 tie-break points; "6" → 6 games. */
function setScore(raw: string | null | undefined): { games: number | null; tiebreak: number | null } {
  const match = /^(\d+)(?:\((\d+)\))?/.exec(raw?.trim() ?? "");
  if (!match) return { games: null, tiebreak: null };
  return { games: Number(match[1]), tiebreak: match[2] ? Number(match[2]) : null };
}

function legsOf(score: PadelApiMatch["score"]): BracketMatch["legs"] {
  if (!Array.isArray(score) || score.length === 0) return undefined;
  return score.map((set) => {
    const home = setScore(set.team_1);
    const away = setScore(set.team_2);
    return {
      homeScore: home.games,
      awayScore: away.games,
      ...(home.tiebreak !== null && { homeTiebreak: home.tiebreak }),
      ...(away.tiebreak !== null && { awayTiebreak: away.tiebreak }),
    };
  });
}

function isHidden(m: PadelApiMatch): boolean {
  return m.score === HIDDEN || m.winner === HIDDEN;
}

/**
 * One category's draw from the round of 16 to the final.
 *
 * The provider places every match by (round, index), and the winner of slot i
 * always plays the next round's slot i / 2 — on top when i is even. That
 * fills the slots a later round has not been given yet, so a draw part-way
 * through still shows who meets whom.
 *
 * A draw whose results the free plan hides comes back with no rounds and
 * `resultsHidden`: the matches still name everybody, but a bracket with no
 * winners in it says less than the champions do.
 */
function drawFrom(tournamentId: string, matches: PadelApiMatch[], category: PadelCategory): RacquetDraw {
  const own = matches.filter(
    (m) => (m.category ?? category) === category && (m.draw ?? "main") === "main"
  );
  if (own.length === 0) return { tournamentId, rounds: [], players: [] };
  const largest = Math.max(...own.map((m) => m.round));
  const first = Math.min(FIRST_BRACKET_ROUND, largest);
  if (own.some((m) => m.round <= first && isHidden(m))) {
    return { tournamentId, rounds: [], players: [], resultsHidden: true };
  }

  const pairs = new Map<string, Team>();
  const register = (team: Team | null): string | null => {
    if (!team) return null;
    const known = pairs.get(team.id);
    // The seed is the pair's for the whole event; take it wherever it is printed.
    if (!known || (!known.code && team.code)) pairs.set(team.id, team);
    return team.id;
  };

  const toMatch = (m: PadelApiMatch): BracketMatch => {
    const homeTeamId = register(pairOf(m.players?.team_1, m.seeds?.team_1));
    const awayTeamId = register(pairOf(m.players?.team_2, m.seeds?.team_2));
    return {
      id: String(m.id),
      homeTeamId,
      awayTeamId,
      legs: legsOf(m.score),
      winnerTeamId: m.winner === "team_1" ? homeTeamId : m.winner === "team_2" ? awayTeamId : null,
      date: m.scheduled_at ?? m.played_at ?? undefined,
      ...(m.status === "walkover" && { outcome: "walkover" as const }),
      ...(m.status === "retired" && { outcome: "retired" as const }),
    };
  };

  const bySlot = new Map(own.map((m) => [`${m.round}:${m.index}`, m]));

  const grid = new Map<number, BracketMatch[]>();
  for (let size = first; size >= 1; size /= 2) {
    grid.set(
      size,
      Array.from({ length: size }, (_, i) => {
        const m = bySlot.get(`${size}:${i}`);
        return m
          ? toMatch(m)
          : { id: `${tournamentId}-${category}-${size}-${i}`, homeTeamId: null, awayTeamId: null };
      })
    );
  }

  const advance = (size: number, index: number, winnerId: string | null | undefined) => {
    const target = grid.get(size / 2)?.[Math.floor(index / 2)];
    if (!target || !winnerId) return;
    if (index % 2 === 0) target.homeTeamId ??= winnerId;
    else target.awayTeamId ??= winnerId;
  };
  // The round before the first shown only seeds it: its winners, nothing else.
  for (const m of own.filter((m) => m.round === first * 2)) {
    advance(first * 2, m.index, toMatch(m).winnerTeamId);
  }
  for (let size = first; size > 1; size /= 2) {
    grid.get(size)!.forEach((m, i) => advance(size, i, m.winnerTeamId));
  }

  const rounds: BracketRound[] = [];
  for (let size = first; size >= 1; size /= 2) {
    rounds.push({ id: ROUND_IDS[size], label: ROUND_LABELS[size] ?? `Round of ${size * 2}`, matches: grid.get(size)! });
  }

  const used = new Set(rounds.flatMap((r) => r.matches.flatMap((m) => [m.homeTeamId, m.awayTeamId])));
  const final = grid.get(1)![0];
  const loserId = final.winnerTeamId === final.homeTeamId ? final.awayTeamId : final.homeTeamId;
  return {
    tournamentId,
    rounds,
    players: [...pairs.values()].filter((p) => used.has(p.id)),
    champion: final.winnerTeamId ? pairs.get(final.winnerTeamId)?.name : undefined,
    runnerUp: final.winnerTeamId && loserId ? pairs.get(loserId)?.name : undefined,
  };
}

function drawsFrom(id: number, matches: PadelApiMatch[]): PadelDraws {
  const tournamentId = `padelapi-${id}`;
  return {
    men: drawFrom(tournamentId, matches, "men"),
    women: drawFrom(tournamentId, matches, "women"),
  };
}

async function fetchPadel<T>(path: string): Promise<T> {
  const token = process.env.PADEL_API_KEY;
  if (!token) throw new Error("PADEL_API_KEY not configured");
  const res = await fetch(`${BASE_URL}${path}`, {
    signal: upstreamSignal(),
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`padel-api ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

/**
 * One call for both categories, final first: sorted by round, the first page
 * of fifty holds the final, semi-finals, quarter-finals and round of 16 of
 * both draws (30 matches) with part of the round of 32 behind them.
 */
async function fetchPadelDraws(id: number): Promise<PadelDraws> {
  const params = new URLSearchParams({
    sort_by: "round",
    order_by: "asc",
    per_page: String(PAGE_SIZE),
  });
  const res = await fetchPadel<PadelApiList<PadelApiMatch>>(
    `/tournaments/${id}/matches?${params.toString()}`
  );
  return drawsFrom(id, res.data);
}

/**
 * A draw being played changes by the match; a finished one never again. Two
 * caches, so a finished draw costs one request a day however often it is
 * opened, and a live one is never more than five minutes behind.
 */
const getLiveDraws = cachedFeed<[number], PadelDraws | null>(
  "padel-api draw",
  fetchPadelDraws,
  () => null,
  ["padel-api:draw:live"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:padel"] },
);

const getFinishedDraws = cachedFeed<[number], PadelDraws | null>(
  "padel-api draw",
  fetchPadelDraws,
  () => null,
  ["padel-api:draw:finished"],
  { revalidate: FINISHED_DRAW_SECONDS, tags: ["sports:padel"] },
);

function drawsFor(id: number, status: RacquetTournament["status"]): Promise<PadelDraws | null> {
  return status === "completed" ? getFinishedDraws(id) : getLiveDraws(id);
}

/**
 * The whole season in one call: from New Year, or from 45 days back when
 * that is further — in January the season so far is a week old and the last
 * results are December's.
 */
function tournamentsPath(now: Date): string {
  const lookback = new Date(now);
  lookback.setUTCDate(lookback.getUTCDate() - CALENDAR_LOOKBACK_DAYS);
  const seasonStart = `${now.getUTCFullYear()}-01-01`;
  const lookbackDay = lookback.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    level: PREMIER_LEVELS,
    after_date: lookbackDay < seasonStart ? lookbackDay : seasonStart,
    sort_by: "start_date",
    order_by: "asc",
    per_page: String(PAGE_SIZE),
  });
  return `/tournaments?${params.toString()}`;
}

/**
 * Rankings, calendar and the draws worth having, for both categories.
 *
 * Budget (10 a minute, 2,000 a day): three calls every five minutes, plus the
 * featured draw's while it is being played. The just-finished draws are read
 * for their finals' runners-up through the day-long cache, so they cost one
 * call a day each — never seven draws every five minutes, which alone would
 * be 2,016 a day.
 */
async function fetchPadelFromApi(): Promise<PadelData> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  // `per_page`, not `limit`: the API ignores `limit`, so the tournaments call
  // had been returning its default 15.
  const [menRanks, womenRanks, tournamentsRes] = await Promise.all([
    fetchPadel<PadelApiList<PadelApiPlayer>>(
      `/rankings?category=men&per_page=${RANKING_LIMIT}`,
    ),
    fetchPadel<PadelApiList<PadelApiPlayer>>(
      `/rankings?category=women&per_page=${RANKING_LIMIT}`,
    ),
    fetchPadel<PadelApiList<PadelApiTournament>>(tournamentsPath(now)),
  ]);

  if (menRanks.data.length === 0 && womenRanks.data.length === 0) {
    throw new Error("padel-api returned no rankings");
  }

  const season = [...tournamentsRes.data].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const listed = season.map((t) => ({
    raw: t,
    id: `padelapi-${t.id}`,
    status: mapStatus(t.status),
    startDate: t.start_date,
    endDate: t.end_date,
  }));
  const featured = featuredTournament(listed);
  const wanted = [
    ...(featured && drawIsOut(featured.status, featured.startDate, today) ? [featured] : []),
    ...[currentTournament(listed), ...justFinished(listed, JUST_FINISHED)].filter(
      (t): t is (typeof listed)[number] => Boolean(t)
    ),
  ];
  const unique = [...new Map(wanted.map((t) => [t.id, t])).values()];
  const draws = new Map(
    await Promise.all(
      unique.map(async (t) => [t.id, await drawsFor(t.raw.id, t.status)] as const)
    )
  );
  const shipped = drawsShipped(listed);
  const recentFrom = addDays(today, -CALENDAR_LOOKBACK_DAYS);
  // The last results stay listed through the winter break, when the most
  // recent final is older than the window.
  const recent = new Set(justFinished(listed, JUST_FINISHED).map((t) => t.id));

  const buildSection = (
    rankings: PadelApiPlayer[],
    tour: RacquetTour,
    category: PadelCategory,
  ): RacquetData => {
    const players = new Map<string, Team>();
    const tournaments = season
      .filter((t) => t.end_date >= recentFrom || recent.has(`padelapi-${t.id}`))
      .map((t): RacquetTournament => {
        const base = mapTournament(t, category);
        const draw = draws.get(base.id)?.[category];
        const bracket = shipped.has(base.id) && draw?.rounds.length ? draw.rounds : undefined;
        if (bracket) for (const p of draw!.players) players.set(p.id, p);
        return {
          ...base,
          champion: base.champion ?? draw?.champion,
          runnerUp: draw?.runnerUp,
          bracket,
        };
      });
    return {
      tour,
      season: now.getUTCFullYear(),
      rankings: rankings.map(mapRanking),
      tournaments,
      calendar: season.map((t) => calendarEntry(t, category)),
      drawPlayers: [...players.values()],
    };
  };

  return {
    men: buildSection(menRanks.data, "wpt-men", "men"),
    women: buildSection(womenRanks.data, "wpt-women", "women"),
  };
}

export const getPadelData = cachedFeed(
  "padel-api",
  fetchPadelFromApi,
  () => PADEL_DATA,
  ["padel-api:padel-data"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:padel"] },
);

/**
 * One tournament's draw for the details sheet, by the id the view knows it by.
 *
 * Only a tournament on this season's calendar is fetched — the id arrives
 * from the browser, and each fetch spends the shared daily budget — and its
 * state there picks the cache: a day once finished, five minutes otherwise.
 * Null when it is not on the calendar or the provider did not answer.
 */
export async function getPadelDraw(
  tour: "wpt-men" | "wpt-women",
  tournamentId: string,
): Promise<RacquetDraw | null> {
  const id = /^padelapi-(\d+)$/.exec(tournamentId)?.[1];
  if (!id) return null;
  const data = await getPadelData();
  const section = tour === "wpt-men" ? data.men : data.women;
  const known =
    section.calendar?.find((t) => t.id === tournamentId) ??
    section.tournaments.find((t) => t.id === tournamentId);
  if (!known) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (!drawIsOut(known.status, known.startDate, today)) {
    return { tournamentId, rounds: [], players: [] };
  }
  const draws = await drawsFor(Number(id), known.status);
  const draw = draws?.[tour === "wpt-men" ? "men" : "women"];
  if (!draw) return null;
  return { ...draw, champion: draw.champion ?? known.champion };
}

/** Pure mappers, exported for their tests — nothing here touches the network. */
export const __testing = {
  mapStatus,
  mapTournament,
  mapRanking,
  shortNameFor,
  surnameOf,
  photoFor,
  tournamentsPath,
  calendarEntry,
  pairOf,
  setScore,
  drawFrom,
  drawsFrom,
};
