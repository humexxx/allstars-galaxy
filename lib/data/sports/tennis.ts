import type { PlayerRanking, RacquetTournament, TennisData } from "@/types/sports";

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

const WTA_RANKINGS: PlayerRanking[] = [
  { position: 1, name: "Iga Świątek", shortName: "I. Świątek", countryCode: "POL", flagEmoji: "🇵🇱", points: 10870, movement: 0 },
  { position: 2, name: "Aryna Sabalenka", shortName: "A. Sabalenka", countryCode: "BLR", flagEmoji: "🇧🇾", points: 9580, movement: 0 },
  { position: 3, name: "Coco Gauff", shortName: "C. Gauff", countryCode: "USA", flagEmoji: "🇺🇸", points: 7720, movement: 0 },
  { position: 4, name: "Elena Rybakina", shortName: "E. Rybakina", countryCode: "KAZ", flagEmoji: "🇰🇿", points: 6240, movement: 0 },
  { position: 5, name: "Jessica Pegula", shortName: "J. Pegula", countryCode: "USA", flagEmoji: "🇺🇸", points: 5310, movement: 1 },
  { position: 6, name: "Jasmine Paolini", shortName: "J. Paolini", countryCode: "ITA", flagEmoji: "🇮🇹", points: 4980, movement: 2 },
  { position: 7, name: "Qinwen Zheng", shortName: "Q. Zheng", countryCode: "CHN", flagEmoji: "🇨🇳", points: 4520, movement: -1 },
  { position: 8, name: "Emma Navarro", shortName: "E. Navarro", countryCode: "USA", flagEmoji: "🇺🇸", points: 3870, movement: 0 },
  { position: 9, name: "Daria Kasatkina", shortName: "D. Kasatkina", countryCode: "RUS", flagEmoji: "🇷🇺", points: 3210, movement: -2 },
  { position: 10, name: "Barbora Krejčíková", shortName: "B. Krejčíková", countryCode: "CZE", flagEmoji: "🇨🇿", points: 3050, movement: 0 },
];

const ATP_TOURNAMENTS: RacquetTournament[] = [
  { id: "atp-ao", name: "Australian Open", surface: "Hard", location: "Melbourne", startDate: "2026-01-19", endDate: "2026-02-01", status: "completed", champion: "J. Sinner", runnerUp: "A. Zverev" },
  { id: "atp-iw", name: "Indian Wells", surface: "Hard", location: "Indian Wells", startDate: "2026-03-09", endDate: "2026-03-22", status: "completed", champion: "C. Alcaraz", runnerUp: "D. Medvedev" },
  { id: "atp-miami", name: "Miami Open", surface: "Hard", location: "Miami", startDate: "2026-03-23", endDate: "2026-04-05", status: "completed", champion: "J. Sinner", runnerUp: "T. Fritz" },
  { id: "atp-mc", name: "Monte-Carlo Masters", surface: "Clay", location: "Monaco", startDate: "2026-04-12", endDate: "2026-04-19", status: "completed", champion: "C. Alcaraz", runnerUp: "C. Ruud" },
  { id: "atp-rome", name: "Italian Open", surface: "Clay", location: "Rome", startDate: "2026-05-08", endDate: "2026-05-18", status: "completed", champion: "J. Sinner", runnerUp: "C. Alcaraz" },
  { id: "atp-rg", name: "Roland Garros", surface: "Clay", location: "Paris", startDate: "2026-05-25", endDate: "2026-06-07", status: "live" },
  { id: "atp-wim", name: "Wimbledon", surface: "Grass", location: "London", startDate: "2026-06-29", endDate: "2026-07-12", status: "upcoming" },
];

const WTA_TOURNAMENTS: RacquetTournament[] = [
  { id: "wta-ao", name: "Australian Open", surface: "Hard", location: "Melbourne", startDate: "2026-01-19", endDate: "2026-02-01", status: "completed", champion: "A. Sabalenka", runnerUp: "Q. Zheng" },
  { id: "wta-iw", name: "Indian Wells", surface: "Hard", location: "Indian Wells", startDate: "2026-03-09", endDate: "2026-03-22", status: "completed", champion: "I. Świątek", runnerUp: "C. Gauff" },
  { id: "wta-miami", name: "Miami Open", surface: "Hard", location: "Miami", startDate: "2026-03-23", endDate: "2026-04-05", status: "completed", champion: "A. Sabalenka", runnerUp: "J. Paolini" },
  { id: "wta-madrid", name: "Madrid Open", surface: "Clay", location: "Madrid", startDate: "2026-04-25", endDate: "2026-05-04", status: "completed", champion: "I. Świątek", runnerUp: "A. Sabalenka" },
  { id: "wta-rome", name: "Italian Open", surface: "Clay", location: "Rome", startDate: "2026-05-08", endDate: "2026-05-18", status: "completed", champion: "I. Świątek", runnerUp: "C. Gauff" },
  { id: "wta-rg", name: "Roland Garros", surface: "Clay", location: "Paris", startDate: "2026-05-25", endDate: "2026-06-07", status: "live" },
  { id: "wta-wim", name: "Wimbledon", surface: "Grass", location: "London", startDate: "2026-06-29", endDate: "2026-07-12", status: "upcoming" },
];

export const TENNIS_DATA: TennisData = {
  atp: {
    tour: "atp",
    season: 2026,
    rankings: ATP_RANKINGS,
    tournaments: ATP_TOURNAMENTS,
  },
  wta: {
    tour: "wta",
    season: 2026,
    rankings: WTA_RANKINGS,
    tournaments: WTA_TOURNAMENTS,
  },
};
