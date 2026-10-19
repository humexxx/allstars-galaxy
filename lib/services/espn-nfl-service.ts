import "server-only";

import { NFL_DATA } from "@/lib/data/sports/nfl";
import { espnImage } from "@/lib/sports/espn-images";
import { orderMatchesForDisplay } from "@/lib/sports/match-order";
import type {
  BracketMatch,
  BracketRound,
  BracketRoundId,
  Match,
  MatchStatus,
  NflConference,
  NflData,
  NflDivision,
  NflStanding,
  Team,
} from "@/types/sports";
import { cachedFeed, upstreamSignal } from "./upstream";

const SITE_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
/** `level=3` nests the table conference → division, which is the only place the division is named. */
const STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/football/nfl/standings?level=3";
const REVALIDATE_SECONDS = 300;

type EspnTeam = {
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  color?: string;
  /** The scoreboard's logo. */
  logo?: string;
  /** The standings' logos, the default first. */
  logos?: Array<{ href?: string }>;
};

type EspnStatus = {
  type?: { name?: string; state?: "pre" | "in" | "post"; completed?: boolean };
};

type EspnCompetitor = {
  homeAway?: "home" | "away";
  score?: string;
  winner?: boolean;
  team?: EspnTeam;
};

type EspnEvent = {
  id: string;
  date?: string;
  season?: { year?: number; type?: number };
  week?: { number?: number };
  status?: EspnStatus;
  competitions?: Array<{
    date?: string;
    status?: EspnStatus;
    notes?: Array<{ headline?: string }>;
    competitors?: EspnCompetitor[];
  }>;
};

type EspnScoreboard = {
  season?: { year?: number; type?: number };
  events?: EspnEvent[];
};

type EspnStandingEntry = {
  team?: EspnTeam;
  stats?: Array<{ name?: string; displayValue?: string; value?: number | null }>;
};

type EspnStandingsGroup = {
  abbreviation?: string;
  standings?: { entries?: EspnStandingEntry[] };
  children?: EspnStandingsGroup[];
};

type EspnStandings = { children?: EspnStandingsGroup[] };

/** ESPN's season types. Only the postseason and the months after it carry a bracket. */
const SEASON_TYPE = { preseason: 1, regular: 2, postseason: 3, offseason: 4 } as const;

/**
 * The postseason by ESPN week; week 4 is the Pro Bowl. ESPN takes no date
 * range for the NFL, so the bracket is one call per round, and only made
 * while there is a postseason to show.
 */
const POSTSEASON_ROUNDS: Array<{ week: number; id: BracketRoundId; label: string }> = [
  { week: 1, id: "round-of-16", label: "Wild Card" },
  { week: 2, id: "quarter-final", label: "Divisional" },
  { week: 3, id: "semi-final", label: "Conference" },
  { week: 5, id: "final", label: "Super Bowl" },
];

/**
 * Club colours by ESPN abbreviation. The scoreboard carries a colour only for
 * teams playing that week, so a team on its bye would lose its badge.
 *
 * They sit behind the logo, so the Rams and both New York clubs, whose marks
 * are drawn in that very colour, take their white instead: on their own blue
 * and green the logo vanished.
 */
const TEAM_COLORS: Record<string, string> = {
  ARI: "#97233F", ATL: "#A71930", BAL: "#241773", BUF: "#00338D",
  CAR: "#0085CA", CHI: "#0B162A", CIN: "#FB4F14", CLE: "#311D00",
  DAL: "#003594", DEN: "#FB4F14", DET: "#0076B6", GB: "#203731",
  HOU: "#03202F", IND: "#002C5F", JAX: "#101820", KC: "#E31837",
  LAC: "#0080C6", LAR: "#FFFFFF", LV: "#000000", MIA: "#008E97",
  MIN: "#4F2683", NE: "#002244", NO: "#D3BC8D", NYG: "#FFFFFF",
  NYJ: "#FFFFFF", PHI: "#004C54", PIT: "#FFB612", SEA: "#002244",
  SF: "#AA0000", TB: "#D50A0A", TEN: "#0C2340", WSH: "#5A1414",
};

const DIVISIONS = new Set<NflDivision>([
  "afc-east", "afc-north", "afc-south", "afc-west",
  "nfc-east", "nfc-north", "nfc-south", "nfc-west",
]);

function teamFrom(t: EspnTeam | undefined): Team | null {
  const code = t?.abbreviation;
  // An undecided playoff slot comes back as a "TBD" team.
  if (!code || code === "TBD") return null;
  return {
    id: code.toLowerCase(),
    name: t.displayName ?? code,
    shortName: t.shortDisplayName ?? t.displayName ?? code,
    code,
    // The scoreboard's own logo is a 4096px original, half a megabyte for a
    // 24px badge — hence the resize.
    logoUrl: espnImage(t.logo ?? t.logos?.[0]?.href),
    primaryColor: TEAM_COLORS[code] ?? (t.color ? `#${t.color}` : undefined),
  };
}

function statusFrom(status: EspnStatus | undefined): MatchStatus {
  const type = status?.type;
  if (type?.name === "STATUS_POSTPONED") return "postponed";
  if (type?.name === "STATUS_CANCELED") return "cancelled";
  if (type?.state === "in") return "live";
  if (type?.state === "post") return "ft";
  return "scheduled";
}

function scoreOf(c: EspnCompetitor | undefined): number | null {
  const n = Number(c?.score);
  return c?.score !== undefined && Number.isFinite(n) ? n : null;
}

function stageLabel(event: EspnEvent): string | undefined {
  const week = event.week?.number;
  const notes = event.competitions?.[0]?.notes?.[0]?.headline;
  switch (event.season?.type) {
    case SEASON_TYPE.postseason:
      return notes ?? POSTSEASON_ROUNDS.find((r) => r.week === week)?.label;
    case SEASON_TYPE.preseason:
      return week ? `Preseason · Week ${week}` : "Preseason";
    default:
      return week ? `Week ${week}` : undefined;
  }
}

function sides(event: EspnEvent) {
  const competitors = event.competitions?.[0]?.competitors ?? [];
  return {
    home: competitors.find((c) => c.homeAway === "home"),
    away: competitors.find((c) => c.homeAway === "away"),
  };
}

function matchFrom(event: EspnEvent): { match: Match; teams: Team[] } | null {
  const { home, away } = sides(event);
  const homeTeam = teamFrom(home?.team);
  const awayTeam = teamFrom(away?.team);
  if (!homeTeam || !awayTeam) return null;
  const competition = event.competitions?.[0];
  const status = statusFrom(competition?.status ?? event.status);
  // ESPN sends "0" for a game that has not kicked off.
  const scored = status === "live" || status === "ft";
  return {
    match: {
      id: event.id,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeScore: scored ? scoreOf(home) : null,
      awayScore: scored ? scoreOf(away) : null,
      kickoff: competition?.date ?? event.date ?? "",
      status,
      stageLabel: stageLabel(event),
    },
    teams: [homeTeam, awayTeam],
  };
}

function stat(entry: EspnStandingEntry, name: string): { value: number; display: string } {
  const found = entry.stats?.find((s) => s.name === name);
  const display = found?.displayValue ?? "";
  const value = typeof found?.value === "number" ? found.value : Number(display);
  return { value: Number.isFinite(value) ? value : 0, display };
}

/**
 * Both conferences, each team at its conference seed.
 *
 * The seed is ESPN's own tiebreak-aware order (1–16), which is what the view
 * sorts by; a conference whose seeds are not out yet falls back to win
 * percentage.
 */
function standingsFrom(json: EspnStandings): { standings: NflStanding[]; teams: Team[] } {
  const teams: Team[] = [];
  const standings: NflStanding[] = [];
  for (const conferenceGroup of json.children ?? []) {
    const conference = conferenceGroup.abbreviation?.toLowerCase();
    if (conference !== "afc" && conference !== "nfc") continue;
    const rows: Array<{ row: NflStanding; seed: number }> = [];
    for (const divisionGroup of conferenceGroup.children ?? []) {
      const division = `${conference}-${divisionGroup.abbreviation?.toLowerCase()}`;
      if (!DIVISIONS.has(division as NflDivision)) continue;
      for (const entry of divisionGroup.standings?.entries ?? []) {
        const team = teamFrom(entry.team);
        if (!team) continue;
        teams.push(team);
        rows.push({
          seed: stat(entry, "playoffSeed").value,
          row: {
            position: 0,
            teamId: team.id,
            conference: conference as NflConference,
            division: division as NflDivision,
            wins: stat(entry, "wins").value,
            losses: stat(entry, "losses").value,
            ties: stat(entry, "ties").value,
            pct: stat(entry, "winPercent").value,
            pointsFor: stat(entry, "pointsFor").value,
            pointsAgainst: stat(entry, "pointsAgainst").value,
            streak: stat(entry, "streak").display || "—",
          },
        });
      }
    }
    const seeded = rows.every((r) => r.seed > 0);
    rows
      .sort((a, b) =>
        seeded ? a.seed - b.seed : b.row.pct - a.row.pct || b.row.wins - a.row.wins
      )
      .forEach(({ row }, i) => standings.push({ ...row, position: i + 1 }));
  }
  return { standings, teams };
}

/**
 * One postseason round as bracket ties, the AFC half first so each
 * conference keeps its own side of the draw.
 */
function roundFrom(
  board: EspnScoreboard,
  round: (typeof POSTSEASON_ROUNDS)[number]
): BracketRound | null {
  const events = [...(board.events ?? [])].sort((a, b) => {
    const conf = (e: EspnEvent) =>
      e.competitions?.[0]?.notes?.[0]?.headline?.startsWith("NFC") ? 1 : 0;
    return conf(a) - conf(b) || (a.date ?? "").localeCompare(b.date ?? "");
  });
  const matches: BracketMatch[] = events.map((event) => {
    const { home, away } = sides(event);
    const homeTeam = teamFrom(home?.team);
    const awayTeam = teamFrom(away?.team);
    const played = statusFrom(event.competitions?.[0]?.status ?? event.status) === "ft";
    return {
      id: event.id,
      homeTeamId: homeTeam?.id ?? null,
      awayTeamId: awayTeam?.id ?? null,
      homeScore: played ? scoreOf(home) : null,
      awayScore: played ? scoreOf(away) : null,
      winnerTeamId: home?.winner ? (homeTeam?.id ?? null) : away?.winner ? (awayTeam?.id ?? null) : null,
      date: event.competitions?.[0]?.date ?? event.date,
    };
  });
  if (matches.length === 0) return null;
  // "Super Bowl LX" rather than "Super Bowl", when ESPN names it.
  const label =
    round.id === "final"
      ? (events[0]?.competitions?.[0]?.notes?.[0]?.headline ?? round.label)
      : round.label;
  return { id: round.id, label, matches };
}

async function fetchEspn<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: upstreamSignal() });
  if (!res.ok) throw new Error(`espn nfl ${res.status} on ${url}`);
  return (await res.json()) as T;
}

async function fetchPlayoffs(year: number): Promise<BracketRound[]> {
  const boards = await Promise.all(
    POSTSEASON_ROUNDS.map((round) =>
      fetchEspn<EspnScoreboard>(
        `${SITE_URL}/scoreboard?dates=${year}&seasontype=${SEASON_TYPE.postseason}&week=${round.week}`
      )
    )
  );
  return POSTSEASON_ROUNDS.map((round, i) => roundFrom(boards[i], round)).filter(
    (r): r is BracketRound => r !== null
  );
}

/**
 * This week's games, both conference tables and, once there is one, the
 * playoff bracket — from ESPN's public API, the endpoints espn.com reads, no
 * key. The NFL had been a hand-written season because no free provider was
 * thought to carry current data.
 */
async function fetchNflFromApi(): Promise<NflData> {
  const [board, table] = await Promise.all([
    fetchEspn<EspnScoreboard>(`${SITE_URL}/scoreboard`),
    fetchEspn<EspnStandings>(STANDINGS_URL),
  ]);
  const season = board.season?.year ?? new Date().getFullYear();
  const seasonType = board.season?.type ?? SEASON_TYPE.regular;

  const byId = new Map<string, Team>();
  const games: Match[] = [];
  for (const event of board.events ?? []) {
    const mapped = matchFrom(event);
    if (!mapped) continue;
    games.push(mapped.match);
    for (const team of mapped.teams) byId.set(team.id, team);
  }
  const { standings, teams } = standingsFrom(table);
  for (const team of teams) if (!byId.has(team.id)) byId.set(team.id, team);
  if (games.length === 0 && standings.length === 0) {
    throw new Error("espn nfl returned neither games nor standings");
  }

  const playoffs =
    seasonType >= SEASON_TYPE.postseason ? await fetchPlayoffs(season) : [];

  return {
    season,
    teams: [...byId.values()],
    games: orderMatchesForDisplay(
      games,
      (m) => m.kickoff,
      (m) => m.status
    ),
    standings,
    playoffs,
  };
}

export const getNflData = cachedFeed(
  "espn nfl",
  fetchNflFromApi,
  () => NFL_DATA,
  ["espn:nfl-data"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:nfl"] }
);

/** Pure mappers, exported for their tests — nothing here touches the network. */
export const __testing = { matchFrom, standingsFrom, roundFrom, statusFrom, teamFrom };
