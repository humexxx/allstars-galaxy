import "server-only";

import { LOL_DATA } from "@/lib/data/sports/lol";
import { orderMatchesForDisplay } from "@/lib/sports/match-order";
import type {
  BracketLink,
  BracketMatch,
  BracketRound,
  BracketRoundId,
  FormResult,
  LolChampion,
  LolData,
  LolMatch,
  LolRegion,
  LolSplit,
  LolStanding,
  LolUpcoming,
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
 * The leagues on the strip. Worlds was not on it at all, so October showed
 * September's finals. Which one leads is `orderSplits`' call; this order only
 * breaks its ties.
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

/** How many pages of a league's schedule to read looking for its tournament. */
const SCHEDULE_PAGES = 3;

/**
 * Lolesports draws its logos for a dark background, so every logo sits on
 * one. T1's red logo on T1's red disc vanished, as did Fnatic's orange.
 */
const LOGO_DISC = "#222";

/** Discs for the teams drawn as initials, when the API sends no logo. */
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

/** A league's tournament on now (or last played), its season so far, and the next one it lists. */
type LeagueTournaments = {
  current: LolesportsTournament | null;
  /** The season's tournaments that have started, first first; the current one among them. */
  season: LolesportsTournament[];
  next: LolesportsTournament | null;
};

/** The tournaments of `current`'s year that have started, in order. */
function seasonSoFar(
  tournaments: LolesportsTournament[],
  current: LolesportsTournament | null,
  today = todayIso(),
): LolesportsTournament[] {
  if (!current) return [];
  const year = current.startDate.slice(0, 4);
  return tournaments
    .filter((t) => t.startDate.slice(0, 4) === year && t.startDate <= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

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

type LolesportsSchedulePage = {
  pages?: { older?: string | null; newer?: string | null };
  events: LolesportsEvent[];
};

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
    primaryColor: ref.image
      ? LOGO_DISC
      : (FALLBACK_COLOR_BY_CODE[ref.code.toUpperCase()] ?? LOGO_DISC),
  };
}

function toMatchStatus(state: LolesportsEvent["state"]): MatchStatus {
  if (state === "inProgress") return "live";
  if (state === "completed") return "ft";
  return "scheduled";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Pick the tournament that's currently happening; if none, the most recently
 * ended one. Never pick a future tournament — those exist in the API (e.g.
 * Summer Split scheduled for July) but have no real data yet.
 */
function pickActiveTournament(
  tournaments: LolesportsTournament[],
  today = todayIso(),
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

/** The soonest tournament that has not started yet. */
function pickNextTournament(
  tournaments: LolesportsTournament[],
  today = todayIso(),
): LolesportsTournament | null {
  return (
    tournaments
      .filter((t) => t.startDate > today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null
  );
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

/**
 * Whether an international event is still the one to show: from its start
 * until the first regional tournament that starts after its final is under
 * way. Nothing else is played in between, and a fixed three weeks of grace
 * had December falling back to LEC's September final. With no regional
 * tournament listed after it yet, it stays.
 *
 * `regionalStarts` are the start days of the regional tournaments on now or
 * last played: one that started after the final has begun by definition.
 */
function isCurrentEvent(
  tournament: LolesportsTournament | null,
  regionalStarts: string[],
  today = todayIso(),
): tournament is LolesportsTournament {
  if (!tournament || tournament.startDate > today) return false;
  return !regionalStarts.some((start) => start > tournament.endDate && start <= today);
}

async function getLeagueTournaments(leagueId: string, today: string): Promise<LeagueTournaments> {
  const data = await fetchLolesports<{
    data: { leagues: Array<{ tournaments: LolesportsTournament[] }> };
  }>(`/getTournamentsForLeague?leagueId=${leagueId}`);
  const tournaments = data.data.leagues[0]?.tournaments ?? [];
  const current = pickActiveTournament(tournaments, today);
  return {
    current,
    season: seasonSoFar(tournaments, current, today),
    next: pickNextTournament(tournaments, today),
  };
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
  return !isPlayInStage(slug);
}

function isPlayInStage(slug: string | undefined): boolean {
  return /play[-_]?ins?/.test(slug ?? "");
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
  schedule: Map<string, ScheduledMatch> = new Map(),
): BracketRound[] {
  return withSchedule(buildLolRounds(sections, blockByMatchId), schedule);
}

/** Each tie's day and format, which only the schedule knows. */
function withSchedule(
  rounds: BracketRound[],
  schedule: Map<string, ScheduledMatch>,
): BracketRound[] {
  return rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => {
      const scheduled = schedule.get(match.id);
      return scheduled ? { ...match, date: scheduled.date, bestOf: scheduled.bestOf } : match;
    }),
  }));
}

function buildLolRounds(
  sections: PlayoffSection[],
  blockByMatchId: Map<string, string>,
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

const FINAL_ROUND = /^(grand )?finals?$/i;

/**
 * Who won the round named "Finals". Not the bracket's last round: LPL plays
 * a "Regional Qualifier" after its final, whose winner (IG) was not the
 * champion (AL).
 *
 * A bracket match names whoever leads as its winner, so a final at 1–0 would
 * crown somebody mid-series: the winner must have taken the majority of its
 * best-of, a best-of-five when the schedule never said.
 */
function findChampion(playoffs: BracketRound[] | undefined): LolChampion | null {
  const final = playoffs?.find((round) => FINAL_ROUND.test(round.label.trim()))?.matches.at(-1);
  if (!final?.winnerTeamId) return null;
  const wins = final.winnerTeamId === final.homeTeamId ? final.homeScore : final.awayScore;
  if ((wins ?? 0) < Math.ceil((final.bestOf ?? 5) / 2)) return null;
  return { teamId: final.winnerTeamId, final };
}

/** Rounds that are a plain knockout: each halving into the next, down to one final. */
function isKnockoutTree(rounds: BracketRound[]): boolean {
  return (
    rounds.length > 0 &&
    rounds[rounds.length - 1].matches.length === 1 &&
    rounds.every((r, i) => i === rounds.length - 1 || r.matches.length === rounds[i + 1].matches.length * 2)
  );
}

/** A team plays twice in one of them: several rounds the schedule did not tell apart. */
function mixesRounds(rounds: BracketRound[]): boolean {
  return rounds.some((round) => {
    const seen = new Set<string>();
    return round.matches.some((m) =>
      [m.homeTeamId, m.awayTeamId].some((id) => {
        if (!id) return false;
        if (seen.has(id)) return true;
        seen.add(id);
        return false;
      }),
    );
  });
}

/**
 * A stage the schedule does not split into rounds — MSI's double elimination
 * is one "Knockouts" block of thirteen and the final, its play-ins one block
 * of six — laid out by where its teams went, since the API links no match to
 * the ones feeding it. In the order they were played, each match sits one
 * column after the later of its teams' previous matches; one between two
 * teams that have both lost before is the lower bracket's; and each winner's
 * next match is linked to the one it won. A last column of one match is the
 * final.
 */
function flowBracket(
  matches: LolesportsStandingsMatch[],
  schedule: Map<string, ScheduledMatch>,
): { rounds: BracketRound[]; links: BracketLink[] } {
  const inOrder = matches
    .map((m, index) => {
      const match = toBracketMatch(m, `flow-${index}`);
      return { match, index, at: schedule.get(match.id)?.date ?? "" };
    })
    .sort((a, b) => a.at.localeCompare(b.at) || a.index - b.index);

  const column = new Map<string, number>();
  const previous = new Map<string, { id: string; won: boolean }>();
  const losses = new Map<string, number>();
  const links: BracketLink[] = [];
  const placed: Array<{ match: BracketMatch; column: number }> = [];
  let deepest = 0;
  for (const { match } of inOrder) {
    const teams = [match.homeTeamId, match.awayTeamId].filter((id): id is string => Boolean(id));
    const before = teams.flatMap((t) => {
      const p = previous.get(t);
      return p ? [p] : [];
    });
    const at = teams.length > 0 ? 1 + Math.max(0, ...before.map((p) => column.get(p.id) ?? 0)) : deepest + 1;
    column.set(match.id, at);
    deepest = Math.max(deepest, at);
    for (const p of before) if (p.won) links.push({ from: p.id, to: match.id });
    const lower = teams.length > 0 && teams.every((t) => (losses.get(t) ?? 0) > 0);
    placed.push({ match: { ...match, side: lower ? "lower" : "upper" }, column: at });
    for (const t of teams) {
      const won = match.winnerTeamId === t;
      previous.set(t, { id: match.id, won });
      if (match.winnerTeamId && !won) losses.set(t, (losses.get(t) ?? 0) + 1);
    }
  }

  const columns = Array.from({ length: deepest }, (_, i) =>
    placed
      .filter((p) => p.column === i + 1)
      .map((p) => p.match)
      // The upper bracket above the lower, each in the order played.
      .sort((a, b) => (a.side === b.side ? 0 : a.side === "upper" ? -1 : 1)),
  ).filter((c) => c.length > 0);
  const rounds = columns.map((list, i): BracketRound => ({
    id: `round-${i + 1}`,
    label: i === columns.length - 1 && list.length === 1 ? "Final" : `Round ${i + 1}`,
    matches: list,
  }));
  return { rounds: withSchedule(rounds, schedule), links };
}

/**
 * A stage's bracket: the schedule's blocks as its rounds, or — where a block
 * holds several rounds, as a double elimination's does — the rounds its
 * teams' paths make, with the branches between them.
 */
function buildStageBracket(
  sections: PlayoffSection[],
  blockByMatchId: Map<string, string>,
  schedule: Map<string, ScheduledMatch>,
): { rounds: BracketRound[]; links?: BracketLink[] } {
  const rounds = buildLolBracket(sections, blockByMatchId, schedule);
  if (isKnockoutTree(rounds) || !mixesRounds(rounds)) return { rounds };
  return flowBracket(sections.flatMap((s) => s.matches), schedule);
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
  playInSections: PlayoffSection[];
  swissMatches: LolesportsStandingsMatch[];
}> {
  const data = await fetchLolesports<{
    data: { standings: LolesportsStandingsEntry[] };
  }>(`/getStandings?tournamentId=${tournamentId}`);

  const teamsMap = new Map<string, Team>();
  const rows: LolStanding[] = [];
  const playoffSections: PlayoffSection[] = [];
  const playInSections: PlayoffSection[] = [];
  const swissMatches: LolesportsStandingsMatch[] = [];
  const addTeams = (matches: LolesportsStandingsMatch[]): void => {
    for (const match of matches) {
      for (const team of match.teams) {
        if (team.code === "TBD") continue;
        const t = toTeam(team);
        if (!teamsMap.has(t.id)) teamsMap.set(t.id, t);
      }
    }
  };

  for (const entry of data.data.standings) {
    for (const stage of entry.stages) {
      const isRegular = REGULAR_STAGE_SLUGS.has(stage.slug ?? "");
      const isBracket = isBracketStage(stage.slug);
      const isPlayIn = isPlayInStage(stage.slug);
      for (const section of stage.sections) {
        // Ranked nowhere (no table until it is played), so its teams and
        // matches are only here.
        if (stage.slug === "swiss") {
          const matches = section.matches ?? [];
          addTeams(matches);
          swissMatches.push(...matches);
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
        // An international event's play-ins: a bracket of their own, before
        // the event's main stage. A league's (LCK's) stay out of its playoffs.
        const playInMatches = isPlayIn ? (section.matches ?? []) : [];
        if (playInMatches.length > 0) {
          addTeams(playInMatches);
          playInSections.push({ name: section.name ?? null, matches: playInMatches });
        }
        // Bracket matches come from the playoff stages, split into rounds below.
        if (isBracket) {
          const sectionMatches = section.matches ?? [];
          if (sectionMatches.length === 0) continue;
          addTeams(sectionMatches);
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
    playInSections,
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

async function fetchSchedulePage(
  leagueId: string,
  pageToken?: string,
): Promise<LolesportsSchedulePage> {
  const page = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
  const data = await fetchLolesports<{ data: { schedule: LolesportsSchedulePage } }>(
    `/getSchedule?leagueId=${leagueId}${page}`,
  );
  return data.data.schedule;
}

/**
 * The tournament's events: off the league's schedule, or failing that its
 * completed events, so a split with standings always has its matches too.
 */
async function getTournamentEvents(
  leagueId: string,
  tournament: LolesportsTournament | null,
): Promise<LolesportsEvent[]> {
  const scheduled = await findInSchedule(leagueId, tournament);
  if (scheduled.length > 0 || !tournament) return scheduled;
  // Lolesports lists only the matches with a VOD here (four of LPL's split 3
  // 2026, none of its final), so it is the last resort, not the source.
  return getCompletedEvents(tournament.id).catch((err: unknown) => {
    console.warn(`Lolesports completed events failed for ${tournament.slug}:`, err);
    return [];
  });
}

/** Every completed event of a tournament. They come without a type or state. */
async function getCompletedEvents(tournamentId: string): Promise<LolesportsEvent[]> {
  const data = await fetchLolesports<{
    data: { schedule: { events: Omit<LolesportsEvent, "type" | "state">[] } };
  }>(`/getCompletedEvents?tournamentId=${tournamentId}`);
  return data.data.schedule.events.map((e) => ({ ...e, type: "match", state: "completed" }));
}

/**
 * The tournament's events off the league's schedule.
 *
 * The first page is the league's newest. Once next season is scheduled it can
 * hold nothing but next season, and the split on screen — the one that last
 * ended — kept its standings and lost every match. So while a page has none of
 * the tournament and starts after it ended, the page before it is read too.
 */
async function findInSchedule(
  leagueId: string,
  tournament: LolesportsTournament | null,
): Promise<LolesportsEvent[]> {
  let page = await fetchSchedulePage(leagueId);
  for (let read = 1; ; read++) {
    const events = page.events.filter((e) => withinTournament(e.startTime, tournament));
    if (events.length > 0 || !tournament || read >= SCHEDULE_PAGES) return events;
    const earliest = page.events.reduce<string | null>(
      (min, e) => (min === null || e.startTime < min ? e.startTime : min),
      null,
    );
    // A page that reaches back past the tournament without any of it means
    // there is none of it to find.
    if (!earliest || earliest.slice(0, 10) <= tournament.endDate || !page.pages?.older) {
      return events;
    }
    // An older page that fails ends the search, not the split: the completed
    // events stand in, and the standings and bracket stand regardless.
    const older = await fetchSchedulePage(leagueId, page.pages.older).catch((err: unknown) => {
      console.warn(`Lolesports older schedule page failed for ${leagueId}:`, err);
      return null;
    });
    if (!older) return events;
    page = older;
  }
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
  const events = await getTournamentEvents(leagueId, tournament);

  const teamsMap = new Map<string, Team>();
  const matches: LolMatch[] = [];
  const blockByMatchId = new Map<string, string>();
  const scheduleByMatchId = new Map<string, ScheduledMatch>();

  for (const event of events) {
    if (event.type !== "match" || !event.match) continue;
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

function seasonOf(tournament: LolesportsTournament | null): string {
  return tournament?.startDate.slice(0, 4) ?? String(new Date().getFullYear());
}

/** "Worlds 2026", "LEC Split 3". */
function tournamentName(
  target: TargetLeague,
  league: LolesportsLeague,
  tournament: LolesportsTournament | null,
): string {
  if (target.international) return `${league.name} ${seasonOf(tournament)}`;
  return tournament
    ? `${target.slug.toUpperCase()} ${prettifyTournamentSlug(tournament.slug)}`
    : `${target.slug.toUpperCase()} ${seasonOf(tournament)}`;
}

async function fetchSplit(
  target: TargetLeague,
  league: LolesportsLeague,
  tournament: LolesportsTournament | null,
  season: LolesportsTournament[],
): Promise<LolSplit> {
  const noStandings = {
    teams: [] as Team[],
    standings: [] as LolStanding[],
    playoffSections: [] as PlayoffSection[],
    playInSections: [] as PlayoffSection[],
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
  const stage = (sections: PlayoffSection[]) =>
    sections.length > 0
      ? buildStageBracket(sections, scheduleRes.blockByMatchId, scheduleRes.scheduleByMatchId)
      : undefined;
  const playoffStage = stage(standingsRes.playoffSections);
  const playoffs = playoffStage?.rounds;
  // Only an international event's: a league's play-ins decide its bracket's
  // last seeds and are not a stage worth a tab.
  const playIns = target.international ? stage(standingsRes.playInSections) : undefined;
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

  const champion = findChampion(playoffs);

  return {
    region: target.region,
    name: tournamentName(target, league, tournament),
    season: seasonOf(tournament),
    ...(tournament ? { tournamentId: tournament.id } : {}),
    // A league's earlier splits this season, to move between from inside it.
    ...(!target.international && season.length > 1
      ? { seasonSplits: season.map((t) => ({ id: t.id, name: tournamentName(target, league, t) })) }
      : {}),
    ...(target.international ? { international: true } : {}),
    teams,
    standings: standingsWithForm,
    matches: scheduleRes.matches.slice(0, 24),
    ...(playIns && playIns.rounds.length > 0
      ? { playIns: playIns.rounds, ...(playIns.links ? { playInLinks: playIns.links } : {}) }
      : {}),
    ...(swiss ? { swiss } : {}),
    playoffs,
    ...(playoffStage?.links ? { playoffLinks: playoffStage.links } : {}),
    ...(champion ? { champion } : {}),
  };
}

type FetchedSplit = {
  split: LolSplit;
  tournament: LolesportsTournament | null;
  /** An international event that is no longer the one being played: it goes by its end date. */
  over?: boolean;
};

/**
 * The current international event, then the regional splits being played
 * today, then the rest by how recently they ended. The dashboard card shows
 * the first: in a fixed league order it would have kept LEC's September final
 * up after LCK and LPL had started the new season.
 */
function orderSplits(fetched: FetchedSplit[], today = todayIso()): LolSplit[] {
  const rank = ({ split, tournament, over }: FetchedSplit): number => {
    if (split.international && !over) return 0;
    if (tournament && tournament.startDate <= today && today <= tournament.endDate) return 1;
    return 2;
  };
  return [...fetched]
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (rank(a) === 2
          ? (b.tournament?.endDate ?? "").localeCompare(a.tournament?.endDate ?? "")
          : 0),
    )
    .map(({ split }) => split);
}

async function fetchLolDataFromApi(): Promise<LolData> {
  const today = todayIso();
  // One leagues list for every target; it was being fetched once per region.
  const leagues = await fetchLolesports<{ data: { leagues: LolesportsLeague[] } }>(
    "/getLeagues",
  );
  const targets = TARGET_LEAGUES.flatMap((target) => {
    const league = leagues.data.leagues.find((l) => l.slug.toLowerCase() === target.slug);
    return league ? [{ target, league }] : [];
  });
  // Every league's tournaments before any split: whether an international
  // event is still the one to show depends on when the regional ones start.
  const listed = (
    await Promise.all(
      targets.map(({ target, league }) =>
        getLeagueTournaments(league.id, today).then(
          (tournaments) => ({ target, league, ...tournaments }),
          (err: unknown) => {
            console.warn(`Lolesports fetch failed for ${target.slug}:`, err);
            return null;
          },
        ),
      ),
    )
  ).filter((l) => l !== null);
  const regionalStarts = listed.flatMap((l) =>
    !l.target.international && l.current ? [l.current.startDate] : [],
  );

  const fetched = await Promise.all(
    listed.map(async ({ target, league, current, season }): Promise<FetchedSplit | null> => {
      // The event being played leads; this season's earlier ones (MSI in
      // October) stay to be looked back on. Last season's do not.
      const isCurrent = target.international && isCurrentEvent(current, regionalStarts, today);
      const thisSeason = current !== null && current.startDate.slice(0, 4) === today.slice(0, 4);
      if (target.international && !isCurrent && !thisSeason) return null;
      try {
        return {
          split: await fetchSplit(target, league, current, season),
          tournament: current,
          ...(target.international && !isCurrent ? { over: true } : {}),
        };
      } catch (err) {
        console.warn(`Lolesports fetch failed for ${target.slug}:`, err);
        return null;
      }
    }),
  );
  const live = fetched.filter(
    (f): f is FetchedSplit => f !== null && f.split.teams.length > 0,
  );
  if (live.length === 0) {
    throw new Error("Lolesports returned no splits");
  }

  const upcoming = listed
    .flatMap(({ target, league, next }): LolUpcoming[] =>
      next
        ? [{ region: target.region, name: tournamentName(target, league, next), startDate: next.startDate }]
        : [],
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return { splits: orderSplits(live, today), upcoming };
}

/**
 * One of a league's splits this season, for the view to move to from the
 * split on screen. Only a tournament of that league, of this season and
 * started, is read — the id arrives from the browser. A day's cache: a split
 * that is over does not change, and the one being played is the feed's.
 */
async function fetchLeagueSplit(region: LolRegion, tournamentId: string): Promise<LolSplit | null> {
  const target = TARGET_LEAGUES.find((t) => t.region === region && !t.international);
  if (!target) return null;
  const leagues = await fetchLolesports<{ data: { leagues: LolesportsLeague[] } }>("/getLeagues");
  const league = leagues.data.leagues.find((l) => l.slug.toLowerCase() === target.slug);
  if (!league) return null;
  const { season } = await getLeagueTournaments(league.id, todayIso());
  const tournament = season.find((t) => t.id === tournamentId);
  if (!tournament) return null;
  return fetchSplit(target, league, tournament, season);
}

export const getLolSplit = cachedFeed(
  "Lolesports split",
  fetchLeagueSplit,
  (): LolSplit | null => null,
  ["lolesports:split"],
  { revalidate: 86_400, tags: ["sports:lol"] },
);

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
  buildStageBracket,
  buildSwissStage,
  flowBracket,
  findChampion,
  isBracketStage,
  isCurrentEvent,
  orderSplits,
  pickActiveTournament,
  pickNextTournament,
  seasonSoFar,
  toTeam,
  withinTournament,
};
