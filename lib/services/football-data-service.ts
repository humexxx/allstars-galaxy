import "server-only";

import { getFootballLeague } from "@/lib/data/sports/football";
import { WORLD_CUP_DATA } from "@/lib/data/sports/world-cup";
import { orderMatchesForDisplay } from "@/lib/sports/match-order";
import type {
  BracketMatch,
  BracketRound,
  BracketRoundId,
  FootballGroupStandings,
  FootballLeagueData,
  FootballLeagueId,
  FormResult,
  Match,
  MatchStatus,
  Standing,
  StandingBand,
  Team,
} from "@/types/sports";
import { cachedFeed, upstreamSignal } from "./upstream";

const BASE_URL = "https://api.football-data.org/v4";
// 5 minutes: short enough that live scores are near-current when the user
// lands. Each competition is its own cache entry (2 calls; the World Cup 1),
// so a refresh never has to spend the whole minute's budget at once.
const REVALIDATE_SECONDS = 300;
// Wide enough to stay populated for competitions between rounds (e.g. UCL
// knockout, or a domestic league in its off-week). Matches are capped below.
const MATCH_WINDOW_DAYS = 60;
const MAX_MATCHES = 40;

type CompetitionConfig = {
  internalId: FootballLeagueId;
  code: string;
  shortName: string;
  name: string;
  region: string;
  hasKnockout: boolean;
};

const COMPETITIONS: CompetitionConfig[] = [
  {
    internalId: "uefa-champions-league",
    code: "CL",
    shortName: "UCL",
    name: "UEFA Champions League",
    region: "UEFA",
    hasKnockout: true,
  },
  {
    internalId: "la-liga",
    code: "PD",
    shortName: "La Liga",
    name: "LaLiga",
    region: "ESP",
    hasKnockout: false,
  },
  {
    internalId: "premier-league",
    code: "PL",
    shortName: "EPL",
    name: "Premier League",
    region: "ENG",
    hasKnockout: false,
  },
  {
    internalId: "serie-a",
    code: "SA",
    shortName: "Serie A",
    name: "Serie A",
    region: "ITA",
    hasKnockout: false,
  },
];

// Knockout fixtures whose participants are not decided yet (e.g. World Cup
// quarter-finals while the round of 16 is in play) come back with every team
// field null.
type FdTeam = {
  id: number | null;
  name: string | null;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
};

type FdGoals = { home: number | null; away: number | null };

type FdScore = {
  fullTime: FdGoals;
  halfTime?: FdGoals;
  regularTime?: FdGoals;
  extraTime?: FdGoals;
  /** "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT" — how the match was decided. */
  duration?: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
  penalties?: FdGoals | null;
};

type FdMatch = {
  id: number;
  utcDate: string;
  status:
    | "SCHEDULED"
    | "TIMED"
    | "IN_PLAY"
    | "PAUSED"
    | "FINISHED"
    | "POSTPONED"
    | "CANCELLED"
    | "SUSPENDED";
  matchday: number | null;
  stage?: string;
  group?: string | null;
  score: FdScore;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
};

const LEAGUE_STAGES = new Set([
  "LEAGUE_STAGE",
  "GROUP_STAGE",
  "REGULAR_SEASON",
]);

const KNOCKOUT_STAGE_LABELS: Record<string, string> = {
  PRELIMINARY_ROUND: "Preliminary",
  FIRST_QUALIFYING_ROUND: "Q1",
  SECOND_QUALIFYING_ROUND: "Q2",
  THIRD_QUALIFYING_ROUND: "Q3",
  PLAYOFF_ROUND: "Play-offs",
  PLAY_OFFS: "Play-offs",
  LAST_32: "Round of 32",
  ROUND_OF_32: "Round of 32",
  LAST_16: "Round of 16",
  ROUND_OF_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  THIRD_PLACE: "Third place",
  FINAL: "Final",
};

/**
 * football-data tags knockout legs with matchday 1/2, so a naive "Matchday N"
 * label conflates Round-of-16, QF, SF. Use the real stage name for knockout
 * rounds and reserve "Matchday N" for league/group play.
 */
function matchStageLabel(m: FdMatch): string | undefined {
  const stage = m.stage ?? "";
  if (LEAGUE_STAGES.has(stage)) {
    return m.matchday ? `Matchday ${m.matchday}` : undefined;
  }
  const known = KNOCKOUT_STAGE_LABELS[stage];
  if (known) return known;
  if (m.matchday) return `Matchday ${m.matchday}`;
  if (!stage) return undefined;
  // Fallback: prettify an unknown SCREAMING_SNAKE stage.
  return stage
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type FdTableRow = {
  position: number;
  team: FdTeam;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form?: string;
};

type FdStandingsResponse = {
  season: { startDate: string; endDate: string };
  standings: Array<{
    stage?: string;
    type?: string;
    group?: string;
    table: FdTableRow[];
  }>;
};

type FdMatchesResponse = { matches: FdMatch[] };

const ZONE_BAND_DEFAULTS: Record<FootballLeagueId, (pos: number, total: number) => StandingBand> = {
  "premier-league": (pos, total) => {
    if (pos <= 4) return "champions";
    if (pos === 5) return "europa";
    if (pos === 6) return "conference";
    if (pos > total - 3) return "relegation";
    return null;
  },
  "la-liga": (pos, total) => {
    if (pos <= 4) return "champions";
    if (pos === 5) return "europa";
    if (pos === 6) return "conference";
    if (pos > total - 3) return "relegation";
    return null;
  },
  "serie-a": (pos, total) => {
    if (pos <= 4) return "champions";
    if (pos === 5) return "europa";
    if (pos === 6) return "conference";
    if (pos > total - 3) return "relegation";
    return null;
  },
  "uefa-champions-league": (pos) => {
    if (pos <= 8) return "champions";
    if (pos <= 24) return "playoff";
    return null;
  },
  // 2026 format: top 2 advance directly, the 8 best third-placed teams join
  // them — mark 3rd as "playoff" since advancing depends on other groups.
  "world-cup": (pos) => {
    if (pos <= 2) return "champions";
    if (pos === 3) return "playoff";
    return null;
  },
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function teamFromFd(team: FdTeam | null | undefined): Team | null {
  const name = team?.name;
  if (!name) return null;
  const shortName = team.shortName ?? name;
  const code = team.tla ?? shortName.slice(0, 3).toUpperCase();
  return {
    id: slugify(shortName),
    name,
    shortName,
    code,
    logoUrl: team.crest ?? undefined,
    primaryColor: undefined,
  };
}

function mapMatchStatus(s: FdMatch["status"], score?: FdScore): MatchStatus {
  switch (s) {
    case "IN_PLAY":
    case "PAUSED":
    case "SUSPENDED":
      return "live";
    case "FINISHED":
      // Cup matches decided after 90' carry score.duration — surface AET/PEN
      // instead of a plain FT (a level fullTime score with "FT" reads as an
      // unresolved draw in a knockout).
      if (score?.duration === "PENALTY_SHOOTOUT") return "pen";
      if (score?.duration === "EXTRA_TIME") return "aet";
      return "ft";
    case "POSTPONED":
      return "postponed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "scheduled";
  }
}

type Goals = {
  home: number | null;
  away: number | null;
  penalties?: { home: number; away: number };
};

/**
 * The match score, with a shoot-out carried beside it rather than inside it.
 *
 * football-data folds the penalties into `fullTime`: Germany 1–1 Paraguay,
 * 3–4 on penalties, arrives as 4–5. `regularTime + extraTime` is the score the
 * match actually finished on.
 */
function goalsOf(score: FdScore): Goals {
  const { home, away } = score.fullTime;
  const pens = score.penalties;
  if (score.duration !== "PENALTY_SHOOTOUT" || pens?.home == null || pens.away == null) {
    return { home, away };
  }
  const played = score.regularTime;
  const extra = score.extraTime;
  return {
    home:
      played?.home != null
        ? played.home + (extra?.home ?? 0)
        : home === null ? null : home - pens.home,
    away:
      played?.away != null
        ? played.away + (extra?.away ?? 0)
        : away === null ? null : away - pens.away,
    penalties: { home: pens.home, away: pens.away },
  };
}

function parseForm(form: string | null | undefined): FormResult[] | undefined {
  if (!form) return undefined;
  const tokens = form
    .split(/[,\s]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  if (tokens.length === 0) return undefined;
  return tokens.slice(0, 5).map((t): FormResult => {
    if (t === "W" || t === "D" || t === "L") return t;
    return "-";
  });
}

/**
 * Last five results per team, most recent first, from the matches already
 * fetched. The free tier sends `form: null` on every standings row, so the
 * table's form column never rendered.
 */
function formFromMatches(matches: FdMatch[]): Map<string, FormResult[]> {
  const finished = matches
    .filter((m) => m.status === "FINISHED")
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate));
  const form = new Map<string, FormResult[]>();
  for (const m of finished) {
    const home = teamFromFd(m.homeTeam);
    const away = teamFromFd(m.awayTeam);
    const { home: hg, away: ag } = goalsOf(m.score);
    if (!home || !away || hg === null || ag === null) continue;
    for (const [team, scored, conceded] of [
      [home, hg, ag],
      [away, ag, hg],
    ] as const) {
      const list = form.get(team.id) ?? [];
      if (list.length >= 5) continue;
      list.push(scored > conceded ? "W" : scored < conceded ? "L" : "D");
      form.set(team.id, list);
    }
  }
  return form;
}

/**
 * The free tier allows ten requests a minute per KEY, and the key is shared:
 * production, previews and every local dev server draw on the same ten. This
 * process cannot count the others' requests, so it reads the provider's own
 * counter off each response and stops asking once the minute is spent — a
 * request sent into a spent minute only earns a 429.
 */
const budget = { spentUntil: 0 };

function noteBudget(res: Response, now = Date.now()): void {
  const left = res.headers.get("x-requests-available-minute");
  const reset = Number(res.headers.get("x-requestcounter-reset"));
  if (res.status === 429 || (left !== null && Number(left) <= 0)) {
    budget.spentUntil = now + (Number.isFinite(reset) && reset > 0 ? reset : 60) * 1000;
  }
}

/**
 * Two requests in flight at most. Firing a whole cold refresh at once meant
 * eight requests left before the first response could say the minute was
 * nearly gone; queued, each one checks the budget the last one reported.
 */
const MAX_IN_FLIGHT = 2;
let inFlight = 0;
const waiting: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight += 1;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
}

function releaseSlot(): void {
  const next = waiting.shift();
  if (next) next();
  else inFlight -= 1;
}

async function fetchFd<T>(path: string): Promise<T> {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) throw new Error("FOOTBALL_DATA_API_KEY not configured");
  await acquireSlot();
  try {
    if (Date.now() < budget.spentUntil) {
      throw new Error(`football-data minute spent, skipped ${path}`);
    }
    const res = await fetch(`${BASE_URL}${path}`, {
      signal: upstreamSignal(),
      headers: { "X-Auth-Token": token },
    });
    noteBudget(res);
    if (!res.ok) {
      throw new Error(`football-data ${res.status} on ${path}`);
    }
    return (await res.json()) as T;
  } finally {
    releaseSlot();
  }
}

function windowDates(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - MATCH_WINDOW_DAYS);
  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + MATCH_WINDOW_DAYS);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function mapStandings(
  competition: CompetitionConfig,
  rows: FdTableRow[],
  formByTeam: Map<string, FormResult[]> = new Map(),
): { standings: Standing[]; teams: Team[] } {
  const teamsMap = new Map<string, Team>();
  const total = rows.length;
  const standings: Standing[] = [];
  for (const row of rows) {
    const team = teamFromFd(row.team);
    if (!team) continue;
    if (!teamsMap.has(team.id)) teamsMap.set(team.id, team);
    standings.push({
      position: row.position,
      teamId: team.id,
      played: row.playedGames,
      won: row.won,
      drawn: row.draw,
      lost: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      points: row.points,
      form: parseForm(row.form) ?? formByTeam.get(team.id),
      band: ZONE_BAND_DEFAULTS[competition.internalId](row.position, total),
    });
  }
  return { standings, teams: Array.from(teamsMap.values()) };
}

function mapMatches(
  matches: FdMatch[],
  teamsMap: Map<string, Team>,
): Match[] {
  const mapped: Match[] = [];
  for (const m of matches) {
    const home = teamFromFd(m.homeTeam);
    const away = teamFromFd(m.awayTeam);
    // TBD-vs-TBD fixtures (undecided knockout pairings) belong in the bracket,
    // not the flat match list.
    if (!home || !away) continue;
    if (!teamsMap.has(home.id)) teamsMap.set(home.id, home);
    if (!teamsMap.has(away.id)) teamsMap.set(away.id, away);
    const goals = goalsOf(m.score);
    mapped.push({
      id: `m-${m.id}`,
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeScore: goals.home,
      awayScore: goals.away,
      penalties: goals.penalties,
      kickoff: m.utcDate,
      status: mapMatchStatus(m.status, m.score),
      stageLabel: matchStageLabel(m),
    });
  }
  return mapped;
}

type FdScoreWithWinner = FdScore & {
  winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
};

// Knockout rounds we render, ordered final-ward. PLAYOFFS (UCL's pre-R16
// knockout) is intentionally omitted to keep the bracket to four clean columns.
// LAST_32 and THIRD_PLACE only occur in cup tournaments (World Cup).
const KNOCKOUT_ROUND_ORDER: Array<{
  stage: string;
  id: BracketRoundId;
  label: string;
}> = [
  { stage: "LAST_32", id: "round-of-32", label: "Round of 32" },
  { stage: "ROUND_OF_32", id: "round-of-32", label: "Round of 32" },
  { stage: "LAST_16", id: "round-of-16", label: "Round of 16" },
  { stage: "ROUND_OF_16", id: "round-of-16", label: "Round of 16" },
  { stage: "QUARTER_FINALS", id: "quarter-final", label: "Quarterfinals" },
  { stage: "SEMI_FINALS", id: "semi-final", label: "Semifinals" },
  { stage: "THIRD_PLACE", id: "third-place", label: "Third place" },
  { stage: "FINAL", id: "final", label: "Final" },
];

function tieKey(aId: string, bId: string): string {
  return [aId, bId].sort().join("__");
}

/**
 * Collapse a stage's matches into bracket ties. Two-legged ties (R16→SF) appear
 * as two matches with home/away swapped; we pair them by team set, keep leg 1's
 * orientation, and compute the aggregate + winner. The final is a single match.
 */
function buildRoundFromStage(
  stageMatches: FdMatch[],
  round: { id: BracketRoundId; label: string },
  teamsMap: Map<string, Team>,
): BracketRound | null {
  const sorted = [...stageMatches].sort(
    (a, b) => (a.matchday ?? 0) - (b.matchday ?? 0),
  );
  const ties = new Map<
    string,
    { homeId: string | null; awayId: string | null; legs: FdMatch[] }
  >();

  for (const m of sorted) {
    const home = teamFromFd(m.homeTeam);
    const away = teamFromFd(m.awayTeam);
    if (home && !teamsMap.has(home.id)) teamsMap.set(home.id, home);
    if (away && !teamsMap.has(away.id)) teamsMap.set(away.id, away);
    // Undecided pairings (TBD teams) can't be keyed by team set — keep each
    // fixture as its own single-leg tie so the bracket still shows the slot.
    const key =
      home && away ? tieKey(home.id, away.id) : `fixture-${m.id}`;
    const existing = ties.get(key);
    if (existing) {
      existing.legs.push(m);
    } else {
      ties.set(key, {
        homeId: home?.id ?? null,
        awayId: away?.id ?? null,
        legs: [m],
      });
    }
  }

  const matches: BracketMatch[] = [];
  for (const tie of ties.values()) {
    const [leg1, leg2] = tie.legs;
    const homeId = tie.homeId;
    const awayId = tie.awayId;

    if (tie.legs.length === 1) {
      // Single match (final, or one-legged round).
      const ft = goalsOf(leg1.score);
      const winner = (leg1.score as FdScoreWithWinner).winner;
      matches.push({
        id: `m-${leg1.id}`,
        homeTeamId: homeId,
        awayTeamId: awayId,
        homeScore: ft.home,
        awayScore: ft.away,
        winnerTeamId:
          winner === "HOME_TEAM" ? homeId : winner === "AWAY_TEAM" ? awayId : null,
        date: leg1.utcDate,
      });
      continue;
    }

    // Two legs. Leg 2 swaps home/away, so re-orient to the tie's home team.
    const l1 = goalsOf(leg1.score);
    const l2 = goalsOf(leg2.score);
    const l2HomeForTie = teamFromFd(leg2.homeTeam)?.id === homeId;
    const leg2HomeGoals = l2HomeForTie ? l2.home : l2.away;
    const leg2AwayGoals = l2HomeForTie ? l2.away : l2.home;
    // Aggregate + winner exist only once BOTH legs are final. Summing with
    // `?? 0` while leg 2 is merely scheduled fabricated an aggregate (null
    // goals counted as 0) and bolded a "winner" mid-tie.
    const bothLegsFinished =
      leg1.status === "FINISHED" && leg2.status === "FINISHED";
    const aggHome = bothLegsFinished
      ? (l1.home ?? 0) + (leg2HomeGoals ?? 0)
      : null;
    const aggAway = bothLegsFinished
      ? (l1.away ?? 0) + (leg2AwayGoals ?? 0)
      : null;
    const decisiveWinner = (leg2.score as FdScoreWithWinner).winner;
    const winnerTeamId =
      aggHome === null || aggAway === null
        ? null
        : aggHome > aggAway
          ? homeId
          : aggAway > aggHome
            ? awayId
            : decisiveWinner === "HOME_TEAM"
              ? (l2HomeForTie ? homeId : awayId)
              : decisiveWinner === "AWAY_TEAM"
                ? (l2HomeForTie ? awayId : homeId)
                : null;

    matches.push({
      id: `m-${leg1.id}`,
      homeTeamId: homeId,
      awayTeamId: awayId,
      legs: [
        { homeScore: l1.home, awayScore: l1.away },
        { homeScore: leg2HomeGoals, awayScore: leg2AwayGoals },
      ],
      aggregateHome: aggHome,
      aggregateAway: aggAway,
      winnerTeamId,
    });
  }

  if (matches.length === 0) return null;
  return { id: round.id, label: round.label, matches };
}

function buildKnockoutBracket(
  matches: FdMatch[],
  teamsMap: Map<string, Team>,
): BracketRound[] | undefined {
  const byStage = new Map<string, FdMatch[]>();
  for (const m of matches) {
    const stage = m.stage ?? "";
    if (LEAGUE_STAGES.has(stage)) continue;
    (byStage.get(stage) ?? byStage.set(stage, []).get(stage)!).push(m);
  }

  const rounds: BracketRound[] = [];
  for (const round of KNOCKOUT_ROUND_ORDER) {
    const stageMatches = byStage.get(round.stage);
    if (!stageMatches || stageMatches.length === 0) continue;
    const built = buildRoundFromStage(stageMatches, round, teamsMap);
    if (built) rounds.push(built);
  }

  return rounds.length > 0 ? rounds : undefined;
}

function prettyGroupLabel(key: string): string {
  const short = key.match(/^GROUP_(\w+)$/);
  if (short) return `Group ${short[1]}`;
  return key
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Derive per-group tables from GROUP_STAGE matches. Cup tournaments (World
 * Cup) expose standings as 12 separate group blocks; computing them from the
 * matches we already fetched saves the extra standings request.
 */
function buildGroupStandings(
  matches: FdMatch[],
  teamsMap: Map<string, Team>,
): FootballGroupStandings[] {
  const byGroup = new Map<string, FdMatch[]>();
  for (const m of matches) {
    if (m.stage !== "GROUP_STAGE" || !m.group) continue;
    (byGroup.get(m.group) ?? byGroup.set(m.group, []).get(m.group)!).push(m);
  }

  type Row = {
    team: Team;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  };

  const groups: FootballGroupStandings[] = [];
  const sortedGroups = [...byGroup.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  for (const [groupKey, groupMatches] of sortedGroups) {
    const rows = new Map<string, Row>();
    const rowFor = (team: Team): Row => {
      const existing = rows.get(team.id);
      if (existing) return existing;
      const created: Row = {
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      };
      rows.set(team.id, created);
      return created;
    };

    for (const m of groupMatches) {
      const home = teamFromFd(m.homeTeam);
      const away = teamFromFd(m.awayTeam);
      if (!home || !away) continue;
      if (!teamsMap.has(home.id)) teamsMap.set(home.id, home);
      if (!teamsMap.has(away.id)) teamsMap.set(away.id, away);
      const homeRow = rowFor(home);
      const awayRow = rowFor(away);
      if (m.status !== "FINISHED") continue;
      const { home: hg, away: ag } = goalsOf(m.score);
      if (hg === null || ag === null) continue;
      homeRow.played += 1;
      awayRow.played += 1;
      homeRow.goalsFor += hg;
      homeRow.goalsAgainst += ag;
      awayRow.goalsFor += ag;
      awayRow.goalsAgainst += hg;
      if (hg > ag) {
        homeRow.won += 1;
        homeRow.points += 3;
        awayRow.lost += 1;
      } else if (hg < ag) {
        awayRow.won += 1;
        awayRow.points += 3;
        homeRow.lost += 1;
      } else {
        homeRow.drawn += 1;
        awayRow.drawn += 1;
        homeRow.points += 1;
        awayRow.points += 1;
      }
    }

    const ordered = [...rows.values()].sort(
      (a, b) =>
        b.points - a.points ||
        b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
        b.goalsFor - a.goalsFor ||
        a.team.shortName.localeCompare(b.team.shortName),
    );
    const total = ordered.length;
    groups.push({
      label: prettyGroupLabel(groupKey),
      standings: ordered.map((row, idx) => ({
        position: idx + 1,
        teamId: row.team.id,
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        points: row.points,
        band: ZONE_BAND_DEFAULTS["world-cup"](idx + 1, total),
      })),
    });
  }
  return groups;
}

const WORLD_CUP: CompetitionConfig = {
  internalId: "world-cup",
  code: "WC",
  shortName: "World Cup",
  name: "FIFA World Cup 2026",
  region: "FIFA",
  hasKnockout: true,
};

async function fetchWorldCupFromApi(): Promise<FootballLeagueData> {
  // One full-season matches call covers the group tables AND the bracket; the
  // standings endpoint is skipped to stay inside the free 10 req/min budget.
  const matchesRes = await fetchFd<FdMatchesResponse>(
    `/competitions/${WORLD_CUP.code}/matches`,
  );
  if (matchesRes.matches.length === 0) {
    throw new Error("football-data: empty World Cup season");
  }
  const teamsMap = new Map<string, Team>();
  const groups = buildGroupStandings(matchesRes.matches, teamsMap);
  const knockout = buildKnockoutBracket(matchesRes.matches, teamsMap);
  const matches = orderMatchesForDisplay(
    mapMatches(matchesRes.matches, teamsMap),
    (m) => m.kickoff,
    (m) => m.status,
    MAX_MATCHES,
  );
  const seasonYear = matchesRes.matches[0]?.utcDate.slice(0, 4) ?? "2026";

  return {
    league: {
      id: WORLD_CUP.internalId,
      name: WORLD_CUP.name,
      shortName: WORLD_CUP.shortName,
      region: WORLD_CUP.region,
      hasKnockout: true,
      season: seasonYear,
    },
    teams: Array.from(teamsMap.values()),
    matches,
    standings: [],
    groups,
    knockout,
  };
}

export const getWorldCupData = cachedFeed(
  "football-data World Cup",
  fetchWorldCupFromApi,
  () => WORLD_CUP_DATA,
  ["football-data:world-cup"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:worldcup"] },
);

async function fetchLeague(
  competition: CompetitionConfig,
): Promise<FootballLeagueData> {
  // Knockout competitions fetch the full season once and derive BOTH the recent
  // matches and the bracket from it — this avoids a second matches call and
  // keeps the per-cold-load football-data request count within the free 10/min
  // limit. League-only competitions use a tighter ±60d window.
  const window = windowDates();
  const matchesPath = competition.hasKnockout
    ? `/competitions/${competition.code}/matches`
    : `/competitions/${competition.code}/matches?dateFrom=${window.from}&dateTo=${window.to}`;
  // Both or neither: a league cached without its matches looked like a live
  // table with nothing played, and stayed that way for the whole window.
  const [standingsRes, matchesRes] = await Promise.all([
    fetchFd<FdStandingsResponse>(`/competitions/${competition.code}/standings`),
    fetchFd<FdMatchesResponse>(matchesPath),
  ]);

  const tableBlock =
    standingsRes.standings.find(
      (s) => s.type === "TOTAL" && (!s.group || s.group === "League phase"),
    ) ??
    standingsRes.standings.find((s) => s.type === "TOTAL") ??
    standingsRes.standings[0];

  if (!tableBlock?.table?.length) {
    throw new Error(`football-data: empty standings for ${competition.code}`);
  }

  const seasonStart = standingsRes.season.startDate.slice(0, 4);
  const seasonEnd = standingsRes.season.endDate.slice(2, 4);

  const { standings, teams: standingsTeams } = mapStandings(
    competition,
    tableBlock.table,
    formFromMatches(matchesRes.matches),
  );
  const teamsMap = new Map<string, Team>(standingsTeams.map((t) => [t.id, t]));
  const knockout = competition.hasKnockout
    ? buildKnockoutBracket(matchesRes.matches, teamsMap)
    : undefined;
  const matches = orderMatchesForDisplay(
    mapMatches(matchesRes.matches, teamsMap),
    (m) => m.kickoff,
    (m) => m.status,
    MAX_MATCHES
  );

  return {
    league: {
      id: competition.internalId,
      name: competition.name,
      shortName: competition.shortName,
      region: competition.region,
      hasKnockout: competition.hasKnockout,
      season: `${seasonStart}–${seasonEnd}`,
    },
    teams: Array.from(teamsMap.values()),
    matches,
    standings,
    knockout,
  };
}

function competitionFor(id: FootballLeagueId): CompetitionConfig {
  const competition = COMPETITIONS.find((c) => c.internalId === id);
  if (!competition) throw new Error(`football-data: no competition for ${id}`);
  return competition;
}

/** What the league picker offers, in its order. Names only: nothing is fetched. */
export const FOOTBALL_COMPETITIONS: ReadonlyArray<{ id: FootballLeagueId; name: string }> =
  COMPETITIONS.map((c) => ({ id: c.internalId, name: c.name }));

/**
 * One competition, cached on its own. The page and the dashboard each ask for
 * the one league they show, and a league that fails to refresh keeps its last
 * good table rather than taking the others down with it.
 */
export const getFootballLeagueData = cachedFeed(
  "football-data league",
  (id: FootballLeagueId) => fetchLeague(competitionFor(id)),
  (id: FootballLeagueId) => getFootballLeague(id),
  ["football-data:league"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:football"] },
);

/** The mappers and the request budget, exported for their tests. */
export const __testing = {
  goalsOf,
  formFromMatches,
  mapMatches,
  buildKnockoutBracket,
  noteBudget,
  budget,
};
