import type { PadelData, PlayerRanking, RacquetTournament } from "@/types/sports";

const MEN_RANKINGS: PlayerRanking[] = [
  { position: 1, name: "Arturo Coello", shortName: "A. Coello", countryCode: "ESP", flagEmoji: "🇪🇸", points: 11250, movement: 0 },
  { position: 2, name: "Agustín Tapia", shortName: "A. Tapia", countryCode: "ARG", flagEmoji: "🇦🇷", points: 10980, movement: 0 },
  { position: 3, name: "Alejandro Galán", shortName: "A. Galán", countryCode: "ESP", flagEmoji: "🇪🇸", points: 9420, movement: 1 },
  { position: 4, name: "Federico Chingotto", shortName: "F. Chingotto", countryCode: "ARG", flagEmoji: "🇦🇷", points: 9180, movement: -1 },
  { position: 5, name: "Paquito Navarro", shortName: "P. Navarro", countryCode: "ESP", flagEmoji: "🇪🇸", points: 7860, movement: 0 },
  { position: 6, name: "Juan Lebrón", shortName: "J. Lebrón", countryCode: "ESP", flagEmoji: "🇪🇸", points: 7290, movement: 2 },
  { position: 7, name: "Martín Di Nenno", shortName: "M. Di Nenno", countryCode: "ARG", flagEmoji: "🇦🇷", points: 6740, movement: -1 },
  { position: 8, name: "Franco Stupaczuk", shortName: "F. Stupaczuk", countryCode: "ARG", flagEmoji: "🇦🇷", points: 6310, movement: -1 },
  { position: 9, name: "Mike Yanguas", shortName: "M. Yanguas", countryCode: "ESP", flagEmoji: "🇪🇸", points: 5680, movement: 0 },
  { position: 10, name: "Pablo Lima", shortName: "P. Lima", countryCode: "BRA", flagEmoji: "🇧🇷", points: 5120, movement: 0 },
];

const WOMEN_RANKINGS: PlayerRanking[] = [
  { position: 1, name: "Gemma Triay", shortName: "G. Triay", countryCode: "ESP", flagEmoji: "🇪🇸", points: 10760, movement: 0 },
  { position: 2, name: "Delfina Brea", shortName: "D. Brea", countryCode: "ARG", flagEmoji: "🇦🇷", points: 10620, movement: 0 },
  { position: 3, name: "Bea González", shortName: "B. González", countryCode: "ESP", flagEmoji: "🇪🇸", points: 9180, movement: 1 },
  { position: 4, name: "Claudia Fernández", shortName: "C. Fernández", countryCode: "ESP", flagEmoji: "🇪🇸", points: 8940, movement: 1 },
  { position: 5, name: "Ariana Sánchez", shortName: "A. Sánchez", countryCode: "ESP", flagEmoji: "🇪🇸", points: 8410, movement: -2 },
  { position: 6, name: "Paula Josemaría", shortName: "P. Josemaría", countryCode: "ESP", flagEmoji: "🇪🇸", points: 7890, movement: 0 },
  { position: 7, name: "Tamara Icardo", shortName: "T. Icardo", countryCode: "ESP", flagEmoji: "🇪🇸", points: 6720, movement: 0 },
  { position: 8, name: "Marta Ortega", shortName: "M. Ortega", countryCode: "ESP", flagEmoji: "🇪🇸", points: 5980, movement: 1 },
  { position: 9, name: "Alejandra Salazar", shortName: "A. Salazar", countryCode: "ESP", flagEmoji: "🇪🇸", points: 5640, movement: -1 },
  { position: 10, name: "Jessica Castelló", shortName: "J. Castelló", countryCode: "ESP", flagEmoji: "🇪🇸", points: 5020, movement: 0 },
];

const MEN_TOURNAMENTS: RacquetTournament[] = [
  { id: "wpt-m-doha", name: "Qatar Major", location: "Doha", startDate: "2026-02-23", endDate: "2026-03-01", status: "completed", champion: "Coello / Tapia", runnerUp: "Galán / Chingotto" },
  { id: "wpt-m-riyadh", name: "Riyadh P1", location: "Riyadh", startDate: "2026-03-16", endDate: "2026-03-22", status: "completed", champion: "Galán / Chingotto", runnerUp: "Coello / Tapia" },
  { id: "wpt-m-buenosaires", name: "Buenos Aires P1", location: "Buenos Aires", startDate: "2026-04-06", endDate: "2026-04-12", status: "completed", champion: "Coello / Tapia", runnerUp: "Lebrón / Di Nenno" },
  { id: "wpt-m-madrid", name: "Madrid Master", location: "Madrid", startDate: "2026-05-04", endDate: "2026-05-10", status: "completed", champion: "Coello / Tapia", runnerUp: "Galán / Chingotto" },
  { id: "wpt-m-rome", name: "Rome P1", location: "Rome", startDate: "2026-05-18", endDate: "2026-05-24", status: "live" },
  { id: "wpt-m-paris", name: "Paris Major", location: "Paris", startDate: "2026-06-08", endDate: "2026-06-14", status: "upcoming" },
];

const WOMEN_TOURNAMENTS: RacquetTournament[] = [
  { id: "wpt-w-doha", name: "Qatar Major", location: "Doha", startDate: "2026-02-23", endDate: "2026-03-01", status: "completed", champion: "Triay / Brea", runnerUp: "González / Fernández" },
  { id: "wpt-w-riyadh", name: "Riyadh P1", location: "Riyadh", startDate: "2026-03-16", endDate: "2026-03-22", status: "completed", champion: "Triay / Brea", runnerUp: "Sánchez / Josemaría" },
  { id: "wpt-w-buenosaires", name: "Buenos Aires P1", location: "Buenos Aires", startDate: "2026-04-06", endDate: "2026-04-12", status: "completed", champion: "González / Fernández", runnerUp: "Triay / Brea" },
  { id: "wpt-w-madrid", name: "Madrid Master", location: "Madrid", startDate: "2026-05-04", endDate: "2026-05-10", status: "completed", champion: "Triay / Brea", runnerUp: "González / Fernández" },
  { id: "wpt-w-rome", name: "Rome P1", location: "Rome", startDate: "2026-05-18", endDate: "2026-05-24", status: "live" },
  { id: "wpt-w-paris", name: "Paris Major", location: "Paris", startDate: "2026-06-08", endDate: "2026-06-14", status: "upcoming" },
];

export const PADEL_DATA: PadelData = {
  men: {
    tour: "wpt-men",
    season: 2026,
    rankings: MEN_RANKINGS,
    tournaments: MEN_TOURNAMENTS,
  },
  women: {
    tour: "wpt-women",
    season: 2026,
    rankings: WOMEN_RANKINGS,
    tournaments: WOMEN_TOURNAMENTS,
  },
};
