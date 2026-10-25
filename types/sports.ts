// Shared sports domain types. All data is mocked for now; the shapes are
// designed to be filled by a real API later (e.g. football-data.org, ergast,
// nba-api, etc.) without changing the UI layer.

import type { F1NewsImage, userSportsPreferences, userSportsTeamFilters } from "@/db/schema";

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

export type UserSportsTeamFilter = typeof userSportsTeamFilters.$inferSelect;

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

export type DashboardTable = {
  id: string;
  label: string;
  rows: DashboardTableRow[];
  /** A list rather than a ranking (LoL's champions): no position column. */
  unranked?: boolean;
};

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
  /**
   * The games after the featured one, which its box steps through rather
   * than listing them under it (football, the NBA, the NFL).
   */
  following?: DashboardMatch[];
  /** Racquet sports have tournaments rather than matches on the dashboard. */
  event?: { name: string; detail: string; status: "live" | "upcoming" | "completed" };
  /** Listed under the lead (LoL: a day of an event is several series back to back). */
  matches: DashboardMatch[];
  /** More than one shows as a toggle (East / West, AFC / NFC). */
  tables: DashboardTable[];
  /**
   * In place of a table the sport has none of yet: the NBA's last champion
   * before the opener. `when` is an instant the card prints in the reader's
   * zone after its label ("Tips off Tue, Oct 20").
   */
  note?: { title: string; text?: string; when?: { label: string; startsAt: string } };
  /** The championship picker, on a sport that has a choice (`SPORT_COMPETITIONS`). */
  competitions?: DashboardCompetitions;
  /** The latest stories, for a sport with a wire (football's, the NBA's, the NFL's — ESPN). */
  news?: NewsStory[];
};

/**
 * What a card is set to and what else it could show. `value` is the choice
 * the card honoured, or null for the sport's own pick, named `automatic`.
 * Football has no such pick: its default is the Champions League itself.
 */
export type DashboardCompetitions = {
  value: string | null;
  automatic?: string;
  options: { id: string; label: string }[];
  /**
   * A choice the favourite holds that the card cannot show today (a LoL event
   * not in the feed). It still stands — the card goes back to it when the
   * event returns — so the picker ticks it, and choosing `automatic` clears it.
   */
  waiting?: { id: string; label: string };
};

/** A favourite sport and the championship its dashboard card is set to. */
export type FavoriteSport = { sportId: SportId; competition: string | null };

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
  /** A padel pair's two photos, in the order `shortName` names its players. */
  photos?: Array<string | null>;
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
  /** Where it is on in the US, nationally: TV first ("NBC", "Peacock"). */
  broadcasts?: string[];
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
  | "final"
  // A double elimination's columns, numbered in the order they are played.
  | `round-${number}`;

export type BracketMatch = {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  /** A double elimination's half: the lower bracket is where a team plays on after its first loss. */
  side?: "upper" | "lower";
  /** When the tie is two-legged, leg scores live here (a tennis draw's sets). */
  legs?: Array<{
    homeScore: number | null;
    awayScore: number | null;
    date?: string;
    /** A racquet set's tie-break points, where it went to one: 7–6(3). */
    homeTiebreak?: number | null;
    awayTiebreak?: number | null;
  }>;
  /** A racquet tie decided without being played out; a bye has nobody on one side. */
  outcome?: "walkover" | "retired" | "bye";
  homeScore?: number | null;
  awayScore?: number | null;
  aggregateHome?: number | null;
  aggregateAway?: number | null;
  /** A shoot-out, kept apart from the score it settled. */
  penalties?: { home: number; away: number };
  winnerTeamId?: string | null;
  /** ISO date for the decisive match. */
  date?: string;
  /** A series' format: an esports best-of, or an NBA playoff series' seven. */
  bestOf?: 1 | 3 | 5 | 7;
};

/** A winner's way from one match (`from`) to the next (`to`), by match id. */
export type BracketLink = { from: string; to: string };

export type BracketRound = {
  id: BracketRoundId;
  label: string;
  matches: BracketMatch[];
};

// ---------- Football leagues ----------

/** Every football competition, the World Cup included — `FootballLeagueId` derives from it. */
export const FOOTBALL_COMPETITION_IDS = [
  "uefa-champions-league",
  "la-liga",
  "premier-league",
  "serie-a",
  "world-cup",
] as const;

export type FootballLeagueId = (typeof FOOTBALL_COMPETITION_IDS)[number];

/**
 * A match list the team filter remembers: one football league, or a sport
 * with a single list, keyed by its own id.
 */
export type TeamFilterList =
  | { sportId: "football"; competition: FootballLeagueId }
  | { sportId: "nba"; competition: "nba" }
  | { sportId: "nfl"; competition: "nfl" };

/** The list on screen and the teams last picked in it ([] is every team). */
export type SavedTeamFilter = { list: TeamFilterList; teamIds: string[] };

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
  /** ESPN's headshot, when ESPN lists the driver. */
  imageUrl?: string;
  /** ESPN's flag for the driver's country, badged on the headshot. */
  flagUrl?: string;
};

export type F1Constructor = {
  position: number;
  name: string;
  shortName: string;
  points: number;
  wins: number;
  podiums: number;
  primaryColor: string;
  /** The team's logo, when one is published for it. */
  logoUrl?: string;
};

export type F1SessionKind =
  | "fp1"
  | "fp2"
  | "fp3"
  | "sprint-qualifying"
  | "sprint"
  | "qualifying"
  | "race";

/** One session of a race weekend. */
export type F1Session = {
  kind: F1SessionKind;
  /** ISO instant (UTC). */
  startsAt: string;
};

export type F1RaceWinner = {
  code: string;
  team: string;
  /** The winner's race time, "1:42:00.785". */
  time?: string;
  laps?: number;
  /** Where the winner started; 0 is the pit lane. */
  grid?: number;
};

/** A driver and the lap that earned a mention: pole, the fastest lap. */
export type F1LapMark = {
  code: string;
  /** "1:35.202" */
  time?: string;
  /** The lap it was set on (the fastest lap only). */
  lap?: number;
};

/** Who won at this circuit the season before, for the dashboard. */
export type F1PastWinner = {
  season: number;
  code: string;
  name: string;
  team: string;
};

export type F1Race = {
  id: string;
  round: number;
  name: string;
  circuit: string;
  /** Jolpica's key for the track ("monaco", "americas"), which finds its outline. */
  circuitId: string;
  /** The town ("Austin"). */
  location: string;
  /** "USA", "Monaco". */
  country?: string;
  flagEmoji: string;
  /**
   * The race's day in UTC, which is not the reader's day: Melbourne's 04:00Z
   * start is the evening before in the Americas. Show `startsAt` when there
   * is one.
   */
  date: string;
  /** The race start as an ISO instant. */
  startsAt?: string;
  /** A sprint weekend. */
  sprint?: boolean;
  /** Every session of the weekend, the race included, in time order. */
  sessions?: F1Session[];
  /** Top-3 driver codes when status === "completed". */
  podium?: [string, string, string];
  /** P2's and P3's gap to the winner, "+7.335" or "+1 lap". */
  podiumGaps?: [string, string];
  winner?: F1RaceWinner;
  pole?: F1LapMark;
  fastestLap?: F1LapMark;
  sprintWinner?: { code: string; team: string };
  /** Only on the dashboard's race, which looks it up on its own. */
  lastYear?: F1PastWinner;
  status: "completed" | "upcoming" | "live";
};

/** One car in a race's final order. */
export type F1ClassificationRow = {
  /** "1" to "22", or why a car is unplaced: "DNF", "DSQ", "NC"… */
  position: string;
  code: string;
  /** "M. Verstappen" */
  name: string;
  team: string;
  /** Where the car started; 0 is the pit lane. */
  grid?: number;
  laps?: number;
  /** The winner's time, everybody else's gap, "+1 lap", or why the car stopped. */
  result: string;
  points: number;
  /** Set the fastest lap of the race. */
  fastestLap?: boolean;
};

export type F1RaceClassification = {
  season: number;
  round: number;
  rows: F1ClassificationRow[];
};

/** One car in a session's order: practice, qualifying, a sprint or the race. */
export type F1SessionResultRow = {
  /** "1" to "22", or "DNF" / "DNS" / "DSQ" for a car that did not finish it. */
  position: string;
  /** "LEC" */
  code: string;
  /** "C. Leclerc" */
  name: string;
  team: string;
  /** The team's colour as "#RRGGBB". */
  teamColor?: string;
  /** The best lap ("1:35.291"); for a race or sprint, the winner's total time. */
  time?: string;
  /** "+0.042", "+2 laps"; none for the leader. */
  gap?: string;
  laps?: number;
  /** In qualifying, the part the time was set in. */
  segment?: "Q1" | "Q2" | "Q3";
};

export type F1SessionResult = {
  kind: F1SessionKind;
  rows: F1SessionResultRow[];
};

/** What each session of one weekend finished in, in time order, the finished ones only. */
export type F1WeekendResults = {
  season: number;
  round: number;
  sessions: F1SessionResult[];
};

/**
 * The race on the dashboard's F1 card, with what the weekend is doing now.
 * The sessions are decided per request, never inside the cached feed: the
 * next session moves on while the feed sits in its cache.
 */
export type F1DashboardHighlight = {
  season: number;
  race: F1Race;
  /** A session on track right now. */
  liveSession?: F1Session;
  /** The first session still to start. */
  nextSession?: F1Session;
  /** "in 3h" — how far off `nextSession` is. */
  nextSessionIn?: string;
};

export type F1Data = {
  season: number;
  drivers: F1Driver[];
  constructors: F1Constructor[];
  races: F1Race[];
};

// ---------- NBA ----------

export type NbaConference = "east" | "west";

export type NbaStanding = Omit<Standing, "band"> & {
  conference: NbaConference;
  /** Pct of games won, e.g. 0.812. */
  winPct: number;
  /** Games behind leader. */
  gamesBehind: number;
  streak: string;
  /** Last 10 record, e.g. "8-2". */
  last10: string;
};

/** Last season's finals, as the view and the dashboard print them. */
export type NbaChampion = {
  /** The season it was won, "2025–26". */
  season: string;
  teamId: string;
  /** "New York Knicks, 4–1 over San Antonio". */
  summary: string;
};

export type NbaData = {
  season: string;
  teams: Team[];
  games: Match[];
  standings: NbaStanding[];
  /**
   * The postseason as best-of-seven series, East half first. Empty or absent
   * while there is no postseason.
   */
  playoffs?: BracketRound[];
  /** Last season's champion, only until this season's opener. */
  champion?: NbaChampion;
  /**
   * The season's first regular-season game, while it is still ahead: an
   * instant, or a calendar day when balldontlie has no time for it yet.
   */
  tipOff?: string;
};

// ---------- Tennis / Padel rankings ----------

/** The men's tours only: the hub follows no women's tour. */
export type RacquetTour = "atp" | "wpt-men";

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
  /**
   * The draw, shipped only for the featured and the current tournament; any
   * other one is read on the tournament's page (`loadRacquetTournament`).
   */
  bracket?: BracketRound[];
  /** "Grand Slam", "Major", "P1". */
  tier?: string;
  /** The event's poster, where the provider publishes one. */
  imageUrl?: string;
  /** The arena or the full place name: "Allianz Cloud Milano". */
  venue?: string;
  prize?: { amount: number; currency: string };
  /** Last edition's champion — the name to beat before this one has a final. */
  defendingChampion?: string;
};

/** One line of a tour's season calendar: no draw, just enough to list it and open it. */
export type RacquetCalendarEntry = {
  /** The same id the tour's `tournaments` use, so a calendar row opens the same page. */
  id: string;
  name: string;
  /** Calendar days, `YYYY-MM-DD`. */
  startDate: string;
  endDate: string;
  status: RacquetTournament["status"];
  champion?: string;
};

/** One tournament's draw, as its page or the hub reads it. */
export type RacquetDraw = {
  tournamentId: string;
  rounds: BracketRound[];
  /** Everyone in `rounds`, as plain data; the view builds the lookup. */
  players: Team[];
  champion?: string;
  runnerUp?: string;
  /**
   * The provider withholds this draw's results — Padel API's free plan, for
   * events older than about six months — so only the champions can be shown.
   */
  resultsHidden?: boolean;
};

export type RacquetData = {
  tour: RacquetTour;
  season: number;
  rankings: PlayerRanking[];
  /** What just finished, what is on and what is next, in date order. */
  tournaments: RacquetTournament[];
  /** The whole season, in date order. */
  calendar?: RacquetCalendarEntry[];
  /**
   * Everyone appearing in any of this tour's draws.
   *
   * A list rather than a Map so it crosses the server/client boundary as
   * plain data; the view builds the lookup.
   */
  drawPlayers?: Team[];
};

/** The sports drawn as racquet tours. */
export type RacquetSport = Extract<SportId, "padel" | "tennis">;

/** Singles players with a flag and a seed, or padel pairs: two names, a seed, no flag. */
export type DrawVariant = "player" | "pair";

/** Where one tournament's draw stands. */
export type DrawState =
  /** Upcoming, and too far off for a draw to exist. */
  | { status: "pending" }
  /** The provider did not answer; worth another try. */
  | { status: "error" }
  /** No provider knows this id — a fixture tournament, while the feed is down. */
  | { status: "unavailable" }
  | { status: "ready"; draw: RacquetDraw };

export type TennisData = {
  atp: RacquetData;
};

export type PadelData = {
  men: RacquetData;
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

/** The four regional leagues: each has splits of its own, read on demand. */
export const LOL_LEAGUE_REGIONS = ["lec", "lcs", "lck", "lpl"] as const;

export type LolLeagueRegion = (typeof LOL_LEAGUE_REGIONS)[number];

/** The four regional leagues, plus the international events while they run. */
export const LOL_REGIONS = [...LOL_LEAGUE_REGIONS, "worlds", "msi", "first-stand"] as const;

export type LolRegion = (typeof LOL_REGIONS)[number];

export function isLolLeague(region: LolRegion): region is LolLeagueRegion {
  return (LOL_LEAGUE_REGIONS as readonly string[]).includes(region);
}

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

/** Who won a split's final, read off the round named "Finals". */
export type LolChampion = {
  teamId: string;
  /** The final itself, from the bracket: the score, the day, the format. */
  final: BracketMatch;
};

/** A league's next tournament, once Lolesports lists it. */
export type LolUpcoming = {
  region: LolRegion;
  /** "LCK Split 1", "First Stand 2027". */
  name: string;
  /** `YYYY-MM-DD`, a calendar day. */
  startDate: string;
};

export type LolSplit = {
  region: LolRegion;
  name: string;
  season: string;
  /** Lolesports' id for the tournament: what another of the league's splits is asked for beside. */
  tournamentId?: string;
  /**
   * A league's tournaments this season so far, in order, this one among them:
   * moved between from inside the league, not offered in the picker.
   */
  seasonSplits?: Array<{ id: string; name: string }>;
  /** Worlds, MSI or First Stand rather than a regional league. */
  international?: boolean;
  teams: Team[];
  standings: LolStanding[];
  matches: LolMatch[];
  /** An international event's play-ins, before its Swiss stage or knockouts. */
  playIns?: BracketRound[];
  /** The play-ins' branches, when they are a double elimination (see `playoffLinks`). */
  playInLinks?: BracketLink[];
  /** Worlds' Swiss stage, between the play-ins and the knockouts. */
  swiss?: SwissStage;
  playoffs?: BracketRound[];
  /**
   * Who went where, for a bracket that is not a plain knockout (MSI's double
   * elimination): each winner's next match. Without it the branches are read
   * off the rounds, each halving into the next.
   */
  playoffLinks?: BracketLink[];
  /** Once the final is decided. */
  champion?: LolChampion;
};

export type LolData = {
  /** The current international event, the splits on today, then the rest by end date. */
  splits: LolSplit[];
  /** Each league's next tournament, soonest first. */
  upcoming?: LolUpcoming[];
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

/** A driver's pictures from ESPN, with what it takes to find him in another feed. */
export type F1DriverPortrait = {
  /** The three-letter race code, e.g. "VER". */
  code?: string;
  name: string;
  imageUrl: string;
  flagUrl?: string;
};

// ---------- F1 news (RapidAPI, stored daily) ----------

/**
 * One story on a sport's News tab, whatever wire it came from: F1's stored
 * one (opened on our own page) or ESPN's (opened at the source).
 */
export type NewsStory = {
  id: string;
  headline: string;
  description: string | null;
  href: string;
  /** Opened at the source, in a new tab, rather than on our own page. */
  external: boolean;
  image: { url: string; alt?: string } | null;
  /** ISO: when it was published, or — for a wire that says nothing — first seen. */
  at: string;
  /** A video or a game recap leads nothing; an article can. */
  kind: "story" | "recap" | "video";
  /** The teams and players it is filed under. */
  about: string[];
};

export type F1NewsArticle = {
  id: string;
  headline: string;
  description: string | null;
  link: string | null;
  images: F1NewsImage[];
  firstSeenAt: Date;
};

// ---------- Dashboard competitions ----------

/**
 * What each sport's dashboard card can be set to
 * (`user_sports_preferences.competition`, null for the card's own pick). A
 * sport missing here has nothing to choose.
 */
export const SPORT_COMPETITIONS: Partial<Record<SportId, readonly string[]>> = {
  football: FOOTBALL_COMPETITION_IDS,
  lol: LOL_REGIONS,
};
