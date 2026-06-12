import "server-only";

import { unstable_cache } from "next/cache";

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
  Team,
} from "@/types/sports";

// Lolesports' public-but-unofficial endpoint. The x-api-key value is the same
// one their own site (lolesports.com) ships in its frontend — it's a
// hard-coded constant, not user-specific.
const LOLESPORTS_BASE_URL = "https://esports-api.lolesports.com/persisted/gw";
const LOLESPORTS_API_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";
const REVALIDATE_SECONDS = 1800;

const TARGET_REGIONS: Array<{ slug: string; region: LolRegion }> = [
  { slug: "lec", region: "lec" },
  { slug: "lcs", region: "lcs" },
  { slug: "lck", region: "lck" },
  { slug: "lpl", region: "lpl" },
];

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
  state?: "unstarted" | "inProgress" | "completed";
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
): LolesportsTournament | null {
  if (tournaments.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
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

async function getLeagueId(slug: string): Promise<string | null> {
  const data = await fetchLolesports<{ data: { leagues: LolesportsLeague[] } }>(
    "/getLeagues",
  );
  const league = data.data.leagues.find(
    (l) => l.slug.toLowerCase() === slug.toLowerCase(),
  );
  return league?.id ?? null;
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
]);

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
 * Build bracket rounds from the standings sections. Each non-regular section
 * (e.g. "Quarterfinals", "Semifinals", "Finals") becomes one round, labelled
 * with the section's own name — the API's bracket structure IS the round
 * structure, so rounds stay stable as ties resolve.
 *
 * Falls back to the TBD-count heuristic only when sections carry no names.
 * (The old TBD-only approach collapsed the bracket as the tournament
 * progressed: once a semifinal's teams were decided it had 0 TBDs and
 * migrated into "Early Rounds", so a finished playoff rendered as one mixed
 * column with the final mislabeled.)
 */
function buildLolBracket(
  sections: Array<{ name: string | null; matches: LolesportsStandingsMatch[] }>,
): BracketRound[] {
  const named = sections.filter((s) => s.name && s.matches.length > 0);
  if (named.length === 0) {
    return partitionBracketByTbd(sections.flatMap((s) => s.matches));
  }
  return named.map((s, idx) => {
    const fromEnd = named.length - 1 - idx;
    const id =
      ROUND_IDS_FROM_END[Math.min(fromEnd, ROUND_IDS_FROM_END.length - 1)];
    return {
      id,
      label: s.name!,
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
  const hasScore = homeWins !== null && awayWins !== null && (homeWins > 0 || awayWins > 0);
  const winnerCode =
    hasScore && home && away
      ? homeWins! > awayWins!
        ? home.code
        : awayWins! > homeWins!
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

async function getStandingsAndPlayoffs(
  tournamentId: string,
): Promise<{
  teams: Team[];
  standings: LolStanding[];
  playoffs?: BracketRound[];
}> {
  const data = await fetchLolesports<{
    data: { standings: LolesportsStandingsEntry[] };
  }>(`/getStandings?tournamentId=${tournamentId}`);

  const teamsMap = new Map<string, Team>();
  const rows: LolStanding[] = [];
  const playoffSections: Array<{
    name: string | null;
    matches: LolesportsStandingsMatch[];
  }> = [];

  for (const entry of data.data.standings) {
    for (const stage of entry.stages) {
      const isRegular = REGULAR_STAGE_SLUGS.has(stage.slug ?? "");
      for (const section of stage.sections) {
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
        // Bracket matches come from non-regular stages — one section per round.
        if (!isRegular) {
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

  const playoffs =
    playoffSections.length > 0 ? buildLolBracket(playoffSections) : undefined;

  return {
    teams: Array.from(teamsMap.values()),
    standings: dedupedStandings,
    playoffs,
  };
}

async function getSchedule(leagueId: string): Promise<{
  matches: LolMatch[];
  extraTeams: Team[];
}> {
  const data = await fetchLolesports<{
    data: { schedule: { events: LolesportsEvent[] } };
  }>(`/getSchedule?leagueId=${leagueId}`);

  const teamsMap = new Map<string, Team>();
  const matches: LolMatch[] = [];

  for (const event of data.data.schedule.events) {
    if (event.type !== "match" || !event.match) continue;
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
  target: (typeof TARGET_REGIONS)[number],
): Promise<LolSplit | null> {
  const leagueId = await getLeagueId(target.slug);
  if (!leagueId) return null;

  const tournament = await getCurrentTournament(leagueId);
  const [standingsRes, scheduleRes] = await Promise.all([
    tournament
      ? getStandingsAndPlayoffs(tournament.id).catch(() => ({
          teams: [] as Team[],
          standings: [] as LolStanding[],
          playoffs: undefined as BracketRound[] | undefined,
        }))
      : Promise.resolve({
          teams: [] as Team[],
          standings: [] as LolStanding[],
          playoffs: undefined as BracketRound[] | undefined,
        }),
    getSchedule(leagueId),
  ]);

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
  const splitName = tournament
    ? `${target.slug.toUpperCase()} ${prettifyTournamentSlug(tournament.slug)}`
    : `${target.slug.toUpperCase()} ${seasonYear}`;

  return {
    region: target.region,
    name: splitName,
    season: seasonYear,
    teams,
    standings: standingsWithForm,
    matches: scheduleRes.matches.slice(0, 24),
    playoffs: standingsRes.playoffs,
  };
}

async function fetchLolDataFromApi(): Promise<LolData> {
  const splits = await Promise.all(
    TARGET_REGIONS.map((target) =>
      fetchSplit(target).catch((err) => {
        console.warn(`Lolesports fetch failed for ${target.slug}:`, err);
        return null;
      }),
    ),
  );
  const live = splits.filter((s): s is LolSplit => s !== null && s.teams.length > 0);
  if (live.length === 0) {
    throw new Error("Lolesports returned no splits");
  }
  return { splits: live };
}

export const getLolData = unstable_cache(
  async (): Promise<LolData> => {
    try {
      return await fetchLolDataFromApi();
    } catch (err) {
      console.warn("Lolesports unavailable, falling back to mock LOL_DATA:", err);
      return LOL_DATA;
    }
  },
  ["lolesports:lol-data"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:lol"] },
);
