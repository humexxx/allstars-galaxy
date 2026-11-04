import type {
  PadelData,
  PlayerRanking,
  RacquetCalendarEntry,
  RacquetTournament,
} from "@/types/sports";

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

const MEN_TOURNAMENTS: RacquetTournament[] = [
  { id: "wpt-m-doha", name: "Qatar Major", tier: "Major", location: "Doha", venue: "Khalifa International Tennis and Squash Complex", startDate: "2026-02-23", endDate: "2026-03-01", status: "completed", champion: "Coello / Tapia", runnerUp: "Galán / Chingotto" },
  { id: "wpt-m-riyadh", name: "Riyadh P1", tier: "P1", location: "Riyadh", startDate: "2026-03-16", endDate: "2026-03-22", status: "completed", champion: "Galán / Chingotto", runnerUp: "Coello / Tapia" },
  { id: "wpt-m-buenosaires", name: "Buenos Aires P1", tier: "P1", location: "Buenos Aires", startDate: "2026-04-06", endDate: "2026-04-12", status: "completed", champion: "Coello / Tapia", runnerUp: "Lebrón / Di Nenno" },
  { id: "wpt-m-madrid", name: "Madrid Master", tier: "P1", location: "Madrid", startDate: "2026-05-04", endDate: "2026-05-10", status: "completed", champion: "Coello / Tapia", runnerUp: "Galán / Chingotto" },
  { id: "wpt-m-rome", name: "Rome P1", tier: "P1", location: "Rome", venue: "Foro Italico", startDate: "2026-05-18", endDate: "2026-05-24", status: "live" },
  { id: "wpt-m-paris", name: "Paris Major", tier: "Major", location: "Paris", venue: "Roland Garros", prize: { amount: 1050000, currency: "EUR" }, startDate: "2026-06-08", endDate: "2026-06-14", status: "upcoming" },
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

export const PADEL_DATA: PadelData = {
  men: {
    tour: "wpt-men",
    season: 2026,
    rankings: MEN_RANKINGS,
    tournaments: MEN_TOURNAMENTS,
    calendar: calendarOf(MEN_TOURNAMENTS),
  },
};
