import { WORLD_CUP_DATA } from "@/lib/data/sports/world-cup";
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
  { position: 1, teamId: "arsenal", played: 8, won: 8, drawn: 0, lost: 0, goalsFor: 23, goalsAgainst: 4, points: 24, band: "champions" },
  { position: 2, teamId: "bayern", played: 8, won: 7, drawn: 0, lost: 1, goalsFor: 22, goalsAgainst: 8, points: 21, band: "champions" },
  { position: 3, teamId: "liverpool", played: 8, won: 6, drawn: 0, lost: 2, goalsFor: 20, goalsAgainst: 8, points: 18, band: "champions" },
  { position: 4, teamId: "spurs", played: 8, won: 5, drawn: 2, lost: 1, goalsFor: 17, goalsAgainst: 7, points: 17, band: "champions" },
  { position: 5, teamId: "barcelona", played: 8, won: 5, drawn: 1, lost: 2, goalsFor: 22, goalsAgainst: 14, points: 16, band: "champions" },
  { position: 6, teamId: "chelsea", played: 8, won: 5, drawn: 1, lost: 2, goalsFor: 17, goalsAgainst: 10, points: 16, band: "champions" },
  { position: 7, teamId: "sporting", played: 8, won: 5, drawn: 1, lost: 2, goalsFor: 17, goalsAgainst: 11, points: 16, band: "champions" },
  { position: 8, teamId: "mancity", played: 8, won: 5, drawn: 1, lost: 2, goalsFor: 15, goalsAgainst: 9, points: 16, band: "champions" },
  { position: 9, teamId: "realmadrid", played: 8, won: 5, drawn: 0, lost: 3, goalsFor: 21, goalsAgainst: 12, points: 15, band: "playoff" },
  { position: 10, teamId: "inter", played: 8, won: 5, drawn: 0, lost: 3, goalsFor: 15, goalsAgainst: 7, points: 15, band: "playoff" },
  { position: 11, teamId: "psg", played: 8, won: 4, drawn: 2, lost: 2, goalsFor: 21, goalsAgainst: 11, points: 14, band: "playoff" },
  { position: 12, teamId: "newcastle", played: 8, won: 4, drawn: 2, lost: 2, goalsFor: 17, goalsAgainst: 10, points: 14, band: "playoff" },
  { position: 13, teamId: "leverkusen", played: 8, won: 4, drawn: 1, lost: 3, goalsFor: 14, goalsAgainst: 12, points: 13, band: "playoff" },
  { position: 14, teamId: "bodo", played: 8, won: 4, drawn: 1, lost: 3, goalsFor: 13, goalsAgainst: 13, points: 13, band: "playoff" },
  { position: 15, teamId: "atletico", played: 8, won: 3, drawn: 2, lost: 3, goalsFor: 12, goalsAgainst: 12, points: 11, band: "playoff" },
  { position: 16, teamId: "atalanta", played: 8, won: 3, drawn: 1, lost: 4, goalsFor: 10, goalsAgainst: 11, points: 10, band: "playoff" },
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
  { position: 1, teamId: "realmadrid", played: 30, won: 23, drawn: 4, lost: 3, goalsFor: 68, goalsAgainst: 22, points: 73, band: "champions" },
  { position: 2, teamId: "barcelona", played: 30, won: 22, drawn: 3, lost: 5, goalsFor: 75, goalsAgainst: 30, points: 69, band: "champions" },
  { position: 3, teamId: "atletico", played: 30, won: 20, drawn: 5, lost: 5, goalsFor: 58, goalsAgainst: 28, points: 65, band: "champions" },
  { position: 4, teamId: "girona", played: 30, won: 18, drawn: 5, lost: 7, goalsFor: 60, goalsAgainst: 36, points: 59, band: "champions" },
  { position: 5, teamId: "athletic", played: 30, won: 16, drawn: 6, lost: 8, goalsFor: 48, goalsAgainst: 30, points: 54, band: "europa" },
  { position: 6, teamId: "betis", played: 30, won: 13, drawn: 9, lost: 8, goalsFor: 44, goalsAgainst: 38, points: 48, band: "europa" },
  { position: 7, teamId: "sevilla", played: 30, won: 12, drawn: 7, lost: 11, goalsFor: 40, goalsAgainst: 40, points: 43, band: "conference" },
  { position: 8, teamId: "villarreal", played: 30, won: 11, drawn: 8, lost: 11, goalsFor: 42, goalsAgainst: 44, points: 41, band: null },
  { position: 9, teamId: "valencia", played: 30, won: 10, drawn: 8, lost: 12, goalsFor: 36, goalsAgainst: 39, points: 38, band: null },
];

const LALIGA_MATCHES: Match[] = [
  { id: "ll-1", homeTeamId: "realmadrid", awayTeamId: "barcelona", homeScore: 2, awayScore: 1, kickoff: "2026-04-21T19:00:00Z", status: "ft", stageLabel: "Matchday 31 · El Clásico" },
  { id: "ll-2", homeTeamId: "atletico", awayTeamId: "girona", homeScore: 3, awayScore: 0, kickoff: "2026-04-21T17:00:00Z", status: "ft", stageLabel: "Matchday 31" },
  { id: "ll-3", homeTeamId: "athletic", awayTeamId: "betis", homeScore: 1, awayScore: 1, kickoff: "2026-04-22T19:00:00Z", status: "ft", stageLabel: "Matchday 31" },
  { id: "ll-4", homeTeamId: "sevilla", awayTeamId: "villarreal", homeScore: 2, awayScore: 2, kickoff: "2026-04-22T19:00:00Z", status: "ft", stageLabel: "Matchday 31" },
  { id: "ll-5", homeTeamId: "barcelona", awayTeamId: "atletico", homeScore: null, awayScore: null, kickoff: "2026-04-28T19:00:00Z", status: "scheduled", stageLabel: "Matchday 32" },
  { id: "ll-6", homeTeamId: "realmadrid", awayTeamId: "valencia", homeScore: null, awayScore: null, kickoff: "2026-04-28T17:00:00Z", status: "scheduled", stageLabel: "Matchday 32" },
];

// ---------- MLS ----------

const MLS_TEAMS: Team[] = [
  { id: "nsh", name: "Nashville SC", shortName: "Nashville", code: "NSH", primaryColor: "#ECE83A" },
  { id: "ne", name: "New England Revolution", shortName: "New England", code: "NE", primaryColor: "#022166" },
  { id: "mia", name: "Inter Miami CF", shortName: "Miami", code: "MIA", primaryColor: "#231F20" },
  { id: "chi", name: "Chicago Fire FC", shortName: "Chicago", code: "CHI", primaryColor: "#7CCDEF" },
  { id: "clt", name: "Charlotte FC", shortName: "Charlotte", code: "CLT", primaryColor: "#0085CA" },
  { id: "phi", name: "Philadelphia Union", shortName: "Philadelphia", code: "PHI", primaryColor: "#051F31" },
  { id: "orl", name: "Orlando City SC", shortName: "Orlando", code: "ORL", primaryColor: "#60269E" },
  { id: "cin", name: "FC Cincinnati", shortName: "Cincinnati", code: "CIN", primaryColor: "#003087" },
  { id: "rbny", name: "Red Bull New York", shortName: "Red Bull NY", code: "RBNY", primaryColor: "#BA0C2F" },
  { id: "van", name: "Vancouver Whitecaps", shortName: "Vancouver", code: "VAN", primaryColor: "#12284C" },
  { id: "dal", name: "FC Dallas", shortName: "Dallas", code: "DAL", primaryColor: "#C6093B" },
  { id: "stl", name: "St. Louis CITY SC", shortName: "St. Louis", code: "STL", primaryColor: "#EC1458" },
  { id: "sj", name: "San Jose Earthquakes", shortName: "San Jose", code: "SJ", primaryColor: "#003DA6" },
  { id: "hou", name: "Houston Dynamo FC", shortName: "Houston", code: "HOU", primaryColor: "#FF6B00" },
  { id: "lafc", name: "LAFC", shortName: "LAFC", code: "LAFC", primaryColor: "#000000" },
  { id: "sea", name: "Seattle Sounders FC", shortName: "Seattle", code: "SEA", primaryColor: "#2DC84D" },
  { id: "col", name: "Colorado Rapids", shortName: "Colorado", code: "COL", primaryColor: "#8A2432" },
  { id: "la", name: "LA Galaxy", shortName: "LA Galaxy", code: "LA", primaryColor: "#00235D" },
  { id: "mtl", name: "CF Montréal", shortName: "CF Montréal", code: "MTL", primaryColor: "#003DA6" },
];

const MLS_EAST: Standing[] = [
  { position: 1, teamId: "nsh", played: 31, won: 21, drawn: 7, lost: 3, goalsFor: 66, goalsAgainst: 23, points: 70, band: "champions" },
  { position: 2, teamId: "ne", played: 31, won: 17, drawn: 4, lost: 10, goalsFor: 51, goalsAgainst: 42, points: 55, band: "champions" },
  { position: 3, teamId: "mia", played: 31, won: 15, drawn: 10, lost: 6, goalsFor: 73, goalsAgainst: 53, points: 55, band: "champions" },
  { position: 4, teamId: "chi", played: 31, won: 15, drawn: 6, lost: 10, goalsFor: 55, goalsAgainst: 46, points: 51, band: "champions" },
  { position: 5, teamId: "clt", played: 31, won: 13, drawn: 8, lost: 10, goalsFor: 55, goalsAgainst: 48, points: 47, band: "champions" },
  { position: 6, teamId: "phi", played: 31, won: 13, drawn: 7, lost: 11, goalsFor: 62, goalsAgainst: 50, points: 46, band: "champions" },
  { position: 7, teamId: "orl", played: 31, won: 12, drawn: 6, lost: 13, goalsFor: 60, goalsAgainst: 72, points: 42, band: "champions" },
  { position: 8, teamId: "cin", played: 31, won: 11, drawn: 9, lost: 11, goalsFor: 64, goalsAgainst: 71, points: 42, band: "playoff" },
  { position: 9, teamId: "rbny", played: 31, won: 11, drawn: 6, lost: 14, goalsFor: 41, goalsAgainst: 56, points: 39, band: "playoff" },
];

const MLS_WEST: Standing[] = [
  { position: 1, teamId: "van", played: 31, won: 16, drawn: 7, lost: 8, goalsFor: 63, goalsAgainst: 32, points: 55, band: "champions" },
  { position: 2, teamId: "dal", played: 31, won: 15, drawn: 9, lost: 7, goalsFor: 58, goalsAgainst: 47, points: 54, band: "champions" },
  { position: 3, teamId: "stl", played: 31, won: 14, drawn: 9, lost: 8, goalsFor: 56, goalsAgainst: 44, points: 51, band: "champions" },
  { position: 4, teamId: "sj", played: 31, won: 13, drawn: 9, lost: 9, goalsFor: 52, goalsAgainst: 45, points: 48, band: "champions" },
  { position: 5, teamId: "hou", played: 31, won: 13, drawn: 9, lost: 9, goalsFor: 41, goalsAgainst: 39, points: 48, band: "champions" },
  { position: 6, teamId: "lafc", played: 31, won: 12, drawn: 10, lost: 9, goalsFor: 48, goalsAgainst: 33, points: 46, band: "champions" },
  { position: 7, teamId: "sea", played: 31, won: 11, drawn: 10, lost: 10, goalsFor: 41, goalsAgainst: 39, points: 43, band: "champions" },
  { position: 8, teamId: "col", played: 31, won: 12, drawn: 6, lost: 13, goalsFor: 42, goalsAgainst: 41, points: 42, band: "playoff" },
  { position: 9, teamId: "la", played: 31, won: 10, drawn: 10, lost: 11, goalsFor: 43, goalsAgainst: 52, points: 40, band: "playoff" },
];

/** Both conferences as one table, the Supporters' Shield's: points, then wins, goal difference and goals. */
const MLS_OVERALL: Standing[] = [...MLS_EAST, ...MLS_WEST]
  .sort(
    (a, b) =>
      b.points - a.points ||
      b.won - a.won ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor
  )
  .map((row, i) => ({ ...row, position: i + 1, band: null }));

const MLS_MATCHES: Match[] = [
  { id: "mls-1", homeTeamId: "mtl", awayTeamId: "nsh", homeScore: 0, awayScore: 2, kickoff: "2026-10-24T17:30:00Z", status: "ft" },
  { id: "mls-2", homeTeamId: "rbny", awayTeamId: "mia", homeScore: 2, awayScore: 0, kickoff: "2026-10-24T21:30:00Z", status: "ft" },
  { id: "mls-3", homeTeamId: "dal", awayTeamId: "sj", homeScore: 3, awayScore: 0, kickoff: "2026-10-25T00:30:00Z", status: "ft" },
  { id: "mls-4", homeTeamId: "col", awayTeamId: "van", homeScore: 1, awayScore: 0, kickoff: "2026-10-25T01:30:00Z", status: "ft" },
  { id: "mls-5", homeTeamId: "lafc", awayTeamId: "la", homeScore: 1, awayScore: 1, kickoff: "2026-10-26T01:00:00Z", status: "ft" },
  { id: "mls-6", homeTeamId: "clt", awayTeamId: "mtl", homeScore: null, awayScore: null, kickoff: "2026-10-28T23:30:00Z", status: "scheduled" },
  { id: "mls-7", homeTeamId: "mia", awayTeamId: "cin", homeScore: null, awayScore: null, kickoff: "2026-10-28T23:30:00Z", status: "scheduled" },
  { id: "mls-8", homeTeamId: "sea", awayTeamId: "hou", homeScore: null, awayScore: null, kickoff: "2026-10-29T02:30:00Z", status: "scheduled" },
];

// ---------- Costa Rica ----------

const CRC_TEAMS: Team[] = [
  { id: "sap", name: "Saprissa", shortName: "Saprissa", code: "SAP", primaryColor: "#5B2C83" },
  { id: "car", name: "Cartaginés", shortName: "Cartaginés", code: "CAR", primaryColor: "#003A8C" },
  { id: "ssj", name: "Sporting San José", shortName: "Spr. San José", code: "SSJ", primaryColor: "#1B1B1B" },
  { id: "adsc", name: "AD San Carlos", shortName: "AD San Carlos", code: "ADSC", primaryColor: "#00843D" },
  { id: "ala", name: "Alajuelense", shortName: "Alajuelense", code: "ALA", primaryColor: "#C8102E" },
  { id: "pun", name: "Puntarenas FC", shortName: "Puntarenas", code: "PUN", primaryColor: "#E87722" },
  { id: "isc", name: "Inter de San Carlos", shortName: "Inter San Carlos", code: "ISC", primaryColor: "#0057B8" },
  { id: "her", name: "Herediano", shortName: "Herediano", code: "HER", primaryColor: "#D50032" },
  { id: "bel", name: "Escorpiones Belén", shortName: "Belén", code: "BEL", primaryColor: "#B5121B" },
  { id: "zel", name: "Pérez Zeledón", shortName: "Pérez Zeledón", code: "ZEL", primaryColor: "#5C2D91" },
];

const CRC_STANDINGS: Standing[] = [
  { position: 1, teamId: "sap", played: 13, won: 8, drawn: 0, lost: 5, goalsFor: 27, goalsAgainst: 14, points: 24, band: "champions" },
  { position: 2, teamId: "car", played: 13, won: 8, drawn: 0, lost: 5, goalsFor: 24, goalsAgainst: 17, points: 24, band: "champions" },
  { position: 3, teamId: "ssj", played: 13, won: 7, drawn: 3, lost: 3, goalsFor: 26, goalsAgainst: 20, points: 24, band: "champions" },
  { position: 4, teamId: "adsc", played: 13, won: 7, drawn: 1, lost: 5, goalsFor: 15, goalsAgainst: 15, points: 22, band: "champions" },
  { position: 5, teamId: "ala", played: 12, won: 5, drawn: 4, lost: 3, goalsFor: 20, goalsAgainst: 14, points: 19, band: null },
  { position: 6, teamId: "pun", played: 13, won: 5, drawn: 3, lost: 5, goalsFor: 15, goalsAgainst: 19, points: 18, band: null },
  { position: 7, teamId: "isc", played: 13, won: 5, drawn: 3, lost: 5, goalsFor: 15, goalsAgainst: 20, points: 18, band: null },
  { position: 8, teamId: "her", played: 13, won: 4, drawn: 2, lost: 7, goalsFor: 15, goalsAgainst: 17, points: 14, band: null },
  { position: 9, teamId: "bel", played: 13, won: 3, drawn: 1, lost: 9, goalsFor: 14, goalsAgainst: 22, points: 10, band: null },
  { position: 10, teamId: "zel", played: 12, won: 2, drawn: 3, lost: 7, goalsFor: 9, goalsAgainst: 22, points: 9, band: null },
];

const CRC_MATCHES: Match[] = [
  { id: "crc-1", homeTeamId: "her", awayTeamId: "car", homeScore: 3, awayScore: 1, kickoff: "2026-10-25T02:00:00Z", status: "ft" },
  { id: "crc-2", homeTeamId: "pun", awayTeamId: "isc", homeScore: 3, awayScore: 1, kickoff: "2026-10-25T00:00:00Z", status: "ft" },
  { id: "crc-3", homeTeamId: "adsc", awayTeamId: "sap", homeScore: 2, awayScore: 1, kickoff: "2026-10-25T22:00:00Z", status: "ft" },
  { id: "crc-4", homeTeamId: "ala", awayTeamId: "zel", homeScore: 1, awayScore: 0, kickoff: "2026-10-26T00:00:00Z", status: "ft" },
  { id: "crc-5", homeTeamId: "zel", awayTeamId: "pun", homeScore: null, awayScore: null, kickoff: "2026-10-31T02:00:00Z", status: "scheduled" },
  { id: "crc-6", homeTeamId: "sap", awayTeamId: "ala", homeScore: null, awayScore: null, kickoff: "2026-11-01T22:00:00Z", status: "scheduled" },
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
  "ligue-1": {
    league: { id: "ligue-1", name: "Ligue 1", shortName: "Ligue 1", region: "FRA", hasKnockout: false, season: "2025–26" },
    teams: TEAMS,
    matches: [],
    standings: [],
  },
  bundesliga: {
    league: { id: "bundesliga", name: "Bundesliga", shortName: "Bundesliga", region: "GER", hasKnockout: false, season: "2025–26" },
    teams: TEAMS,
    matches: [],
    standings: [],
  },
  mls: {
    league: { id: "mls", name: "Major League Soccer", shortName: "MLS", region: "USA", hasKnockout: true, season: "2026" },
    teams: MLS_TEAMS,
    matches: MLS_MATCHES,
    standings: MLS_OVERALL,
    groups: [
      { label: "East", standings: MLS_EAST },
      { label: "West", standings: MLS_WEST },
    ],
  },
  "costa-rica": {
    league: {
      id: "costa-rica",
      name: "Primera División de Costa Rica",
      shortName: "Primera División",
      region: "CRC",
      hasKnockout: true,
      season: "2026–27 Apertura",
    },
    teams: CRC_TEAMS,
    matches: CRC_MATCHES,
    standings: CRC_STANDINGS,
  },
  "world-cup": WORLD_CUP_DATA,
};

// The World Cup is intentionally NOT part of the football hub's league list —
// it has its own sport tab. It lives in LEAGUES only for mock fallback lookup.
export const FOOTBALL_LEAGUE_IDS: FootballLeagueId[] = [
  "uefa-champions-league",
  "la-liga",
  "premier-league",
  "serie-a",
  "ligue-1",
  "bundesliga",
  "mls",
  "costa-rica",
];

export function getFootballLeague(id: FootballLeagueId): FootballLeagueData {
  return LEAGUES[id];
}

export function getFootballLeagues(): FootballLeagueData[] {
  return FOOTBALL_LEAGUE_IDS.map((id) => LEAGUES[id]);
}
