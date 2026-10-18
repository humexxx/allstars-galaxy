import "server-only";

import { NBA_DATA } from "@/lib/data/sports/nba";
import type { Match, MatchStatus, NbaData, Team } from "@/types/sports";
import { cachedFeed, upstreamSignal } from "./upstream";

const BASE_URL = "https://api.balldontlie.io/v1";
const REVALIDATE_SECONDS = 300;
/**
 * The free tier allows five requests a minute, shared by everyone looking at
 * the page. One window per refresh keeps a cold cache inside that no matter
 * what time of year it is — three separate windows was enough to earn a 429
 * on its own.
 */
const PAGE_SIZE = 100;
/** In season: a few nights either side of today, well under one page. */
const IN_SEASON_DAYS = 4;
/** Out of season: far enough ahead to reach October's opener. */
const OFF_SEASON_AHEAD_DAYS = 130;

type BdlTeam = {
  id: number;
  full_name: string;
  name: string;
  abbreviation: string;
  conference: string;
};

type BdlGame = {
  id: number;
  date: string;
  datetime: string | null;
  season: number;
  status: string;
  status_state: string;
  postseason: boolean;
  postponed: boolean;
  home_team_score: number;
  visitor_team_score: number;
  home_team: BdlTeam;
  visitor_team: BdlTeam;
};

/**
 * The NBA labels a season by the year it starts in, so "2026" is 2026–27.
 * Before October the season under way (or just finished) is the previous one.
 */
function currentSeason(today: Date): number {
  return today.getMonth() >= 9 ? today.getFullYear() : today.getFullYear() - 1;
}

function seasonLabel(season: number): string {
  return `${season}–${String((season + 1) % 100).padStart(2, "0")}`;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shift(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * The dates to ask for, as one page of at most a hundred games.
 *
 * A page is the OLDEST hundred games in the range, so the range has to be
 * small enough for today to be inside that page. The old ±130 days only
 * worked out of season: from November its hundred games stopped at the first
 * fortnight of the season, and the "latest results" froze there with no
 * fixtures at all. In season the games are nightly, so a few days either side
 * is plenty. Between the finals (mid-June) and the first week of the new
 * season the nearest games are months apart, so that range starts at June 1 —
 * the finals, never a March night — and runs on to the opener.
 */
function gameWindow(today: Date): { start: string; end: string } {
  const month = today.getMonth();
  const day = today.getDate();
  const offSeason =
    (month === 5 && day >= 15) || month === 6 || month === 7 || month === 8 || (month === 9 && day < 28);
  if (!offSeason) {
    return { start: iso(shift(today, -IN_SEASON_DAYS)), end: iso(shift(today, IN_SEASON_DAYS)) };
  }
  return {
    start: `${today.getFullYear()}-06-01`,
    end: iso(shift(today, OFF_SEASON_AHEAD_DAYS)),
  };
}

async function fetchBdl<T>(path: string): Promise<T> {
  const token = process.env.BALLDONTLIE_API_KEY;
  if (!token) throw new Error("BALLDONTLIE_API_KEY not configured");
  const res = await fetch(`${BASE_URL}${path}`, {
    signal: upstreamSignal(),
    headers: { Authorization: token },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new Error(`balldontlie ${res.status} on ${path}`);
  return (await res.json()) as T;
}

/**
 * Team colours, because balldontlie serves no logos.
 *
 * Without them every badge is the same grey monogram and a scoreboard reads as
 * twelve identical circles. Keyed by the abbreviation the API returns.
 */
const TEAM_COLORS: Record<string, string> = {
  ATL: "#E03A3E", BOS: "#007A33", BKN: "#000000", CHA: "#1D1160",
  CHI: "#CE1141", CLE: "#860038", DAL: "#00538C", DEN: "#0E2240",
  DET: "#C8102E", GSW: "#1D428A", HOU: "#CE1141", IND: "#002D62",
  LAC: "#C8102E", LAL: "#552583", MEM: "#5D76A9", MIA: "#98002E",
  MIL: "#00471B", MIN: "#0C2340", NOP: "#0C2340", NYK: "#006BB6",
  OKC: "#007AC1", ORL: "#0077C0", PHI: "#006BB6", PHX: "#1D1160",
  POR: "#E03A3E", SAC: "#5A2D81", SAS: "#C4CED4", TOR: "#CE1141",
  UTA: "#002B5C", WAS: "#002B5C",
};

function teamFrom(t: BdlTeam): Team {
  return {
    id: String(t.id),
    name: t.full_name,
    shortName: t.name,
    code: t.abbreviation,
    primaryColor: TEAM_COLORS[t.abbreviation],
  };
}

/**
 * `status` is either a kickoff timestamp (scheduled) or a word — "Final",
 * "Postponed", or a live clock like "Q3 4:21".
 */
function statusFrom(game: BdlGame): MatchStatus {
  if (game.postponed) return "postponed";
  switch (game.status_state) {
    case "final":
      return "ft";
    case "in":
      return "live";
    default:
      return "scheduled";
  }
}

function matchFrom(game: BdlGame): Match {
  // "in" is a game in progress — it has a score too, or a live tile is blank.
  const played = game.status_state === "final" || game.status_state === "in";
  return {
    id: String(game.id),
    homeTeamId: String(game.home_team.id),
    awayTeamId: String(game.visitor_team.id),
    homeScore: played ? game.home_team_score : null,
    awayScore: played ? game.visitor_team_score : null,
    kickoff: game.datetime ?? `${game.date}T00:00:00Z`,
    status: statusFrom(game),
    stageLabel: game.postseason ? "Playoffs" : undefined,
  };
}

async function gamesIn(start: string, end: string): Promise<BdlGame[]> {
  const res = await fetchBdl<{ data: BdlGame[] }>(
    `/games?per_page=${PAGE_SIZE}&start_date=${start}&end_date=${end}`
  );
  return res.data ?? [];
}

/**
 * The last results and the next fixtures, whatever the calendar says.
 *
 * In season that is a handful of days either side of today. Out of season the
 * nearest games are months away in both directions — June's finals behind,
 * October's opener ahead — so the window has to be wide enough to catch both,
 * and the trimming happens here rather than in a second request.
 */
function recentAndNext(games: BdlGame[]): BdlGame[] {
  const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));
  // By state, not by date: on a ten-game night "today's games" filled every
  // recent slot with fixtures that had not tipped off yet.
  const played = sorted.filter((g) => g.status_state === "final");
  const ahead = sorted.filter((g) => g.status_state !== "final");
  return [...played.slice(-6), ...ahead.slice(0, 6)];
}

async function fetchNbaFromApi(today: Date): Promise<NbaData> {
  const season = currentSeason(today);
  const { start, end } = gameWindow(today);
  const games = recentAndNext(await gamesIn(start, end));

  if (games.length === 0) throw new Error("balldontlie returned no games");

  const byTeam = new Map<string, Team>();
  for (const game of games) {
    for (const t of [game.home_team, game.visitor_team]) {
      if (!byTeam.has(String(t.id))) byTeam.set(String(t.id), teamFrom(t));
    }
  }

  const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));
  // Out of season the list holds two: the finals just played and the openers
  // already scheduled. The heading names the one the RESULTS belong to, since
  // that is the season a reader is reading; the fixtures carry their own
  // dates. Falling back to the last game's season labelled June's finals with
  // next October's year.
  const played = sorted.filter((g) => g.status_state === "final");
  const latestSeason =
    played[played.length - 1]?.season ?? sorted[sorted.length - 1]?.season ?? season;

  return {
    season: seasonLabel(latestSeason),
    teams: [...byTeam.values()],
    games: sorted.map(matchFrom),
    // The free tier does not serve /standings, and deriving a table would
    // take a request per hundred games. The view drops the tab rather than
    // showing a made-up one next to real scores.
    standings: [],
  };
}

/**
 * Live NBA games, falling back to the mock fixture when there is no last good
 * answer to serve.
 */
export const getNbaData = cachedFeed(
  "balldontlie NBA",
  () => fetchNbaFromApi(new Date()),
  () => NBA_DATA,
  ["nba-data"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:nba"] }
);

/** Pure helpers, exported for their tests — nothing here touches the network. */
export const __testing = { currentSeason, seasonLabel, recentAndNext, statusFrom, gameWindow };
