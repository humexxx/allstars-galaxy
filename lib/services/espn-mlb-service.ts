import "server-only";

import { MLB_DATA } from "@/lib/data/sports/mlb";
import { espnImage } from "@/lib/sports/espn-images";
import { orderMatchesForDisplay } from "@/lib/sports/match-order";
import { ordinal } from "@/lib/utils/format";
import type {
  BracketRound,
  Match,
  MatchStatus,
  MlbData,
  MlbDivision,
  MlbLeague,
  MlbStanding,
  Team,
} from "@/types/sports";
import {
  fetchHeader,
  fetchHeaderDays,
  groupSeries,
  headerMatch,
  headerNote,
  isoDay,
  seriesBracket,
  shiftDay,
  type HeaderEvent,
  type HeaderLeague,
  type HeaderStatus,
  type SeriesGame,
  type SeriesRound,
} from "./espn-scoreboard";
import {
  fetchEspnJson,
  standingStat,
  standingValue,
  teamColour,
  teamsListFrom,
  type EspnStandings,
  type EspnTeam,
  type EspnTeams,
} from "./espn-site";
import { cachedFeed, settledOrNull } from "./upstream";

const LEAGUE: HeaderLeague = { sport: "baseball", league: "mlb" };
/** All thirty clubs with their colours: the table carries none, a day's games only the teams playing. */
const TEAMS_URL = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams";
/** `level=3` nests the table league → division, which is the only place the division is named. */
const STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings?level=3";
const REVALIDATE_SECONDS = 300;

/**
 * The days listed: two weeks of results up to today and two of what is next.
 * The list opens on the latest results with the earlier days behind its clock.
 */
const DAYS_BEHIND = 14;
const DAYS_AHEAD = 13;

/**
 * The postseason's dates, read in one request. The Wild Card opens around
 * Oct 1 and the World Series is over in early November. It starts only a few
 * days early: the regular season's last days are a full slate each, and the
 * scores bar fails a range that holds more than ~215 games.
 */
const POSTSEASON_DATES = { from: "09-26", to: "11-15" };
/** When last season's bracket gives way: spring training opens the next one mid-February. */
const SPRING_TRAINING = "02-15";

const SPRING = "1";
const POSTSEASON = "3";

/** The All-Star Game's sides, "AL" and "NL": neither is a club. */
const ALL_STAR_IDS = new Set(["31", "32"]);

/** MLB.TV streams nearly every game out of market, so it never says where one is on. */
const EVERY_GAME_CHANNELS = ["MLB.TV"];

/**
 * Clubs whose logo is drawn in their own colour: on a disc of it the mark
 * vanished, the Dodgers', the Yankees' and the Phillies' entirely. They take
 * white, as the NFL's do.
 */
const LOGO_ON_WHITE = new Set(["CIN", "DET", "KC", "LAD", "NYY", "PHI", "SD", "STL", "TB", "WSH"]);

const DIVISIONS: Record<string, MlbDivision> = {
  ALE: "al-east",
  ALC: "al-central",
  ALW: "al-west",
  NLE: "nl-east",
  NLC: "nl-central",
  NLW: "nl-west",
};

/** Each league's Wild Card, Division Series and LCS, then the World Series. */
const ROUNDS: readonly SeriesRound[] = [
  { id: "round-of-16", label: "Wild Card", size: 4, bestOf: 3 },
  { id: "quarter-final", label: "Division Series", size: 4, bestOf: 5 },
  { id: "semi-final", label: "Championship Series", size: 2, bestOf: 7 },
  { id: "final", label: "World Series", size: 1, bestOf: 7 },
];

/** "ALWC - Game 3", "NLDS - Game 5", "ALCS - Game 4 Rain - Makeup on Oct 18", "World Series - Game 6 If Necessary". */
const ROUND_NOTE = /^(?:(AL|NL)(WC|DS|CS)|World Series)\b/;
const ROUND_BY_NOTE: Record<string, number> = { WC: 0, DS: 1, CS: 2 };
const ROUND_BY_TYPE: Record<string, number> = { WILDCARD: 0, DIV: 1, CONF: 2, FINAL: 3 };
const GAME_NOTE = /^(.+?) - Game (\d+)(.*)$/;
/** The two series whose short names fans do not use. */
const ROUND_NAMES: Record<string, string> = { ALWC: "AL Wild Card", NLWC: "NL Wild Card" };

function colourOf(code: string, color: string | undefined): string | undefined {
  return teamColour(code, color, LOGO_ON_WHITE);
}

/** A club from the teams list or the table. */
function teamFrom(t: EspnTeam | undefined): Team | null {
  const code = t?.abbreviation;
  if (!code || code === "TBD") return null;
  return {
    id: code.toLowerCase(),
    name: t.displayName ?? code,
    shortName: t.shortDisplayName ?? t.displayName ?? code,
    code,
    logoUrl: espnImage(t.logos?.[0]?.href),
    primaryColor: colourOf(code, t.color),
  };
}

function teamsFrom(json: EspnTeams): Team[] {
  return teamsListFrom(json, teamFrom);
}

const HALF_INNINGS: Record<string, { short: string; spoken: string }> = {
  top: { short: "Top", spoken: "Top" },
  bot: { short: "Bot", spoken: "Bottom" },
  bottom: { short: "Bot", spoken: "Bottom" },
  mid: { short: "Mid", spoken: "Middle" },
  middle: { short: "Mid", spoken: "Middle" },
  end: { short: "End", spoken: "End" },
};

/**
 * Where a game stands in baseball's words: live, the half-inning ("Top 7th"),
 * over, the innings when they were not nine ("F/10"). A nine-inning final
 * keeps the plain FT, and a fixture its date.
 */
function statusText(status: HeaderStatus | undefined, state: MatchStatus): Match["statusText"] {
  const type = status?.type;
  if (state === "live") {
    if (type?.name === "STATUS_RAIN_DELAY") return { short: "Delay", spoken: "Rain delay" };
    if (type?.name === "STATUS_DELAYED") return { short: "Delay", spoken: "Delayed" };
    const shown = /^(Top|Bot|Bottom|Mid|Middle|End) (\d+)/i.exec(type?.shortDetail ?? "");
    const half = HALF_INNINGS[(status?.periodPrefix ?? shown?.[1] ?? "").toLowerCase()];
    const inning = status?.period || Number(shown?.[2]);
    if (!half || !inning) return undefined;
    return { short: `${half.short} ${ordinal(inning)}`, spoken: `${half.spoken} of the ${ordinal(inning)} inning` };
  }
  if (state === "ft") {
    const innings = Number(/^Final\/(\d+)$/.exec(type?.detail ?? type?.shortDetail ?? "")?.[1] ?? status?.period);
    if (innings > 0 && innings !== 9) {
      return { short: `F/${innings}`, spoken: `Final after ${innings} innings` };
    }
  }
  return undefined;
}

/**
 * "World Series · Game 3" in the postseason, "Game 6, if necessary" for one
 * that may not be played; a rainout's makeup note goes. The regular season's
 * notes are noise — doubleheaders, makeups, specials — so it has none.
 */
function stageLabel(event: HeaderEvent): string | undefined {
  const seasonType = String(event.seasonType);
  if (seasonType === SPRING) return "Spring Training";
  if (seasonType !== POSTSEASON) return undefined;
  const note = headerNote(event);
  const m = note ? GAME_NOTE.exec(note) : null;
  if (!m) return note?.replaceAll(" - ", " · ");
  const [, round, game, rest] = m;
  const maybe = /if necessary/i.test(rest) ? ", if necessary" : "";
  return `${ROUND_NAMES[round] ?? round} · Game ${game}${maybe}`;
}

function isAllStarGame(event: HeaderEvent): boolean {
  return (event.competitors ?? []).some(
    (c) => ALL_STAR_IDS.has(c.id ?? "") || c.abbreviation === "AL" || c.abbreviation === "NL"
  );
}

type MlbGame = { match: Match; teams: Team[]; winnerTeamId: string | null };

function gameFrom(event: HeaderEvent): MlbGame | null {
  if (isAllStarGame(event)) return null;
  const mapped = headerMatch(event, { exclude: EVERY_GAME_CHANNELS });
  if (!mapped) return null;
  const stage = stageLabel(event);
  const text = statusText(event.fullStatus, mapped.match.status);
  return {
    match: {
      ...mapped.match,
      ...(stage ? { stageLabel: stage } : {}),
      ...(text ? { statusText: text } : {}),
    },
    teams: mapped.teams.map((t) => ({ ...t, primaryColor: colourOf(t.code, t.primaryColor) })),
    winnerTeamId: mapped.winnerTeamId,
  };
}

/** Its round and which league's half of the draw, from the note ("ALDS - Game 5"), or the round alone from its type. */
function roundOf(event: HeaderEvent): Pick<SeriesGame, "round" | "half"> | null {
  const m = ROUND_NOTE.exec(headerNote(event) ?? "");
  if (m) return m[1] ? { round: ROUND_BY_NOTE[m[2]], half: m[1] === "AL" ? 0 : 1 } : { round: 3, half: null };
  const round = ROUND_BY_TYPE[event.competitionType?.abbreviation ?? ""];
  return round === undefined ? null : { round, half: null };
}

/**
 * The postseason as a bracket of series, the AL half above the NL's: a tie
 * per series, its score in wins. ESPN has no bracket for baseball, so it is
 * built from the games.
 */
function playoffsFrom(events: HeaderEvent[]): { rounds: BracketRound[]; teams: Team[] } {
  const games: SeriesGame[] = [];
  const teams: Team[] = [];
  for (const event of events) {
    if (String(event.seasonType) !== POSTSEASON) continue;
    const stage = roundOf(event);
    const game = stage && gameFrom(event);
    if (!stage || !game) continue;
    teams.push(...game.teams);
    games.push({
      ...stage,
      homeTeamId: game.match.homeTeamId,
      awayTeamId: game.match.awayTeamId,
      date: game.match.kickoff,
      status: game.match.status,
      winnerTeamId: game.winnerTeamId,
    });
  }
  return { rounds: seriesBracket(groupSeries(games), ROUNDS, "mlb"), teams };
}

/**
 * Both leagues, each team at its league seed.
 *
 * ESPN sends a division's teams in no order (the AL East's leader last), and
 * the seed (1–15) is its own tiebreak-aware ranking of the league; a league
 * whose seeds are not out yet falls back to winning percentage.
 */
function standingsFrom(json: EspnStandings): { standings: MlbStanding[]; teams: Team[]; season?: number } {
  const standings: MlbStanding[] = [];
  const teams: Team[] = [];
  let season: number | undefined;
  for (const leagueGroup of json.children ?? []) {
    const league = leagueGroup.abbreviation?.toLowerCase();
    if (league !== "al" && league !== "nl") continue;
    const rows: Array<{ row: MlbStanding; seed: number }> = [];
    for (const divisionGroup of leagueGroup.children ?? []) {
      const division = DIVISIONS[divisionGroup.abbreviation?.toUpperCase() ?? ""];
      if (!division) continue;
      season ??= divisionGroup.standings?.season;
      for (const entry of divisionGroup.standings?.entries ?? []) {
        const team = teamFrom(entry.team);
        if (!team) continue;
        teams.push(team);
        rows.push({
          seed: standingValue(entry, "playoffSeed"),
          row: {
            position: 0,
            teamId: team.id,
            league: league as MlbLeague,
            division,
            wins: standingValue(entry, "wins"),
            losses: standingValue(entry, "losses"),
            pct: standingValue(entry, "winPercent"),
            gamesBehind: (standingStat(entry, "divisionGamesBehind") ?? standingStat(entry, "gamesBehind"))?.value ?? 0,
            streak: standingStat(entry, "streak")?.display || "—",
          },
        });
      }
    }
    const seeded = rows.every((r) => r.seed > 0);
    rows
      .sort((a, b) => (seeded ? a.seed - b.seed : b.row.pct - a.row.pct || b.row.wins - a.row.wins))
      .forEach(({ row }, i) => standings.push({ ...row, position: i + 1 }));
  }
  return { standings, teams, season };
}

/** The season whose bracket is shown on `today`, from the Wild Card's week to spring training; null in between. */
function postseasonYear(today: Date): number | null {
  const year = today.getUTCFullYear();
  const day = isoDay(today).slice(5);
  if (day >= POSTSEASON_DATES.from) return year;
  if (day < SPRING_TRAINING) return year - 1;
  return null;
}

type MlbFeeds = {
  teams: EspnTeams | null;
  standings: EspnStandings | null;
  /** The days listed, raw. */
  days: HeaderEvent[];
  /** The postseason's games, raw; none outside it. */
  postseason: HeaderEvent[];
};

/**
 * The feed as the view reads it, mapped down from ESPN's raw answers before
 * anything is cached. Throws when there are neither games nor a table, for
 * the hand-written season to take over.
 */
function mlbDataFrom(feeds: MlbFeeds, today: Date): MlbData {
  const byId = new Map<string, Team>();
  const add = (team: Team): void => {
    if (!byId.has(team.id)) byId.set(team.id, team);
  };
  if (feeds.teams) teamsFrom(feeds.teams).forEach(add);

  const games = new Map<string, Match>();
  let season: number | undefined;
  for (const event of feeds.days) {
    const game = gameFrom(event);
    if (!game || games.has(game.match.id)) continue;
    games.set(game.match.id, game.match);
    game.teams.forEach(add);
    if (typeof event.season === "number") season = Math.max(season ?? 0, event.season);
  }

  const table = feeds.standings ? standingsFrom(feeds.standings) : { standings: [], teams: [] };
  table.teams.forEach(add);
  if (games.size === 0 && table.standings.length === 0) {
    throw new Error("espn mlb returned neither games nor standings");
  }

  const playoffs = playoffsFrom(feeds.postseason);
  playoffs.teams.forEach(add);

  return {
    season: season ?? table.season ?? postseasonYear(today) ?? today.getUTCFullYear(),
    teams: [...byId.values()],
    games: orderMatchesForDisplay(
      [...games.values()],
      (m) => m.kickoff,
      (m) => m.status
    ),
    standings: table.standings,
    playoffs: playoffs.rounds,
  };
}

/**
 * The days around today, both leagues' tables and, from the Wild Card to
 * spring training, the postseason — from ESPN's public API, no key. The
 * teams list and the table fail on their own: the view does without them.
 * The scores bar does not, as an answer without its games or its bracket
 * would replace the last good one in the cache.
 */
async function fetchMlbFromApi(): Promise<MlbData> {
  const now = new Date();
  const today = isoDay(now);
  const year = postseasonYear(now);
  const [teams, standings, days, postseason] = await Promise.allSettled([
    fetchEspnJson<EspnTeams>("espn mlb", TEAMS_URL),
    fetchEspnJson<EspnStandings>("espn mlb", STANDINGS_URL),
    fetchHeaderDays(LEAGUE, shiftDay(today, -DAYS_BEHIND), shiftDay(today, DAYS_AHEAD)),
    year === null
      ? Promise.resolve([])
      : fetchHeader(LEAGUE, `${year}-${POSTSEASON_DATES.from}`, `${year}-${POSTSEASON_DATES.to}`),
  ]);
  if (days.status === "rejected") throw days.reason;
  if (postseason.status === "rejected") throw postseason.reason;
  return mlbDataFrom(
    {
      teams: settledOrNull(teams),
      standings: settledOrNull(standings),
      days: days.value,
      postseason: postseason.value,
    },
    now
  );
}

export const getMlbData = cachedFeed("espn mlb", fetchMlbFromApi, () => MLB_DATA, ["espn:mlb-data"], {
  revalidate: REVALIDATE_SECONDS,
  tags: ["sports:mlb"],
});

/** Pure mappers, exported for their tests — nothing here touches the network. */
export const __testing = {
  gameFrom,
  mlbDataFrom,
  playoffsFrom,
  postseasonYear,
  stageLabel,
  standingsFrom,
  statusText,
  teamsFrom,
};
