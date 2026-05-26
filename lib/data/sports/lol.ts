import type { BracketRound, LolData, LolMatch, LolSplit, LolStanding, Team } from "@/types/sports";

const LEC_TEAMS: Team[] = [
  { id: "g2", name: "G2 Esports", shortName: "G2", code: "G2", primaryColor: "#FF1654" },
  { id: "fnc", name: "Fnatic", shortName: "Fnatic", code: "FNC", primaryColor: "#FF5800" },
  { id: "mad", name: "MAD Lions KOI", shortName: "MAD", code: "MAD", primaryColor: "#020A1A" },
  { id: "th", name: "Team Heretics", shortName: "Heretics", code: "TH", primaryColor: "#001A33" },
  { id: "vit", name: "Team Vitality", shortName: "Vitality", code: "VIT", primaryColor: "#FFE100" },
  { id: "rge", name: "Rogue", shortName: "Rogue", code: "RGE", primaryColor: "#003D7C" },
  { id: "sk", name: "SK Gaming", shortName: "SK", code: "SK", primaryColor: "#FF6600" },
  { id: "kc", name: "Karmine Corp", shortName: "Karmine", code: "KC", primaryColor: "#02ABE7" },
];

const LCK_TEAMS: Team[] = [
  { id: "t1", name: "T1", shortName: "T1", code: "T1", primaryColor: "#E2012D" },
  { id: "gen", name: "Gen.G", shortName: "Gen.G", code: "GEN", primaryColor: "#AA8A00" },
  { id: "hle", name: "Hanwha Life Esports", shortName: "Hanwha", code: "HLE", primaryColor: "#F5A201" },
  { id: "dk", name: "Dplus KIA", shortName: "Dplus KIA", code: "DK", primaryColor: "#1B1B1B" },
  { id: "kt", name: "kt Rolster", shortName: "kt", code: "KT", primaryColor: "#FF0000" },
  { id: "dn", name: "DN Freecs", shortName: "DN", code: "DN", primaryColor: "#152F4A" },
];

const LEC_STANDINGS: LolStanding[] = [
  { position: 1, teamId: "g2", wins: 14, losses: 4, form: ["W", "W", "W", "L", "W"] },
  { position: 2, teamId: "fnc", wins: 13, losses: 5, form: ["W", "W", "L", "W", "W"] },
  { position: 3, teamId: "kc", wins: 11, losses: 7, form: ["L", "W", "W", "L", "W"] },
  { position: 4, teamId: "mad", wins: 10, losses: 8, form: ["W", "L", "W", "W", "L"] },
  { position: 5, teamId: "th", wins: 9, losses: 9, form: ["L", "W", "L", "W", "W"] },
  { position: 6, teamId: "vit", wins: 8, losses: 10, form: ["L", "L", "W", "L", "W"] },
  { position: 7, teamId: "rge", wins: 5, losses: 13, form: ["L", "L", "L", "W", "L"] },
  { position: 8, teamId: "sk", wins: 2, losses: 16, form: ["L", "L", "L", "L", "L"] },
];

const LCK_STANDINGS: LolStanding[] = [
  { position: 1, teamId: "t1", wins: 16, losses: 2, form: ["W", "W", "W", "W", "W"] },
  { position: 2, teamId: "gen", wins: 14, losses: 4, form: ["W", "L", "W", "W", "W"] },
  { position: 3, teamId: "hle", wins: 11, losses: 7, form: ["W", "L", "W", "L", "W"] },
  { position: 4, teamId: "dk", wins: 9, losses: 9, form: ["L", "W", "W", "L", "W"] },
  { position: 5, teamId: "kt", wins: 7, losses: 11, form: ["L", "W", "L", "L", "W"] },
  { position: 6, teamId: "dn", wins: 3, losses: 15, form: ["L", "L", "L", "L", "L"] },
];

const LEC_MATCHES: LolMatch[] = [
  { id: "lec-1", homeTeamId: "g2", awayTeamId: "fnc", homeScore: 1, awayScore: 0, bestOf: 1, date: "2026-05-17T17:00:00Z", status: "ft", stageLabel: "Regular Season · Week 9" },
  { id: "lec-2", homeTeamId: "mad", awayTeamId: "kc", homeScore: 0, awayScore: 1, bestOf: 1, date: "2026-05-17T18:00:00Z", status: "ft", stageLabel: "Regular Season · Week 9" },
  { id: "lec-3", homeTeamId: "th", awayTeamId: "vit", homeScore: 1, awayScore: 0, bestOf: 1, date: "2026-05-17T19:00:00Z", status: "ft", stageLabel: "Regular Season · Week 9" },
  { id: "lec-4", homeTeamId: "rge", awayTeamId: "sk", homeScore: 1, awayScore: 0, bestOf: 1, date: "2026-05-17T20:00:00Z", status: "ft", stageLabel: "Regular Season · Week 9" },
  { id: "lec-5", homeTeamId: "g2", awayTeamId: "kc", homeScore: null, awayScore: null, bestOf: 5, date: "2026-05-30T18:00:00Z", status: "scheduled", stageLabel: "Playoffs · Semifinal" },
];

const LEC_PLAYOFFS: BracketRound[] = [
  {
    id: "quarter-final",
    label: "Quarterfinals",
    matches: [
      { id: "lec-pl-1", homeTeamId: "fnc", awayTeamId: "mad", homeScore: 3, awayScore: 1, winnerTeamId: "fnc" },
      { id: "lec-pl-2", homeTeamId: "kc", awayTeamId: "th", homeScore: 3, awayScore: 2, winnerTeamId: "kc" },
    ],
  },
  {
    id: "semi-final",
    label: "Semifinals",
    matches: [
      { id: "lec-pl-3", homeTeamId: "g2", awayTeamId: "kc", homeScore: null, awayScore: null, date: "2026-05-30T18:00:00Z" },
      { id: "lec-pl-4", homeTeamId: "fnc", awayTeamId: null, homeScore: null, awayScore: null },
    ],
  },
  {
    id: "final",
    label: "Final",
    matches: [
      { id: "lec-pl-5", homeTeamId: null, awayTeamId: null, homeScore: null, awayScore: null, date: "2026-06-07T18:00:00Z" },
    ],
  },
];

const LCK_MATCHES: LolMatch[] = [
  { id: "lck-1", homeTeamId: "t1", awayTeamId: "gen", homeScore: 2, awayScore: 1, bestOf: 3, date: "2026-05-16T10:00:00Z", status: "ft", stageLabel: "Regular Season · Week 9" },
  { id: "lck-2", homeTeamId: "hle", awayTeamId: "dk", homeScore: 2, awayScore: 0, bestOf: 3, date: "2026-05-16T13:00:00Z", status: "ft", stageLabel: "Regular Season · Week 9" },
  { id: "lck-3", homeTeamId: "kt", awayTeamId: "dn", homeScore: 2, awayScore: 0, bestOf: 3, date: "2026-05-17T10:00:00Z", status: "ft", stageLabel: "Regular Season · Week 9" },
];

const LCK_PLAYOFFS: BracketRound[] = [
  {
    id: "semi-final",
    label: "Semifinals",
    matches: [
      { id: "lck-pl-1", homeTeamId: "t1", awayTeamId: "hle", homeScore: 3, awayScore: 1, winnerTeamId: "t1" },
      { id: "lck-pl-2", homeTeamId: "gen", awayTeamId: "dk", homeScore: 3, awayScore: 0, winnerTeamId: "gen" },
    ],
  },
  {
    id: "final",
    label: "Final",
    matches: [
      { id: "lck-pl-3", homeTeamId: "t1", awayTeamId: "gen", homeScore: null, awayScore: null, date: "2026-06-01T10:00:00Z" },
    ],
  },
];

const SPLITS: LolSplit[] = [
  {
    region: "lec",
    name: "LEC Summer Split",
    season: "2026",
    teams: LEC_TEAMS,
    standings: LEC_STANDINGS,
    matches: LEC_MATCHES,
    playoffs: LEC_PLAYOFFS,
  },
  {
    region: "lck",
    name: "LCK Spring",
    season: "2026",
    teams: LCK_TEAMS,
    standings: LCK_STANDINGS,
    matches: LCK_MATCHES,
    playoffs: LCK_PLAYOFFS,
  },
];

export const LOL_DATA: LolData = {
  splits: SPLITS,
};
