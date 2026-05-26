import type { BracketRound, Match, NflData, NflStanding, Team } from "@/types/sports";

const TEAMS: Team[] = [
  // AFC East
  { id: "buf", name: "Buffalo Bills", shortName: "Bills", code: "BUF", primaryColor: "#00338D" },
  { id: "mia-nfl", name: "Miami Dolphins", shortName: "Dolphins", code: "MIA", primaryColor: "#008E97" },
  { id: "nyj", name: "New York Jets", shortName: "Jets", code: "NYJ", primaryColor: "#125740" },
  { id: "ne", name: "New England Patriots", shortName: "Patriots", code: "NE", primaryColor: "#002244" },
  // AFC North
  { id: "bal", name: "Baltimore Ravens", shortName: "Ravens", code: "BAL", primaryColor: "#241773" },
  { id: "pit", name: "Pittsburgh Steelers", shortName: "Steelers", code: "PIT", primaryColor: "#FFB612" },
  { id: "cin", name: "Cincinnati Bengals", shortName: "Bengals", code: "CIN", primaryColor: "#FB4F14" },
  { id: "cle-nfl", name: "Cleveland Browns", shortName: "Browns", code: "CLE", primaryColor: "#311D00" },
  // AFC South
  { id: "hou", name: "Houston Texans", shortName: "Texans", code: "HOU", primaryColor: "#03202F" },
  { id: "ind-nfl", name: "Indianapolis Colts", shortName: "Colts", code: "IND", primaryColor: "#002C5F" },
  { id: "ten", name: "Tennessee Titans", shortName: "Titans", code: "TEN", primaryColor: "#0C2340" },
  { id: "jax", name: "Jacksonville Jaguars", shortName: "Jaguars", code: "JAX", primaryColor: "#101820" },
  // AFC West
  { id: "kc", name: "Kansas City Chiefs", shortName: "Chiefs", code: "KC", primaryColor: "#E31837" },
  { id: "lac-nfl", name: "Los Angeles Chargers", shortName: "Chargers", code: "LAC", primaryColor: "#0080C6" },
  { id: "den-nfl", name: "Denver Broncos", shortName: "Broncos", code: "DEN", primaryColor: "#FB4F14" },
  { id: "lv", name: "Las Vegas Raiders", shortName: "Raiders", code: "LV", primaryColor: "#000000" },
  // NFC East
  { id: "phi-nfl", name: "Philadelphia Eagles", shortName: "Eagles", code: "PHI", primaryColor: "#004C54" },
  { id: "dal-nfl", name: "Dallas Cowboys", shortName: "Cowboys", code: "DAL", primaryColor: "#003594" },
  { id: "nyg", name: "New York Giants", shortName: "Giants", code: "NYG", primaryColor: "#0B2265" },
  { id: "was", name: "Washington Commanders", shortName: "Commanders", code: "WAS", primaryColor: "#5A1414" },
  // NFC North
  { id: "det", name: "Detroit Lions", shortName: "Lions", code: "DET", primaryColor: "#0076B6" },
  { id: "gb", name: "Green Bay Packers", shortName: "Packers", code: "GB", primaryColor: "#203731" },
  { id: "min-nfl", name: "Minnesota Vikings", shortName: "Vikings", code: "MIN", primaryColor: "#4F2683" },
  { id: "chi", name: "Chicago Bears", shortName: "Bears", code: "CHI", primaryColor: "#0B162A" },
  // NFC South
  { id: "tb", name: "Tampa Bay Buccaneers", shortName: "Buccaneers", code: "TB", primaryColor: "#D50A0A" },
  { id: "atl", name: "Atlanta Falcons", shortName: "Falcons", code: "ATL", primaryColor: "#A71930" },
  { id: "no", name: "New Orleans Saints", shortName: "Saints", code: "NO", primaryColor: "#D3BC8D" },
  { id: "car", name: "Carolina Panthers", shortName: "Panthers", code: "CAR", primaryColor: "#0085CA" },
  // NFC West
  { id: "sf", name: "San Francisco 49ers", shortName: "49ers", code: "SF", primaryColor: "#AA0000" },
  { id: "sea", name: "Seattle Seahawks", shortName: "Seahawks", code: "SEA", primaryColor: "#002244" },
  { id: "lar", name: "Los Angeles Rams", shortName: "Rams", code: "LAR", primaryColor: "#003594" },
  { id: "ari", name: "Arizona Cardinals", shortName: "Cardinals", code: "ARI", primaryColor: "#97233F" },
];

const STANDINGS: NflStanding[] = [
  { position: 1, teamId: "buf", conference: "afc", division: "afc-east", wins: 13, losses: 4, ties: 0, pct: 0.765, pointsFor: 482, pointsAgainst: 326, streak: "W4" },
  { position: 2, teamId: "bal", conference: "afc", division: "afc-north", wins: 13, losses: 4, ties: 0, pct: 0.765, pointsFor: 471, pointsAgainst: 311, streak: "W3" },
  { position: 3, teamId: "kc", conference: "afc", division: "afc-west", wins: 12, losses: 5, ties: 0, pct: 0.706, pointsFor: 442, pointsAgainst: 318, streak: "W2" },
  { position: 4, teamId: "hou", conference: "afc", division: "afc-south", wins: 11, losses: 6, ties: 0, pct: 0.647, pointsFor: 420, pointsAgainst: 332, streak: "L1" },
  { position: 5, teamId: "pit", conference: "afc", division: "afc-north", wins: 10, losses: 7, ties: 0, pct: 0.588, pointsFor: 386, pointsAgainst: 340, streak: "W1" },
  { position: 6, teamId: "lac-nfl", conference: "afc", division: "afc-west", wins: 10, losses: 7, ties: 0, pct: 0.588, pointsFor: 374, pointsAgainst: 311, streak: "L1" },
  { position: 7, teamId: "mia-nfl", conference: "afc", division: "afc-east", wins: 9, losses: 8, ties: 0, pct: 0.529, pointsFor: 372, pointsAgainst: 360, streak: "W2" },

  { position: 1, teamId: "det", conference: "nfc", division: "nfc-north", wins: 15, losses: 2, ties: 0, pct: 0.882, pointsFor: 530, pointsAgainst: 312, streak: "W6" },
  { position: 2, teamId: "phi-nfl", conference: "nfc", division: "nfc-east", wins: 13, losses: 4, ties: 0, pct: 0.765, pointsFor: 466, pointsAgainst: 322, streak: "W4" },
  { position: 3, teamId: "tb", conference: "nfc", division: "nfc-south", wins: 11, losses: 6, ties: 0, pct: 0.647, pointsFor: 425, pointsAgainst: 360, streak: "W2" },
  { position: 4, teamId: "lar", conference: "nfc", division: "nfc-west", wins: 11, losses: 6, ties: 0, pct: 0.647, pointsFor: 412, pointsAgainst: 358, streak: "L1" },
  { position: 5, teamId: "min-nfl", conference: "nfc", division: "nfc-north", wins: 10, losses: 7, ties: 0, pct: 0.588, pointsFor: 398, pointsAgainst: 360, streak: "W1" },
  { position: 6, teamId: "was", conference: "nfc", division: "nfc-east", wins: 10, losses: 7, ties: 0, pct: 0.588, pointsFor: 388, pointsAgainst: 350, streak: "L2" },
  { position: 7, teamId: "gb", conference: "nfc", division: "nfc-north", wins: 9, losses: 8, ties: 0, pct: 0.529, pointsFor: 380, pointsAgainst: 362, streak: "W1" },
];

const GAMES: Match[] = [
  { id: "nfl-1", homeTeamId: "kc", awayTeamId: "buf", homeScore: 27, awayScore: 24, kickoff: "2026-01-26T23:30:00Z", status: "ft", stageLabel: "AFC Championship" },
  { id: "nfl-2", homeTeamId: "det", awayTeamId: "phi-nfl", homeScore: 31, awayScore: 21, kickoff: "2026-01-26T20:00:00Z", status: "ft", stageLabel: "NFC Championship" },
  { id: "nfl-3", homeTeamId: "kc", awayTeamId: "det", homeScore: 28, awayScore: 25, kickoff: "2026-02-08T23:30:00Z", status: "ft", stageLabel: "Super Bowl LX" },
];

const PLAYOFFS: BracketRound[] = [
  {
    id: "round-of-16",
    label: "Wild Card",
    matches: [
      { id: "nfl-wc-1", homeTeamId: "buf", awayTeamId: "mia-nfl", homeScore: 31, awayScore: 17, winnerTeamId: "buf" },
      { id: "nfl-wc-2", homeTeamId: "bal", awayTeamId: "pit", homeScore: 28, awayScore: 14, winnerTeamId: "bal" },
      { id: "nfl-wc-3", homeTeamId: "hou", awayTeamId: "lac-nfl", homeScore: 24, awayScore: 22, winnerTeamId: "hou" },
      { id: "nfl-wc-4", homeTeamId: "phi-nfl", awayTeamId: "gb", homeScore: 27, awayScore: 20, winnerTeamId: "phi-nfl" },
      { id: "nfl-wc-5", homeTeamId: "tb", awayTeamId: "was", homeScore: 23, awayScore: 20, winnerTeamId: "tb" },
      { id: "nfl-wc-6", homeTeamId: "lar", awayTeamId: "min-nfl", homeScore: 26, awayScore: 21, winnerTeamId: "lar" },
    ],
  },
  {
    id: "quarter-final",
    label: "Divisional",
    matches: [
      { id: "nfl-div-1", homeTeamId: "kc", awayTeamId: "hou", homeScore: 30, awayScore: 17, winnerTeamId: "kc" },
      { id: "nfl-div-2", homeTeamId: "buf", awayTeamId: "bal", homeScore: 27, awayScore: 25, winnerTeamId: "buf" },
      { id: "nfl-div-3", homeTeamId: "det", awayTeamId: "lar", homeScore: 31, awayScore: 14, winnerTeamId: "det" },
      { id: "nfl-div-4", homeTeamId: "phi-nfl", awayTeamId: "tb", homeScore: 24, awayScore: 21, winnerTeamId: "phi-nfl" },
    ],
  },
  {
    id: "semi-final",
    label: "Conference",
    matches: [
      { id: "nfl-cf-1", homeTeamId: "kc", awayTeamId: "buf", homeScore: 27, awayScore: 24, winnerTeamId: "kc" },
      { id: "nfl-cf-2", homeTeamId: "det", awayTeamId: "phi-nfl", homeScore: 31, awayScore: 21, winnerTeamId: "det" },
    ],
  },
  {
    id: "final",
    label: "Super Bowl LX",
    matches: [
      { id: "nfl-sb", homeTeamId: "kc", awayTeamId: "det", homeScore: 28, awayScore: 25, winnerTeamId: "kc", date: "2026-02-08T23:30:00Z" },
    ],
  },
];

export const NFL_DATA: NflData = {
  season: 2025,
  teams: TEAMS,
  games: GAMES,
  standings: STANDINGS,
  playoffs: PLAYOFFS,
};
