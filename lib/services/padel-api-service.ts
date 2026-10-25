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
/**
 * The draw starts at the round of 16 once everybody in it is known: the byes
 * are all in the rounds before it. Until then it is the whole draw, or its
 * first days showed an empty round of 16 as "not drawn yet".
 */
const FIRST_BRACKET_ROUND = 8;
/** A Major's whole main draw, both categories: 126 matches, three pages. */
const MAX_DRAW_PAGES = 3;
/** What the free plan sends in place of a result older than about six months. */
const HIDDEN = "hidden_free_plan";

/** The provider's two draws; the hub reads only the men's. */
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
  /** Each pair either way round: Tapia then Coello one week, Coello then Tapia the next. */
  winners?: Partial<Record<PadelCategory, Array<{ id?: number; name: string }>>> | null;
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

type PadelApiList<T> = { data: T[]; meta?: { last_page?: number } };

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

/**
 * The pair that won this category, as "A. Coello / A. Tapia": in player-id
 * order, the way `pairOf` names the same pair in the draw, or the card's
 * champion and the final under it would print one pair two ways.
 */
function championOf(t: PadelApiTournament, category: PadelCategory): string | undefined {
  const pair = t.winners?.[category];
  if (!pair?.length) return undefined;
  return [...pair]
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    .map((p) => shortNameFor(p.name))
    .join(" / ");
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
    // As the rankings' faces: spelled from the name, no request spent.
    photos: sorted.map((p) => photoFor(p.name) ?? null),
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

/** One category's main-draw matches. */
function mainDraw(matches: PadelApiMatch[], category: PadelCategory): PadelApiMatch[] {
  return matches.filter(
    (m) => (m.category ?? category) === category && (m.draw ?? "main") === "main"
  );
}

/**
 * Every side of the round `size` is known: named by the provider, or the
 * winner of the match before it that feeds it.
 */
function roundIsSet(own: PadelApiMatch[], size: number): boolean {
  const at = new Map(own.map((m) => [`${m.round}:${m.index}`, m]));
  const won = (m: PadelApiMatch | undefined): boolean => m?.winner === "team_1" || m?.winner === "team_2";
  return Array.from({ length: size }, (_, i) => i).every((i) => {
    const m = at.get(`${size}:${i}`);
    const home = Boolean(m?.players?.team_1?.length) || won(at.get(`${size * 2}:${i * 2}`));
    const away = Boolean(m?.players?.team_2?.length) || won(at.get(`${size * 2}:${i * 2 + 1}`));
    return home && away;
  });
}

/**
 * One category's draw from the round of 16 to the final, or from its first
 * round while the round of 16 is still being filled.
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
  const own = mainDraw(matches, category);
  if (own.length === 0) return { tournamentId, rounds: [], players: [] };
  const largest = Math.max(...own.map((m) => m.round));
  const first = roundIsSet(own, FIRST_BRACKET_ROUND) ? Math.min(FIRST_BRACKET_ROUND, largest) : largest;
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
      ...(m.status === "bye" && { outcome: "bye" as const }),
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
 * The men's draw, out of a list that holds the women's too.
 *
 * One call, final first: sorted by round, the first page of fifty holds the
 * final, semi-finals, quarter-finals and round of 16 of both categories' draws
 * (30 matches) with part of the round of 32 behind them. While the men's round
 * of 16 still has a side to fill, the rest of the draw is read too — two more
 * pages at most, and only in a tournament's first days.
 */
async function fetchPadelDraw(id: number): Promise<RacquetDraw> {
  const page = (n: number): Promise<PadelApiList<PadelApiMatch>> => {
    const params = new URLSearchParams({
      sort_by: "round",
      order_by: "asc",
      per_page: String(PAGE_SIZE),
      page: String(n),
    });
    return fetchPadel<PadelApiList<PadelApiMatch>>(`/tournaments/${id}/matches?${params.toString()}`);
  };
  const first = await page(1);
  const pages = Math.min(first.meta?.last_page ?? 1, MAX_DRAW_PAGES);
  const men = mainDraw(first.data, "men");
  const settled = men.length === 0 || roundIsSet(men, FIRST_BRACKET_ROUND);
  if (pages <= 1 || settled) return drawFrom(`padelapi-${id}`, first.data, "men");
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => page(i + 2)));
  return drawFrom(`padelapi-${id}`, [...first.data, ...rest.flatMap((r) => r.data)], "men");
}

/**
 * A draw being played changes by the match; a finished one never again. Two
 * caches, so a finished draw costs one request a day however often it is
 * opened, and a live one is never more than five minutes behind.
 */
const getLiveDraw = cachedFeed<[number], RacquetDraw | null>(
  "padel-api draw",
  fetchPadelDraw,
  () => null,
  ["padel-api:draw:live"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:padel"] },
);

const getFinishedDraw = cachedFeed<[number], RacquetDraw | null>(
  "padel-api draw",
  fetchPadelDraw,
  () => null,
  ["padel-api:draw:finished"],
  { revalidate: FINISHED_DRAW_SECONDS, tags: ["sports:padel"] },
);

function drawFor(id: number, status: RacquetTournament["status"]): Promise<RacquetDraw | null> {
  return status === "completed" ? getFinishedDraw(id) : getLiveDraw(id);
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
 * The men's rankings and the season, without a single draw: two calls every
 * five minutes, 576 a day. The draws are joined in by
 * `getPadelData`, each through its own cache.
 */
async function fetchPadelFromApi(): Promise<PadelData> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  // `per_page`, not `limit`: the API ignores `limit`, so the tournaments call
  // had been returning its default 15.
  const [rankings, tournamentsRes] = await Promise.all([
    fetchPadel<PadelApiList<PadelApiPlayer>>(
      `/rankings?category=men&per_page=${RANKING_LIMIT}`,
    ),
    fetchPadel<PadelApiList<PadelApiTournament>>(tournamentsPath(now)),
  ]);

  if (rankings.data.length === 0) throw new Error("padel-api returned no rankings");

  const season = [...tournamentsRes.data].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const recentFrom = addDays(today, -CALENDAR_LOOKBACK_DAYS);
  // The last results stay listed through the winter break, when the most
  // recent final is older than the window.
  const dated = season.map((t) => ({
    id: `padelapi-${t.id}`,
    status: mapStatus(t.status),
    startDate: t.start_date,
    endDate: t.end_date,
  }));
  const recent = new Set(justFinished(dated, JUST_FINISHED).map((t) => t.id));
  const listed = season.filter((t) => t.end_date >= recentFrom || recent.has(`padelapi-${t.id}`));

  return {
    men: {
      tour: "wpt-men",
      season: now.getUTCFullYear(),
      rankings: rankings.data.map(mapRanking),
      tournaments: listed.map((t) => mapTournament(t, "men")),
      calendar: season.map((t) => calendarEntry(t, "men")),
      drawPlayers: [],
    },
  };
}

const getPadelFeed = cachedFeed(
  "padel-api",
  fetchPadelFromApi,
  () => PADEL_DATA,
  ["padel-api:padel-data"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:padel"] },
);

/** The provider's number behind a feed id: 747 from "padelapi-747". */
function providerId(tournamentId: string): number | null {
  const id = /^padelapi-(\d+)$/.exec(tournamentId)?.[1];
  return id ? Number(id) : null;
}

/**
 * The draws worth reading with the feed: the featured one's once it can
 * exist, the current one's, and the just-finished ones' for their finals'
 * runners-up.
 */
function drawsWanted(tournaments: RacquetTournament[], today: string): RacquetTournament[] {
  const featured = featuredTournament(tournaments);
  const wanted = [
    ...(featured && drawIsOut(featured.status, featured.startDate, today) ? [featured] : []),
    ...[currentTournament(tournaments), ...justFinished(tournaments, JUST_FINISHED)].filter(
      (t): t is RacquetTournament => Boolean(t)
    ),
  ];
  return [...new Map(wanted.map((t) => [t.id, t])).values()];
}

/**
 * The season with its draws joined in: the featured and current tournaments
 * carry their brackets, every draw read lends its final's pairs.
 */
function sectionWithDraws(section: RacquetData, draws: Map<string, RacquetDraw | null>): RacquetData {
  const shipped = drawsShipped(section.tournaments);
  const players = new Map<string, Team>();
  const tournaments = section.tournaments.map((t): RacquetTournament => {
    const draw = draws.get(t.id);
    if (!draw) return t;
    const bracket = shipped.has(t.id) && draw.rounds.length ? draw.rounds : undefined;
    if (bracket) for (const p of draw.players) players.set(p.id, p);
    return {
      ...t,
      // The final's own winner, named as the bracket names it.
      champion: draw.champion ?? t.champion,
      runnerUp: draw.runnerUp ?? t.runnerUp,
      bracket,
    };
  });
  return { ...section, tournaments, drawPlayers: [...players.values()] };
}

/**
 * Rankings, calendar and the draws worth having.
 *
 * The draws are read out here, never inside the feed's cached function:
 * Next skips the read of an `unstable_cache` nested in another, so the
 * day-long cache of a finished draw would never have served, and every
 * five-minute refresh would have fetched every draw again — 2,016 calls a day
 * at seven, past the 2,000 allowed. Read here, a finished draw costs one call
 * a day and the live one 288, so a live week stays under 1,200; and a draw
 * that fails is missing from this one answer instead of from the cached feed.
 */
export async function getPadelData(): Promise<PadelData> {
  const feed = await getPadelFeed();
  if (feed === PADEL_DATA) return feed;
  const today = new Date().toISOString().slice(0, 10);
  const wanted = drawsWanted(feed.men.tournaments, today);
  const draws = new Map(
    await Promise.all(
      wanted.map(async (t) => {
        const id = providerId(t.id);
        return [t.id, id === null ? null : await drawFor(id, t.status)] as const;
      })
    )
  );
  return { men: sectionWithDraws(feed.men, draws) };
}

/**
 * One tournament's draw, for a tournament's page or the hub's featured
 * tournament, by the id the view knows it by.
 *
 * Only a tournament on this season's calendar is fetched — the id arrives
 * from the browser, and each fetch spends the shared daily budget — and its
 * state there picks the cache: a day once finished, five minutes otherwise.
 * Null when it is not on the calendar or the provider did not answer.
 */
export async function getPadelDraw(tournamentId: string): Promise<RacquetDraw | null> {
  const id = providerId(tournamentId);
  if (id === null) return null;
  const section = (await getPadelFeed()).men;
  const known =
    section.calendar?.find((t) => t.id === tournamentId) ??
    section.tournaments.find((t) => t.id === tournamentId);
  if (!known) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (!drawIsOut(known.status, known.startDate, today)) {
    return { tournamentId, rounds: [], players: [] };
  }
  const draw = await drawFor(id, known.status);
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
  fetchPadelDraw,
};
