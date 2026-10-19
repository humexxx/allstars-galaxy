// Shared sports domain types. All data is mocked for now; the shapes are
// designed to be filled by a real API later (e.g. football-data.org, ergast,
// nba-api, etc.) without changing the UI layer.

import type { F1NewsImage, userSportsPreferences } from "@/db/schema";

/** The single list of sport keys — `sportIdSchema` validates against it. */
export const SPORT_IDS = [
  "football",
  "padel",
  "f1",
  "nba",
  "tennis",
  "nfl",
  "lol",
] as const;

export type SportId = (typeof SPORT_IDS)[number];

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

/** One side of a match on a dashboard card. */
export type DashboardSide = {
  name: string;
  code: string;
  logoUrl?: string;
  color?: string;
  score: number | null;
  winner: boolean;
};

export type DashboardMatch = {
  id: string;
  home: DashboardSide;
  away: DashboardSide;
  status: "live" | "upcoming" | "result";
  /** An instant; the card formats it in the reader's zone. */
  startsAt: string;
  /** "Matchday 3", "Swiss · BO1". */
  label?: string;
  /** Football's live minute. */
  minute?: number;
};

export type DashboardTableRow = {
  position: number;
  name: string;
  /** A team's logo is fitted inside the disc; a player's photo fills it. */
  image?: { url: string; kind: "logo" | "photo" };
  code?: string;
  color?: string;
  flagEmoji?: string;
  /** "6 pts", "60–22", "9,880". */
  value: string;
};

export type DashboardTable = { id: string; label: string; rows: DashboardTableRow[] };

/**
 * One favourite sport's dashboard card: what is on now or next, what follows,
 * and the top of the table. The same shape for every sport, so they share one
 * card.
 */
export type DashboardSportCard = {
  sportId: SportId;
  label: string;
  emoji: string;
  /** The line under the title: the competition, its stage. */
  context: string;
  featured?: DashboardMatch;
  /** Racquet sports have tournaments rather than matches on the dashboard. */
  event?: { name: string; detail: string; status: "live" | "upcoming" | "completed" };
  matches: DashboardMatch[];
  /** More than one shows as a toggle (East / West, ATP / WTA). */
  tables: DashboardTable[];
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
  /** A shoot-out, kept out of the score itself (status "pen"). */
  penalties?: { home: number; away: number };
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
  // A Grand Slam draw starts two rounds earlier than any knockout the other
  // sports have: 128 players is a round of 128.
  | "round-of-128"
  | "round-of-64"
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
  /** When the tie is two-legged, leg scores live here (a tennis draw's sets). */
  legs?: Array<{ homeScore: number | null; awayScore: number | null; date?: string }>;
  homeScore?: number | null;
  awayScore?: number | null;
  aggregateHome?: number | null;
  aggregateAway?: number | null;
  winnerTeamId?: string | null;
  /** ISO date for the decisive match. */
  date?: string;
  /** An esports series' format. */
  bestOf?: 1 | 3 | 5;
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
  | "serie-a"
  | "world-cup";

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

/** One group table for tournaments played in groups (World Cup, Euro). */
export type FootballGroupStandings = {
  label: string;
  standings: Standing[];
};

export type FootballLeagueData = {
  league: FootballLeague;
  teams: Team[];
  matches: Match[];
  standings: Standing[];
  /** Group-stage tables for cup tournaments; empty for domestic leagues. */
  groups?: FootballGroupStandings[];
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
  /**
   * Everyone appearing in any of this tour's draws.
   *
   * A list rather than a Map so it crosses the server/client boundary as
   * plain data; the view builds the lookup.
   */
  drawPlayers?: Team[];
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

/** The four regional leagues, plus the international events while they run. */
export type LolRegion = "lec" | "lcs" | "lck" | "lpl" | "worlds" | "msi" | "first-stand";

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

/** One match of a Swiss round. Its teams are null until the pairing is drawn. */
export type SwissMatch = BracketMatch & {
  status: MatchStatus;
};

/** Everyone on one record plays one match a round: the "1-0" pool. */
export type SwissPool = {
  /** The record going into the round. */
  wins: number;
  losses: number;
  matches: SwissMatch[];
};

/** A record that ends the stage: through on enough wins, out on enough losses. */
export type SwissExit = {
  wins: number;
  losses: number;
  advanced: boolean;
  /** How many teams finish on this record. */
  slots: number;
  /** The ones known so far. */
  teamIds: string[];
};

export type SwissStage = {
  winsToAdvance: number;
  lossesToExit: number;
  /** Round by round, best record first. */
  rounds: SwissPool[][];
  /** Best record first. */
  exits: SwissExit[];
};

export type LolSplit = {
  region: LolRegion;
  name: string;
  season: string;
  teams: Team[];
  standings: LolStanding[];
  matches: LolMatch[];
  /** Worlds' Swiss stage, between the play-ins and the knockouts. */
  swiss?: SwissStage;
  playoffs?: BracketRound[];
};

export type LolData = {
  splits: LolSplit[];
};

// ---------- F1 standings (ESPN) ----------

export type F1StandingRow = {
  position: number;
  name: string;
  points: number;
  /** A driver's headshot, or nothing for a constructor. */
  imageUrl?: string;
  /** A driver's country flag. */
  flagUrl?: string;
  /** A constructor's team logo, when one is published for it. */
  logoUrl?: string;
  /** A constructor's livery colour, for its badge. */
  color?: string;
  /** A constructor's short code, shown when there is no logo. */
  code?: string;
};

export type F1DashboardStandings = {
  drivers: F1StandingRow[];
  constructors: F1StandingRow[];
};

// ---------- F1 news (RapidAPI, stored daily) ----------

export type F1NewsArticle = {
  id: string;
  headline: string;
  description: string | null;
  link: string | null;
  images: F1NewsImage[];
  firstSeenAt: Date;
};
