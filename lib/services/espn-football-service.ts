import "server-only";

import { getFootballLeague } from "@/lib/data/sports/football";
import { espnImage } from "@/lib/sports/espn-images";
import { orderMatchesForDisplay } from "@/lib/sports/match-order";
import {
  ESPN_FOOTBALL_LEAGUE_IDS,
  type BracketMatch,
  type BracketRound,
  type BracketRoundId,
  type EspnFootballLeagueId,
  type FootballGroupStandings,
  type FootballLeague,
  type FootballLeagueData,
  type FootballLeagueId,
  type Match,
  type MatchStatus,
  type Standing,
  type StandingBand,
  type Team,
} from "@/types/sports";

import {
  fetchHeader,
  fetchHeaderDays,
  headerMatch,
  isoDay,
  seriesTie,
  shiftDay,
  sidesOf,
  type HeaderCompetitor,
  type HeaderEvent,
  type HeaderLeague,
  type Series,
} from "./espn-scoreboard";
import { fetchEspnJson, standingValue, teamsListFrom, type EspnTeam, type EspnTeams } from "./espn-site";
import { ZONE_BAND_DEFAULTS } from "./football-data-service";
import { cachedFeed, settledOrNull } from "./upstream";

const SITE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/soccer";
const REVALIDATE_SECONDS = 300;

/**
 * The days listed: six weeks of results up to today and four of what is
 * next, a week a request — ESPN's site scoreboard answers a range with a 400,
 * its scores bar does not.
 */
const DAYS_BEHIND = 42;
const DAYS_AHEAD = 27;
/** The scores bar's ceiling for one request; a postseason is a few games a week. */
const SPAN_MAX_DAYS = 62;
const MATCH_CAPS = { upcoming: 30, results: 80 } as const;

/**
 * When a league's knockout is on screen, as calendar days ("MM-DD"): its games
 * fall between `from` and `to`, and the bracket stays up until `until`, the
 * next season or tournament. Outside them the Knockout tab is locked. A
 * bracket is only drawn from a whole span: one cut off by the days listed
 * would show a final with no way to it.
 */
type PlayoffSpan = { from: string; to: string; until: string };

type PlayoffFormat =
  /** One game, a shoot-out if level. */
  | "single"
  /** MLS's Round One: best of three, every game settled on the day. */
  | "series"
  /** Home and away, on aggregate. */
  | "two-legged";

type KnockoutRound = {
  id: BracketRoundId;
  /** The column's heading: "Round One", "Conference finals". */
  label: string;
  /** A game's stage in the match list: "Conference final". */
  matchLabel: string;
  size: number;
  format: PlayoffFormat;
  /** Drawn only when a game of it is on: Costa Rica's grand final is played only some seasons. */
  optional?: boolean;
};

type Phase =
  | { kind: "league"; label?: string }
  | { kind: "knockout"; round: number; half: 0 | 1 | null; label: string }
  | { kind: "other"; label?: string };

type EspnFootballLeague = {
  id: EspnFootballLeagueId;
  /** ESPN's league slug. */
  slug: string;
  name: string;
  shortName: string;
  region: string;
  /** The tournament under way joins the season: Costa Rica's "2026–27 Apertura". */
  tournamentInSeason: boolean;
  playoffs: readonly PlayoffSpan[];
  rounds: readonly KnockoutRound[];
  phase: (event: FootballEvent) => Phase;
};

type FootballCompetitor = HeaderCompetitor & {
  /** A shoot-out's kicks scored, beside the score the match ended on. */
  shootoutScore?: number | null;
  aggregateScore?: number | null;
  /** Who goes through: on a tie's deciding game, and on every playoff winner's. */
  advance?: boolean;
};

type FootballEvent = Omit<HeaderEvent, "competitors"> & {
  competitors?: FootballCompetitor[];
  /** The stage: "Eastern Conference Playoffs - Round One", "Apertura - Playoff Semifinals". */
  group?: { name?: string; abbreviation?: string };
  leg?: { value?: number };
};

const MLS_ROUNDS: Record<string, number> = { "wild card": 0, "round one": 1, semifinals: 2, final: 3 };

/** "Eastern Conference Playoffs - Round One", "MLS Cup". */
function mlsPhase(event: FootballEvent): Phase {
  const name = event.group?.name?.trim() ?? "";
  if (/^MLS Cup$/i.test(name)) return { kind: "knockout", round: 4, half: null, label: "MLS Cup" };
  const m = /^(Eastern|Western) Conference Playoffs\s*-\s*(.+)$/i.exec(name);
  const round = m ? MLS_ROUNDS[m[2].toLowerCase()] : undefined;
  if (m && round !== undefined) {
    const half = m[1].toLowerCase() === "eastern" ? 0 : 1;
    const game = round === 1 ? /^Game (\d+)/.exec(event.note ?? "")?.[1] : undefined;
    const stage = [half === 0 ? "East" : "West", MLS.rounds[round].matchLabel, game && `Game ${game}`];
    return { kind: "knockout", round, half, label: stage.filter(Boolean).join(" · ") };
  }
  if (String(event.seasonType) === "1") return { kind: "league" };
  return { kind: "other", label: name || undefined };
}

/**
 * "Apertura", "Apertura - Playoff Semifinals", "Clausura- Relegation Playoffs".
 * A league game goes unlabelled, as MLS's do: the tournament is in the season's name.
 */
function costaRicaPhase(event: FootballEvent): Phase {
  const name = event.group?.name?.trim() ?? "";
  const m = /^(Apertura|Clausura)\s*-\s*(.+)$/i.exec(name);
  if (!m) return { kind: "league" };
  const [, tournament, stage] = m;
  if (/relegation/i.test(stage)) return { kind: "other", label: "Relegation play-off" };
  const round = /grand final/i.test(stage) ? 2 : /semifinal/i.test(stage) ? 0 : /final/i.test(stage) ? 1 : undefined;
  if (round === undefined) return { kind: "other", label: `${tournament} ${stage}` };
  const leg = event.leg?.value;
  const label = `${tournament} ${COSTA_RICA.rounds[round].matchLabel}${leg ? ` · Leg ${leg}` : ""}`;
  return { kind: "knockout", round, half: null, label };
}

const MLS: EspnFootballLeague = {
  id: "mls",
  slug: "usa.1",
  name: "Major League Soccer",
  shortName: "MLS",
  region: "USA",
  tournamentInSeason: false,
  // Decision Day is early November; MLS Cup is played by mid-December, and
  // the new season opens late February.
  playoffs: [{ from: "10-15", to: "12-20", until: "02-01" }],
  rounds: [
    { id: "round-1", label: "Wild card", matchLabel: "Wild card", size: 2, format: "single" },
    { id: "round-of-16", label: "Round One", matchLabel: "Round One", size: 8, format: "series" },
    { id: "quarter-final", label: "Conference semi-finals", matchLabel: "Conference semi-final", size: 4, format: "single" },
    { id: "semi-final", label: "Conference finals", matchLabel: "Conference final", size: 2, format: "single" },
    { id: "final", label: "MLS Cup", matchLabel: "MLS Cup", size: 1, format: "single" },
  ],
  phase: mlsPhase,
};

const COSTA_RICA: EspnFootballLeague = {
  id: "costa-rica",
  slug: "crc.1",
  name: "Primera División de Costa Rica",
  shortName: "Primera División",
  region: "CRC",
  tournamentInSeason: true,
  // Two tournaments a season, each with its own play-offs: the Apertura's in
  // December, the Clausura's in May.
  playoffs: [
    { from: "11-15", to: "12-31", until: "02-01" },
    { from: "04-15", to: "06-15", until: "07-15" },
  ],
  rounds: [
    { id: "semi-final", label: "Semi-finals", matchLabel: "semi-final", size: 2, format: "two-legged" },
    { id: "final", label: "Final", matchLabel: "final", size: 1, format: "two-legged" },
    { id: "round-3", label: "Grand final", matchLabel: "grand final", size: 1, format: "two-legged", optional: true },
  ],
  phase: costaRicaPhase,
};

const LEAGUES: Record<EspnFootballLeagueId, EspnFootballLeague> = { mls: MLS, "costa-rica": COSTA_RICA };

export function isEspnFootballLeague(id: FootballLeagueId): id is EspnFootballLeagueId {
  return ESPN_FOOTBALL_LEAGUE_IDS.some((league) => league === id);
}

/** ESPN's leagues for the picker, in its order. Names only: nothing is fetched. */
export const ESPN_FOOTBALL_LEAGUES: ReadonlyArray<{ id: EspnFootballLeagueId; name: string }> = ESPN_FOOTBALL_LEAGUE_IDS.map(
  (id) => ({ id, name: LEAGUES[id].name })
);

// ---------- Teams ----------

/** The plain crest: the dark-mode variants are skipped. */
function logoOf(t: EspnTeam): string | undefined {
  const logos = t.logos ?? [];
  const light = logos.filter((l) => !l.rel?.includes("dark"));
  return (light.find((l) => l.rel?.includes("default")) ?? light[0] ?? logos[0])?.href ?? t.logo;
}

/** A club from the teams list or the table, keyed like the scores bar's sides: its abbreviation in lower case. */
function teamFrom(t: EspnTeam | undefined): Team | null {
  const code = t?.abbreviation;
  if (!code) return null;
  return {
    id: code.toLowerCase(),
    name: t.displayName ?? code,
    shortName: t.shortDisplayName ?? t.displayName ?? code,
    code,
    logoUrl: espnImage(logoOf(t)),
    primaryColor: t.color ? `#${t.color.replace(/^#/, "")}` : undefined,
  };
}

/**
 * Two clubs ESPN gives one short name (AD San Carlos and Inter de San Carlos
 * are both "San Carlos") go by their full names, or a table would list the
 * same club twice.
 */
function distinctNames(teams: Team[]): Team[] {
  const count = new Map<string, number>();
  for (const t of teams) count.set(t.shortName, (count.get(t.shortName) ?? 0) + 1);
  return teams.map((t) => ((count.get(t.shortName) ?? 0) > 1 ? { ...t, shortName: t.name } : t));
}

// ---------- Matches ----------

/**
 * The live minute as ESPN prints it: "33'", "90'+5'" in stoppage time, "HT"
 * at the break. Stoppage time keeps its own words; the minute alone is what
 * the dashboard shows.
 */
function liveClock(status: HeaderEvent["fullStatus"]): Pick<Match, "minute" | "statusText"> {
  const name = status?.type?.name;
  const shown = status?.type?.shortDetail ?? status?.displayClock ?? "";
  if (name === "STATUS_HALFTIME" || /^HT$/i.test(shown)) return { statusText: { short: "HT", spoken: "Half-time" } };
  if (name === "STATUS_SHOOTOUT") return { statusText: { short: "PENS", spoken: "Penalty shoot-out" } };
  const m = /^(\d+)'(?:\+(\d+)'?)?/.exec(shown);
  if (!m) return {};
  const minute = Number(m[1]);
  if (!m[2]) return { minute };
  return { minute, statusText: { short: `${m[1]}+${m[2]}'`, spoken: `Live, minute ${m[1]} plus ${m[2]}` } };
}

/** A final past 90 minutes says how it was settled: the scores bar's own status reads plain "post". */
function finalStatus(status: HeaderEvent["fullStatus"]): MatchStatus {
  const type = status?.type;
  if (type?.name === "STATUS_FINAL_PEN" || /pen/i.test(type?.shortDetail ?? "")) return "pen";
  if (type?.name === "STATUS_FINAL_AET" || /^AET$/i.test(type?.shortDetail ?? "")) return "aet";
  return "ft";
}

type Game = {
  match: Match;
  teams: Team[];
  winnerTeamId: string | null;
  /** The side ESPN says goes through on this game, for a tie's deciding leg. */
  advancingTeamId: string | null;
  phase: Phase;
};

function shootout(home: FootballCompetitor, away: FootballCompetitor): Match["penalties"] {
  const h = home.shootoutScore;
  const a = away.shootoutScore;
  return typeof h === "number" && typeof a === "number" ? { home: h, away: a } : undefined;
}

/** "Alajuelense advance 4-1 on aggregate", "Saprissa advances." */
function advancingFromNotes(event: FootballEvent, teams: Team[]): string | null {
  const notes = [event.note, ...(event.notes ?? []).map((n) => n.headline)];
  for (const note of notes) {
    const named = /^(?:2nd Leg - )?(.+?) advances?\b/i.exec(note ?? "")?.[1];
    const team = named && teams.find((t) => t.name === named || t.shortName === named);
    if (team) return team.id;
  }
  return null;
}

function gameFrom(event: FootballEvent, league: EspnFootballLeague): Game | null {
  const mapped = headerMatch(event);
  const { home, away } = sidesOf(event.competitors);
  if (!mapped || !home || !away) return null;
  const phase = league.phase(event);
  let status = mapped.match.status;
  if (status === "ft") status = finalStatus(event.fullStatus);
  const penalties = status === "pen" ? shootout(home, away) : undefined;
  const clock = status === "live" ? liveClock(event.fullStatus) : {};
  const label = phase.label;
  const advancing = home.advance ? mapped.teams[0].id : away.advance ? mapped.teams[1].id : null;
  return {
    match: {
      ...mapped.match,
      status,
      ...(penalties ? { penalties } : {}),
      ...clock,
      ...(label ? { stageLabel: label } : {}),
    },
    teams: mapped.teams,
    winnerTeamId: mapped.winnerTeamId,
    advancingTeamId: advancing ?? advancingFromNotes(event, mapped.teams),
    phase,
  };
}

// ---------- Standings ----------

type StandingNote = { description?: string; rank?: number };

type FootballStandingsGroup = {
  name?: string;
  abbreviation?: string;
  standings?: {
    season?: number;
    /** "2026-27 Primera División de Costa Rica", "2026 MLS". */
    seasonDisplayName?: string;
    entries?: Array<{ team?: EspnTeam; note?: StandingNote; stats?: Array<{ name?: string; displayValue?: string; value?: number | null }> }>;
  };
};

type FootballStandings = { children?: FootballStandingsGroup[] };

/** ESPN's note on a row, as a zone: "Qualifies for MLS Cup Playoffs - Wild Card Matches". */
function bandFromNote(note: StandingNote | undefined): StandingBand | undefined {
  const text = note?.description ?? "";
  if (!text) return undefined;
  if (/relegat/i.test(text)) return "relegation";
  if (/wild card|play-?in/i.test(text)) return "playoff";
  if (/round one|playoff|semi-?final|qualif/i.test(text)) return "champions";
  return undefined;
}

type Table = { groups: FootballGroupStandings[]; teams: Team[]; season?: string };

/**
 * Each of the league's tables (MLS's two conferences, Costa Rica's one), its
 * rows in ESPN's own ranking — the entries come in club order. A table whose
 * rows carry ESPN's notes takes its zones from them; one without any, from
 * the competition's rule.
 */
function standingsFrom(json: FootballStandings, league: EspnFootballLeague): Table {
  const teams: Team[] = [];
  const groups: FootballGroupStandings[] = [];
  let season: string | undefined;
  for (const group of json.children ?? []) {
    const entries = group.standings?.entries ?? [];
    season ??= seasonLabel(group.standings?.seasonDisplayName, group.standings?.season);
    const noted = entries.some((e) => e.note?.description);
    const rows: Standing[] = [];
    for (const entry of entries) {
      const team = teamFrom(entry.team);
      if (!team) continue;
      teams.push(team);
      rows.push({
        position: standingValue(entry, "rank"),
        teamId: team.id,
        played: standingValue(entry, "gamesPlayed"),
        won: standingValue(entry, "wins"),
        drawn: standingValue(entry, "ties"),
        lost: standingValue(entry, "losses"),
        goalsFor: standingValue(entry, "pointsFor"),
        goalsAgainst: standingValue(entry, "pointsAgainst"),
        points: standingValue(entry, "points"),
        band: noted ? (bandFromNote(entry.note) ?? null) : undefined,
      });
    }
    const ranked = rows.every((r) => r.position > 0);
    const ordered = ranked ? rows.sort((a, b) => a.position - b.position) : rows.sort(byRecord);
    const total = ordered.length;
    const standings = ordered.map((row, i) => {
      const position = ranked ? row.position : i + 1;
      return { ...row, position, band: row.band === undefined ? ZONE_BAND_DEFAULTS[league.id](position, total) : row.band };
    });
    if (standings.length === 0) continue;
    const label = group.abbreviation ?? group.name ?? league.shortName;
    groups.push({ label, standings });
  }
  if (season && league.tournamentInSeason && groups.length === 1) season = `${season} ${groups[0].label}`;
  return { groups, teams, season };
}

/** "2026-27 …" as "2026–27"; otherwise the year. */
function seasonLabel(display: string | undefined, year: number | undefined): string | undefined {
  const split = /^(\d{4})-(\d{2})\b/.exec(display ?? "");
  if (split) return `${split[1]}–${split[2]}`;
  return year ? String(year) : undefined;
}

function byRecord(a: Standing, b: Standing): number {
  return (
    b.points - a.points ||
    b.won - a.won ||
    b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor
  );
}

/**
 * Both conferences as one table, the Supporters' Shield's: points, then wins,
 * goal difference and goals scored. No zones — the play-offs are by conference.
 */
function overallTable(groups: FootballGroupStandings[]): Standing[] {
  return groups
    .flatMap((g) => g.standings)
    .sort(byRecord)
    .map((row, i) => ({ ...row, position: i + 1, band: null }));
}

// ---------- Knockout ----------

/** A knockout game, oriented as ESPN has it. */
type KnockoutGame = {
  round: number;
  half: 0 | 1 | null;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  penalties?: { home: number; away: number };
  date: string;
  status: MatchStatus;
  winnerTeamId: string | null;
  advancingTeamId: string | null;
};

/** One pairing of a round: a single game, a series, or a tie's two legs. */
type Contest = { round: number; half: 0 | 1 | null; teamIds: [string, string]; games: KnockoutGame[] };

const FINISHED: ReadonlySet<MatchStatus> = new Set<MatchStatus>(["ft", "aet", "pen"]);

/**
 * Games into pairings: a pair of clubs meets once a round, so the round and
 * the pair are its key. A postponed game comes back as one of its own, and a
 * cancelled one — a Game 3 nobody needed — is not one of them.
 */
function contestsFrom(games: KnockoutGame[]): Contest[] {
  const byKey = new Map<string, Contest>();
  const inPlay = games
    .filter((g) => g.status !== "postponed" && g.status !== "cancelled")
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  for (const game of inPlay) {
    const key = `${game.round}|${[game.homeTeamId, game.awayTeamId].sort().join("|")}`;
    let contest = byKey.get(key);
    if (!contest) {
      contest = { round: game.round, half: game.half, teamIds: [game.homeTeamId, game.awayTeamId], games: [] };
      byKey.set(key, contest);
    }
    contest.games.push(game);
  }
  return [...byKey.values()];
}

/** `game` from `home`'s side: the bracket draws a tie's upper feeder first. */
function oriented(game: KnockoutGame, home: string): KnockoutGame {
  if (game.homeTeamId === home) return game;
  return {
    ...game,
    homeTeamId: game.awayTeamId,
    awayTeamId: game.homeTeamId,
    homeScore: game.awayScore,
    awayScore: game.homeScore,
    ...(game.penalties ? { penalties: { home: game.penalties.away, away: game.penalties.home } } : {}),
  };
}

/** The last game of a one-game pairing (a replay replaces the one before). */
function singleTie(id: string, contest: Contest, home: string): BracketMatch {
  const game = oriented(contest.games[contest.games.length - 1], home);
  return {
    id,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    ...(game.penalties ? { penalties: game.penalties } : {}),
    winnerTeamId: FINISHED.has(game.status) ? game.winnerTeamId : null,
    date: game.date,
  };
}

/**
 * A home-and-away tie: each leg from the tie's first side, the aggregate once
 * both are over, and who goes through — ESPN's word on the second leg first
 * (its notes say "Alajuelense advance 4-1 on aggregate"), else the aggregate,
 * else the second leg's shoot-out. One leg alone is the first, whatever its
 * score: the return leg is still to come.
 */
function twoLeggedTie(id: string, contest: Contest, home: string): BracketMatch {
  const games = contest.games.slice(-2).map((g) => oriented(g, home));
  const [first, second] = games;
  const away = contest.teamIds.find((t) => t !== home) ?? first.awayTeamId;
  const legs = games.map((g) => ({ homeScore: g.homeScore, awayScore: g.awayScore, date: g.date }));
  if (!second) {
    return { id, homeTeamId: home, awayTeamId: away, legs, aggregateHome: null, aggregateAway: null, winnerTeamId: null, date: first.date };
  }
  const over = games.every((g) => FINISHED.has(g.status));
  const aggregateHome = over ? (first.homeScore ?? 0) + (second.homeScore ?? 0) : null;
  const aggregateAway = over ? (first.awayScore ?? 0) + (second.awayScore ?? 0) : null;
  let winnerTeamId: string | null = null;
  if (over && aggregateHome !== null && aggregateAway !== null) {
    winnerTeamId =
      second.advancingTeamId ??
      (aggregateHome > aggregateAway ? home : aggregateAway > aggregateHome ? away : second.winnerTeamId);
  }
  return {
    id,
    homeTeamId: home,
    awayTeamId: away,
    legs,
    aggregateHome,
    aggregateAway,
    ...(second.penalties ? { penalties: second.penalties } : {}),
    winnerTeamId,
    date: second.date,
  };
}

/** Round One, best of three: wins, not goals. Game one's home side, the higher seed, first. */
function seriesTieOf(id: string, contest: Contest): BracketMatch {
  const series: Series = { round: contest.round, half: contest.half, teamIds: contest.teamIds, games: contest.games };
  return seriesTie(series, id, 3);
}

type Tie = { match: BracketMatch; teamIds: string[] };

function tieOf(id: string, contest: Contest, format: PlayoffFormat, home: string): BracketMatch {
  switch (format) {
    case "series":
      return seriesTieOf(id, contest);
    case "two-legged":
      return twoLeggedTie(id, contest, home);
    case "single":
      return singleTie(id, contest, home);
  }
}

/**
 * A first round's pairings in the order their winners meet, by the better
 * seed of each: MLS's Round One, in each conference, 1 v 8 above 4 v 5, then
 * 2 v 7 above 3 v 6; Costa Rica's semi-finals, 1 v 4 above 2 v 3.
 */
const SEED_ORDER: Record<number, readonly number[]> = { 1: [1], 2: [1, 2], 4: [1, 4, 2, 3] };

/**
 * Where each pairing of a round sits. The first round goes by seed, each
 * conference in its own half; every later one by the ties its clubs came out
 * of, slot k being fed by the last round's 2k and 2k + 1. A pairing that fits
 * neither takes the first free slot of its half.
 */
function placeRound(
  list: Contest[],
  size: number,
  previous: Tie[],
  seedOf: (teamId: string) => number | undefined
): Array<Contest | undefined> {
  const slots: Array<Contest | undefined> = Array.from({ length: size }, () => undefined);
  const halving = previous.length === size * 2;
  const perHalf = size > 1 ? size / 2 : size;
  const ownSlots = ({ half }: Contest): number[] => {
    if (half === null || size === 1) return Array.from({ length: size }, (_, i) => i);
    return Array.from({ length: perHalf }, (_, i) => half * perHalf + i);
  };
  const loose: Contest[] = [];
  for (const contest of list) {
    let k: number | undefined;
    if (halving) {
      k = ownSlots(contest).find(
        (i) =>
          !slots[i] &&
          [previous[2 * i], previous[2 * i + 1]].some((f) => f?.teamIds.some((t) => contest.teamIds.includes(t)))
      );
    } else if (previous.length === 0) {
      const seeds = contest.teamIds.map(seedOf).filter((s): s is number => s !== undefined);
      const { half } = contest;
      const whole = half === null || size === 1;
      const slot = seeds.length > 0 ? (SEED_ORDER[whole ? size : perHalf] ?? []).indexOf(Math.min(...seeds)) : -1;
      const start = whole ? 0 : half * perHalf;
      if (slot !== -1 && !slots[start + slot]) k = start + slot;
    }
    if (k === undefined) loose.push(contest);
    else slots[k] = contest;
  }
  for (const contest of loose) {
    const k = ownSlots(contest).find((i) => !slots[i]) ?? slots.findIndex((s) => !s);
    if (k !== undefined && k !== -1) slots[k] = contest;
  }
  return slots;
}

/**
 * The knockout as a bracket, built from its games: ESPN has no bracket that
 * names clubs. From the first round with a game on, every round is there, a
 * slot TBD until its clubs are known — or naming the winners it waits for.
 * The East's half above the West's.
 */
function knockoutFrom(
  games: KnockoutGame[],
  league: EspnFootballLeague,
  seedOf: (teamId: string) => number | undefined
): BracketRound[] {
  const contests = contestsFrom(games);
  const first = league.rounds.findIndex((_, r) => contests.some((c) => c.round === r));
  if (first === -1) return [];
  const rounds: BracketRound[] = [];
  let previous: Tie[] = [];
  league.rounds.forEach((round, r) => {
    if (r < first) return;
    const list = contests.filter((c) => c.round === r);
    if (round.optional && list.length === 0) return;
    // MLS's wild card feeds one slot of Round One, not a pair of them.
    const feeders = previous.length === round.size * 2 ? previous : [];
    const slots = placeRound(list, round.size, feeders, seedOf);
    const ties = slots.map((contest, k): Tie => {
      const id = round.size === 1 ? `${league.id}-${round.id}` : `${league.id}-${round.id}-${k}`;
      const upper = feeders[2 * k];
      const lower = feeders[2 * k + 1];
      if (!contest) {
        const home = upper?.match.winnerTeamId ?? null;
        const away = lower?.match.winnerTeamId ?? null;
        return {
          match: {
            id,
            homeTeamId: home,
            awayTeamId: away,
            homeScore: null,
            awayScore: null,
            winnerTeamId: null,
            ...(round.format === "series" ? { bestOf: 3 as const } : {}),
          },
          teamIds: [home, away].filter((t): t is string => t !== null),
        };
      }
      const home = upper?.teamIds.find((t) => contest.teamIds.includes(t)) ?? contest.teamIds[0];
      return { match: tieOf(id, contest, round.format, home), teamIds: [...contest.teamIds] };
    });
    rounds.push({ id: round.id, label: round.label, matches: ties.map((t) => t.match) });
    previous = ties;
  });
  return rounds;
}

/** The knockout's games of `events` played within `span`, each once. */
function knockoutGamesFrom(
  events: FootballEvent[],
  league: EspnFootballLeague,
  span: { from: string; to: string }
): { games: KnockoutGame[]; teams: Team[] } {
  const seen = new Set<string>();
  const games: KnockoutGame[] = [];
  const teams: Team[] = [];
  for (const event of events) {
    const date = event.date?.slice(0, 10) ?? "";
    if (!event.id || seen.has(event.id) || date < span.from || date > span.to) continue;
    seen.add(event.id);
    const game = gameFrom(event, league);
    if (!game || game.phase.kind !== "knockout") continue;
    teams.push(...game.teams);
    const { match } = game;
    games.push({
      round: game.phase.round,
      half: game.phase.half,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      ...(match.penalties ? { penalties: match.penalties } : {}),
      date: match.kickoff,
      status: match.status,
      winnerTeamId: game.winnerTeamId,
      advancingTeamId: game.advancingTeamId,
    });
  }
  return { games, teams };
}

/** The playoff span `today` falls in, as dates: its games' days and whether they are past. */
function activeSpan(league: EspnFootballLeague, today: string): { from: string; to: string } | null {
  const year = Number(today.slice(0, 4));
  const day = today.slice(5);
  for (const span of league.playoffs) {
    const wraps = span.until < span.from;
    const inSpan = wraps ? day >= span.from || day < span.until : day >= span.from && day < span.until;
    if (!inSpan) continue;
    const start = wraps && day < span.from ? year - 1 : year;
    const endYear = span.to < span.from ? start + 1 : start;
    return { from: `${start}-${span.from}`, to: `${endYear}-${span.to}` };
  }
  return null;
}

/** The part of the span before the days listed, in requests of two months at most. */
function earlierSpans(span: { from: string; to: string } | null, listedFrom: string): Array<{ from: string; to: string }> {
  if (!span || span.from >= listedFrom) return [];
  const end = span.to < listedFrom ? span.to : shiftDay(listedFrom, -1);
  const spans: Array<{ from: string; to: string }> = [];
  for (let start = span.from; start <= end; start = shiftDay(start, SPAN_MAX_DAYS)) {
    const last = shiftDay(start, SPAN_MAX_DAYS - 1);
    spans.push({ from: start, to: last < end ? last : end });
  }
  return spans;
}

// ---------- The feed ----------

type Feeds = {
  /** The days listed, raw. */
  days: FootballEvent[];
  standings: FootballStandings | null;
  teams: EspnTeams | null;
  /**
   * The play-offs' earlier days, before the days listed; null when they did
   * not answer, which leaves the bracket out rather than half drawn.
   */
  earlier: FootballEvent[] | null;
};

/**
 * The league as the football view reads it, mapped down from ESPN's raw
 * answers before anything is cached. Throws when there are neither matches
 * nor a table, for the hand-written season to take over.
 */
function leagueDataFrom(league: EspnFootballLeague, feeds: Feeds, today: string): FootballLeagueData {
  const byId = new Map<string, Team>();
  const add = (team: Team): void => {
    if (!byId.has(team.id)) byId.set(team.id, team);
  };
  const table = feeds.standings ? standingsFrom(feeds.standings, league) : { groups: [], teams: [], season: undefined };
  const listed = feeds.teams ? teamsListFrom(feeds.teams, teamFrom) : [];
  // The list carries club colours, the table none; a game's side names a
  // club by a nickname ESPN cuts short ("Municipal Li"), so it comes last.
  listed.forEach(add);
  table.teams.forEach(add);

  const matches = new Map<string, Match>();
  let year: number | undefined;
  for (const event of feeds.days) {
    const game = gameFrom(event, league);
    if (!game || matches.has(game.match.id)) continue;
    // ESPN cancels a series' Game 3 once one side has won the first two.
    if (game.match.status === "cancelled" && game.phase.kind === "knockout") continue;
    matches.set(game.match.id, game.match);
    game.teams.forEach(add);
    if (typeof event.season === "number") year = Math.max(year ?? 0, event.season);
  }
  if (matches.size === 0 && table.groups.length === 0) {
    throw new Error(`espn football ${league.slug} returned neither games nor standings`);
  }

  const span = activeSpan(league, today);
  let knockout: BracketRound[] = [];
  if (span && feeds.earlier) {
    const seeds = new Map(table.groups.flatMap((g) => g.standings.map((s) => [s.teamId, s.position] as const)));
    const { games, teams } = knockoutGamesFrom([...feeds.earlier, ...feeds.days], league, span);
    teams.forEach(add);
    knockout = knockoutFrom(games, league, (id) => seeds.get(id));
  }

  const conferences = table.groups.length > 1;
  const info: FootballLeague = {
    id: league.id,
    name: league.name,
    shortName: league.shortName,
    region: league.region,
    hasKnockout: true,
    season: table.season ?? String(year ?? today.slice(0, 4)),
  };
  return {
    league: info,
    teams: distinctNames([...byId.values()]),
    matches: orderMatchesForDisplay(
      [...matches.values()],
      (m) => m.kickoff,
      (m) => m.status,
      MATCH_CAPS
    ),
    standings: conferences ? overallTable(table.groups) : (table.groups[0]?.standings ?? []),
    ...(conferences ? { groups: table.groups } : {}),
    ...(knockout.length > 0 ? { knockout } : {}),
  };
}

async function fetchEspnFootball(id: EspnFootballLeagueId): Promise<FootballLeagueData> {
  const league = LEAGUES[id];
  const scores: HeaderLeague = { sport: "soccer", league: league.slug };
  const today = isoDay(new Date());
  const from = shiftDay(today, -DAYS_BEHIND);
  const earlier = earlierSpans(activeSpan(league, today), from);
  const [days, standings, teams, before] = await Promise.allSettled([
    fetchHeaderDays(scores, from, shiftDay(today, DAYS_AHEAD)),
    fetchEspnJson<FootballStandings>(`espn ${league.slug}`, `${STANDINGS_URL}/${league.slug}/standings`),
    fetchEspnJson<EspnTeams>(`espn ${league.slug}`, `${SITE_URL}/${league.slug}/teams`),
    Promise.all(earlier.map((s) => fetchHeader(scores, s.from, s.to))).then((spans) => spans.flat()),
  ]);
  if (days.status === "rejected") throw days.reason;
  return leagueDataFrom(
    league,
    {
      days: days.value,
      standings: settledOrNull(standings),
      teams: settledOrNull(teams),
      earlier: settledOrNull(before),
    },
    today
  );
}

/**
 * MLS or Costa Rica's Primera División, from ESPN's public API (no key), a
 * cache entry each. Its table and teams list fail on their own: the view
 * does without them. The scores bar does not.
 */
export const getEspnFootballLeague = cachedFeed(
  "espn football league",
  fetchEspnFootball,
  (id: EspnFootballLeagueId) => getFootballLeague(id),
  ["espn:football-league"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:football"] }
);

/** Pure mappers, exported for their tests — nothing here touches the network. */
export const __testing = {
  activeSpan,
  bandFromNote,
  earlierSpans,
  gameFrom,
  knockoutFrom,
  knockoutGamesFrom,
  leagueDataFrom,
  liveClock,
  standingsFrom,
  LEAGUES,
};

export type { FootballEvent, FootballStandings };
