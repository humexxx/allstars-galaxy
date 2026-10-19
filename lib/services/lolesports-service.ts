import "server-only";

import { LOL_DATA } from "@/lib/data/sports/lol";
import { orderMatchesForDisplay } from "@/lib/sports/match-order";
import type {
  BracketMatch,
  BracketRound,
  BracketRoundId,
  FormResult,
  LolData,
  LolMatch,
  LolRegion,
  LolSplit,
  LolStanding,
  MatchStatus,
  SwissExit,
  SwissPool,
  SwissStage,
  Team,
} from "@/types/sports";
import { cachedFeed, upstreamSignal } from "./upstream";

// Lolesports' public-but-unofficial endpoint. The x-api-key value is the same
// one their own site (lolesports.com) ships in its frontend — it's a
// hard-coded constant, not user-specific.
const LOLESPORTS_BASE_URL = "https://esports-api.lolesports.com/persisted/gw";
const LOLESPORTS_API_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";
const REVALIDATE_SECONDS = 300;

type TargetLeague = { slug: string; region: LolRegion; international?: boolean };

/**
 * International events first: while one is on it is the only LoL anyone is
 * watching, and the regional splits behind it are weeks old. Worlds was not on
 * the list at all, so October showed September's finals.
 */
const TARGET_LEAGUES: TargetLeague[] = [
  { slug: "worlds", region: "worlds", international: true },
  { slug: "msi", region: "msi", international: true },
  { slug: "first_stand", region: "first-stand", international: true },
  { slug: "lec", region: "lec" },
  { slug: "lcs", region: "lcs" },
  { slug: "lck", region: "lck" },
  { slug: "lpl", region: "lpl" },
];

/** How long an international event stays on the strip after its final. */
const INTERNATIONAL_GRACE_DAYS = 21;

const FALLBACK_COLOR_BY_CODE: Record<string, string> = {
  G2: "#FF1654",
  FNC: "#FF5800",
  T1: "#E2012D",
  GEN: "#AA8A00",
  TES: "#C8102E",
  JDG: "#1C1F2D",
};

type LolesportsLeague = {
  id: string;
  slug: string;
  name: string;
  region: string;
  image?: string;
};

type LolesportsTournament = {
  id: string;
  slug: string;
  startDate: string;
  endDate: string;
};

type LolesportsTeamRef = {
  name: string;
  code: string;
  image?: string;
  result?: { outcome: "win" | "loss" | "tie" | null; gameWins: number };
  record?: { wins: number; losses: number };
};

type LolesportsEvent = {
  startTime: string;
  state: "unstarted" | "inProgress" | "completed";
  type: "match" | "show";
  blockName?: string;
  league?: { slug?: string; name?: string };
  match?: {
    id: string;
    teams: LolesportsTeamRef[];
    strategy?: { type: "bestOf"; count: 1 | 3 | 5 };
  };
};

type LolesportsStandingTeam = {
  name: string;
  code: string;
  image?: string;
  record?: { wins: number; losses: number };
  result?: { outcome?: "win" | "loss" | "tie" | null; gameWins?: number } | null;
};

type LolesportsRanking = {
  ordinal: number;
  teams: LolesportsStandingTeam[];
};

type LolesportsStandingsMatch = {
  id?: string;
  state?: LolesportsEvent["state"];
  teams: LolesportsStandingTeam[];
};

type LolesportsSection = {
  name?: string;
  rankings: LolesportsRanking[];
  matches?: LolesportsStandingsMatch[];
};

type LolesportsStage = {
  name?: string;
  slug?: string;
  sections: LolesportsSection[];
};

type LolesportsStandingsEntry = { stages: LolesportsStage[] };

async function fetchLolesports<T>(path: string): Promise<T> {
  const url = `${LOLESPORTS_BASE_URL}${path}${path.includes("?") ? "&" : "?"}hl=en-US`;
  const res = await fetch(url, {
    signal: upstreamSignal(),
    headers: { "x-api-key": LOLESPORTS_API_KEY },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    throw new Error(`Lolesports ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

function teamIdFromCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toTeam(ref: { name: string; code: string; image?: string }): Team {
  return {
    id: teamIdFromCode(ref.code),
    name: ref.name,
    shortName: ref.name,
    code: ref.code,
    logoUrl: ref.image,
    primaryColor: FALLBACK_COLOR_BY_CODE[ref.code.toUpperCase()] ?? "#222",
  };
}

function toMatchStatus(state: LolesportsEvent["state"]): MatchStatus {
  if (state === "inProgress") return "live";
  if (state === "completed") return "ft";
  return "scheduled";
}

/**
 * Pick the tournament that's currently happening; if none, the most recently
 * ended one. Never pick a future tournament — those exist in the API (e.g.
 * Summer Split scheduled for July) but have no real data yet.
 */
function pickActiveTournament(
  tournaments: LolesportsTournament[],
  today = new Date().toISOString().slice(0, 10),
): LolesportsTournament | null {
  if (tournaments.length === 0) return null;
  const active = tournaments.find(
    (t) => t.startDate <= today && today <= t.endDate,
  );
  if (active) return active;
  const past = tournaments
    .filter((t) => t.endDate < today)
    .sort(
      (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime(),
    );
  return past[0] ?? null;
}

function deriveFormFromMatches(
  matches: LolMatch[],
  teamId: string,
): FormResult[] {
  const completed = matches.filter(
    (m) =>
      (m.status === "ft" || m.status === "live") &&
      (m.homeTeamId === teamId || m.awayTeamId === teamId) &&
      m.homeScore !== null &&
      m.awayScore !== null,
  );
  const sorted = completed.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  return sorted.slice(0, 5).map((m): FormResult => {
    const isHome = m.homeTeamId === teamId;
    const teamScore = isHome ? m.homeScore : m.awayScore;
    const oppScore = isHome ? m.awayScore : m.homeScore;
    if (teamScore === null || oppScore === null) return "-";
    if (teamScore > oppScore) return "W";
    if (teamScore < oppScore) return "L";
    return "D";
  });
}

/** On now, or finished recently enough that its results are still news. */
function isCurrentEvent(
  tournament: LolesportsTournament | null,
  today = new Date().toISOString().slice(0, 10),
): tournament is LolesportsTournament {
  if (!tournament || tournament.startDate > today) return false;
  const until = new Date(`${tournament.endDate}T00:00:00Z`);
  until.setUTCDate(until.getUTCDate() + INTERNATIONAL_GRACE_DAYS);
  return today <= until.toISOString().slice(0, 10);
}

async function getCurrentTournament(
  leagueId: string,
): Promise<LolesportsTournament | null> {
  const data = await fetchLolesports<{
    data: { leagues: Array<{ tournaments: LolesportsTournament[] }> };
  }>(`/getTournamentsForLeague?leagueId=${leagueId}`);
  const tournaments = data.data.leagues[0]?.tournaments ?? [];
  return pickActiveTournament(tournaments);
}

const REGULAR_STAGE_SLUGS = new Set([
  "regular_season",
  "regular-season",
  "groups",
  "group_stage",
  "group-stage",
  "swiss",
]);

/**
 * Play-ins decide who reaches the bracket; they are not a round of it. LCK's
 * three play-in matches sat in front of its Regional Championship as if they
 * were its first round.
 */
function isBracketStage(slug: string | undefined): boolean {
  if (REGULAR_STAGE_SLUGS.has(slug ?? "")) return false;
  return !/play[-_]?ins?/.test(slug ?? "");
}

const ROUND_BY_TBD: Record<number, { id: BracketRoundId; label: string }> = {
  0: { id: "quarter-final", label: "Early Rounds" },
  1: { id: "semi-final", label: "Semifinals" },
  2: { id: "final", label: "Final" },
};

/** Positional round ids, assigned from the END of the section list (the API
 *  returns sections in bracket order, final last). Guarantees unique ids. */
const ROUND_IDS_FROM_END: BracketRoundId[] = [
  "final",
  "semi-final",
  "quarter-final",
  "round-of-16",
  "round-of-32",
];

/**
 * One section per block of the schedule.
 *
 * The API now returns a whole playoff as ONE section — LEC's eight matches
 * arrived as a single "Playoffs" column, Worlds' quarters, semis and final as
 * one "Knockouts" list. The schedule still names each match's block
 * ("Quarterfinals", "Finals"), and the section lists its matches in bracket
 * order, so consecutive blocks are the rounds.
 */
function splitSectionsByBlock(
  sections: PlayoffSection[],
  blockByMatchId: Map<string, string>,
): PlayoffSection[] {
  return sections.flatMap((section) => {
    const blocks: PlayoffSection[] = [];
    for (const match of section.matches) {
      const block = (match.id && blockByMatchId.get(match.id)) || section.name;
      const last = blocks[blocks.length - 1];
      if (last && last.name === block) last.matches.push(match);
      else blocks.push({ name: block, matches: [match] });
    }
    const distinct = new Set(blocks.map((b) => b.name)).size;
    return distinct > 1 && distinct === blocks.length ? blocks : [section];
  });
}

/**
 * Build bracket rounds from the playoff sections. Each section — or each
 * schedule block within one (see `splitSectionsByBlock`) — becomes one round,
 * labelled with its own name, so rounds stay stable as ties resolve.
 *
 * Falls back to the TBD-count heuristic only when sections carry no names.
 * (The old TBD-only approach collapsed the bracket as the tournament
 * progressed: once a semifinal's teams were decided it had 0 TBDs and
 * migrated into "Early Rounds", so a finished playoff rendered as one mixed
 * column with the final mislabeled.)
 */
function buildLolBracket(
  sections: PlayoffSection[],
  blockByMatchId: Map<string, string> = new Map(),
): BracketRound[] {
  const named = splitSectionsByBlock(sections, blockByMatchId).filter(
    (s): s is { name: string; matches: LolesportsStandingsMatch[] } =>
      Boolean(s.name) && s.matches.length > 0,
  );
  if (named.length === 0) {
    return partitionBracketByTbd(sections.flatMap((s) => s.matches));
  }
  // Ids come from the end of a five-step list; past five rounds they would
  // repeat, and a round id is a React key.
  if (named.length > ROUND_IDS_FROM_END.length) {
    return partitionBracketByTbd(sections.flatMap((s) => s.matches));
  }
  return named.map((s, idx) => {
    const fromEnd = named.length - 1 - idx;
    const id =
      ROUND_IDS_FROM_END[Math.min(fromEnd, ROUND_IDS_FROM_END.length - 1)];
    return {
      id,
      label: s.name,
      matches: s.matches.map((m, i) => toBracketMatch(m, `${idx}-${i}`)),
    };
  });
}

/**
 * Last-resort grouping by TBD-placeholder count: matches with both teams known
 * are early-round, one TBD = waiting on one prior winner (semis), two TBDs =
 * grand final. Only used when the standings sections carry no names.
 */
function partitionBracketByTbd(
  matches: LolesportsStandingsMatch[],
): BracketRound[] {
  const buckets: LolesportsStandingsMatch[][] = [[], [], []];
  for (const m of matches) {
    const tbd = Math.min(2, m.teams.filter((t) => t.code === "TBD").length);
    buckets[tbd].push(m);
  }
  const rounds: BracketRound[] = [];
  for (let tbd = 0; tbd < buckets.length; tbd++) {
    if (buckets[tbd].length === 0) continue;
    const { id, label } = ROUND_BY_TBD[tbd];
    rounds.push({
      id,
      label,
      matches: buckets[tbd].map((m, i) => toBracketMatch(m, `${tbd}-${i}`)),
    });
  }
  return rounds;
}

function toBracketMatch(
  m: LolesportsStandingsMatch,
  fallbackId: string,
): BracketMatch {
  const [home, away] = m.teams;
  const homeReal = home && home.code !== "TBD";
  const awayReal = away && away.code !== "TBD";
  const homeWins = home?.result?.gameWins ?? null;
  const awayWins = away?.result?.gameWins ?? null;
  const scored =
    homeWins !== null && awayWins !== null && (homeWins > 0 || awayWins > 0)
      ? { home: homeWins, away: awayWins }
      : null;
  const hasScore = scored !== null;
  const winnerCode =
    scored && home && away
      ? scored.home > scored.away
        ? home.code
        : scored.away > scored.home
          ? away.code
          : null
      : null;
  return {
    id: m.id ?? fallbackId,
    homeTeamId: homeReal ? teamIdFromCode(home.code) : null,
    awayTeamId: awayReal ? teamIdFromCode(away.code) : null,
    homeScore: hasScore ? homeWins : null,
    awayScore: hasScore ? awayWins : null,
    winnerTeamId: winnerCode ? teamIdFromCode(winnerCode) : null,
  };
}

type PlayoffSection = { name: string | null; matches: LolesportsStandingsMatch[] };

/** What only the schedule knows about a match. */
type ScheduledMatch = { date: string; bestOf: 1 | 3 | 5 };

type SwissShape = {
  winsToAdvance: number;
  lossesToExit: number;
  /** Matches per pool, round by round, best record first. */
  rounds: { wins: number; losses: number; matches: number }[][];
  exits: { wins: number; losses: number; slots: number }[];
};

const byRecord = (
  a: { wins: number; losses: number },
  b: { wins: number; losses: number },
): number => b.wins - a.wins || a.losses - b.losses;

/**
 * The pools a Swiss stage plays for this many teams, counts only. Null when a
 * pool would hold an odd number of teams, which no real format has.
 */
function swissShape(teams: number, winsToAdvance: number, lossesToExit: number): SwissShape | null {
  type Pool = { wins: number; losses: number; teams: number };
  let pools: Pool[] = [{ wins: 0, losses: 0, teams }];
  const rounds: SwissShape["rounds"] = [];
  const exits = new Map<string, Pool>();
  while (pools.length > 0) {
    const next = new Map<string, Pool>();
    const round: SwissShape["rounds"][number] = [];
    for (const pool of pools.sort(byRecord)) {
      if (pool.teams % 2 !== 0) return null;
      round.push({ wins: pool.wins, losses: pool.losses, matches: pool.teams / 2 });
      for (const [wins, losses] of [
        [pool.wins + 1, pool.losses],
        [pool.wins, pool.losses + 1],
      ]) {
        const into = wins === winsToAdvance || losses === lossesToExit ? exits : next;
        const key = `${wins}-${losses}`;
        const target = into.get(key) ?? { wins, losses, teams: 0 };
        target.teams += pool.teams / 2;
        into.set(key, target);
      }
    }
    rounds.push(round);
    pools = Array.from(next.values());
  }
  return {
    winsToAdvance,
    lossesToExit,
    rounds,
    exits: Array.from(exits.values())
      .sort(byRecord)
      .map((e) => ({ wins: e.wins, losses: e.losses, slots: e.teams })),
  };
}

/**
 * The Swiss formats that play exactly this many matches, likeliest first.
 * Worlds' is 16 teams, through on three wins and out on three losses: 33.
 */
function swissShapesFor(matchCount: number, knownTeams: number): SwissShape[] {
  const shapes: SwissShape[] = [];
  for (const wins of [3, 2, 4]) {
    for (let teams = Math.max(4, knownTeams + (knownTeams % 2)); teams <= 64; teams += 2) {
      const shape = swissShape(teams, wins, wins);
      const total = shape?.rounds.flat().reduce((sum, p) => sum + p.matches, 0);
      if (shape && total === matchCount) shapes.push(shape);
    }
  }
  return shapes;
}

/** The team that won a finished match, by code. */
function swissWinner(match: LolesportsStandingsMatch): string | null {
  const [home, away] = match.teams;
  if (!home || !away || home.code === "TBD" || away.code === "TBD") return null;
  if (home.result?.outcome === "win") return home.code;
  if (away.result?.outcome === "win") return away.code;
  if (match.state !== "completed") return null;
  const homeWins = home.result?.gameWins ?? 0;
  const awayWins = away.result?.gameWins ?? 0;
  if (homeWins === awayWins) return null;
  return homeWins > awayWins ? home.code : away.code;
}

/**
 * Worlds' Swiss stage as pools and exits, so it can be drawn as the tree it
 * is rather than a list of cards.
 *
 * The API sends the stage as one section of matches, round by round and best
 * record first within a round, and says nothing about which record a match
 * was played on. That order is the only key, so it is checked: every team the
 * results place in a match must be on that match's record, or the stage is not
 * drawn at all rather than drawn wrong.
 */
function buildSwissStage(
  matches: LolesportsStandingsMatch[],
  schedule: Map<string, ScheduledMatch> = new Map(),
): SwissStage | null {
  if (matches.length === 0) return null;
  const known = new Set(
    matches.flatMap((m) => m.teams.filter((t) => t.code !== "TBD").map((t) => t.code)),
  );
  for (const shape of swissShapesFor(matches.length, known.size)) {
    const stage = fitSwissShape(shape, matches, schedule);
    if (stage) return stage;
  }
  return null;
}

function fitSwissShape(
  shape: SwissShape,
  matches: LolesportsStandingsMatch[],
  schedule: Map<string, ScheduledMatch>,
): SwissStage | null {
  const records = new Map<string, { wins: number; losses: number }>();
  const recordOf = (code: string) => records.get(code) ?? { wins: 0, losses: 0 };
  // Each exit's teams in the order they got there.
  const finished = new Map<string, string[]>();
  let next = 0;
  const rounds: SwissPool[][] = [];
  for (const [r, round] of shape.rounds.entries()) {
    const pools: SwissPool[] = [];
    for (const [p, slot] of round.entries()) {
      const played = matches.slice(next, next + slot.matches);
      next += slot.matches;
      for (const match of played) {
        for (const t of match.teams) {
          if (t.code === "TBD") continue;
          const rec = recordOf(t.code);
          if (rec.wins !== slot.wins || rec.losses !== slot.losses) return null;
        }
      }
      for (const match of played) {
        const winner = swissWinner(match);
        if (!winner) continue;
        for (const t of match.teams) {
          const before = recordOf(t.code);
          const rec =
            t.code === winner
              ? { wins: before.wins + 1, losses: before.losses }
              : { wins: before.wins, losses: before.losses + 1 };
          records.set(t.code, rec);
          if (rec.wins === shape.winsToAdvance || rec.losses === shape.lossesToExit) {
            const key = `${rec.wins}-${rec.losses}`;
            finished.set(key, [...(finished.get(key) ?? []), teamIdFromCode(t.code)]);
          }
        }
      }
      pools.push({
        wins: slot.wins,
        losses: slot.losses,
        matches: played.map((m, i) => {
          const scheduled = m.id ? schedule.get(m.id) : undefined;
          return {
            ...toBracketMatch(m, `swiss-${r}-${p}-${i}`),
            status: toMatchStatus(m.state ?? "unstarted"),
            ...(scheduled ? { date: scheduled.date, bestOf: scheduled.bestOf } : {}),
          };
        }),
      });
    }
    rounds.push(pools);
  }
  const exits: SwissExit[] = shape.exits.map((exit) => ({
    ...exit,
    advanced: exit.wins === shape.winsToAdvance,
    teamIds: finished.get(`${exit.wins}-${exit.losses}`) ?? [],
  }));
  return {
    winsToAdvance: shape.winsToAdvance,
    lossesToExit: shape.lossesToExit,
    rounds,
    exits,
  };
}

async function getStandingsAndPlayoffs(tournamentId: string): Promise<{
  teams: Team[];
  standings: LolStanding[];
  playoffSections: PlayoffSection[];
  swissMatches: LolesportsStandingsMatch[];
}> {
  const data = await fetchLolesports<{
    data: { standings: LolesportsStandingsEntry[] };
  }>(`/getStandings?tournamentId=${tournamentId}`);

  const teamsMap = new Map<string, Team>();
  const rows: LolStanding[] = [];
  const playoffSections: PlayoffSection[] = [];
  const swissMatches: LolesportsStandingsMatch[] = [];

  for (const entry of data.data.standings) {
    for (const stage of entry.stages) {
      const isRegular = REGULAR_STAGE_SLUGS.has(stage.slug ?? "");
      const isBracket = isBracketStage(stage.slug);
      for (const section of stage.sections) {
        // Ranked nowhere (no table until it is played), so its teams and
        // matches are only here.
        if (stage.slug === "swiss") {
          for (const match of section.matches ?? []) {
            for (const team of match.teams) {
              if (team.code === "TBD") continue;
              const t = toTeam(team);
              if (!teamsMap.has(t.id)) teamsMap.set(t.id, t);
            }
            swissMatches.push(match);
          }
        }
        // Standings rows come from regular-season rankings.
        if (isRegular) {
          for (const ranking of section.rankings ?? []) {
            for (const team of ranking.teams) {
              const t = toTeam(team);
              if (!teamsMap.has(t.id)) teamsMap.set(t.id, t);
              rows.push({
                position: ranking.ordinal,
                teamId: t.id,
                wins: team.record?.wins ?? 0,
                losses: team.record?.losses ?? 0,
              });
            }
          }
        }
        // Bracket matches come from the playoff stages, split into rounds below.
        if (isBracket) {
          const sectionMatches = section.matches ?? [];
          if (sectionMatches.length === 0) continue;
          for (const match of sectionMatches) {
            for (const team of match.teams) {
              if (team.code === "TBD") continue;
              const t = toTeam(team);
              if (!teamsMap.has(t.id)) teamsMap.set(t.id, t);
            }
          }
          playoffSections.push({
            name: section.name ?? null,
            matches: sectionMatches,
          });
        }
      }
    }
  }

  const dedupedStandings = rows.filter(
    (row, idx, arr) => arr.findIndex((r) => r.teamId === row.teamId) === idx,
  );

  return {
    teams: Array.from(teamsMap.values()),
    standings: dedupedStandings,
    playoffSections,
    swissMatches,
  };
}

/**
 * Whether a scheduled event belongs to the tournament on screen.
 *
 * A league's schedule pages run across tournaments: LEC's newest page carried
 * the spring split alongside the summer one, and Worlds' carried last year's
 * knockouts. A day either side absorbs time zones.
 */
function withinTournament(
  startTime: string,
  tournament: LolesportsTournament | null,
): boolean {
  if (!tournament) return true;
  const day = startTime.slice(0, 10);
  const shiftDay = (date: string, by: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + by);
    return d.toISOString().slice(0, 10);
  };
  return shiftDay(tournament.startDate, -1) <= day && day <= shiftDay(tournament.endDate, 1);
}

async function getSchedule(
  leagueId: string,
  tournament: LolesportsTournament | null,
): Promise<{
  matches: LolMatch[];
  extraTeams: Team[];
  blockByMatchId: Map<string, string>;
  scheduleByMatchId: Map<string, ScheduledMatch>;
}> {
  const data = await fetchLolesports<{
    data: { schedule: { events: LolesportsEvent[] } };
  }>(`/getSchedule?leagueId=${leagueId}`);

  const teamsMap = new Map<string, Team>();
  const matches: LolMatch[] = [];
  const blockByMatchId = new Map<string, string>();
  const scheduleByMatchId = new Map<string, ScheduledMatch>();

  for (const event of data.data.schedule.events) {
    if (event.type !== "match" || !event.match) continue;
    if (!withinTournament(event.startTime, tournament)) continue;
    if (event.blockName) blockByMatchId.set(event.match.id, event.blockName);
    scheduleByMatchId.set(event.match.id, {
      date: event.startTime,
      bestOf: event.match.strategy?.count ?? 1,
    });
    const [home, away] = event.match.teams;
    if (!home || !away || home.code === "TBD" || away.code === "TBD") continue;

    const homeTeam = toTeam(home);
    const awayTeam = toTeam(away);
    if (!teamsMap.has(homeTeam.id)) teamsMap.set(homeTeam.id, homeTeam);
    if (!teamsMap.has(awayTeam.id)) teamsMap.set(awayTeam.id, awayTeam);

    const status = toMatchStatus(event.state);
    const isCompleted = status === "ft" || status === "live";

    matches.push({
      id: event.match.id,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      // A completed event missing `result` renders "—", not a fake 0–0.
      homeScore: isCompleted ? (home.result?.gameWins ?? null) : null,
      awayScore: isCompleted ? (away.result?.gameWins ?? null) : null,
      bestOf: (event.match.strategy?.count ?? 1) as 1 | 3 | 5,
      date: event.startTime,
      status,
      stageLabel: event.blockName,
    });
  }

  return {
    matches: orderMatchesForDisplay(
      matches,
      (m) => m.date,
      (m) => m.status
    ),
    extraTeams: Array.from(teamsMap.values()),
    blockByMatchId,
    scheduleByMatchId,
  };
}

function prettifyTournamentSlug(slug: string): string {
  // "lec_split_2_2026" → "Split 2"
  const parts = slug.split("_");
  const splitIdx = parts.findIndex((p) => p.toLowerCase() === "split");
  if (splitIdx >= 0 && parts[splitIdx + 1]) {
    return `Split ${parts[splitIdx + 1]}`;
  }
  // Capitalise everything except the league code and year
  return parts
    .filter((p) => !/^\d{4}$/.test(p))
    .slice(1)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

async function fetchSplit(
  target: TargetLeague,
  league: LolesportsLeague,
): Promise<LolSplit | null> {
  const tournament = await getCurrentTournament(league.id);
  // An international event is only worth a slot while it is on or just over;
  // the rest of the year it would be last season's results under this year.
  if (target.international && !isCurrentEvent(tournament)) return null;

  const noStandings = {
    teams: [] as Team[],
    standings: [] as LolStanding[],
    playoffSections: [] as PlayoffSection[],
    swissMatches: [] as LolesportsStandingsMatch[],
  };
  const [standingsRes, scheduleRes] = await Promise.all([
    tournament
      ? getStandingsAndPlayoffs(tournament.id).catch(() => noStandings)
      : Promise.resolve(noStandings),
    getSchedule(league.id, tournament),
  ]);
  // Built here rather than with the standings: the rounds are named by the
  // schedule's blocks.
  const playoffs =
    standingsRes.playoffSections.length > 0
      ? buildLolBracket(standingsRes.playoffSections, scheduleRes.blockByMatchId)
      : undefined;
  const swiss = buildSwissStage(standingsRes.swissMatches, scheduleRes.scheduleByMatchId);

  const teamsMap = new Map<string, Team>();
  for (const t of [...standingsRes.teams, ...scheduleRes.extraTeams]) {
    if (!teamsMap.has(t.id)) teamsMap.set(t.id, t);
  }
  const teams = Array.from(teamsMap.values());

  const standingsWithForm = standingsRes.standings.map((row) => ({
    ...row,
    form: deriveFormFromMatches(scheduleRes.matches, row.teamId),
  }));

  const seasonYear = tournament?.startDate.slice(0, 4) ?? String(new Date().getFullYear());
  const splitName = target.international
    ? `${league.name} ${seasonYear}`
    : tournament
      ? `${target.slug.toUpperCase()} ${prettifyTournamentSlug(tournament.slug)}`
      : `${target.slug.toUpperCase()} ${seasonYear}`;

  return {
    region: target.region,
    name: splitName,
    season: seasonYear,
    teams,
    standings: standingsWithForm,
    matches: scheduleRes.matches.slice(0, 24),
    ...(swiss ? { swiss } : {}),
    playoffs,
  };
}

async function fetchLolDataFromApi(): Promise<LolData> {
  // One leagues list for every target; it was being fetched once per region.
  const leagues = await fetchLolesports<{ data: { leagues: LolesportsLeague[] } }>(
    "/getLeagues",
  );
  const splits = await Promise.all(
    TARGET_LEAGUES.map((target) => {
      const league = leagues.data.leagues.find(
        (l) => l.slug.toLowerCase() === target.slug,
      );
      if (!league) return null;
      return fetchSplit(target, league).catch((err) => {
        console.warn(`Lolesports fetch failed for ${target.slug}:`, err);
        return null;
      });
    }),
  );
  const live = splits.filter((s): s is LolSplit => s !== null && s.teams.length > 0);
  if (live.length === 0) {
    throw new Error("Lolesports returned no splits");
  }
  return { splits: live };
}

export const getLolData = cachedFeed(
  "Lolesports",
  fetchLolDataFromApi,
  () => LOL_DATA,
  ["lolesports:lol-data"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:lol"] },
);

/** Pure mappers, exported for their tests — nothing here touches the network. */
export const __testing = {
  buildLolBracket,
  buildSwissStage,
  isBracketStage,
  isCurrentEvent,
  pickActiveTournament,
  withinTournament,
};
