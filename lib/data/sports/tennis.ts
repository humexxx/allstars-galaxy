import type {
  PlayerRanking,
  RacquetCalendarEntry,
  RacquetTournament,
  TennisData,
} from "@/types/sports";

const ATP_RANKINGS: PlayerRanking[] = [
  { position: 1, name: "Jannik Sinner", shortName: "J. Sinner", countryCode: "ITA", flagEmoji: "🇮🇹", points: 11830, movement: 0 },
  { position: 2, name: "Carlos Alcaraz", shortName: "C. Alcaraz", countryCode: "ESP", flagEmoji: "🇪🇸", points: 10250, movement: 0 },
  { position: 3, name: "Alexander Zverev", shortName: "A. Zverev", countryCode: "GER", flagEmoji: "🇩🇪", points: 7920, movement: 0 },
  { position: 4, name: "Daniil Medvedev", shortName: "D. Medvedev", countryCode: "RUS", flagEmoji: "🇷🇺", points: 6210, movement: 1 },
  { position: 5, name: "Taylor Fritz", shortName: "T. Fritz", countryCode: "USA", flagEmoji: "🇺🇸", points: 5390, movement: -1 },
  { position: 6, name: "Casper Ruud", shortName: "C. Ruud", countryCode: "NOR", flagEmoji: "🇳🇴", points: 4720, movement: 0 },
  { position: 7, name: "Holger Rune", shortName: "H. Rune", countryCode: "DEN", flagEmoji: "🇩🇰", points: 4180, movement: 2 },
  { position: 8, name: "Andrey Rublev", shortName: "A. Rublev", countryCode: "RUS", flagEmoji: "🇷🇺", points: 3950, movement: -1 },
  { position: 9, name: "Hubert Hurkacz", shortName: "H. Hurkacz", countryCode: "POL", flagEmoji: "🇵🇱", points: 3640, movement: 0 },
  { position: 10, name: "Stefanos Tsitsipas", shortName: "S. Tsitsipas", countryCode: "GRE", flagEmoji: "🇬🇷", points: 3320, movement: -1 },
];

const ATP_TOURNAMENTS: RacquetTournament[] = [
  { id: "atp-ao", name: "Australian Open", tier: "Grand Slam", surface: "Hard", location: "Melbourne", startDate: "2026-01-19", endDate: "2026-02-01", status: "completed", champion: "J. Sinner", runnerUp: "A. Zverev" },
  { id: "atp-iw", name: "Indian Wells", surface: "Hard", location: "Indian Wells", startDate: "2026-03-09", endDate: "2026-03-22", status: "completed", champion: "C. Alcaraz", runnerUp: "D. Medvedev" },
  { id: "atp-miami", name: "Miami Open", surface: "Hard", location: "Miami", startDate: "2026-03-23", endDate: "2026-04-05", status: "completed", champion: "J. Sinner", runnerUp: "T. Fritz" },
  { id: "atp-mc", name: "Monte-Carlo Masters", surface: "Clay", location: "Monaco", startDate: "2026-04-12", endDate: "2026-04-19", status: "completed", champion: "C. Alcaraz", runnerUp: "C. Ruud" },
  { id: "atp-rome", name: "Italian Open", surface: "Clay", location: "Rome", startDate: "2026-05-08", endDate: "2026-05-18", status: "completed", champion: "J. Sinner", runnerUp: "C. Alcaraz" },
  { id: "atp-rg", name: "Roland Garros", tier: "Grand Slam", surface: "Clay", location: "Paris", venue: "Stade Roland Garros, Paris", defendingChampion: "C. Alcaraz", startDate: "2026-05-25", endDate: "2026-06-07", status: "live" },
  { id: "atp-wim", name: "Wimbledon", tier: "Grand Slam", surface: "Grass", location: "London", defendingChampion: "J. Sinner", startDate: "2026-06-29", endDate: "2026-07-12", status: "upcoming" },
];

/** The season's lines, as the live feed lists them beside its tournaments. */
function calendarOf(tournaments: RacquetTournament[]): RacquetCalendarEntry[] {
  return tournaments.map(({ id, name, startDate, endDate, status, champion }) => ({
    id,
    name,
    startDate,
    endDate,
    status,
    champion,
  }));
}

export const TENNIS_DATA: TennisData = {
  atp: {
    tour: "atp",
    season: 2026,
    rankings: ATP_RANKINGS,
    tournaments: ATP_TOURNAMENTS,
    calendar: calendarOf(ATP_TOURNAMENTS),
  },
};
