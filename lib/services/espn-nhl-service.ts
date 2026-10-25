import "server-only";

import { NHL_DATA } from "@/lib/data/sports/nhl";
import { espnImage } from "@/lib/sports/espn-images";
import { orderMatchesForDisplay } from "@/lib/sports/match-order";
import { ordinal } from "@/lib/utils/format";
import type {
  BracketMatch,
  BracketRound,
  Match,
  MatchStatus,
  NhlConference,
  NhlData,
  NhlDivision,
  NhlStanding,
  Team,
} from "@/types/sports";
import {
  fetchHeader,
  fetchHeaderDays,
  groupSeries,
  headerMatch,
  headerNote,
  isoDay,
  seriesTie,
  shiftDay,
  type HeaderCompetitor,
  type HeaderEvent,
  type HeaderLeague,
  type HeaderStatus,
  type Series,
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

const LEAGUE: HeaderLeague = { sport: "hockey", league: "nhl" };
/** All 32 clubs with their colours: the table carries none, a day's games only the teams playing. */
const TEAMS_URL = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams";
/**
 * `level=3` nests the table conference → division, the only place the
 * division is named. Without `seasontype=2` a spring read can come back with
 * playoff records.
 */
const STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/hockey/nhl/standings?level=3&seasontype=2";
const REVALIDATE_SECONDS = 300;

/**
 * The days listed: two weeks of results up to today and two of what is
 * next, four requests of a week. The list opens on the latest results with
 * the earlier days behind its clock.
 */
const DAYS_BEHIND = 14;
const DAYS_AHEAD = 13;

/**
 * The postseason's dates: it opens mid-April and the Final is over by late
 * June. The scores bar takes at most two months a request, so it is read in
 * two spans.
 */
const POSTSEASON_SPANS = [
  { from: "04-11", to: "05-31" },
  { from: "06-01", to: "06-30" },
];
/** When last season's bracket gives way: the preseason opens mid-September. */
const PRESEASON_OPENS = "09-15";

const PRESEASON = "1";
const POSTSEASON = "3";

/** ESPN+ streams nearly every game out of market, so it never says where one is on. */
const EVERY_GAME_CHANNELS = ["ESPN+"];

/** Utah's code in `/teams`; everything else ESPN sends calls it UTA. */
const CODE_ALIASES: Record<string, string> = { UTAH: "UTA" };

/** The Lightning's bolt is drawn in their own blue: on a disc of it only the outline showed. */
const LOGO_ON_WHITE = new Set(["TB"]);

const CONFERENCES: Record<string, NhlConference> = { EAST: "east", WEST: "west" };
const DIVISIONS: Record<string, NhlDivision> = {
  ATL: "atlantic",
  MET: "metropolitan",
  CEN: "central",
  PAC: "pacific",
};
/** The scores bar names a team's division by ESPN's group id. */
const DIVISION_BY_GROUP: Record<string, NhlDivision> = {
  "32": "atlantic",
  "33": "metropolitan",
  "31": "central",
  "30": "pacific",
};
const CONFERENCE_OF: Record<NhlDivision, NhlConference> = {
  atlantic: "east",
  metropolitan: "east",
  central: "west",
  pacific: "west",
};
/** Each division's place in its conference's half of the draw: the Atlantic above the Metropolitan, the Central above the Pacific. */
const DIVISION_SLOT: Record<NhlDivision, number> = { atlantic: 0, metropolitan: 1, central: 0, pacific: 1 };

/** Four rounds of best-of-seven, each conference's half on its own side until the Final. */
const ROUNDS: readonly SeriesRound[] = [
  { id: "round-of-16", label: "First Round", size: 8, bestOf: 7 },
  { id: "quarter-final", label: "Second Round", size: 4, bestOf: 7 },
  { id: "semi-final", label: "Conference Final", size: 2, bestOf: 7 },
  { id: "final", label: "Stanley Cup Final", size: 1, bestOf: 7 },
];

/** "East 1st Round - Game 1", "West Final -  Game 3", "Stanley Cup Final - Game 6". */
const ROUND_NOTE = /^(?:(East|West) (1st Round|2nd Round|Final)|Stanley Cup Final)\b/;
const ROUND_BY_NOTE: Record<string, number> = { "1st Round": 0, "2nd Round": 1, Final: 2 };
/** The first two rounds share the abbreviation "DIV"; the slug tells them apart. */
const ROUND_BY_SLUG: Record<string, number> = {
  "divisional-round": 0,
  "divisional-finals": 1,
  "conference-finals": 2,
  "league-finals": 3,
};
const GAME_NOTE = /^(.+?)\s+-\s+Game\s+(\d+)(.*)$/;

const ORDINAL_WORDS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth"];

type NhlCompetitor = HeaderCompetitor & {
  /** The team's division, as ESPN's group id ("32" the Atlantic). */
  group?: string;
  /** `playoffSeed` is the conference rank at the end of the regular season. */
  recordStats?: { playoffSeed?: { value?: number } };
};

type NhlStatus = HeaderStatus & {
  /** "2nd", "OT", "2OT", "SO". */
  displayPeriod?: string | null;
  type?: HeaderStatus["type"] & {
    /** A final's overtime or shootout: "OT", "2OT", "SO". */
    altDetail?: string;
  };
};

type NhlEvent = Omit<HeaderEvent, "competitors" | "fullStatus" | "competitionType"> & {
  competitors?: NhlCompetitor[];
  fullStatus?: NhlStatus;
  competitionType?: { abbreviation?: string; slug?: string };
};

function colourOf(code: string, color: string | undefined): string | undefined {
  return teamColour(code, color, LOGO_ON_WHITE);
}

/**
 * The scores bar's logo has a white keyline the plain one lacks, which keeps
 * a dark mark apart from its own colour; the dark-mode variants are skipped.
 */
function logoOf(t: EspnTeam): string | undefined {
  const logos = t.logos ?? [];
  const light = logos.filter((l) => !l.rel?.includes("dark"));
  return (light.find((l) => l.rel?.includes("scoreboard")) ?? light[0] ?? logos[0])?.href;
}

/** A club from the teams list or the table. */
function teamFrom(t: EspnTeam | undefined): Team | null {
  const raw = t?.abbreviation;
  if (!raw || raw === "TBD") return null;
  const code = CODE_ALIASES[raw] ?? raw;
  return {
    id: code.toLowerCase(),
    name: t.displayName ?? code,
    shortName: t.shortDisplayName ?? t.displayName ?? code,
    code,
    logoUrl: espnImage(logoOf(t)),
    primaryColor: colourOf(code, t.color),
  };
}

function teamsFrom(json: EspnTeams): Team[] {
  return teamsListFrom(json, teamFrom);
}

function nthWord(n: number): string {
  return ORDINAL_WORDS[n - 1] ?? ordinal(n);
}

type Period =
  | { kind: "regulation"; n: number }
  | { kind: "overtime"; n: number }
  | { kind: "shootout" };

/**
 * "2nd", "OT", "2OT", "SO", as ESPN prints a period. A live playoff game's
 * second overtime reads "2nd OT", so overtime is matched before regulation.
 */
function periodFromLabel(label: string | null | undefined): Period | null {
  const text = label?.trim() ?? "";
  const overtime = /^(?:(\d+)(?:st|nd|rd|th)?\s*)?OT$/i.exec(text);
  if (overtime) return { kind: "overtime", n: Number(overtime[1] ?? 1) };
  if (/^SO$/i.test(text)) return { kind: "shootout" };
  const regulation = /^([1-3])(?:st|nd|rd)(?:\s+Period)?$/i.exec(text);
  if (regulation) return { kind: "regulation", n: Number(regulation[1]) };
  return null;
}

/**
 * The period by number only when ESPN printed none. A fifth period is a
 * regular season's shootout but a playoff game's second overtime, so the
 * number alone never decides a final's words.
 */
function periodFromNumber(period: number | undefined, postseason: boolean): Period | null {
  if (!period || period < 1) return null;
  if (period <= 3) return { kind: "regulation", n: period };
  if (postseason) return { kind: "overtime", n: period - 3 };
  return period === 4 ? { kind: "overtime", n: 1 } : { kind: "shootout" };
}

function periodOf(status: NhlStatus | undefined, postseason: boolean): Period | null {
  const shown = /\s-\s(.+)$/.exec(status?.type?.shortDetail ?? "")?.[1];
  return (
    periodFromLabel(status?.displayPeriod) ??
    periodFromLabel(shown) ??
    periodFromNumber(status?.period, postseason)
  );
}

function periodWords(period: Period): { short: string; spoken: string } {
  switch (period.kind) {
    case "regulation":
      return { short: `P${period.n}`, spoken: `${nthWord(period.n)} period` };
    case "overtime":
      return period.n === 1
        ? { short: "OT", spoken: "Overtime" }
        : { short: `${period.n}OT`, spoken: `${nthWord(period.n)} overtime` };
    case "shootout":
      return { short: "SO", spoken: "Shootout" };
  }
}

/**
 * Between periods. ESPN keeps the game STATUS_IN_PROGRESS through an
 * intermission (seen Oct 2026) and says so only in its line, "End of 1st
 * Period"; a status of its own is honoured should one appear.
 */
function isBreak(status: NhlStatus | undefined): boolean {
  const type = status?.type;
  if (type?.name === "STATUS_END_PERIOD" || type?.name === "STATUS_INTERMISSION") return true;
  return /^End of\b|intermission/i.test(type?.detail ?? type?.shortDetail ?? "");
}

function breakWords(period: Period): { short: string; spoken: string } {
  if (period.kind === "regulation" && period.n < 3) {
    return { short: `${ordinal(period.n)} INT`, spoken: `${nthWord(period.n)} intermission` };
  }
  if (period.kind === "regulation") return { short: "End 3rd", spoken: "End of regulation" };
  if (period.kind === "overtime") {
    return period.n === 1
      ? { short: "End OT", spoken: "End of overtime" }
      : { short: `End ${period.n}OT`, spoken: `End of the ${nthWord(period.n).toLowerCase()} overtime` };
  }
  return { short: "SO", spoken: "Shootout" };
}

/**
 * Where a game stands in hockey's words: live, the period and the clock
 * ("P2 12:34") or the intermission; over, how it was decided when it went
 * past regulation ("OT", "2OT", "SO"), read from ESPN's own line. A
 * regulation final keeps the plain FT, and a fixture its date.
 */
function statusText(status: NhlStatus | undefined, state: MatchStatus, postseason: boolean): Match["statusText"] {
  const type = status?.type;
  if (state === "live") {
    if (type?.name === "STATUS_DELAYED") return { short: "Delay", spoken: "Delayed" };
    const period = periodOf(status, postseason);
    if (!period) return undefined;
    if (isBreak(status)) return breakWords(period);
    const words = periodWords(period);
    const clock = status?.displayClock;
    if (period.kind === "shootout" || !clock) return words;
    return { short: `${words.short} ${clock}`, spoken: `${words.spoken}, ${clock} left` };
  }
  if (state === "ft") {
    const end = type?.altDetail || /^Final\/(.+)$/i.exec(type?.detail ?? type?.shortDetail ?? "")?.[1];
    const period = periodFromLabel(end);
    if (period?.kind === "shootout") return { short: "SO", spoken: "Final after a shootout" };
    if (period?.kind === "overtime") {
      return period.n === 1
        ? { short: "OT", spoken: "Final after overtime" }
        : { short: `${period.n}OT`, spoken: `Final after ${period.n} overtimes` };
    }
  }
  return undefined;
}

/**
 * "East 1st Round · Game 1" in the playoffs, "Game 7, if necessary" for one
 * that may not be played. The regular season's notes name its outdoor games
 * ("Heritage Classic"), kept; a makeup date is not.
 */
function stageLabel(event: NhlEvent): string | undefined {
  const seasonType = String(event.seasonType);
  if (seasonType === PRESEASON) return "Preseason";
  const note = headerNote(event)?.replace(/\s+/g, " ").trim();
  if (!note) return undefined;
  if (seasonType !== POSTSEASON) return /^makeup\b/i.test(note) ? undefined : note;
  const m = GAME_NOTE.exec(note);
  if (!m) return note;
  const [, round, game, rest] = m;
  const maybe = /if necessary/i.test(rest) ? ", if necessary" : "";
  return `${round} · Game ${game}${maybe}`;
}

type NhlGame = { match: Match; teams: Team[]; winnerTeamId: string | null };

function gameFrom(event: NhlEvent): NhlGame | null {
  const mapped = headerMatch(event, { exclude: EVERY_GAME_CHANNELS });
  if (!mapped) return null;
  const stage = stageLabel(event);
  const text = statusText(event.fullStatus, mapped.match.status, String(event.seasonType) === POSTSEASON);
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

/** Its round, and which conference's half of the draw when the note says ("East 2nd Round - Game 4"). */
function roundOf(event: NhlEvent): Pick<SeriesGame, "round" | "half"> | null {
  const m = ROUND_NOTE.exec(headerNote(event)?.trim() ?? "");
  if (m) return m[1] ? { round: ROUND_BY_NOTE[m[2]], half: m[1] === "East" ? 0 : 1 } : { round: 3, half: null };
  const round = ROUND_BY_SLUG[event.competitionType?.slug ?? ""];
  return round === undefined ? null : { round, half: null };
}

/** What the table knew of a team at the end of the regular season, for a game that does not say. */
type Seeding = { division: NhlDivision; seed: number };

type Tie = { match: BracketMatch; teamIds: string[]; trusted: boolean };

type Slot = { series?: Series; trusted: boolean };

/**
 * Where each series of a round sits. The first round is drawn by division:
 * each conference's half holds its two divisions (the Atlantic above the
 * Metropolitan, the Central above the Pacific), each the winner's series
 * against a wild card above 2 v 3. The winner is the side that hosted the
 * series' first game with the better conference seed. Every later round goes
 * by the ties its teams came out of. A series that fits neither way takes
 * the first free slot of its half, and is not trusted to carry its winner on.
 */
function placeSeries(
  round: number,
  list: Series[],
  previous: Tie[],
  divisionOf: (teamId: string) => NhlDivision | undefined,
  seedOf: (teamId: string) => number
): Slot[] {
  const { size } = ROUNDS[round];
  const slots: Slot[] = Array.from({ length: size }, () => ({ trusted: round > 0 }));
  const halfOf = (series: Series): 0 | 1 | null => {
    if (series.half !== null) return series.half;
    const division = divisionOf(series.teamIds[0]);
    return division ? (CONFERENCE_OF[division] === "east" ? 0 : 1) : null;
  };
  const own = (series: Series): number[] => {
    const half = halfOf(series);
    if (size === 1 || half === null) return Array.from({ length: size }, (_, i) => i);
    return Array.from({ length: size / 2 }, (_, i) => half * (size / 2) + i);
  };

  const preferred = new Map<Series, number>();
  if (round === 0) {
    const byDivision = new Map<NhlDivision, Series[]>();
    for (const series of list) {
      const division = divisionOf(series.teamIds[0]);
      if (division) byDivision.set(division, [...(byDivision.get(division) ?? []), series]);
    }
    for (const [division, pair] of byDivision) {
      const crossDivision = (s: Series): number => (s.teamIds.some((id) => divisionOf(id) !== division) ? 0 : 1);
      pair
        .sort((a, b) => seedOf(a.teamIds[0]) - seedOf(b.teamIds[0]) || crossDivision(a) - crossDivision(b))
        .slice(0, 2)
        .forEach((series, i) => {
          const half = CONFERENCE_OF[division] === "east" ? 0 : 1;
          preferred.set(series, half * 4 + DIVISION_SLOT[division] * 2 + i);
        });
    }
  } else {
    for (const series of list) {
      const k = own(series).find((i) =>
        [previous[2 * i], previous[2 * i + 1]].some((feeder) => feeder?.teamIds.some((id) => series.teamIds.includes(id)))
      );
      if (k !== undefined) preferred.set(series, k);
    }
  }

  const loose: Series[] = [];
  for (const series of list) {
    const k = preferred.get(series);
    if (k !== undefined && !slots[k].series) slots[k] = { series, trusted: true };
    else loose.push(series);
  }
  for (const series of loose) {
    const k = own(series).find((i) => !slots[i].series) ?? slots.findIndex((s) => !s.series);
    if (k !== -1) slots[k] = { series, trusted: round > 0 };
  }
  return slots;
}

/**
 * One slot as a tie. Past the first round the team out of the upper feeder
 * is home, so the tree keeps its shape, and a slot ESPN has not drawn yet
 * already names the winners it waits for.
 */
function tieFrom(id: string, slot: Slot, upper: Tie | undefined, lower: Tie | undefined): Tie {
  const { series } = slot;
  const carried = (feeder: Tie | undefined): string | null =>
    feeder?.trusted ? (feeder.match.winnerTeamId ?? null) : null;
  if (!series) {
    const match = seriesTie(undefined, id, 7);
    const home = carried(upper);
    const away = carried(lower);
    return {
      match: { ...match, homeTeamId: home, awayTeamId: away },
      teamIds: [home, away].filter((t): t is string => t !== null),
      trusted: slot.trusted,
    };
  }
  const fromUpper = series.teamIds.find((t) => upper?.teamIds.includes(t));
  const fromLower = series.teamIds.find((t) => lower?.teamIds.includes(t) && t !== fromUpper);
  const oriented: Series =
    fromUpper && fromLower && fromUpper !== series.teamIds[0] ? { ...series, teamIds: [fromUpper, fromLower] } : series;
  return { match: seriesTie(oriented, id, 7), teamIds: [...series.teamIds], trusted: slot.trusted };
}

/**
 * The playoffs as a bracket of best-of-seven series, the East's half above
 * the West's, built from the games: ESPN has no bracket that names teams.
 * From the first round with a series on, every round is there, TBD until its
 * teams are known. `seedings` is the table, for a game that names neither
 * its teams' divisions nor their seeds.
 */
function playoffsFrom(
  events: NhlEvent[],
  seedings: ReadonlyMap<string, Seeding> = new Map()
): { rounds: BracketRound[]; teams: Team[] } {
  const games: SeriesGame[] = [];
  const teams: Team[] = [];
  const divisions = new Map<string, NhlDivision>();
  const seeds = new Map<string, number>();
  for (const event of events) {
    if (String(event.seasonType) !== POSTSEASON) continue;
    const stage = roundOf(event);
    const game = stage && gameFrom(event);
    if (!stage || !game) continue;
    teams.push(...game.teams);
    for (const c of event.competitors ?? []) {
      const id = c.homeAway === "home" ? game.match.homeTeamId : game.match.awayTeamId;
      const division = DIVISION_BY_GROUP[c.group ?? ""];
      if (division) divisions.set(id, division);
      const seed = c.recordStats?.playoffSeed?.value;
      if (typeof seed === "number" && seed > 0) seeds.set(id, seed);
    }
    games.push({
      ...stage,
      homeTeamId: game.match.homeTeamId,
      awayTeamId: game.match.awayTeamId,
      date: game.match.kickoff,
      status: game.match.status,
      winnerTeamId: game.winnerTeamId,
    });
  }

  const series = groupSeries(games);
  if (series.length === 0) return { rounds: [], teams };
  const divisionOf = (id: string): NhlDivision | undefined => divisions.get(id) ?? seedings.get(id)?.division;
  const seedOf = (id: string): number => seeds.get(id) ?? seedings.get(id)?.seed ?? Infinity;

  const first = Math.min(...series.map((s) => s.round));
  const rounds: BracketRound[] = [];
  let previous: Tie[] = [];
  ROUNDS.forEach((round, r) => {
    if (r < first) return;
    const ties = placeSeries(r, series.filter((s) => s.round === r), previous, divisionOf, seedOf).map((slot, k) =>
      tieFrom(round.size === 1 ? `nhl-${round.id}` : `nhl-${round.id}-${k}`, slot, previous[2 * k], previous[2 * k + 1])
    );
    rounds.push({ id: round.id, label: round.label, matches: ties.map((t) => t.match) });
    previous = ties;
  });
  return { rounds, teams };
}

/**
 * Both conferences, each team at its conference seed.
 *
 * ESPN sends a division's teams in no reliable order, and the seed (1–16) is
 * its own tiebreak-aware ranking of the conference; a conference whose seeds
 * are not out yet falls back to points, then fewer games played. `losses`
 * is regulation losses: ESPN's own `regLosses` does not add up, but games
 * played = wins + losses + OT losses always does.
 */
function standingsFrom(json: EspnStandings): { standings: NhlStanding[]; teams: Team[]; season?: number } {
  const standings: NhlStanding[] = [];
  const teams: Team[] = [];
  let season: number | undefined;
  for (const conferenceGroup of json.children ?? []) {
    const conference = CONFERENCES[conferenceGroup.abbreviation?.toUpperCase() ?? ""];
    if (!conference) continue;
    const rows: Array<{ row: NhlStanding; seed: number }> = [];
    for (const divisionGroup of conferenceGroup.children ?? []) {
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
            conference,
            division,
            gamesPlayed: standingValue(entry, "gamesPlayed"),
            wins: standingValue(entry, "wins"),
            losses: standingValue(entry, "losses"),
            otLosses: standingValue(entry, "otLosses"),
            points: standingValue(entry, "points"),
            goalsFor: standingValue(entry, "pointsFor"),
            goalsAgainst: standingValue(entry, "pointsAgainst"),
            streak: standingStat(entry, "streak")?.display || "—",
          },
        });
      }
    }
    const seeded = rows.every((r) => r.seed > 0);
    rows
      .sort((a, b) =>
        seeded
          ? a.seed - b.seed
          : b.row.points - a.row.points || a.row.gamesPlayed - b.row.gamesPlayed || b.row.wins - a.row.wins
      )
      .forEach(({ row }, i) => standings.push({ ...row, position: i + 1 }));
  }
  return { standings, teams, season };
}

/**
 * The year whose playoffs are shown on `today`: from mid-April through the
 * summer, when last season's bracket is all there is, until the preseason
 * opens; null in between.
 */
function postseasonYear(today: Date): number | null {
  const day = isoDay(today).slice(5);
  return day >= POSTSEASON_SPANS[0].from && day < PRESEASON_OPENS ? today.getUTCFullYear() : null;
}

/** The season under way or just finished, by the year it started: 2026 is 2026–27. */
function seasonOn(today: Date): number {
  const year = today.getUTCFullYear();
  return isoDay(today).slice(5) >= PRESEASON_OPENS ? year : year - 1;
}

type NhlFeeds = {
  teams: EspnTeams | null;
  standings: EspnStandings | null;
  /** The days listed, raw. */
  days: NhlEvent[];
  /** The playoffs' games, raw; none outside them. */
  postseason: NhlEvent[];
};

/**
 * The feed as the view reads it, mapped down from ESPN's raw answers before
 * anything is cached. Throws when there are neither games nor a table, for
 * the hand-written season to take over.
 */
function nhlDataFrom(feeds: NhlFeeds, today: Date): NhlData {
  const byId = new Map<string, Team>();
  const add = (team: Team): void => {
    if (!byId.has(team.id)) byId.set(team.id, team);
  };
  const listed = feeds.teams ? teamsFrom(feeds.teams) : [];
  const table = feeds.standings ? standingsFrom(feeds.standings) : { standings: [], teams: [], season: undefined };
  // An All-Star game or a preseason exhibition against a European club is not
  // between two of the league's teams; with no list to tell, every game stays.
  const clubs = new Set([...listed, ...table.teams].map((t) => t.id));
  // The table's teams go in last: they carry no colour, a game's do.
  listed.forEach(add);

  const games = new Map<string, Match>();
  let season: number | undefined;
  for (const event of feeds.days) {
    const game = gameFrom(event);
    if (!game || games.has(game.match.id)) continue;
    if (clubs.size > 0 && !game.teams.every((t) => clubs.has(t.id))) continue;
    games.set(game.match.id, game.match);
    game.teams.forEach(add);
    if (typeof event.season === "number") season = Math.max(season ?? 0, event.season);
  }
  if (games.size === 0 && table.standings.length === 0) {
    throw new Error("espn nhl returned neither games nor standings");
  }
  table.teams.forEach(add);

  const seedings = new Map<string, Seeding>(
    table.standings.map((s) => [s.teamId, { division: s.division, seed: s.position }])
  );
  const playoffs = playoffsFrom(feeds.postseason, seedings);
  playoffs.teams.forEach(add);

  // ESPN's season is the year it ends in: 2027 is 2026–27.
  const endYear = season ?? table.season;
  return {
    season: endYear ? endYear - 1 : seasonOn(today),
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

/** Both spans or neither: half a bracket would show a decided series as still to come. */
async function fetchPostseason(year: number): Promise<HeaderEvent[]> {
  const spans = await Promise.all(
    POSTSEASON_SPANS.map((s) => fetchHeader(LEAGUE, `${year}-${s.from}`, `${year}-${s.to}`))
  );
  return spans.flat();
}

/**
 * Four weeks of days around today, both conferences' tables and, from
 * mid-April until the preseason, the playoffs — from ESPN's public API, no
 * key. The teams list and the table fail on their own: the view does without
 * them. The scores bar does not, as an answer without its games or its
 * bracket would replace the last good one in the cache.
 */
async function fetchNhlFromApi(): Promise<NhlData> {
  const now = new Date();
  const today = isoDay(now);
  const year = postseasonYear(now);
  const [teams, standings, days, postseason] = await Promise.allSettled([
    fetchEspnJson<EspnTeams>("espn nhl", TEAMS_URL),
    fetchEspnJson<EspnStandings>("espn nhl", STANDINGS_URL),
    fetchHeaderDays(LEAGUE, shiftDay(today, -DAYS_BEHIND), shiftDay(today, DAYS_AHEAD)),
    year === null ? Promise.resolve([]) : fetchPostseason(year),
  ]);
  if (days.status === "rejected") throw days.reason;
  if (postseason.status === "rejected") throw postseason.reason;
  return nhlDataFrom(
    {
      teams: settledOrNull(teams),
      standings: settledOrNull(standings),
      days: days.value,
      postseason: postseason.value,
    },
    now
  );
}

export const getNhlData = cachedFeed("espn nhl", fetchNhlFromApi, () => NHL_DATA, ["espn:nhl-data"], {
  revalidate: REVALIDATE_SECONDS,
  tags: ["sports:nhl"],
});

/** Pure mappers, exported for their tests — nothing here touches the network. */
export const __testing = {
  gameFrom,
  nhlDataFrom,
  playoffsFrom,
  postseasonYear,
  stageLabel,
  standingsFrom,
  statusText,
  teamFrom,
  teamsFrom,
};
