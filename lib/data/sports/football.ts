import type {
  BracketRound,
  FootballLeagueData,
  FootballLeagueId,
  Match,
  Standing,
  Team,
} from "@/types/sports";

// ---------- Teams (shared across leagues) ----------

const TEAMS: Team[] = [
  { id: "arsenal", name: "Arsenal", shortName: "Arsenal", code: "ARS", primaryColor: "#EF0107" },
  { id: "bayern", name: "Bayern Munich", shortName: "Bayern", code: "FCB", primaryColor: "#DC052D" },
  { id: "liverpool", name: "Liverpool", shortName: "Liverpool", code: "LIV", primaryColor: "#C8102E" },
  { id: "spurs", name: "Tottenham", shortName: "Spurs", code: "TOT", primaryColor: "#132257" },
  { id: "barcelona", name: "FC Barcelona", shortName: "Barcelona", code: "BAR", primaryColor: "#A50044" },
  { id: "chelsea", name: "Chelsea", shortName: "Chelsea", code: "CHE", primaryColor: "#034694" },
  { id: "sporting", name: "Sporting CP", shortName: "Sporting", code: "SPO", primaryColor: "#008057" },
  { id: "mancity", name: "Manchester City", shortName: "Man City", code: "MCI", primaryColor: "#6CABDD" },
  { id: "realmadrid", name: "Real Madrid", shortName: "Real Madrid", code: "RMA", primaryColor: "#FEBE10" },
  { id: "inter", name: "Inter Milan", shortName: "Inter", code: "INT", primaryColor: "#0068A8" },
  { id: "psg", name: "Paris Saint-Germain", shortName: "PSG", code: "PSG", primaryColor: "#004170" },
  { id: "newcastle", name: "Newcastle United", shortName: "Newcastle", code: "NEW", primaryColor: "#241F20" },
  { id: "leverkusen", name: "Bayer Leverkusen", shortName: "Leverkusen", code: "B04", primaryColor: "#E32221" },
  { id: "bodo", name: "Bodø/Glimt", shortName: "Bodø/Glimt", code: "BOD", primaryColor: "#FFC72C" },
  { id: "atletico", name: "Atlético Madrid", shortName: "Atlético", code: "ATM", primaryColor: "#CB3524" },
  { id: "atalanta", name: "Atalanta", shortName: "Atalanta", code: "ATA", primaryColor: "#1E4FA3" },
  // La Liga additions
  { id: "girona", name: "Girona", shortName: "Girona", code: "GIR", primaryColor: "#CD2533" },
  { id: "athletic", name: "Athletic Club", shortName: "Athletic", code: "ATH", primaryColor: "#EE2523" },
  { id: "betis", name: "Real Betis", shortName: "Betis", code: "BET", primaryColor: "#0BB363" },
  { id: "valencia", name: "Valencia CF", shortName: "Valencia", code: "VAL", primaryColor: "#F8A30D" },
  { id: "sevilla", name: "Sevilla FC", shortName: "Sevilla", code: "SEV", primaryColor: "#D00027" },
  { id: "villarreal", name: "Villarreal", shortName: "Villarreal", code: "VIL", primaryColor: "#FFE667" },
];

// ---------- UEFA Champions League ----------

const UCL_STANDINGS: Standing[] = [
  { position: 1, teamId: "arsenal", played: 8, won: 8, drawn: 0, lost: 0, goalsFor: 23, goalsAgainst: 4, points: 24, form: ["W", "W", "W", "W", "W"], band: "champions" },
  { position: 2, teamId: "bayern", played: 8, won: 7, drawn: 0, lost: 1, goalsFor: 22, goalsAgainst: 8, points: 21, form: ["W", "L", "W", "W", "W"], band: "champions" },
  { position: 3, teamId: "liverpool", played: 8, won: 6, drawn: 0, lost: 2, goalsFor: 20, goalsAgainst: 8, points: 18, form: ["W", "L", "W", "W", "W"], band: "champions" },
  { position: 4, teamId: "spurs", played: 8, won: 5, drawn: 2, lost: 1, goalsFor: 17, goalsAgainst: 7, points: 17, form: ["W", "L", "W", "W", "W"], band: "champions" },
  { position: 5, teamId: "barcelona", played: 8, won: 5, drawn: 1, lost: 2, goalsFor: 22, goalsAgainst: 14, points: 16, form: ["-", "L", "W", "W", "W"], band: "champions" },
  { position: 6, teamId: "chelsea", played: 8, won: 5, drawn: 1, lost: 2, goalsFor: 17, goalsAgainst: 10, points: 16, form: ["-", "W", "L", "W", "W"], band: "champions" },
  { position: 7, teamId: "sporting", played: 8, won: 5, drawn: 1, lost: 2, goalsFor: 17, goalsAgainst: 11, points: 16, form: ["-", "W", "L", "W", "W"], band: "champions" },
  { position: 8, teamId: "mancity", played: 8, won: 5, drawn: 1, lost: 2, goalsFor: 15, goalsAgainst: 9, points: 16, form: ["W", "L", "W", "L", "W"], band: "champions" },
  { position: 9, teamId: "realmadrid", played: 8, won: 5, drawn: 0, lost: 3, goalsFor: 21, goalsAgainst: 12, points: 15, form: ["L", "W", "L", "W", "L"], band: "playoff" },
  { position: 10, teamId: "inter", played: 8, won: 5, drawn: 0, lost: 3, goalsFor: 15, goalsAgainst: 7, points: 15, form: ["W", "L", "L", "L", "W"], band: "playoff" },
  { position: 11, teamId: "psg", played: 8, won: 4, drawn: 2, lost: 2, goalsFor: 21, goalsAgainst: 11, points: 14, form: ["L", "W", "-", "L", "-"], band: "playoff" },
  { position: 12, teamId: "newcastle", played: 8, won: 4, drawn: 2, lost: 2, goalsFor: 17, goalsAgainst: 10, points: 14, form: ["W", "L", "W", "D", "-"], band: "playoff" },
  { position: 13, teamId: "leverkusen", played: 8, won: 4, drawn: 1, lost: 3, goalsFor: 14, goalsAgainst: 12, points: 13, form: ["L", "W", "D", "W", "L"], band: "playoff" },
  { position: 14, teamId: "bodo", played: 8, won: 4, drawn: 1, lost: 3, goalsFor: 13, goalsAgainst: 13, points: 13, form: ["L", "W", "L", "D", "W"], band: "playoff" },
  { position: 15, teamId: "atletico", played: 8, won: 3, drawn: 2, lost: 3, goalsFor: 12, goalsAgainst: 12, points: 11, form: ["W", "L", "D", "W", "L"], band: "playoff" },
  { position: 16, teamId: "atalanta", played: 8, won: 3, drawn: 1, lost: 4, goalsFor: 10, goalsAgainst: 11, points: 10, form: ["L", "D", "L", "W", "W"], band: "playoff" },
];

const UCL_MATCHES: Match[] = [
  { id: "ucl-r16-1", homeTeamId: "sporting", awayTeamId: "bodo", homeScore: 5, awayScore: 0, kickoff: "2026-03-17T20:00:00Z", status: "aet", stageLabel: "Round of 16 · Leg 2 of 2" },
  { id: "ucl-r16-2", homeTeamId: "chelsea", awayTeamId: "psg", homeScore: 0, awayScore: 3, kickoff: "2026-03-17T20:00:00Z", status: "ft", stageLabel: "Round of 16 · Leg 2 of 2" },
  { id: "ucl-r16-3", homeTeamId: "mancity", awayTeamId: "realmadrid", homeScore: 1, awayScore: 2, kickoff: "2026-03-17T20:00:00Z", status: "ft", homeRedCard: true, stageLabel: "Round of 16 · Leg 2 of 2" },
  { id: "ucl-r16-4", homeTeamId: "arsenal", awayTeamId: "leverkusen", homeScore: 2, awayScore: 0, kickoff: "2026-03-17T20:00:00Z", status: "ft", stageLabel: "Round of 16 · Leg 2 of 2" },
  { id: "ucl-r16-5", homeTeamId: "barcelona", awayTeamId: "newcastle", homeScore: 7, awayScore: 2, kickoff: "2026-03-18T20:00:00Z", status: "ft", stageLabel: "Round of 16 · Leg 2 of 2" },
  { id: "ucl-r16-6", homeTeamId: "spurs", awayTeamId: "atletico", homeScore: 3, awayScore: 2, kickoff: "2026-03-18T20:00:00Z", status: "ft", stageLabel: "Round of 16 · Leg 2 of 2" },
  { id: "ucl-r16-7", homeTeamId: "liverpool", awayTeamId: "psg", homeScore: 0, awayScore: 0, kickoff: "2026-03-18T20:00:00Z", status: "ft", stageLabel: "Round of 16 · Leg 2 of 2" },
  { id: "ucl-r16-8", homeTeamId: "bayern", awayTeamId: "inter", homeScore: 1, awayScore: 2, kickoff: "2026-03-18T20:00:00Z", status: "ft", stageLabel: "Round of 16 · Leg 2 of 2" },
];

const UCL_KNOCKOUT: BracketRound[] = [
  {
    id: "quarter-final",
    label: "Quarter-final",
    matches: [
      { id: "ucl-qf-1", homeTeamId: "liverpool", awayTeamId: "psg", legs: [{ homeScore: 0, awayScore: 2 }, { homeScore: 0, awayScore: 2 }], aggregateHome: 0, aggregateAway: 4, winnerTeamId: "psg" },
      { id: "ucl-qf-2", homeTeamId: "bayern", awayTeamId: "realmadrid", legs: [{ homeScore: 2, awayScore: 1 }, { homeScore: 4, awayScore: 3 }], aggregateHome: 6, aggregateAway: 4, winnerTeamId: "bayern" },
      { id: "ucl-qf-3", homeTeamId: "atletico", awayTeamId: "barcelona", legs: [{ homeScore: 2, awayScore: 0 }, { homeScore: 1, awayScore: 2 }], aggregateHome: 3, aggregateAway: 2, winnerTeamId: "atletico" },
      { id: "ucl-qf-4", homeTeamId: "arsenal", awayTeamId: "sporting", legs: [{ homeScore: 1, awayScore: 0 }, { homeScore: 0, awayScore: 0 }], aggregateHome: 1, aggregateAway: 0, winnerTeamId: "arsenal" },
    ],
  },
  {
    id: "semi-final",
    label: "Semi-final",
    matches: [
      { id: "ucl-sf-1", homeTeamId: "bayern", awayTeamId: "psg", legs: [{ homeScore: 4, awayScore: 5 }, { homeScore: 1, awayScore: 1 }], aggregateHome: 5, aggregateAway: 6, winnerTeamId: "psg" },
      { id: "ucl-sf-2", homeTeamId: "arsenal", awayTeamId: "atletico", legs: [{ homeScore: 1, awayScore: 1 }, { homeScore: 1, awayScore: 0 }], aggregateHome: 2, aggregateAway: 1, winnerTeamId: "arsenal" },
    ],
  },
  {
    id: "final",
    label: "Final",
    matches: [
      { id: "ucl-f-1", homeTeamId: "psg", awayTeamId: "arsenal", date: "2026-05-30T19:00:00Z", winnerTeamId: null, homeScore: null, awayScore: null },
    ],
  },
];

// ---------- La Liga ----------

const LALIGA_STANDINGS: Standing[] = [
  { position: 1, teamId: "realmadrid", played: 30, won: 23, drawn: 4, lost: 3, goalsFor: 68, goalsAgainst: 22, points: 73, form: ["W", "W", "D", "W", "W"], band: "champions" },
  { position: 2, teamId: "barcelona", played: 30, won: 22, drawn: 3, lost: 5, goalsFor: 75, goalsAgainst: 30, points: 69, form: ["W", "L", "W", "W", "W"], band: "champions" },
  { position: 3, teamId: "atletico", played: 30, won: 20, drawn: 5, lost: 5, goalsFor: 58, goalsAgainst: 28, points: 65, form: ["W", "W", "W", "D", "L"], band: "champions" },
  { position: 4, teamId: "girona", played: 30, won: 18, drawn: 5, lost: 7, goalsFor: 60, goalsAgainst: 36, points: 59, form: ["W", "D", "W", "L", "W"], band: "champions" },
  { position: 5, teamId: "athletic", played: 30, won: 16, drawn: 6, lost: 8, goalsFor: 48, goalsAgainst: 30, points: 54, form: ["L", "W", "W", "D", "W"], band: "europa" },
  { position: 6, teamId: "betis", played: 30, won: 13, drawn: 9, lost: 8, goalsFor: 44, goalsAgainst: 38, points: 48, form: ["D", "W", "L", "W", "D"], band: "europa" },
  { position: 7, teamId: "sevilla", played: 30, won: 12, drawn: 7, lost: 11, goalsFor: 40, goalsAgainst: 40, points: 43, form: ["L", "W", "D", "L", "W"], band: "conference" },
  { position: 8, teamId: "villarreal", played: 30, won: 11, drawn: 8, lost: 11, goalsFor: 42, goalsAgainst: 44, points: 41, form: ["W", "L", "D", "W", "L"], band: null },
  { position: 9, teamId: "valencia", played: 30, won: 10, drawn: 8, lost: 12, goalsFor: 36, goalsAgainst: 39, points: 38, form: ["L", "D", "W", "L", "D"], band: null },
];

const LALIGA_MATCHES: Match[] = [
  { id: "ll-1", homeTeamId: "realmadrid", awayTeamId: "barcelona", homeScore: 2, awayScore: 1, kickoff: "2026-04-21T19:00:00Z", status: "ft", stageLabel: "Matchday 31 · El Clásico" },
  { id: "ll-2", homeTeamId: "atletico", awayTeamId: "girona", homeScore: 3, awayScore: 0, kickoff: "2026-04-21T17:00:00Z", status: "ft", stageLabel: "Matchday 31" },
  { id: "ll-3", homeTeamId: "athletic", awayTeamId: "betis", homeScore: 1, awayScore: 1, kickoff: "2026-04-22T19:00:00Z", status: "ft", stageLabel: "Matchday 31" },
  { id: "ll-4", homeTeamId: "sevilla", awayTeamId: "villarreal", homeScore: 2, awayScore: 2, kickoff: "2026-04-22T19:00:00Z", status: "ft", stageLabel: "Matchday 31" },
  { id: "ll-5", homeTeamId: "barcelona", awayTeamId: "atletico", homeScore: null, awayScore: null, kickoff: "2026-04-28T19:00:00Z", status: "scheduled", stageLabel: "Matchday 32" },
  { id: "ll-6", homeTeamId: "realmadrid", awayTeamId: "valencia", homeScore: null, awayScore: null, kickoff: "2026-04-28T17:00:00Z", status: "scheduled", stageLabel: "Matchday 32" },
];

// ---------- Public API ----------

const LEAGUES: Record<FootballLeagueId, FootballLeagueData> = {
  "uefa-champions-league": {
    league: {
      id: "uefa-champions-league",
      name: "UEFA Champions League",
      shortName: "UCL",
      region: "UEFA",
      hasKnockout: true,
      season: "2025–26",
    },
    teams: TEAMS,
    matches: UCL_MATCHES,
    standings: UCL_STANDINGS,
    knockout: UCL_KNOCKOUT,
  },
  "la-liga": {
    league: {
      id: "la-liga",
      name: "Spanish La Liga",
      shortName: "La Liga",
      region: "ESP",
      hasKnockout: false,
      season: "2025–26",
    },
    teams: TEAMS,
    matches: LALIGA_MATCHES,
    standings: LALIGA_STANDINGS,
  },
  "premier-league": {
    league: {
      id: "premier-league",
      name: "Premier League",
      shortName: "EPL",
      region: "ENG",
      hasKnockout: false,
      season: "2025–26",
    },
    teams: TEAMS,
    matches: [],
    standings: [],
  },
  "serie-a": {
    league: {
      id: "serie-a",
      name: "Serie A",
      shortName: "Serie A",
      region: "ITA",
      hasKnockout: false,
      season: "2025–26",
    },
    teams: TEAMS,
    matches: [],
    standings: [],
  },
};

export const FOOTBALL_LEAGUE_IDS: FootballLeagueId[] = [
  "uefa-champions-league",
  "la-liga",
  "premier-league",
  "serie-a",
];

export const FOOTBALL_TEAMS: Team[] = TEAMS;

export function getFootballLeague(id: FootballLeagueId): FootballLeagueData {
  return LEAGUES[id];
}

export function getFootballLeagues(): FootballLeagueData[] {
  return FOOTBALL_LEAGUE_IDS.map((id) => LEAGUES[id]);
}
