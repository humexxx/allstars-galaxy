import type { BracketRound, Match, NhlData, NhlStanding, Team } from "@/types/sports";

/** Twelve clubs, six a conference: last season's four conference finalists among them. */
const TEAMS: Team[] = [
  // Eastern Conference
  { id: "car", name: "Carolina Hurricanes", shortName: "Hurricanes", code: "CAR", primaryColor: "#E30426" },
  { id: "bos", name: "Boston Bruins", shortName: "Bruins", code: "BOS", primaryColor: "#231F20" },
  { id: "ott", name: "Ottawa Senators", shortName: "Senators", code: "OTT", primaryColor: "#DD1A32" },
  { id: "tor", name: "Toronto Maple Leafs", shortName: "Maple Leafs", code: "TOR", primaryColor: "#003E7E" },
  { id: "tb", name: "Tampa Bay Lightning", shortName: "Lightning", code: "TB", primaryColor: "#003E7E" },
  { id: "mtl", name: "Montreal Canadiens", shortName: "Canadiens", code: "MTL", primaryColor: "#C41230" },
  // Western Conference
  { id: "edm", name: "Edmonton Oilers", shortName: "Oilers", code: "EDM", primaryColor: "#00205B" },
  { id: "vgk", name: "Vegas Golden Knights", shortName: "Golden Knights", code: "VGK", primaryColor: "#344043" },
  { id: "uta", name: "Utah Mammoth", shortName: "Mammoth", code: "UTA", primaryColor: "#000000" },
  { id: "min", name: "Minnesota Wild", shortName: "Wild", code: "MIN", primaryColor: "#124734" },
  { id: "dal", name: "Dallas Stars", shortName: "Stars", code: "DAL", primaryColor: "#20864C" },
  { id: "col", name: "Colorado Avalanche", shortName: "Avalanche", code: "COL", primaryColor: "#860038" },
];

/** Each conference by points, as ESPN's table stood on Oct 25. */
const STANDINGS: NhlStanding[] = [
  { position: 1, teamId: "car", conference: "east", division: "metropolitan", gamesPlayed: 13, wins: 9, losses: 2, otLosses: 2, points: 20, goalsFor: 51, goalsAgainst: 33, streak: "W1" },
  { position: 2, teamId: "bos", conference: "east", division: "atlantic", gamesPlayed: 12, wins: 9, losses: 2, otLosses: 1, points: 19, goalsFor: 48, goalsAgainst: 26, streak: "W2" },
  { position: 3, teamId: "ott", conference: "east", division: "atlantic", gamesPlayed: 12, wins: 8, losses: 4, otLosses: 0, points: 16, goalsFor: 38, goalsAgainst: 34, streak: "W1" },
  { position: 4, teamId: "tor", conference: "east", division: "atlantic", gamesPlayed: 13, wins: 7, losses: 4, otLosses: 2, points: 16, goalsFor: 50, goalsAgainst: 41, streak: "W4" },
  { position: 5, teamId: "tb", conference: "east", division: "atlantic", gamesPlayed: 11, wins: 7, losses: 3, otLosses: 1, points: 15, goalsFor: 38, goalsAgainst: 34, streak: "L2" },
  { position: 6, teamId: "mtl", conference: "east", division: "atlantic", gamesPlayed: 10, wins: 5, losses: 3, otLosses: 2, points: 12, goalsFor: 34, goalsAgainst: 35, streak: "W1" },

  { position: 1, teamId: "edm", conference: "west", division: "pacific", gamesPlayed: 11, wins: 8, losses: 2, otLosses: 1, points: 17, goalsFor: 49, goalsAgainst: 39, streak: "L1" },
  { position: 2, teamId: "vgk", conference: "west", division: "pacific", gamesPlayed: 13, wins: 8, losses: 4, otLosses: 1, points: 17, goalsFor: 47, goalsAgainst: 38, streak: "L3" },
  { position: 3, teamId: "uta", conference: "west", division: "central", gamesPlayed: 12, wins: 8, losses: 4, otLosses: 0, points: 16, goalsFor: 46, goalsAgainst: 40, streak: "W1" },
  { position: 4, teamId: "min", conference: "west", division: "central", gamesPlayed: 12, wins: 7, losses: 3, otLosses: 2, points: 16, goalsFor: 37, goalsAgainst: 28, streak: "W1" },
  { position: 5, teamId: "dal", conference: "west", division: "central", gamesPlayed: 10, wins: 6, losses: 3, otLosses: 1, points: 13, goalsFor: 26, goalsAgainst: 17, streak: "W4" },
  { position: 6, teamId: "col", conference: "west", division: "central", gamesPlayed: 11, wins: 6, losses: 4, otLosses: 1, points: 13, goalsFor: 47, goalsAgainst: 34, streak: "W1" },
];

/** The week before Oct 25 between these clubs, one game under way that evening, and the week after. */
const GAMES: Match[] = [
  {
    id: "nhl-401892545", homeTeamId: "dal", awayTeamId: "bos", homeScore: 3, awayScore: 2, kickoff: "2026-10-21T00:00:00Z", status: "ft",
    statusText: { short: "OT", spoken: "Final after overtime" }, broadcasts: ["ESPN"],
  },
  {
    id: "nhl-401892546", homeTeamId: "edm", awayTeamId: "min", homeScore: 4, awayScore: 3, kickoff: "2026-10-21T01:00:00Z", status: "ft",
    statusText: { short: "OT", spoken: "Final after overtime" },
  },
  { id: "nhl-401892549", homeTeamId: "vgk", awayTeamId: "tb", homeScore: 2, awayScore: 6, kickoff: "2026-10-21T02:45:00Z", status: "ft", broadcasts: ["ESPN"] },
  {
    id: "nhl-401892561", homeTeamId: "edm", awayTeamId: "car", homeScore: 6, awayScore: 5, kickoff: "2026-10-23T01:00:00Z", status: "ft",
    statusText: { short: "SO", spoken: "Final after a shootout" },
  },
  { id: "nhl-401892565", homeTeamId: "col", awayTeamId: "tb", homeScore: 6, awayScore: 3, kickoff: "2026-10-24T01:00:00Z", status: "ft" },
  { id: "nhl-401892574", homeTeamId: "edm", awayTeamId: "tor", homeScore: 2, awayScore: 7, kickoff: "2026-10-24T23:00:00Z", status: "ft" },
  {
    id: "nhl-401892575", homeTeamId: "uta", awayTeamId: "tb", homeScore: 5, awayScore: 4, kickoff: "2026-10-25T01:00:00Z", status: "ft",
    statusText: { short: "OT", spoken: "Final after overtime" },
  },
  {
    id: "nhl-live", homeTeamId: "dal", awayTeamId: "ott", homeScore: 2, awayScore: 1, kickoff: "2026-10-25T22:00:00Z", status: "live",
    statusText: { short: "P2 12:34", spoken: "Second period, 12:34 left" }, broadcasts: ["TNT", "truTV"],
  },
  { id: "nhl-401892586", homeTeamId: "car", awayTeamId: "bos", homeScore: null, awayScore: null, kickoff: "2026-10-28T00:00:00Z", status: "scheduled", broadcasts: ["ESPN"] },
  { id: "nhl-401892592", homeTeamId: "uta", awayTeamId: "min", homeScore: null, awayScore: null, kickoff: "2026-10-28T01:00:00Z", status: "scheduled" },
  { id: "nhl-401892593", homeTeamId: "vgk", awayTeamId: "ott", homeScore: null, awayScore: null, kickoff: "2026-10-28T02:00:00Z", status: "scheduled" },
  { id: "nhl-401892606", homeTeamId: "dal", awayTeamId: "mtl", homeScore: null, awayScore: null, kickoff: "2026-10-30T00:00:00Z", status: "scheduled" },
];

/** The last two rounds of the 2026 playoffs: each conference's final, then Carolina's Cup. */
const PLAYOFFS: BracketRound[] = [
  {
    id: "semi-final",
    label: "Conference Final",
    matches: [
      { id: "nhl-semi-final-0", homeTeamId: "car", awayTeamId: "mtl", homeScore: 4, awayScore: 1, winnerTeamId: "car", date: "2026-05-30T00:00:00Z", bestOf: 7 },
      { id: "nhl-semi-final-1", homeTeamId: "col", awayTeamId: "vgk", homeScore: 0, awayScore: 4, winnerTeamId: "vgk", date: "2026-05-27T01:00:00Z", bestOf: 7 },
    ],
  },
  {
    id: "final",
    label: "Stanley Cup Final",
    matches: [
      { id: "nhl-final", homeTeamId: "car", awayTeamId: "vgk", homeScore: 4, awayScore: 2, winnerTeamId: "car", date: "2026-06-15T00:00:00Z", bestOf: 7 },
    ],
  },
];

/**
 * A hand-written start to the 2026–27 season, for when ESPN has never
 * answered: twelve clubs, both conferences' tables, a week of games either
 * side of Oct 25 and last spring's bracket.
 */
export const NHL_DATA: NhlData = {
  season: 2026,
  teams: TEAMS,
  games: GAMES,
  standings: STANDINGS,
  playoffs: PLAYOFFS,
};
