// Shared sports domain types. All data is mocked for now; the shapes are
// designed to be filled by a real API later (e.g. football-data.org, ergast,
// nba-api, etc.) without changing the UI layer.

import type { userSportsPreferences } from "@/db/schema";

export type SportId =
  | "football"
  | "padel"
  | "f1"
  | "nba"
  | "tennis"
  | "nfl"
  | "lol";

export type UserSportsPreference = typeof userSportsPreferences.$inferSelect;

// One compact highlight rendered on the dashboard widget for a single
// favourited sport. Each entry is a self-contained card the user can scan
// without leaving the dashboard.
export type DashboardSportHighlight = {
  sportId: SportId;
  emoji: string;
  label: string;
  /** Short headline, e.g. "Real Madrid 2 – 1 Arsenal · LIVE 67'". */
  headline: string;
  /** Secondary line: league/competition or timing context. */
  context: string;
  /** Optional tone for status pill: live games, upcoming, completed. */
  tone?: "live" | "upcoming" | "result";
  /** Optional secondary entry under the main headline (e.g. league leader). */
  secondary?: { label: string; value: string };
};

export type SportMeta = {
  id: SportId;
  label: string;
  shortLabel: string;
  emoji: string;
};

// ---------- Common shapes ----------

export type Team = {
  id: string;
  name: string;
  shortName: string;
  /** Two-letter or three-letter code (e.g. "ARS", "PSG"). */
  code: string;
  /** Public URL to the badge/crest. Optional — falls back to monogram. */
  logoUrl?: string;
  /** Tailwind-friendly hex used for branded backgrounds. */
  primaryColor?: string;
};

export type MatchStatus =
  | "scheduled"
  | "live"
  | "ft"
  | "aet"
  | "pen"
  | "postponed"
  | "cancelled";

export type Match = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  /** ISO date string, e.g. "2026-03-17T20:00:00Z". */
  kickoff: string;
  status: MatchStatus;
  /** Minute when status === "live" (e.g. 67 → "67'"). */
  minute?: number;
  /** Short label like "Round of 16 · Leg 2 of 2". */
  stageLabel?: string;
  /** Optional red-card indicator next to each team. */
  homeRedCard?: boolean;
  awayRedCard?: boolean;
};

/** Two-legged knockout tie, e.g. UEFA Champions League round of 16. */
export type LegTie = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  legs: [LegLeg, LegLeg];
  aggregateHome: number;
  aggregateAway: number;
  winnerTeamId: string | null;
  /** Optional label such as "AET" if extra time decided the tie. */
  decidedBy?: "ft" | "aet" | "pen" | "away-goals";
};

export type LegLeg = {
  leg: 1 | 2;
  homeScore: number;
  awayScore: number;
  /** ISO date. */
  date: string;
  status: MatchStatus;
};

/** League / group-stage row. */
export type Standing = {
  position: number;
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  /** Most-recent first; max 5. */
  form?: FormResult[];
  /** Highlight band on the row (UCL/UEL qualification, relegation, etc.). */
  band?: StandingBand;
};

export type FormResult = "W" | "D" | "L" | "-";

export type StandingBand =
  | "champions"
  | "europa"
  | "conference"
  | "relegation"
  | "playoff"
  | null;

// ---------- Knockout bracket ----------

export type BracketRoundId =
  | "round-of-32"
  | "round-of-16"
  | "quarter-final"
  | "semi-final"
  | "third-place"
  | "final";

export type BracketMatch = {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  /** When the tie is two-legged, leg scores live here. */
  legs?: Array<{ homeScore: number | null; awayScore: number | null }>;
  homeScore?: number | null;
  awayScore?: number | null;
  aggregateHome?: number | null;
  aggregateAway?: number | null;
  winnerTeamId?: string | null;
  /** ISO date for the decisive match. */
  date?: string;
};

export type BracketRound = {
  id: BracketRoundId;
  label: string;
  matches: BracketMatch[];
};

// ---------- Football leagues ----------

export type FootballLeagueId =
  | "uefa-champions-league"
  | "la-liga"
  | "premier-league"
  | "serie-a";

export type FootballLeague = {
  id: FootballLeagueId;
  name: string;
  shortName: string;
  /** Country code or "UEFA". */
  region: string;
  /** True when the league has a knockout phase to render. */
  hasKnockout: boolean;
  season: string;
};

export type FootballLeagueData = {
  league: FootballLeague;
  teams: Team[];
  matches: Match[];
  standings: Standing[];
  knockout?: BracketRound[];
};

// ---------- F1 ----------

export type F1Driver = {
  position: number;
  code: string;
  name: string;
  shortName: string;
  team: string;
  nationality: string;
  flagEmoji: string;
  points: number;
  wins: number;
  podiums: number;
};

export type F1Constructor = {
  position: number;
  name: string;
  shortName: string;
  points: number;
  wins: number;
  podiums: number;
  primaryColor: string;
};

export type F1Race = {
  id: string;
  round: number;
  name: string;
  circuit: string;
  location: string;
  flagEmoji: string;
  /** ISO date. */
  date: string;
  /** Top-3 driver codes when status === "completed". */
  podium?: [string, string, string];
  status: "completed" | "upcoming" | "live";
};

export type F1Data = {
  season: number;
  drivers: F1Driver[];
  constructors: F1Constructor[];
  races: F1Race[];
};

// ---------- NBA ----------

export type NbaConference = "east" | "west";

export type NbaStanding = Omit<Standing, "form" | "band"> & {
  conference: NbaConference;
  /** Pct of games won, e.g. 0.812. */
  winPct: number;
  /** Games behind leader. */
  gamesBehind: number;
  streak: string;
  /** Last 10 record, e.g. "8-2". */
  last10: string;
};

export type NbaData = {
  season: string;
  teams: Team[];
  games: Match[];
  standings: NbaStanding[];
};

// ---------- Tennis / Padel rankings ----------

export type RacquetTour = "atp" | "wta" | "wpt-men" | "wpt-women";

export type PlayerRanking = {
  position: number;
  name: string;
  shortName: string;
  countryCode: string;
  flagEmoji: string;
  points: number;
  /** Position change vs. previous week. Positive = climbed. */
  movement: number;
  /** Optional headshot URL. */
  photoUrl?: string;
};

export type RacquetTournament = {
  id: string;
  name: string;
  surface?: string;
  location: string;
  /** ISO date range. */
  startDate: string;
  endDate: string;
  status: "completed" | "upcoming" | "live";
  /** Champion player short name (e.g. "C. Alcaraz"). */
  champion?: string;
  runnerUp?: string;
  /** Optional rendered bracket for the final stages. */
  bracket?: BracketRound[];
};

export type RacquetData = {
  tour: RacquetTour;
  season: number;
  rankings: PlayerRanking[];
  tournaments: RacquetTournament[];
};

export type TennisData = {
  atp: RacquetData;
  wta: RacquetData;
};

export type PadelData = {
  men: RacquetData;
  women: RacquetData;
};

// ---------- NFL ----------

export type NflConference = "afc" | "nfc";
export type NflDivision =
  | "afc-east"
  | "afc-north"
  | "afc-south"
  | "afc-west"
  | "nfc-east"
  | "nfc-north"
  | "nfc-south"
  | "nfc-west";

export type NflStanding = {
  position: number;
  teamId: string;
  conference: NflConference;
  division: NflDivision;
  wins: number;
  losses: number;
  ties: number;
  pct: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: string;
};

export type NflData = {
  season: number;
  teams: Team[];
  games: Match[];
  standings: NflStanding[];
  playoffs: BracketRound[];
};

// ---------- League of Legends ----------

export type LolRegion = "lec" | "lcs" | "lck" | "lpl";

export type LolStanding = {
  position: number;
  teamId: string;
  wins: number;
  losses: number;
  /** Recent form, most recent first (max 5). */
  form?: FormResult[];
};

export type LolMatch = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  /** Best-of format, e.g. 3 or 5. */
  bestOf: 1 | 3 | 5;
  date: string;
  status: MatchStatus;
  stageLabel?: string;
};

export type LolSplit = {
  region: LolRegion;
  name: string;
  season: string;
  teams: Team[];
  standings: LolStanding[];
  matches: LolMatch[];
  playoffs?: BracketRound[];
};

export type LolData = {
  splits: LolSplit[];
};
