import type { Match, NbaData, NbaStanding, Team } from "@/types/sports";

const TEAMS: Team[] = [
  { id: "bos", name: "Boston Celtics", shortName: "Celtics", code: "BOS", primaryColor: "#007A33" },
  { id: "nyk", name: "New York Knicks", shortName: "Knicks", code: "NYK", primaryColor: "#006BB6" },
  { id: "mil", name: "Milwaukee Bucks", shortName: "Bucks", code: "MIL", primaryColor: "#00471B" },
  { id: "cle", name: "Cleveland Cavaliers", shortName: "Cavaliers", code: "CLE", primaryColor: "#860038" },
  { id: "phi", name: "Philadelphia 76ers", shortName: "76ers", code: "PHI", primaryColor: "#006BB6" },
  { id: "ind", name: "Indiana Pacers", shortName: "Pacers", code: "IND", primaryColor: "#002D62" },
  { id: "mia", name: "Miami Heat", shortName: "Heat", code: "MIA", primaryColor: "#98002E" },
  { id: "orl", name: "Orlando Magic", shortName: "Magic", code: "ORL", primaryColor: "#0077C0" },
  { id: "den", name: "Denver Nuggets", shortName: "Nuggets", code: "DEN", primaryColor: "#0E2240" },
  { id: "okc", name: "Oklahoma City Thunder", shortName: "Thunder", code: "OKC", primaryColor: "#007AC1" },
  { id: "min", name: "Minnesota Timberwolves", shortName: "Timberwolves", code: "MIN", primaryColor: "#0C2340" },
  { id: "lac", name: "LA Clippers", shortName: "Clippers", code: "LAC", primaryColor: "#C8102E" },
  { id: "lal", name: "Los Angeles Lakers", shortName: "Lakers", code: "LAL", primaryColor: "#552583" },
  { id: "dal", name: "Dallas Mavericks", shortName: "Mavericks", code: "DAL", primaryColor: "#00538C" },
  { id: "gsw", name: "Golden State Warriors", shortName: "Warriors", code: "GSW", primaryColor: "#1D428A" },
  { id: "phx", name: "Phoenix Suns", shortName: "Suns", code: "PHX", primaryColor: "#1D1160" },
];

const STANDINGS: NbaStanding[] = [
  { position: 1, teamId: "bos", conference: "east", played: 65, won: 53, drawn: 0, lost: 12, goalsFor: 7702, goalsAgainst: 7150, points: 0, winPct: 0.815, gamesBehind: 0, streak: "W4", last10: "8-2" },
  { position: 2, teamId: "nyk", conference: "east", played: 65, won: 44, drawn: 0, lost: 21, goalsFor: 7350, goalsAgainst: 7088, points: 0, winPct: 0.677, gamesBehind: 9, streak: "W2", last10: "7-3" },
  { position: 3, teamId: "mil", conference: "east", played: 65, won: 42, drawn: 0, lost: 23, goalsFor: 7385, goalsAgainst: 7240, points: 0, winPct: 0.646, gamesBehind: 11, streak: "L1", last10: "6-4" },
  { position: 4, teamId: "cle", conference: "east", played: 65, won: 40, drawn: 0, lost: 25, goalsFor: 7180, goalsAgainst: 7042, points: 0, winPct: 0.615, gamesBehind: 13, streak: "W1", last10: "5-5" },
  { position: 5, teamId: "ind", conference: "east", played: 65, won: 38, drawn: 0, lost: 27, goalsFor: 7480, goalsAgainst: 7385, points: 0, winPct: 0.585, gamesBehind: 15, streak: "W3", last10: "7-3" },
  { position: 6, teamId: "phi", conference: "east", played: 65, won: 36, drawn: 0, lost: 29, goalsFor: 7200, goalsAgainst: 7120, points: 0, winPct: 0.554, gamesBehind: 17, streak: "L2", last10: "4-6" },
  { position: 7, teamId: "mia", conference: "east", played: 65, won: 35, drawn: 0, lost: 30, goalsFor: 7050, goalsAgainst: 7032, points: 0, winPct: 0.538, gamesBehind: 18, streak: "W1", last10: "6-4" },
  { position: 8, teamId: "orl", conference: "east", played: 65, won: 32, drawn: 0, lost: 33, goalsFor: 6950, goalsAgainst: 6900, points: 0, winPct: 0.492, gamesBehind: 21, streak: "L1", last10: "5-5" },

  { position: 1, teamId: "okc", conference: "west", played: 65, won: 51, drawn: 0, lost: 14, goalsFor: 7510, goalsAgainst: 6980, points: 0, winPct: 0.785, gamesBehind: 0, streak: "W5", last10: "9-1" },
  { position: 2, teamId: "den", conference: "west", played: 65, won: 46, drawn: 0, lost: 19, goalsFor: 7400, goalsAgainst: 7100, points: 0, winPct: 0.708, gamesBehind: 5, streak: "W2", last10: "7-3" },
  { position: 3, teamId: "min", conference: "west", played: 65, won: 43, drawn: 0, lost: 22, goalsFor: 7150, goalsAgainst: 6900, points: 0, winPct: 0.662, gamesBehind: 8, streak: "L1", last10: "6-4" },
  { position: 4, teamId: "lac", conference: "west", played: 65, won: 41, drawn: 0, lost: 24, goalsFor: 7280, goalsAgainst: 7090, points: 0, winPct: 0.631, gamesBehind: 10, streak: "W1", last10: "6-4" },
  { position: 5, teamId: "dal", conference: "west", played: 65, won: 40, drawn: 0, lost: 25, goalsFor: 7330, goalsAgainst: 7180, points: 0, winPct: 0.615, gamesBehind: 11, streak: "W3", last10: "7-3" },
  { position: 6, teamId: "lal", conference: "west", played: 65, won: 37, drawn: 0, lost: 28, goalsFor: 7150, goalsAgainst: 7120, points: 0, winPct: 0.569, gamesBehind: 14, streak: "L1", last10: "5-5" },
  { position: 7, teamId: "phx", conference: "west", played: 65, won: 35, drawn: 0, lost: 30, goalsFor: 7220, goalsAgainst: 7200, points: 0, winPct: 0.538, gamesBehind: 16, streak: "W2", last10: "6-4" },
  { position: 8, teamId: "gsw", conference: "west", played: 65, won: 33, drawn: 0, lost: 32, goalsFor: 7100, goalsAgainst: 7090, points: 0, winPct: 0.508, gamesBehind: 18, streak: "L1", last10: "4-6" },
];

const GAMES: Match[] = [
  { id: "nba-1", homeTeamId: "bos", awayTeamId: "nyk", homeScore: 118, awayScore: 105, kickoff: "2026-05-21T23:30:00Z", status: "ft", stageLabel: "Conference Finals · Game 1" },
  { id: "nba-2", homeTeamId: "okc", awayTeamId: "den", homeScore: 124, awayScore: 119, kickoff: "2026-05-21T02:00:00Z", status: "ft", stageLabel: "Conference Finals · Game 1" },
  { id: "nba-3", homeTeamId: "bos", awayTeamId: "nyk", homeScore: 110, awayScore: 102, kickoff: "2026-05-23T23:30:00Z", status: "ft", stageLabel: "Conference Finals · Game 2" },
  { id: "nba-4", homeTeamId: "okc", awayTeamId: "den", homeScore: null, awayScore: null, kickoff: "2026-05-24T02:00:00Z", status: "scheduled", stageLabel: "Conference Finals · Game 2" },
  { id: "nba-5", homeTeamId: "nyk", awayTeamId: "bos", homeScore: null, awayScore: null, kickoff: "2026-05-26T00:00:00Z", status: "scheduled", stageLabel: "Conference Finals · Game 3" },
];

export const NBA_DATA: NbaData = {
  season: "2025–26",
  teams: TEAMS,
  games: GAMES,
  standings: STANDINGS,
};
