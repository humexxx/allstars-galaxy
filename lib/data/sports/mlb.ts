import type { BracketRound, Match, MlbData, MlbStanding, Team } from "@/types/sports";

/** The twelve clubs of the 2026 postseason, six a league. */
const TEAMS: Team[] = [
  // American League
  { id: "tb", name: "Tampa Bay Rays", shortName: "Rays", code: "TB", primaryColor: "#092C5C" },
  { id: "cle", name: "Cleveland Guardians", shortName: "Guardians", code: "CLE", primaryColor: "#002B5C" },
  { id: "hou", name: "Houston Astros", shortName: "Astros", code: "HOU", primaryColor: "#002D62" },
  { id: "nyy", name: "New York Yankees", shortName: "Yankees", code: "NYY", primaryColor: "#132448" },
  { id: "bos", name: "Boston Red Sox", shortName: "Red Sox", code: "BOS", primaryColor: "#0D2B56" },
  { id: "chw", name: "Chicago White Sox", shortName: "White Sox", code: "CHW", primaryColor: "#000000" },
  // National League
  { id: "mil", name: "Milwaukee Brewers", shortName: "Brewers", code: "MIL", primaryColor: "#13294B" },
  { id: "lad", name: "Los Angeles Dodgers", shortName: "Dodgers", code: "LAD", primaryColor: "#005A9C" },
  { id: "atl", name: "Atlanta Braves", shortName: "Braves", code: "ATL", primaryColor: "#0C2340" },
  { id: "sd", name: "San Diego Padres", shortName: "Padres", code: "SD", primaryColor: "#2F241D" },
  { id: "chc", name: "Chicago Cubs", shortName: "Cubs", code: "CHC", primaryColor: "#0E3386" },
  { id: "phi", name: "Philadelphia Phillies", shortName: "Phillies", code: "PHI", primaryColor: "#E81828" },
];

/** Each league by its seed: the division winners first, then the wild cards. */
const STANDINGS: MlbStanding[] = [
  { position: 1, teamId: "tb", league: "al", division: "al-east", wins: 98, losses: 64, pct: 0.605, gamesBehind: 0, streak: "L1" },
  { position: 2, teamId: "cle", league: "al", division: "al-central", wins: 85, losses: 77, pct: 0.525, gamesBehind: 0, streak: "L1" },
  { position: 3, teamId: "hou", league: "al", division: "al-west", wins: 81, losses: 81, pct: 0.5, gamesBehind: 0, streak: "W2" },
  { position: 4, teamId: "nyy", league: "al", division: "al-east", wins: 93, losses: 68, pct: 0.578, gamesBehind: 4.5, streak: "W1" },
  { position: 5, teamId: "bos", league: "al", division: "al-east", wins: 87, losses: 75, pct: 0.537, gamesBehind: 11, streak: "L1" },
  { position: 6, teamId: "chw", league: "al", division: "al-central", wins: 84, losses: 78, pct: 0.519, gamesBehind: 1, streak: "W1" },

  { position: 1, teamId: "mil", league: "nl", division: "nl-central", wins: 103, losses: 59, pct: 0.636, gamesBehind: 0, streak: "W5" },
  { position: 2, teamId: "lad", league: "nl", division: "nl-west", wins: 100, losses: 62, pct: 0.617, gamesBehind: 0, streak: "W3" },
  { position: 3, teamId: "atl", league: "nl", division: "nl-east", wins: 94, losses: 68, pct: 0.58, gamesBehind: 0, streak: "L1" },
  { position: 4, teamId: "sd", league: "nl", division: "nl-west", wins: 91, losses: 71, pct: 0.562, gamesBehind: 9, streak: "W2" },
  { position: 5, teamId: "chc", league: "nl", division: "nl-central", wins: 89, losses: 73, pct: 0.549, gamesBehind: 14, streak: "W1" },
  { position: 6, teamId: "phi", league: "nl", division: "nl-east", wins: 88, losses: 74, pct: 0.543, gamesBehind: 6, streak: "W1" },
];

/**
 * The last League Championship Series games and the World Series, two games
 * in. Nothing is live: this stands in for months, and a game live here would
 * be on the dashboard as live all that time.
 */
const GAMES: Match[] = [
  { id: "mlb-nlcs-3", homeTeamId: "lad", awayTeamId: "mil", homeScore: 2, awayScore: 6, kickoff: "2026-10-15T00:00:00Z", status: "ft", stageLabel: "NLCS · Game 3", broadcasts: ["FS1"] },
  { id: "mlb-nlcs-4", homeTeamId: "lad", awayTeamId: "mil", homeScore: 4, awayScore: 6, kickoff: "2026-10-16T00:00:00Z", status: "ft", stageLabel: "NLCS · Game 4", broadcasts: ["FS1"] },
  { id: "mlb-alcs-4-ppd", homeTeamId: "cle", awayTeamId: "tb", homeScore: null, awayScore: null, kickoff: "2026-10-17T00:00:00Z", status: "postponed", stageLabel: "ALCS · Game 4", broadcasts: ["TBS"] },
  { id: "mlb-alcs-4", homeTeamId: "cle", awayTeamId: "tb", homeScore: 3, awayScore: 7, kickoff: "2026-10-18T00:00:00Z", status: "ft", stageLabel: "ALCS · Game 4", broadcasts: ["TBS"] },
  { id: "mlb-alcs-5", homeTeamId: "cle", awayTeamId: "tb", homeScore: 1, awayScore: 3, kickoff: "2026-10-18T21:00:00Z", status: "ft", stageLabel: "ALCS · Game 5", broadcasts: ["TBS"] },
  { id: "mlb-alcs-6", homeTeamId: "tb", awayTeamId: "cle", homeScore: 7, awayScore: 3, kickoff: "2026-10-20T00:00:00Z", status: "ft", stageLabel: "ALCS · Game 6", broadcasts: ["TBS"] },
  { id: "mlb-ws-1", homeTeamId: "mil", awayTeamId: "tb", homeScore: 3, awayScore: 2, kickoff: "2026-10-24T00:00:00Z", status: "ft", stageLabel: "World Series · Game 1", broadcasts: ["Fox"] },
  {
    id: "mlb-ws-2", homeTeamId: "mil", awayTeamId: "tb", homeScore: 5, awayScore: 4, kickoff: "2026-10-25T00:00:00Z", status: "ft",
    statusText: { short: "F/10", spoken: "Final after 10 innings" }, stageLabel: "World Series · Game 2", broadcasts: ["Fox"],
  },
  { id: "mlb-ws-3", homeTeamId: "tb", awayTeamId: "mil", homeScore: null, awayScore: null, kickoff: "2026-10-27T00:00:00Z", status: "scheduled", stageLabel: "World Series · Game 3", broadcasts: ["Fox"] },
  { id: "mlb-ws-4", homeTeamId: "tb", awayTeamId: "mil", homeScore: null, awayScore: null, kickoff: "2026-10-28T00:00:00Z", status: "scheduled", stageLabel: "World Series · Game 4", broadcasts: ["Fox"] },
  { id: "mlb-ws-5", homeTeamId: "tb", awayTeamId: "mil", homeScore: null, awayScore: null, kickoff: "2026-10-29T00:00:00Z", status: "scheduled", stageLabel: "World Series · Game 5, if necessary", broadcasts: ["Fox"] },
];

/** A tie per series, its score in wins: the AL's half of each round above the NL's, and its champion first in the final. */
const PLAYOFFS: BracketRound[] = [
  {
    id: "round-of-16",
    label: "Wild Card",
    matches: [
      { id: "mlb-round-of-16-0", homeTeamId: "hou", awayTeamId: "chw", homeScore: 0, awayScore: 2, winnerTeamId: "chw", date: "2026-09-30T21:00:00Z", bestOf: 3 },
      { id: "mlb-round-of-16-1", homeTeamId: "nyy", awayTeamId: "bos", homeScore: 2, awayScore: 0, winnerTeamId: "nyy", date: "2026-10-01T00:00:00Z", bestOf: 3 },
      { id: "mlb-round-of-16-2", homeTeamId: "atl", awayTeamId: "phi", homeScore: 2, awayScore: 1, winnerTeamId: "atl", date: "2026-10-02T00:00:00Z", bestOf: 3 },
      { id: "mlb-round-of-16-3", homeTeamId: "sd", awayTeamId: "chc", homeScore: 2, awayScore: 0, winnerTeamId: "sd", date: "2026-10-01T02:00:00Z", bestOf: 3 },
    ],
  },
  {
    id: "quarter-final",
    label: "Division Series",
    matches: [
      { id: "mlb-quarter-final-0", homeTeamId: "cle", awayTeamId: "chw", homeScore: 3, awayScore: 2, winnerTeamId: "cle", date: "2026-10-11T00:00:00Z", bestOf: 5 },
      { id: "mlb-quarter-final-1", homeTeamId: "tb", awayTeamId: "nyy", homeScore: 3, awayScore: 0, winnerTeamId: "tb", date: "2026-10-08T00:00:00Z", bestOf: 5 },
      { id: "mlb-quarter-final-2", homeTeamId: "lad", awayTeamId: "atl", homeScore: 3, awayScore: 1, winnerTeamId: "lad", date: "2026-10-07T22:00:00Z", bestOf: 5 },
      { id: "mlb-quarter-final-3", homeTeamId: "mil", awayTeamId: "sd", homeScore: 3, awayScore: 1, winnerTeamId: "mil", date: "2026-10-08T02:00:00Z", bestOf: 5 },
    ],
  },
  {
    id: "semi-final",
    label: "Championship Series",
    matches: [
      { id: "mlb-semi-final-0", homeTeamId: "tb", awayTeamId: "cle", homeScore: 4, awayScore: 2, winnerTeamId: "tb", date: "2026-10-20T00:00:00Z", bestOf: 7 },
      { id: "mlb-semi-final-1", homeTeamId: "mil", awayTeamId: "lad", homeScore: 4, awayScore: 0, winnerTeamId: "mil", date: "2026-10-16T00:00:00Z", bestOf: 7 },
    ],
  },
  {
    id: "final",
    label: "World Series",
    matches: [
      { id: "mlb-final", homeTeamId: "tb", awayTeamId: "mil", homeScore: 0, awayScore: 2, winnerTeamId: null, date: "2026-10-27T00:00:00Z", bestOf: 7 },
    ],
  },
];

/**
 * A hand-written 2026 postseason, for when ESPN has never answered: the
 * twelve October clubs, their tables, the World Series two games in.
 */
export const MLB_DATA: MlbData = {
  season: 2026,
  teams: TEAMS,
  games: GAMES,
  standings: STANDINGS,
  playoffs: PLAYOFFS,
};
