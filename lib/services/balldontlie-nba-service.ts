import "server-only";

import { NBA_DATA } from "@/lib/data/sports/nba";
import type { Match, MatchStatus, NbaConference, NbaData, NbaStanding, Team } from "@/types/sports";
import { cachedFeed, upstreamSignal } from "./upstream";

const BASE_URL = "https://api.balldontlie.io/v1";
const ESPN_STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings";
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

/**
 * Teams are keyed by abbreviation, not balldontlie's numeric id, so the ESPN
 * table below can be joined onto the same teams.
 */
function teamFrom(t: BdlTeam): Team {
  return {
    id: t.abbreviation,
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
    homeTeamId: game.home_team.abbreviation,
    awayTeamId: game.visitor_team.abbreviation,
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

type EspnStandingEntry = {
  team?: { abbreviation?: string; displayName?: string; shortDisplayName?: string };
  stats?: Array<{ name?: string; type?: string; displayValue?: string; value?: number }>;
};

type EspnStandings = {
  children?: Array<{ abbreviation?: string; standings?: { entries?: EspnStandingEntry[] } }>;
};

/** Where ESPN's abbreviation is not the one balldontlie uses. */
const ESPN_TO_BDL: Record<string, string> = {
  GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS", UTAH: "UTA", WSH: "WAS",
};

function espnStat(entry: EspnStandingEntry, key: string): { value: number; display: string } {
  const found = entry.stats?.find((s) => s.name === key || s.type === key);
  const display = found?.displayValue ?? "";
  const value = typeof found?.value === "number" ? found.value : Number(display);
  return { value: Number.isFinite(value) ? value : 0, display };
}

/**
 * Both conference tables from ESPN, joined onto balldontlie's teams.
 *
 * balldontlie's free tier serves no /standings, and deriving a table would
 * take a request per hundred games. ESPN's public standings need no key and
 * cost nothing from balldontlie's five a minute.
 */
function standingsFrom(json: EspnStandings): { standings: NbaStanding[]; teams: Team[] } {
  const standings: NbaStanding[] = [];
  const teams: Team[] = [];
  for (const group of json.children ?? []) {
    const conference: NbaConference | null =
      group.abbreviation === "East" ? "east" : group.abbreviation === "West" ? "west" : null;
    if (!conference) continue;
    const rows = (group.standings?.entries ?? [])
      .map((entry) => {
        const espnCode = entry.team?.abbreviation;
        if (!espnCode) return null;
        const code = ESPN_TO_BDL[espnCode] ?? espnCode;
        const won = espnStat(entry, "wins").value;
        const lost = espnStat(entry, "losses").value;
        const behind = espnStat(entry, "gamesBehind");
        teams.push({
          id: code,
          name: entry.team?.displayName ?? code,
          shortName: entry.team?.shortDisplayName ?? code,
          code,
          primaryColor: TEAM_COLORS[code],
        });
        return {
          seed: espnStat(entry, "playoffSeed").value,
          row: {
            position: 0,
            teamId: code,
            conference,
            played: won + lost,
            won,
            drawn: 0,
            lost,
            goalsFor: espnStat(entry, "pointsFor").value,
            goalsAgainst: espnStat(entry, "pointsAgainst").value,
            points: 0,
            winPct: espnStat(entry, "winPercent").value,
            // "-" for the leader.
            gamesBehind: behind.display === "-" ? 0 : behind.value,
            streak: espnStat(entry, "streak").display || "—",
            last10: espnStat(entry, "lasttengames").display || "—",
          } satisfies NbaStanding,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const seeded = rows.every((r) => r.seed > 0);
    rows
      .sort((a, b) => (seeded ? a.seed - b.seed : b.row.winPct - a.row.winPct))
      .forEach(({ row }, i) => standings.push({ ...row, position: i + 1 }));
  }
  return { standings, teams };
}

/**
 * The table for the season the results belong to. ESPN names a season by the
 * year it ends in (2025–26 is 2026), and `seasontype=2` keeps the preseason's
 * exhibition records out of it.
 */
async function fetchStandings(season: number): Promise<EspnStandings> {
  const res = await fetch(`${ESPN_STANDINGS_URL}?season=${season + 1}&seasontype=2`, {
    signal: upstreamSignal(),
  });
  if (!res.ok) throw new Error(`espn nba standings ${res.status}`);
  return (await res.json()) as EspnStandings;
}

async function fetchNbaFromApi(today: Date): Promise<NbaData> {
  const season = currentSeason(today);
  const { start, end } = gameWindow(today);
  const games = recentAndNext(await gamesIn(start, end));

  if (games.length === 0) throw new Error("balldontlie returned no games");

  const byTeam = new Map<string, Team>();
  for (const game of games) {
    for (const t of [game.home_team, game.visitor_team]) {
      if (!byTeam.has(t.abbreviation)) byTeam.set(t.abbreviation, teamFrom(t));
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

  // A table is an extra, not the feed: if ESPN is down the games still
  // refresh, and the view drops the tab rather than inventing one.
  const table = await fetchStandings(latestSeason)
    .then(standingsFrom)
    .catch((error) => {
      console.warn("espn nba standings unavailable:", error);
      return { standings: [] as NbaStanding[], teams: [] as Team[] };
    });
  for (const team of table.teams) if (!byTeam.has(team.id)) byTeam.set(team.id, team);

  return {
    season: seasonLabel(latestSeason),
    teams: [...byTeam.values()],
    games: sorted.map(matchFrom),
    standings: table.standings,
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
export const __testing = {
  currentSeason,
  seasonLabel,
  recentAndNext,
  statusFrom,
  gameWindow,
  standingsFrom,
};
