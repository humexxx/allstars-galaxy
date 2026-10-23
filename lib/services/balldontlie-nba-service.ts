import "server-only";

import { NBA_DATA } from "@/lib/data/sports/nba";
import { espnImage } from "@/lib/sports/espn-images";
import type {
  BracketMatch,
  BracketRound,
  BracketRoundId,
  Match,
  MatchStatus,
  NbaChampion,
  NbaConference,
  NbaData,
  NbaStanding,
  Team,
} from "@/types/sports";
import { cachedFeed, upstreamSignal } from "./upstream";

const BASE_URL = "https://api.balldontlie.io/v1";
const ESPN_STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings";
/**
 * The feed behind espn.com's scores bar. The site API's own `/scoreboard`
 * answers any team sport's date range with a 400 (seen October 2026), and one
 * day or one month of it cannot hold a postseason; this one takes the range,
 * so the whole bracket is a single request.
 */
const ESPN_SCOREBOARD_URL = "https://site.web.api.espn.com/apis/v2/scoreboard/header";
const REVALIDATE_SECONDS = 300;
/**
 * The free tier allows five requests a minute, shared by everyone looking at
 * the page. One window per refresh keeps a cold cache inside that no matter
 * what time of year it is — three separate windows was enough to earn a 429
 * on its own.
 */
const PAGE_SIZE = 100;
/**
 * A busy fortnight can outrun one page; a second is read only when the first
 * says there is one, so a refresh is still one request on most days.
 */
const MAX_PAGES = 2;
/** In season: a few nights back and a week ahead, about one page. */
const IN_SEASON_DAYS_BEHIND = 3;
const IN_SEASON_DAYS_AHEAD = 7;
/**
 * What the view lists: the nights of results up to the latest one and the
 * week of fixtures from the next one, and never fewer than six of either.
 * By nights, because six games was one busy night and the list showed today
 * and nothing after it; at least six, because a finals series plays every
 * other night and three nights of it was its last game alone.
 */
const RESULT_DAYS = 3;
const FIXTURE_DAYS = 7;
const MIN_LISTED = 6;
const DAY_MS = 86_400_000;
/** Out of season: far enough ahead to reach October's opener. */
const OFF_SEASON_AHEAD_DAYS = 130;

type BdlTeam = {
  id: number;
  full_name: string;
  name: string;
  abbreviation: string;
  conference: string;
  city?: string;
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
 * Before October the season under way (or just finished) is the previous one;
 * it flips on Oct 1, the day ESPN's own season starts.
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
    return {
      start: iso(shift(today, -IN_SEASON_DAYS_BEHIND)),
      end: iso(shift(today, IN_SEASON_DAYS_AHEAD)),
    };
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
 * Team colours, the badge behind each logo and the whole badge for a team
 * without one.
 *
 * Without them every badge is the same grey monogram and a scoreboard reads as
 * twelve identical circles. Keyed by the abbreviation the API returns.
 *
 * Houston, Toronto, Utah and New Orleans draw their mark in the club colour
 * itself — red on red, purple on navy, navy on navy — and on that disc it
 * vanished. Theirs is white, the surface ESPN draws its logos for.
 */
const TEAM_COLORS: Record<string, string> = {
  ATL: "#E03A3E", BOS: "#007A33", BKN: "#000000", CHA: "#1D1160",
  CHI: "#CE1141", CLE: "#860038", DAL: "#00538C", DEN: "#0E2240",
  DET: "#C8102E", GSW: "#1D428A", HOU: "#FFFFFF", IND: "#002D62",
  LAC: "#C8102E", LAL: "#552583", MEM: "#5D76A9", MIA: "#98002E",
  MIL: "#00471B", MIN: "#0C2340", NOP: "#FFFFFF", NYK: "#006BB6",
  OKC: "#007AC1", ORL: "#0077C0", PHI: "#006BB6", PHX: "#1D1160",
  POR: "#E03A3E", SAC: "#5A2D81", SAS: "#C4CED4", TOR: "#FFFFFF",
  UTA: "#FFFFFF", WAS: "#002B5C",
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
    logoUrl: logoFor(t.abbreviation),
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
  const games: BdlGame[] = [];
  let cursor: number | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchBdl<{ data: BdlGame[]; meta?: { next_cursor?: number } }>(
      `/games?per_page=${PAGE_SIZE}&start_date=${start}&end_date=${end}` +
        (cursor ? `&cursor=${cursor}` : "")
    );
    games.push(...(res.data ?? []));
    cursor = res.meta?.next_cursor;
    if (!cursor) break;
  }
  return games;
}

/**
 * The last results and the next fixtures, whatever the calendar says, in
 * kickoff order.
 *
 * In season that is a handful of days either side of today. Out of season the
 * nearest games are weeks away — October's opener ahead, a preseason behind
 * that is ESPN's, not balldontlie's — so the trimming happens here rather than
 * in a second request.
 */
function recentAndNext(games: Match[]): Match[] {
  const sorted = [...games].sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  // By state, not by date: on a ten-game night "today's games" filled every
  // recent slot with fixtures that had not tipped off yet.
  const played = sorted.filter((g) => g.status === "ft");
  const ahead = sorted.filter((g) => g.status !== "ft" && g.status !== "cancelled");
  const at = (g: Match): number => Date.parse(g.kickoff);
  const latest = played.at(-1);
  const next = ahead[0];
  const recent = latest ? played.filter((g) => at(latest) - at(g) < RESULT_DAYS * DAY_MS).length : 0;
  const soon = next ? ahead.filter((g) => at(g) - at(next) < FIXTURE_DAYS * DAY_MS).length : 0;
  const kept = new Set([
    ...played.slice(-Math.max(MIN_LISTED, recent)),
    ...ahead.slice(0, Math.max(MIN_LISTED, soon)),
  ]);
  return sorted.filter((g) => kept.has(g));
}

/**
 * When `season`'s first regular-season game starts, while none of its games
 * has been played. Undefined from the opener on, which is what closes the
 * preseason and the champion's line.
 *
 * Only off a page that starts before the season does (`from`, before Oct 1):
 * in season the page is a few nights either side of today, and across the
 * All-Star break every game on it is still to come, so its first was read as
 * the opener in the middle of February.
 */
function tipOffFrom(games: BdlGame[], season: number, from: string): string | undefined {
  if (from >= `${season}-10-01`) return undefined;
  if (games.some((g) => g.status_state === "final" || g.status_state === "in")) return undefined;
  const first = games
    .filter((g) => !g.postseason && !g.postponed)
    .sort((a, b) => Date.parse(a.datetime ?? a.date) - Date.parse(b.datetime ?? b.date))[0];
  // A date-only fallback stays a calendar day; a made-up UTC midnight would
  // print as the day before anywhere west of Greenwich.
  return first ? (first.datetime ?? first.date) : undefined;
}

/**
 * `season`'s champion, off its last postseason game on the page — no request
 * of its own. The page starts at June 1 until the new season is a week old
 * and the finals start in June, so the series is all there; if it is not, the
 * score is left out rather than printed short.
 */
function championFrom(page: BdlGame[], season: number): { champion: NbaChampion; team: BdlTeam } | undefined {
  const postseason = page
    .filter((g) => g.season === season && g.postseason && g.status_state === "final")
    .sort((a, b) => Date.parse(a.datetime ?? a.date) - Date.parse(b.datetime ?? b.date));
  const last = postseason[postseason.length - 1];
  if (!last || last.home_team_score === last.visitor_team_score) return undefined;
  const [winner, loser] =
    last.home_team_score > last.visitor_team_score
      ? [last.home_team, last.visitor_team]
      : [last.visitor_team, last.home_team];
  const sides = new Set([winner.abbreviation, loser.abbreviation]);
  const series = postseason.filter(
    (g) => sides.has(g.home_team.abbreviation) && sides.has(g.visitor_team.abbreviation)
  );
  const wins = series.filter((g) =>
    g.home_team_score > g.visitor_team_score
      ? g.home_team.abbreviation === winner.abbreviation
      : g.visitor_team.abbreviation === winner.abbreviation
  ).length;
  const beaten = loser.city ?? loser.full_name;
  return {
    champion: {
      season: seasonLabel(season),
      teamId: winner.abbreviation,
      summary:
        wins === WINS_TO_ADVANCE
          ? `${winner.full_name}, ${wins}–${series.length - wins} over ${beaten}`
          : `${winner.full_name} over ${beaten}`,
    },
    team: winner,
  };
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

const BDL_TO_ESPN = Object.fromEntries(
  Object.entries(ESPN_TO_BDL).map(([espn, bdl]) => [bdl, espn])
);

/**
 * ESPN's logo for a team, by balldontlie's abbreviation — for the games and
 * the table alike.
 *
 * balldontlie serves no logos. ESPN's files are named after ESPN's own
 * abbreviation, so the six teams it spells its own way ("gs", "no", "ny",
 * "sa", "utah", "wsh") go through `BDL_TO_ESPN`; they are the very files
 * ESPN's standings carry, and all thirty answer. Only for a team in
 * `TEAM_COLORS`: for anybody else, an exhibition side, the guess would 404.
 */
function logoFor(code: string): string | undefined {
  if (!TEAM_COLORS[code]) return undefined;
  const slug = (BDL_TO_ESPN[code] ?? code).toLowerCase();
  return espnImage(`https://a.espncdn.com/i/teamlogos/nba/500/${slug}.png`);
}

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
 *
 * Before the opener ESPN lists all thirty at 0–0 in its own team order, which
 * put New Orleans top of the West in bold. Nobody has played, so there is no
 * table: empty, the view says when it starts.
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
          logoUrl: logoFor(code),
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
  if (standings.every((s) => s.played === 0)) return { standings: [], teams: [] };
  return { standings, teams };
}

/**
 * The table for the season being shown. ESPN names a season by the year it
 * ends in (2025–26 is 2026), and `seasontype=2` keeps the preseason's
 * exhibition records out of it.
 */
async function fetchStandings(season: number): Promise<EspnStandings> {
  const res = await fetch(`${ESPN_STANDINGS_URL}?season=${season + 1}&seasontype=2`, {
    signal: upstreamSignal(),
  });
  if (!res.ok) throw new Error(`espn nba standings ${res.status}`);
  return (await res.json()) as EspnStandings;
}

type EspnHeaderCompetitor = {
  homeAway?: "home" | "away";
  abbreviation?: string;
  displayName?: string;
  name?: string;
  winner?: boolean;
  /** "112"; there from tip-off. */
  score?: string;
  /** This team's series record once the game is over, "3-1". */
  seriesRecord?: string;
  recordStats?: { playoffSeed?: { value?: number } };
};

type EspnHeaderEvent = {
  id?: string;
  date?: string;
  /** "1" preseason, "2" regular season, "3" postseason, "5" play-in. */
  seasonType?: string | number;
  /** "East 1st Round - Game 1", "West Semifinals - Game 4", "NBA Finals - Game 7". */
  note?: string;
  fullStatus?: { type?: { name?: string; state?: "pre" | "in" | "post" } };
  competitors?: EspnHeaderCompetitor[];
};

type EspnScoreboardHeader = {
  sports?: Array<{ leagues?: Array<{ events?: EspnHeaderEvent[] }> }>;
};

type NbaPlayoffs = { rounds: BracketRound[]; teams: Team[] };

const PRESEASON = "1";
const POSTSEASON = "3";
const WINS_TO_ADVANCE = 4;
/**
 * The postseason's dates, wider than any finals: the regular season's last
 * nights and the play-in come back too and are dropped by season type. Even
 * then one page holds it all — ~110 postseason games at most.
 */
const PLAYOFF_DATES = { from: "0410", to: "0731" };
/** Enough for a postseason or a preseason; ESPN answers 500 or more with a 502. */
const HEADER_LIMIT = 300;

function headerEvents(json: EspnScoreboardHeader): EspnHeaderEvent[] {
  return (json.sports ?? []).flatMap((s) => s.leagues ?? []).flatMap((l) => l.events ?? []);
}

/** A side of ESPN's scoreboard as a team, by balldontlie's abbreviation. */
function headerTeam(c: EspnHeaderCompetitor | undefined, code: string): Team {
  return {
    id: code,
    name: c?.displayName ?? code,
    shortName: c?.name ?? code,
    code,
    logoUrl: logoFor(code),
    primaryColor: TEAM_COLORS[code],
  };
}

const PLAYOFF_ROUNDS: ReadonlyArray<{ id: BracketRoundId; label: string; size: number }> = [
  { id: "round-of-16", label: "First Round", size: 8 },
  { id: "quarter-final", label: "Conference Semifinals", size: 4 },
  { id: "semi-final", label: "Conference Finals", size: 2 },
  { id: "final", label: "NBA Finals", size: 1 },
];

const PLAYOFF_NOTE = /^(?:(East|West) (1st Round|Semifinals|Finals)|NBA Finals)\b/;
const ROUND_BY_NOTE: Record<string, number> = { "1st Round": 0, Semifinals: 1, Finals: 2 };

/** A conference's first round top to bottom, by its higher seed: 1v8, 4v5, 3v6, 2v7. */
const FIRST_ROUND_SLOT: Record<number, number> = { 1: 0, 4: 1, 3: 2, 2: 3 };

/**
 * The year whose postseason to read, or null when there cannot be one — and
 * then there is no request at all.
 *
 * Only ever the bracket of the season being shown: by the calendar, from the
 * regular season's last week to the end of June, and beyond that while the
 * page still holds that season's postseason games — all summer, when the
 * finals are the season's last results. On Oct 1 the season shown moves on,
 * and the tab locks until the next play-in. It used to lock once a later
 * season's openers reached the page, which in August hid the bracket while
 * the heading still named the season it belonged to.
 */
function playoffYear(today: Date, page: BdlGame[], season: number): number | null {
  if (page.some((g) => g.season === season && g.postseason)) return season + 1;
  const month = today.getMonth();
  const inWindow = (month === 3 && today.getDate() >= 10) || month === 4 || month === 5;
  return inWindow ? season + 1 : null;
}

async function fetchPlayoffs(year: number): Promise<EspnScoreboardHeader> {
  const dates = `${year}${PLAYOFF_DATES.from}-${year}${PLAYOFF_DATES.to}`;
  const res = await fetch(
    `${ESPN_SCOREBOARD_URL}?sport=basketball&league=nba&dates=${dates}&limit=${HEADER_LIMIT}`,
    { signal: upstreamSignal() }
  );
  if (!res.ok) throw new Error(`espn nba scoreboard ${res.status}`);
  return (await res.json()) as EspnScoreboardHeader;
}

type NbaPreseason = { games: Match[]; teams: Team[] };

const NO_PRESEASON: NbaPreseason = { games: [], teams: [] };

/**
 * The preseason so far, from Oct 1 through tomorrow (a late tip-off is
 * tomorrow in UTC). balldontlie's free tier has none of it. Never more than a
 * few weeks: ESPN answers a span much over five months with nothing at all.
 */
async function fetchPreseason(season: number, through: Date): Promise<EspnScoreboardHeader> {
  const dates = `${season}1001-${iso(through).replace(/-/g, "")}`;
  const res = await fetch(
    `${ESPN_SCOREBOARD_URL}?sport=basketball&league=nba&dates=${dates}&limit=${HEADER_LIMIT}`,
    { signal: upstreamSignal() }
  );
  if (!res.ok) throw new Error(`espn nba preseason ${res.status}`);
  return (await res.json()) as EspnScoreboardHeader;
}

function preseasonStatus(type: { name?: string; state?: string } | undefined): MatchStatus {
  if (type?.name === "STATUS_CANCELED") return "cancelled";
  if (type?.name === "STATUS_POSTPONED") return "postponed";
  if (type?.state === "post") return "ft";
  if (type?.state === "in") return "live";
  return "scheduled";
}

function headerScore(c: EspnHeaderCompetitor | undefined): number | null {
  const score = Number(c?.score);
  return c?.score !== undefined && Number.isFinite(score) ? score : null;
}

/**
 * ESPN's preseason games as matches. The rest of the range — the opener when
 * "tomorrow" reaches it — is dropped by season type. A side that is not an
 * NBA team (the London Lions) has no logo to guess and keeps a monogram.
 */
function preseasonFrom(json: EspnScoreboardHeader): NbaPreseason {
  const games: Match[] = [];
  const teams = new Map<string, Team>();
  for (const event of headerEvents(json)) {
    if (String(event.seasonType) !== PRESEASON || !event.id || !event.date) continue;
    const home = event.competitors?.find((c) => c.homeAway === "home");
    const away = event.competitors?.find((c) => c.homeAway === "away");
    const homeId = playoffTeamId(home);
    const awayId = playoffTeamId(away);
    if (!homeId || !awayId) continue;
    if (!teams.has(homeId)) teams.set(homeId, headerTeam(home, homeId));
    if (!teams.has(awayId)) teams.set(awayId, headerTeam(away, awayId));
    const status = preseasonStatus(event.fullStatus?.type);
    const played = status === "ft" || status === "live";
    games.push({
      id: `espn-${event.id}`,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeScore: played ? headerScore(home) : null,
      awayScore: played ? headerScore(away) : null,
      kickoff: event.date,
      status,
      stageLabel: "Preseason",
    });
  }
  return { games, teams: [...teams.values()] };
}

type PlayoffSide = {
  teamId: string | null;
  seed: number | null;
  won: boolean;
  seriesWins: number | null;
};

type PlayoffGame = {
  round: number;
  conference: NbaConference | null;
  date: string;
  played: boolean;
  canceled: boolean;
  /** Home, then away. */
  sides: [PlayoffSide, PlayoffSide];
};

type Series = {
  round: number;
  conference: NbaConference | null;
  /** In the order they first appear: game one's home side first. */
  teamIds: string[];
  seeds: Map<string, number>;
  games: PlayoffGame[];
};

type Slot = {
  series?: Series;
  /** Its winner may be written into the next round before ESPN draws it. */
  trusted: boolean;
};

type Tie = {
  match: BracketMatch;
  /** Everyone in the tie, to find which later tie its winner went on to. */
  teamIds: string[];
  trusted: boolean;
};

function stageOf(note: string | undefined): Pick<PlayoffGame, "round" | "conference"> | null {
  const m = note?.match(PLAYOFF_NOTE);
  if (!m) return null;
  if (!m[1]) return { round: 3, conference: null };
  return { round: ROUND_BY_NOTE[m[2]], conference: m[1] === "East" ? "east" : "west" };
}

/** An undecided slot comes back as a "TBD" team. */
function playoffTeamId(c: EspnHeaderCompetitor | undefined): string | null {
  const code = c?.abbreviation;
  if (!code || code === "TBD") return null;
  return ESPN_TO_BDL[code] ?? code;
}

function sideFrom(c: EspnHeaderCompetitor | undefined): PlayoffSide {
  const seed = c?.recordStats?.playoffSeed?.value;
  const record = c?.seriesRecord?.match(/^(\d+)-\d+$/);
  return {
    teamId: playoffTeamId(c),
    seed: typeof seed === "number" && seed > 0 ? seed : null,
    won: c?.winner === true,
    seriesWins: record ? Number(record[1]) : null,
  };
}

/**
 * One game per series it belongs to: a team plays one series a round, so a
 * game joins whichever series of its round already has either team in it.
 */
function seriesFrom(games: PlayoffGame[]): Series[] {
  const all: Series[] = [];
  for (const game of [...games].sort((a, b) => a.date.localeCompare(b.date))) {
    const known = game.sides.flatMap((s) => (s.teamId ? [s.teamId] : []));
    if (known.length === 0) continue;
    let series = all.find(
      (s) =>
        s.round === game.round &&
        s.conference === game.conference &&
        known.some((id) => s.teamIds.includes(id))
    );
    if (!series) {
      series = { round: game.round, conference: game.conference, teamIds: [], seeds: new Map(), games: [] };
      all.push(series);
    }
    series.games.push(game);
    for (const side of game.sides) {
      if (!side.teamId) continue;
      if (!series.teamIds.includes(side.teamId)) series.teamIds.push(side.teamId);
      if (side.seed !== null) series.seeds.set(side.teamId, side.seed);
    }
  }
  return all;
}

/** ESPN's own count, off the last game played — it already includes that game. */
function recordedWins(game: PlayoffGame | undefined): Map<string, number> | null {
  if (!game) return null;
  const wins = new Map<string, number>();
  for (const side of game.sides) {
    if (!side.teamId || side.seriesWins === null) return null;
    wins.set(side.teamId, side.seriesWins);
  }
  return wins;
}

function countedWins(teamIds: string[], played: PlayoffGame[]): Map<string, number> {
  const wins = new Map(teamIds.map((id) => [id, 0]));
  for (const game of played) {
    const winner = game.sides.find((s) => s.won)?.teamId;
    if (winner) wins.set(winner, (wins.get(winner) ?? 0) + 1);
  }
  return wins;
}

/** "nba-round-of-16-east-0" … "nba-final": a slot keeps its id while its tie fills in. */
function tieId(round: number, k: number): string {
  const { id, size } = PLAYOFF_ROUNDS[round];
  if (size === 1) return `nba-${id}`;
  const half = size / 2;
  return `nba-${id}-${k < half ? "east" : "west"}-${k % half}`;
}

/**
 * Where each series of a round sits. The first round goes by its higher seed;
 * every later one by the earlier ties its teams came out of. A series that
 * fits neither way takes the first free slot of its half.
 *
 * Only a first-round series placed by its seed is trusted to carry its winner
 * on: placed blind, it may sit beside the wrong neighbour. Later on that
 * cannot happen — a conference has two semifinals and one final.
 */
function placeSeries(round: number, list: Series[], previous: Tie[]): Slot[] {
  const { size } = PLAYOFF_ROUNDS[round];
  const slots: Slot[] = Array.from({ length: size }, () => ({ trusted: round > 0 }));
  const half = (conference: NbaConference | null): number[] => {
    if (size === 1) return [0];
    const start = conference === "west" ? size / 2 : 0;
    return Array.from({ length: size / 2 }, (_, i) => start + i);
  };
  const preferred = (series: Series): number | undefined => {
    const own = half(series.conference);
    if (round === 0) {
      const seed = Math.min(...series.teamIds.map((id) => series.seeds.get(id) ?? Infinity));
      const k = FIRST_ROUND_SLOT[seed];
      return k === undefined ? undefined : own[k];
    }
    return own.find((k) =>
      [previous[2 * k], previous[2 * k + 1]].some((feeder) =>
        feeder?.teamIds.some((id) => series.teamIds.includes(id))
      )
    );
  };

  const loose: Series[] = [];
  for (const series of list) {
    const k = preferred(series);
    if (k !== undefined && !slots[k].series) slots[k] = { series, trusted: true };
    else loose.push(series);
  }
  for (const series of loose) {
    const k = half(series.conference).find((i) => !slots[i].series);
    if (k !== undefined) slots[k] = { series, trusted: round > 0 };
  }
  return slots;
}

/**
 * One series as a tie, its score in wins.
 *
 * The team that came out of the upper feeder is "home", so the tree keeps
 * its shape — East above West, 1v8 above 4v5 — and a tie ESPN has not drawn
 * yet already names the winners it is waiting for. In the first round, with
 * no feeders, that is the higher seed.
 */
function tieFrom(id: string, slot: Slot, upper: Tie | undefined, lower: Tie | undefined): Tie {
  const { series } = slot;
  const teamIds = [...(series?.teamIds ?? [])].sort(
    (a, b) => (series?.seeds.get(a) ?? Infinity) - (series?.seeds.get(b) ?? Infinity)
  );
  const carried = (feeder: Tie | undefined): string | null =>
    feeder?.trusted ? (feeder.match.winnerTeamId ?? null) : null;
  const fromUpper = teamIds.find((t) => upper?.teamIds.includes(t));
  const fromLower = teamIds.find((t) => lower?.teamIds.includes(t));
  const rest = teamIds.filter((t) => t !== fromUpper && t !== fromLower);
  const home = fromUpper ?? rest.shift() ?? carried(upper);
  const away = fromLower ?? rest.shift() ?? carried(lower);

  const games = series?.games ?? [];
  const played = games.filter((g) => g.played && !g.canceled);
  const last = played[played.length - 1];
  const wins = recordedWins(last) ?? countedWins(teamIds, played);
  const winner = [...wins].find(([, n]) => n >= WINS_TO_ADVANCE)?.[0] ?? null;
  const next = games.find((g) => !g.played && !g.canceled);
  const date = winner ? last?.date : (next ?? last)?.date;
  const score = (team: string | null): number | null =>
    played.length > 0 && team ? (wins.get(team) ?? 0) : null;

  return {
    match: {
      id,
      homeTeamId: home,
      awayTeamId: away,
      homeScore: score(home),
      awayScore: score(away),
      winnerTeamId: winner,
      ...(date ? { date } : {}),
      bestOf: 7,
    },
    teamIds: teamIds.length > 0 ? teamIds : [home, away].filter((t): t is string => t !== null),
    trusted: slot.trusted,
  };
}

/**
 * The postseason as a bracket of best-of-seven series, plus every team in it.
 *
 * Each round is ordered the way `KnockoutBracket` pairs them: the East half
 * then the West, the two ties feeding a later one side by side. Once the
 * first round is known so is the rest of the tree, so the later rounds are
 * there from the start, TBD until their teams are. No postseason game, no
 * rounds. The play-in is a season type of its own and never part of it.
 */
function playoffsFrom(json: EspnScoreboardHeader): NbaPlayoffs {
  const games: PlayoffGame[] = [];
  const teams = new Map<string, Team>();
  for (const event of headerEvents(json)) {
    if (String(event.seasonType) !== POSTSEASON || !event.date) continue;
    const stage = stageOf(event.note);
    if (!stage) continue;
    const home = event.competitors?.find((c) => c.homeAway === "home");
    const away = event.competitors?.find((c) => c.homeAway === "away");
    for (const c of [home, away]) {
      const code = playoffTeamId(c);
      if (code && !teams.has(code)) teams.set(code, headerTeam(c, code));
    }
    const status = event.fullStatus?.type;
    games.push({
      ...stage,
      date: event.date,
      played: status?.state === "post",
      canceled: status?.name === "STATUS_CANCELED",
      sides: [sideFrom(home), sideFrom(away)],
    });
  }

  const series = seriesFrom(games);
  if (series.length === 0) return { rounds: [], teams: [] };

  const first = Math.min(...series.map((s) => s.round));
  const rounds: BracketRound[] = [];
  let previous: Tie[] = [];
  PLAYOFF_ROUNDS.forEach((round, r) => {
    if (r < first) return;
    const ties = placeSeries(r, series.filter((s) => s.round === r), previous).map((slot, k) =>
      tieFrom(tieId(r, k), slot, previous[2 * k], previous[2 * k + 1])
    );
    rounds.push({ id: round.id, label: round.label, matches: ties.map((t) => t.match) });
    previous = ties;
  });
  return { rounds, teams: [...teams.values()] };
}

/**
 * balldontlie's games and ESPN's table for the season shown: the part of the
 * feed with one cache entry. The bracket and the preseason are joined in by
 * `getNbaData`, each from a cache of its own.
 */
type NbaFeed = {
  season: number;
  /** The season's games, untrimmed: the preseason is merged in before trimming. */
  games: Match[];
  teams: Team[];
  standings: NbaStanding[];
  champion?: NbaChampion;
  tipOff?: string;
  /** The year whose bracket to read, or null when there cannot be one. */
  playoffYear: number | null;
};

async function fetchNbaFromApi(today: Date): Promise<NbaFeed> {
  const season = currentSeason(today);
  const { start, end } = gameWindow(today);
  const page = await gamesIn(start, end);

  if (page.length === 0) throw new Error("balldontlie returned no games");

  // Out of season the page holds two seasons, June's finals and October's
  // openers, and listing both put the new season's openers under the old
  // one's heading and table. Everything shown is one season's: from Oct 1 the
  // new one, until then the old one, which from mid-June is the finals alone.
  const own = page.filter((g) => g.season === season);
  const tipOff = tipOffFrom(own, season, start);
  const crowned = tipOff ? championFrom(page, season - 1) : undefined;

  // The table is an extra, not the feed: if ESPN is down the games still
  // refresh and the table drops away rather than being invented.
  const table = await fetchStandings(season)
    .then(standingsFrom)
    .catch((error) => {
      console.warn("espn nba standings unavailable:", error);
      return { standings: [] as NbaStanding[], teams: [] as Team[] };
    });

  const teams = new Map<string, Team>();
  for (const game of own) {
    for (const t of [game.home_team, game.visitor_team]) teams.set(t.abbreviation, teamFrom(t));
  }
  if (crowned) teams.set(crowned.team.abbreviation, teamFrom(crowned.team));
  for (const team of table.teams) if (!teams.has(team.id)) teams.set(team.id, team);

  return {
    season,
    games: own.map(matchFrom),
    teams: [...teams.values()],
    standings: table.standings,
    ...(crowned ? { champion: crowned.champion } : {}),
    ...(tipOff ? { tipOff } : {}),
    playoffYear: playoffYear(today, page, season),
  };
}

/** The feed with its extras joined in, trimmed to what the view lists. */
function nbaDataFrom(feed: NbaFeed, bracket: NbaPlayoffs, preseason: NbaPreseason): NbaData {
  const games = recentAndNext([...feed.games, ...preseason.games]);
  const known = new Map<string, Team>(preseason.teams.map((t) => [t.id, t]));
  for (const team of feed.teams) known.set(team.id, team);
  const byTeam = new Map<string, Team>();
  for (const id of [...games.flatMap((g) => [g.homeTeamId, g.awayTeamId]), feed.champion?.teamId]) {
    const team = id ? known.get(id) : undefined;
    if (team && !byTeam.has(team.id)) byTeam.set(team.id, team);
  }
  for (const team of [...feed.teams.filter((t) => feed.standings.some((s) => s.teamId === t.id)), ...bracket.teams]) {
    if (!byTeam.has(team.id)) byTeam.set(team.id, team);
  }

  return {
    season: seasonLabel(feed.season),
    teams: [...byTeam.values()],
    games,
    standings: feed.standings,
    playoffs: bracket.rounds,
    ...(feed.champion ? { champion: feed.champion } : {}),
    ...(feed.tipOff ? { tipOff: feed.tipOff } : {}),
  };
}

const NO_PLAYOFFS: NbaPlayoffs = { rounds: [], teams: [] };

/**
 * The bracket in a cache entry of its own, keyed by its year. Caught inside
 * the games' feed, one failed ESPN call was cached as `[]` for five minutes,
 * and the view read that as "no postseason yet" and locked the tab in the
 * middle of the playoffs. Here a failed refresh keeps the last good bracket.
 */
const getNbaPlayoffs = cachedFeed(
  "ESPN NBA playoffs",
  async (year: number): Promise<NbaPlayoffs> => playoffsFrom(await fetchPlayoffs(year)),
  (): NbaPlayoffs => NO_PLAYOFFS,
  ["nba-playoffs"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:nba"] }
);

/**
 * The preseason, keyed by its season alone so a failed refresh keeps the last
 * good answer from one day to the next; each refresh reads through tomorrow.
 */
const getNbaPreseason = cachedFeed(
  "ESPN NBA preseason",
  async (season: number): Promise<NbaPreseason> =>
    preseasonFrom(await fetchPreseason(season, shift(new Date(), 1))),
  (): NbaPreseason => NO_PRESEASON,
  ["nba-preseason"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:nba"] }
);

const getNbaFeed = cachedFeed(
  "balldontlie NBA",
  () => fetchNbaFromApi(new Date()),
  (): NbaFeed | null => null,
  ["nba-feed"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:nba"] }
);

/**
 * Live NBA games, falling back to the mock fixture when there is no last good
 * answer to serve.
 *
 * The bracket and the preseason are read out here, never inside the feed's
 * cached function: Next bypasses the read of an `unstable_cache` nested in
 * another, so their own entries would never serve and a failed call would be
 * stored with the games, empty, for five minutes. The preseason costs a
 * request only between Oct 1 and the opener. Side by side, so two slow
 * answers cost one timeout, not two.
 */
export async function getNbaData(): Promise<NbaData> {
  const feed = await getNbaFeed();
  if (!feed) return NBA_DATA;
  const [bracket, preseason] = await Promise.all([
    feed.playoffYear === null ? Promise.resolve(NO_PLAYOFFS) : getNbaPlayoffs(feed.playoffYear),
    feed.tipOff ? getNbaPreseason(feed.season) : Promise.resolve(NO_PRESEASON),
  ]);
  return nbaDataFrom(feed, bracket, preseason);
}

/** Pure helpers, exported for their tests — nothing here touches the network. */
export const __testing = {
  currentSeason,
  seasonLabel,
  recentAndNext,
  statusFrom,
  gameWindow,
  standingsFrom,
  teamFrom,
  logoFor,
  playoffYear,
  playoffsFrom,
  tipOffFrom,
  championFrom,
  preseasonFrom,
};
