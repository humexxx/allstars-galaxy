import type {
  BracketRound,
  FootballLeagueData,
  Match,
  Team,
} from "@/types/sports";

// Static fallback for the FIFA World Cup 2026 when football-data.org is
// unreachable. Snapshot of the knockout phase as of early July 2026.

const WC_TEAMS: Team[] = [
  { id: "canada", name: "Canada", shortName: "Canada", code: "CAN" },
  { id: "morocco", name: "Morocco", shortName: "Morocco", code: "MAR" },
  { id: "paraguay", name: "Paraguay", shortName: "Paraguay", code: "PAR" },
  { id: "france", name: "France", shortName: "France", code: "FRA" },
  { id: "brazil", name: "Brazil", shortName: "Brazil", code: "BRA" },
  { id: "norway", name: "Norway", shortName: "Norway", code: "NOR" },
  { id: "mexico", name: "Mexico", shortName: "Mexico", code: "MEX" },
  { id: "england", name: "England", shortName: "England", code: "ENG" },
  { id: "portugal", name: "Portugal", shortName: "Portugal", code: "POR" },
  { id: "spain", name: "Spain", shortName: "Spain", code: "ESP" },
  { id: "united-states", name: "United States", shortName: "United States", code: "USA" },
  { id: "belgium", name: "Belgium", shortName: "Belgium", code: "BEL" },
  { id: "argentina", name: "Argentina", shortName: "Argentina", code: "ARG" },
  { id: "egypt", name: "Egypt", shortName: "Egypt", code: "EGY" },
  { id: "switzerland", name: "Switzerland", shortName: "Switzerland", code: "SUI" },
  { id: "colombia", name: "Colombia", shortName: "Colombia", code: "COL" },
];

const WC_MATCHES: Match[] = [
  { id: "wc-r16-1", homeTeamId: "canada", awayTeamId: "morocco", homeScore: 0, awayScore: 3, kickoff: "2026-07-04T17:00:00Z", status: "ft", stageLabel: "Round of 16" },
  { id: "wc-r16-2", homeTeamId: "paraguay", awayTeamId: "france", homeScore: 0, awayScore: 1, kickoff: "2026-07-04T21:00:00Z", status: "ft", stageLabel: "Round of 16" },
  { id: "wc-r16-3", homeTeamId: "brazil", awayTeamId: "norway", homeScore: null, awayScore: null, kickoff: "2026-07-05T20:00:00Z", status: "scheduled", stageLabel: "Round of 16" },
  { id: "wc-r16-4", homeTeamId: "mexico", awayTeamId: "england", homeScore: null, awayScore: null, kickoff: "2026-07-06T00:00:00Z", status: "scheduled", stageLabel: "Round of 16" },
  { id: "wc-r16-5", homeTeamId: "portugal", awayTeamId: "spain", homeScore: null, awayScore: null, kickoff: "2026-07-06T19:00:00Z", status: "scheduled", stageLabel: "Round of 16" },
  { id: "wc-r16-6", homeTeamId: "united-states", awayTeamId: "belgium", homeScore: null, awayScore: null, kickoff: "2026-07-07T00:00:00Z", status: "scheduled", stageLabel: "Round of 16" },
  { id: "wc-r16-7", homeTeamId: "argentina", awayTeamId: "egypt", homeScore: null, awayScore: null, kickoff: "2026-07-07T16:00:00Z", status: "scheduled", stageLabel: "Round of 16" },
  { id: "wc-r16-8", homeTeamId: "switzerland", awayTeamId: "colombia", homeScore: null, awayScore: null, kickoff: "2026-07-07T20:00:00Z", status: "scheduled", stageLabel: "Round of 16" },
];

const WC_KNOCKOUT: BracketRound[] = [
  {
    id: "round-of-16",
    label: "Round of 16",
    matches: [
      { id: "wc-r16-1", homeTeamId: "canada", awayTeamId: "morocco", homeScore: 0, awayScore: 3, winnerTeamId: "morocco", date: "2026-07-04T17:00:00Z" },
      { id: "wc-r16-2", homeTeamId: "paraguay", awayTeamId: "france", homeScore: 0, awayScore: 1, winnerTeamId: "france", date: "2026-07-04T21:00:00Z" },
      { id: "wc-r16-3", homeTeamId: "brazil", awayTeamId: "norway", homeScore: null, awayScore: null, winnerTeamId: null, date: "2026-07-05T20:00:00Z" },
      { id: "wc-r16-4", homeTeamId: "mexico", awayTeamId: "england", homeScore: null, awayScore: null, winnerTeamId: null, date: "2026-07-06T00:00:00Z" },
      { id: "wc-r16-5", homeTeamId: "portugal", awayTeamId: "spain", homeScore: null, awayScore: null, winnerTeamId: null, date: "2026-07-06T19:00:00Z" },
      { id: "wc-r16-6", homeTeamId: "united-states", awayTeamId: "belgium", homeScore: null, awayScore: null, winnerTeamId: null, date: "2026-07-07T00:00:00Z" },
      { id: "wc-r16-7", homeTeamId: "argentina", awayTeamId: "egypt", homeScore: null, awayScore: null, winnerTeamId: null, date: "2026-07-07T16:00:00Z" },
      { id: "wc-r16-8", homeTeamId: "switzerland", awayTeamId: "colombia", homeScore: null, awayScore: null, winnerTeamId: null, date: "2026-07-07T20:00:00Z" },
    ],
  },
  {
    id: "quarter-final",
    label: "Quarterfinals",
    matches: [
      { id: "wc-qf-1", homeTeamId: "france", awayTeamId: "morocco", homeScore: null, awayScore: null, winnerTeamId: null, date: "2026-07-09T20:00:00Z" },
      { id: "wc-qf-2", homeTeamId: null, awayTeamId: null, homeScore: null, awayScore: null, winnerTeamId: null, date: "2026-07-10T19:00:00Z" },
      { id: "wc-qf-3", homeTeamId: null, awayTeamId: null, homeScore: null, awayScore: null, winnerTeamId: null, date: "2026-07-11T21:00:00Z" },
      { id: "wc-qf-4", homeTeamId: null, awayTeamId: null, homeScore: null, awayScore: null, winnerTeamId: null, date: "2026-07-12T01:00:00Z" },
    ],
  },
  {
    id: "semi-final",
    label: "Semifinals",
    matches: [
      { id: "wc-sf-1", homeTeamId: null, awayTeamId: null, homeScore: null, awayScore: null, winnerTeamId: null, date: "2026-07-14T20:00:00Z" },
      { id: "wc-sf-2", homeTeamId: null, awayTeamId: null, homeScore: null, awayScore: null, winnerTeamId: null, date: "2026-07-15T20:00:00Z" },
    ],
  },
  {
    id: "final",
    label: "Final",
    matches: [
      { id: "wc-f-1", homeTeamId: null, awayTeamId: null, homeScore: null, awayScore: null, winnerTeamId: null, date: "2026-07-19T19:00:00Z" },
    ],
  },
];

export const WORLD_CUP_DATA: FootballLeagueData = {
  league: {
    id: "world-cup",
    name: "FIFA World Cup 2026",
    shortName: "World Cup",
    region: "FIFA",
    hasKnockout: true,
    season: "2026",
  },
  teams: WC_TEAMS,
  matches: WC_MATCHES,
  standings: [],
  knockout: WC_KNOCKOUT,
};
