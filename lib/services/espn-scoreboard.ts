import "server-only";

import { headerBroadcasts } from "@/lib/sports/espn-broadcasts";
import { espnImage } from "@/lib/sports/espn-images";
import type { BracketMatch, BracketRound, BracketRoundId, Match, MatchStatus, Team } from "@/types/sports";
import { upstreamSignal } from "./upstream";

/**
 * The feed behind espn.com's scores bar, for any of ESPN's leagues. The site
 * API's own `/scoreboard` answers a date range with a 400 for every team sport
 * (seen October 2026); this one takes the range, so days of games are one
 * request.
 */
const HEADER_URL = "https://site.web.api.espn.com/apis/v2/scoreboard/header";

/**
 * Its ceilings, found by trial in October 2026. Without a `limit` it stops at
 * 75 games. Whatever the `limit`, a range whose answer runs past ~215 games is
 * a 502 — a fortnight of a full baseball slate is already ~190 — so days are
 * read a week at a time (~105 at most), and one request never spans more
 * than two months.
 */
const HEADER_LIMIT = 200;
const HEADER_MAX_DAYS = 62;
const CHUNK_DAYS = 7;
const DAY_MS = 86_400_000;

/** Which of ESPN's leagues, in the scores bar's own words: `baseball` / `mlb`, `hockey` / `nhl`. */
export type HeaderLeague = { sport: string; league: string };

export type HeaderCompetitor = {
  /** ESPN's numeric team id, "30". */
  id?: string;
  homeAway?: "home" | "away";
  /** "TB"; "TBD" for a playoff slot nobody has won yet. */
  abbreviation?: string;
  displayName?: string;
  /** The nickname, "Rays": the scores bar has no `shortDisplayName`. */
  name?: string;
  color?: string;
  logo?: string;
  /** "4"; "" before the first pitch or puck drop. */
  score?: string;
  winner?: boolean;
};

export type HeaderStatus = {
  /** The inning or period under way, or the last one played. */
  period?: number;
  /** Baseball's half-inning: "Top", "Bot", "Mid", "End". */
  periodPrefix?: string;
  displayClock?: string;
  type?: {
    name?: string;
    state?: "pre" | "in" | "post";
    completed?: boolean;
    /** "Final", "Final/10", "Final/OT". */
    detail?: string;
    shortDetail?: string;
  };
};

export type HeaderEvent = {
  id?: string;
  /** The start, "2026-10-27T00:00:00Z". */
  date?: string;
  season?: number;
  /** "1" preseason, "2" regular season, "3" postseason. */
  seasonType?: string | number;
  /** "WILDCARD", "DIV", "CONF", "FINAL" for a playoff round. */
  competitionType?: { abbreviation?: string };
  note?: string;
  notes?: Array<{ headline?: string }>;
  fullStatus?: HeaderStatus;
  competitors?: HeaderCompetitor[];
  /** The national channels in one string, "Peacock/NBC"; "" for none. */
  broadcast?: string | null;
  broadcasts?: Array<{ name?: string; type?: string }>;
};

export type HeaderScoreboard = {
  sports?: Array<{ leagues?: Array<{ events?: HeaderEvent[] }> }>;
};

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `day` moved by `days`, both calendar days ("2026-10-25"). */
export function shiftDay(day: string, days: number): string {
  return isoDay(new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS));
}

function spanDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/** The request for `from` through `to`, both included. */
export function headerUrl({ sport, league }: HeaderLeague, from: string, to: string): string {
  const days = spanDays(from, to);
  if (!(days >= 1 && days <= HEADER_MAX_DAYS)) {
    throw new Error(`espn scoreboard: ${from} to ${to} is not 1–${HEADER_MAX_DAYS} days`);
  }
  const dates = `${from.replaceAll("-", "")}-${to.replaceAll("-", "")}`;
  return `${HEADER_URL}?sport=${sport}&league=${league}&dates=${dates}&limit=${HEADER_LIMIT}`;
}

export function headerEvents(json: HeaderScoreboard): HeaderEvent[] {
  return (json.sports ?? []).flatMap((s) => s.leagues ?? []).flatMap((l) => l.events ?? []);
}

/**
 * The events of `from` through `to`, raw. A week of baseball is over a
 * megabyte of odds and links, so the answer skips Next's fetch cache, which
 * refuses an entry over 2 MB: callers cache what they map out of it.
 */
export async function fetchHeader(league: HeaderLeague, from: string, to: string): Promise<HeaderEvent[]> {
  const url = headerUrl(league, from, to);
  const res = await fetch(url, { signal: upstreamSignal(), cache: "no-store" });
  if (!res.ok) throw new Error(`espn scoreboard ${res.status} on ${url}`);
  return headerEvents((await res.json()) as HeaderScoreboard);
}

/** `from` through `to` as back-to-back spans of a week at most. */
export function weekChunks(from: string, to: string): Array<{ from: string; to: string }> {
  const chunks: Array<{ from: string; to: string }> = [];
  for (let start = from; start <= to; start = shiftDay(start, CHUNK_DAYS)) {
    const end = shiftDay(start, CHUNK_DAYS - 1);
    chunks.push({ from: start, to: end < to ? end : to });
  }
  return chunks;
}

/**
 * Every day from `from` through `to`, a week a request. A week that fails is
 * left out rather than taking the others with it; when every week fails, so
 * does this, as an empty answer would replace the last good one in the cache.
 */
export async function fetchHeaderDays(league: HeaderLeague, from: string, to: string): Promise<HeaderEvent[]> {
  const settled = await Promise.allSettled(weekChunks(from, to).map((c) => fetchHeader(league, c.from, c.to)));
  const failures = settled.flatMap((r) => (r.status === "rejected" ? [r.reason] : []));
  if (failures.length > 0 && failures.length === settled.length) {
    throw new AggregateError(failures, `espn scoreboard: every week of ${from} to ${to} failed`);
  }
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

/**
 * A postponed or cancelled game reads "post" like a finished one, and a
 * cancelled one can keep a score, so they are told apart by name first. A
 * suspended game is finished another day.
 */
export function headerStatus(status: HeaderStatus | undefined): MatchStatus {
  const type = status?.type;
  if (type?.name === "STATUS_POSTPONED" || type?.name === "STATUS_SUSPENDED") return "postponed";
  if (type?.name === "STATUS_CANCELED") return "cancelled";
  if (type?.state === "in") return "live";
  if (type?.state === "post") return "ft";
  return "scheduled";
}

/** A side as a team, keyed by its abbreviation in lower case; nobody for an undecided slot. */
export function headerTeam(c: HeaderCompetitor | undefined): Team | null {
  const code = c?.abbreviation;
  if (!code || code === "TBD") return null;
  return {
    id: code.toLowerCase(),
    name: c.displayName ?? code,
    shortName: c.name ?? c.displayName ?? code,
    code,
    logoUrl: espnImage(c.logo),
    primaryColor: c.color ? `#${c.color}` : undefined,
  };
}

export function headerScore(c: HeaderCompetitor | undefined): number | null {
  if (!c?.score) return null;
  const n = Number(c.score);
  return Number.isFinite(n) ? n : null;
}

export function headerSides(event: HeaderEvent): { home?: HeaderCompetitor; away?: HeaderCompetitor } {
  const competitors = event.competitors ?? [];
  return {
    home: competitors.find((c) => c.homeAway === "home"),
    away: competitors.find((c) => c.homeAway === "away"),
  };
}

export type HeaderMatch = {
  match: Match;
  teams: [Team, Team];
  home: HeaderCompetitor;
  away: HeaderCompetitor;
  /** Who won, once it is over. */
  winnerTeamId: string | null;
};

/**
 * What every sport's game shares: the sides, the score once there is one,
 * the start, the status and the national channels. `exclude` drops channels
 * that carry nearly every game (MLB.TV), which say nothing about where this
 * one is on. The sport adds its own words (`stageLabel`, `statusText`).
 */
export function headerMatch(
  event: HeaderEvent,
  { exclude = [] }: { exclude?: readonly string[] } = {}
): HeaderMatch | null {
  const { home, away } = headerSides(event);
  const homeTeam = headerTeam(home);
  const awayTeam = headerTeam(away);
  if (!event.id || !home || !away || !homeTeam || !awayTeam) return null;
  const status = headerStatus(event.fullStatus);
  const scored = status === "live" || status === "ft";
  const homeScore = scored ? headerScore(home) : null;
  const awayScore = scored ? headerScore(away) : null;
  const broadcasts = headerBroadcasts(event).filter((b) => !exclude.includes(b));

  let winnerTeamId: string | null = null;
  if (status === "ft") {
    if (home.winner) winnerTeamId = homeTeam.id;
    else if (away.winner) winnerTeamId = awayTeam.id;
    else if (homeScore !== null && awayScore !== null && homeScore !== awayScore) {
      winnerTeamId = homeScore > awayScore ? homeTeam.id : awayTeam.id;
    }
  }

  return {
    match: {
      id: event.id,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeScore,
      awayScore,
      kickoff: event.date ?? "",
      status,
      ...(broadcasts.length > 0 ? { broadcasts } : {}),
    },
    teams: [homeTeam, awayTeam],
    home,
    away,
    winnerTeamId,
  };
}

/** A playoff game, as a best-of series counts it. */
export type SeriesGame = {
  /** Its round, as an index into the caller's rounds. */
  round: number;
  /** Its half of the draw, 0 the top (the AL, the East) and 1 the bottom; null where there is one (the final). */
  half: 0 | 1 | null;
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  status: MatchStatus;
  winnerTeamId: string | null;
};

export type Series = {
  round: number;
  half: 0 | 1 | null;
  /** Game one's home side first: the higher seed, who opens at home. */
  teamIds: [string, string];
  /** By date. */
  games: SeriesGame[];
};

/** A round of a best-of bracket: how many series it holds, and each one's length. */
export type SeriesRound = {
  id: BracketRoundId;
  label: string;
  size: number;
  bestOf: 1 | 3 | 5 | 7;
};

const FINISHED: ReadonlySet<MatchStatus> = new Set<MatchStatus>(["ft", "aet", "pen"]);

/**
 * Games into series. No feed names the series, but a pair of teams meets at
 * most once a round, so the round and the pair are its key. A postponed game
 * is not one of the series' games — its makeup comes back as a game of its
 * own — and nor is a cancelled one.
 */
export function groupSeries(games: SeriesGame[]): Series[] {
  const byKey = new Map<string, Series>();
  const inPlay = games
    .filter((g) => g.status !== "postponed" && g.status !== "cancelled")
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  for (const game of inPlay) {
    const key = `${game.round}|${[game.homeTeamId, game.awayTeamId].sort().join("|")}`;
    let series = byKey.get(key);
    if (!series) {
      series = { round: game.round, half: game.half, teamIds: [game.homeTeamId, game.awayTeamId], games: [] };
      byKey.set(key, series);
    }
    series.half ??= game.half;
    series.games.push(game);
  }
  return [...byKey.values()];
}

/**
 * One series as a tie: its score in wins, decided once a side has won the
 * majority of `bestOf`. Dated by its deciding game, or while it goes on by
 * the next one. With no series, the slot it will fill, TBD.
 */
export function seriesTie(series: Series | undefined, id: string, bestOf: SeriesRound["bestOf"]): BracketMatch {
  if (!series) {
    return { id, homeTeamId: null, awayTeamId: null, homeScore: null, awayScore: null, winnerTeamId: null, bestOf };
  }
  const [home, away] = series.teamIds;
  const played = series.games.filter((g) => FINISHED.has(g.status) && g.winnerTeamId);
  const wins = (team: string): number => played.filter((g) => g.winnerTeamId === team).length;
  const needed = Math.floor(bestOf / 2) + 1;
  const winner = [home, away].find((t) => wins(t) >= needed) ?? null;
  const last = played[played.length - 1];
  const next = series.games.find((g) => g.status === "scheduled" || g.status === "live");
  const date = winner ? last?.date : (next ?? last)?.date;
  return {
    id,
    homeTeamId: home,
    awayTeamId: away,
    homeScore: played.length > 0 ? wins(home) : null,
    awayScore: played.length > 0 ? wins(away) : null,
    winnerTeamId: winner,
    ...(date ? { date } : {}),
    bestOf,
  };
}

/** A round's series in its slots: the top half's first, then the bottom's, a TBD slot where one is still to come. */
function slotsFor(list: Series[], size: number): Array<Series | undefined> {
  const slots: Array<Series | undefined> = Array.from({ length: Math.max(size, 1) }, () => undefined);
  const perHalf = Math.ceil(size / 2);
  const loose: Series[] = [];
  for (const series of list) {
    const start = series.half === null || size <= 1 ? -1 : series.half * perHalf;
    const k = start < 0 ? -1 : slots.findIndex((s, i) => !s && i >= start && i < start + perHalf);
    if (k === -1) loose.push(series);
    else slots[k] = series;
  }
  for (const series of loose) {
    const k = slots.findIndex((s) => !s);
    if (k === -1) slots.push(series);
    else slots[k] = series;
  }
  return slots;
}

/**
 * The final's sides in the order of the halves they came through, the top
 * half's first. Game one's home side can come from either, and
 * `KnockoutBracket` sorts the rounds before the final from its first side:
 * the 2026 World Series opened at Milwaukee, which drew the NL on the AL's side.
 */
function topHalfFirst(final: Series, feeders: Series[]): Series {
  const [a, b] = final.teamIds;
  const halfOf = (team: string): Series["half"] | undefined => feeders.find((s) => s.teamIds.includes(team))?.half;
  return halfOf(b) === 0 && halfOf(a) !== 0 ? { ...final, teamIds: [b, a] } : final;
}

/**
 * The series as a bracket, a tie each, every round's top half before its
 * bottom half — the order `KnockoutBracket` splits a round's ties into the
 * two sides of the draw — and the final's top-half side first. From the first
 * round with a series on, every round is there, its ties TBD until their
 * teams are known, so the shape of the rest is on screen from the first game.
 * No series, no rounds.
 */
export function seriesBracket(series: Series[], rounds: readonly SeriesRound[], idPrefix: string): BracketRound[] {
  const first = rounds.findIndex((_, r) => series.some((s) => s.round === r));
  if (first === -1) return [];
  return rounds.slice(first).map((round, i) => {
    const feeders = series.filter((s) => s.round === first + i - 1);
    const list = series
      .filter((s) => s.round === first + i)
      .map((s) => (round.size === 1 ? topHalfFirst(s, feeders) : s))
      .sort((a, b) => Date.parse(a.games[0]?.date ?? "") - Date.parse(b.games[0]?.date ?? ""));
    return {
      id: round.id,
      label: round.label,
      matches: slotsFor(list, round.size).map((s, k) =>
        seriesTie(s, round.size === 1 ? `${idPrefix}-${round.id}` : `${idPrefix}-${round.id}-${k}`, round.bestOf)
      ),
    };
  });
}
