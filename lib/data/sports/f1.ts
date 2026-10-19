import type { F1Constructor, F1Data, F1Driver, F1Race } from "@/types/sports";

const DRIVERS: F1Driver[] = [
  { position: 1, code: "ANT", name: "Andrea Kimi Antonelli", shortName: "A.K. Antonelli", team: "Mercedes", nationality: "ITA", flagEmoji: "🇮🇹", points: 106, wins: 3, podiums: 4 },
  { position: 2, code: "RUS", name: "George Russell", shortName: "G. Russell", team: "Mercedes", nationality: "GBR", flagEmoji: "🇬🇧", points: 88, wins: 1, podiums: 2 },
  { position: 3, code: "LEC", name: "Charles Leclerc", shortName: "C. Leclerc", team: "Ferrari", nationality: "MON", flagEmoji: "🇲🇨", points: 63, wins: 0, podiums: 2 },
  { position: 4, code: "NOR", name: "Lando Norris", shortName: "L. Norris", team: "McLaren", nationality: "GBR", flagEmoji: "🇬🇧", points: 58, wins: 0, podiums: 1 },
  { position: 5, code: "HAM", name: "Lewis Hamilton", shortName: "L. Hamilton", team: "Ferrari", nationality: "GBR", flagEmoji: "🇬🇧", points: 54, wins: 0, podiums: 1 },
  { position: 6, code: "PIA", name: "Oscar Piastri", shortName: "O. Piastri", team: "McLaren", nationality: "AUS", flagEmoji: "🇦🇺", points: 46, wins: 0, podiums: 1 },
  { position: 7, code: "VER", name: "Max Verstappen", shortName: "M. Verstappen", team: "Red Bull", nationality: "NED", flagEmoji: "🇳🇱", points: 42, wins: 1, podiums: 1 },
  { position: 8, code: "ALO", name: "Fernando Alonso", shortName: "F. Alonso", team: "Aston Martin", nationality: "ESP", flagEmoji: "🇪🇸", points: 28, wins: 0, podiums: 0 },
  { position: 9, code: "GAS", name: "Pierre Gasly", shortName: "P. Gasly", team: "Alpine", nationality: "FRA", flagEmoji: "🇫🇷", points: 22, wins: 0, podiums: 0 },
  { position: 10, code: "ALB", name: "Alex Albon", shortName: "A. Albon", team: "Williams", nationality: "THA", flagEmoji: "🇹🇭", points: 18, wins: 0, podiums: 0 },
];

const CONSTRUCTORS: F1Constructor[] = [
  { position: 1, name: "Mercedes", shortName: "Mercedes", points: 194, wins: 4, podiums: 6, primaryColor: "#27F4D2" },
  { position: 2, name: "Ferrari", shortName: "Ferrari", points: 117, wins: 0, podiums: 3, primaryColor: "#E80020" },
  { position: 3, name: "McLaren", shortName: "McLaren", points: 104, wins: 0, podiums: 2, primaryColor: "#FF8000" },
  { position: 4, name: "Red Bull Racing", shortName: "Red Bull", points: 68, wins: 1, podiums: 1, primaryColor: "#3671C6" },
  { position: 5, name: "Aston Martin", shortName: "Aston Martin", points: 38, wins: 0, podiums: 0, primaryColor: "#229971" },
  { position: 6, name: "Alpine", shortName: "Alpine", points: 30, wins: 0, podiums: 0, primaryColor: "#FF87BC" },
  { position: 7, name: "Williams", shortName: "Williams", points: 26, wins: 0, podiums: 0, primaryColor: "#64C4FF" },
  { position: 8, name: "RB", shortName: "RB", points: 14, wins: 0, podiums: 0, primaryColor: "#6692FF" },
  { position: 9, name: "Sauber", shortName: "Sauber", points: 6, wins: 0, podiums: 0, primaryColor: "#52E252" },
  { position: 10, name: "Haas", shortName: "Haas", points: 4, wins: 0, podiums: 0, primaryColor: "#B6BABD" },
];

// Rounds 5 to 8 carry a whole weekend (5 and 6 are sprints) and 4 to 6 their
// results, so the sample exercises the Races tab's featured card, its lists
// and the race sheet.
const RACES: F1Race[] = [
  { id: "r-1", round: 1, name: "Bahrain Grand Prix", circuit: "Bahrain International Circuit", circuitId: "bahrain", location: "Sakhir", country: "Bahrain", flagEmoji: "🇧🇭", date: "2026-03-08", startsAt: "2026-03-08T15:00:00.000Z", status: "completed", podium: ["ANT", "RUS", "LEC"] },
  { id: "r-2", round: 2, name: "Saudi Arabian GP", circuit: "Jeddah Corniche", circuitId: "jeddah", location: "Jeddah", country: "Saudi Arabia", flagEmoji: "🇸🇦", date: "2026-03-15", startsAt: "2026-03-15T17:00:00.000Z", status: "completed", podium: ["ANT", "VER", "RUS"] },
  { id: "r-3", round: 3, name: "Australian GP", circuit: "Albert Park", circuitId: "albert_park", location: "Melbourne", country: "Australia", flagEmoji: "🇦🇺", date: "2026-03-29", startsAt: "2026-03-29T04:00:00.000Z", status: "completed", podium: ["RUS", "ANT", "PIA"] },
  {
    id: "r-4", round: 4, name: "Japanese GP", circuit: "Suzuka", circuitId: "suzuka", location: "Suzuka", country: "Japan", flagEmoji: "🇯🇵", date: "2026-04-12", startsAt: "2026-04-12T05:00:00.000Z", status: "completed",
    podium: ["ANT", "HAM", "LEC"], podiumGaps: ["+3.112", "+9.870"],
    winner: { code: "ANT", team: "Mercedes", time: "1:28:42.610", laps: 53, grid: 1 },
    pole: { code: "ANT", time: "1:27.064" },
    fastestLap: { code: "HAM", lap: 49, time: "1:30.965" },
  },
  {
    id: "r-5", round: 5, name: "Chinese GP", circuit: "Shanghai International", circuitId: "shanghai", location: "Shanghai", country: "China", flagEmoji: "🇨🇳", date: "2026-04-26", startsAt: "2026-04-26T07:00:00.000Z", sprint: true, status: "completed",
    sessions: [
      { kind: "fp1", startsAt: "2026-04-24T03:30:00.000Z" },
      { kind: "sprint-qualifying", startsAt: "2026-04-24T07:30:00.000Z" },
      { kind: "sprint", startsAt: "2026-04-25T03:00:00.000Z" },
      { kind: "qualifying", startsAt: "2026-04-25T07:00:00.000Z" },
      { kind: "race", startsAt: "2026-04-26T07:00:00.000Z" },
    ],
    podium: ["ANT", "NOR", "LEC"], podiumGaps: ["+5.402", "+11.237"],
    winner: { code: "ANT", team: "Mercedes", time: "1:32:11.902", laps: 56, grid: 2 },
    pole: { code: "RUS", time: "1:30.641" },
    fastestLap: { code: "NOR", lap: 52, time: "1:33.418" },
    sprintWinner: { code: "RUS", team: "Mercedes" },
  },
  {
    id: "r-6", round: 6, name: "Miami GP", circuit: "Miami International", circuitId: "miami", location: "Miami", country: "USA", flagEmoji: "🇺🇸", date: "2026-05-10", startsAt: "2026-05-10T20:00:00.000Z", sprint: true, status: "completed",
    sessions: [
      { kind: "fp1", startsAt: "2026-05-08T16:30:00.000Z" },
      { kind: "sprint-qualifying", startsAt: "2026-05-08T20:30:00.000Z" },
      { kind: "sprint", startsAt: "2026-05-09T16:00:00.000Z" },
      { kind: "qualifying", startsAt: "2026-05-09T20:00:00.000Z" },
      { kind: "race", startsAt: "2026-05-10T20:00:00.000Z" },
    ],
    podium: ["VER", "ANT", "HAM"], podiumGaps: ["+1.874", "+1 lap"],
    winner: { code: "VER", team: "Red Bull", time: "1:30:05.330", laps: 57, grid: 3 },
    pole: { code: "ANT", time: "1:26.204" },
    fastestLap: { code: "VER", lap: 41, time: "1:29.790" },
    sprintWinner: { code: "NOR", team: "McLaren" },
  },
  {
    id: "r-7", round: 7, name: "Emilia Romagna GP", circuit: "Imola", circuitId: "imola", location: "Imola", country: "Italy", flagEmoji: "🇮🇹", date: "2026-05-24", startsAt: "2026-05-24T13:00:00.000Z", status: "upcoming",
    sessions: [
      { kind: "fp1", startsAt: "2026-05-22T11:30:00.000Z" },
      { kind: "fp2", startsAt: "2026-05-22T15:00:00.000Z" },
      { kind: "fp3", startsAt: "2026-05-23T10:30:00.000Z" },
      { kind: "qualifying", startsAt: "2026-05-23T14:00:00.000Z" },
      { kind: "race", startsAt: "2026-05-24T13:00:00.000Z" },
    ],
  },
  {
    id: "r-8", round: 8, name: "Monaco GP", circuit: "Circuit de Monaco", circuitId: "monaco", location: "Monte Carlo", country: "Monaco", flagEmoji: "🇲🇨", date: "2026-06-07", startsAt: "2026-06-07T13:00:00.000Z", status: "upcoming",
    sessions: [
      { kind: "fp1", startsAt: "2026-06-05T11:30:00.000Z" },
      { kind: "fp2", startsAt: "2026-06-05T15:00:00.000Z" },
      { kind: "fp3", startsAt: "2026-06-06T10:30:00.000Z" },
      { kind: "qualifying", startsAt: "2026-06-06T14:00:00.000Z" },
      { kind: "race", startsAt: "2026-06-07T13:00:00.000Z" },
    ],
  },
  { id: "r-9", round: 9, name: "Spanish GP", circuit: "Circuit de Barcelona", circuitId: "catalunya", location: "Barcelona", country: "Spain", flagEmoji: "🇪🇸", date: "2026-06-14", startsAt: "2026-06-14T13:00:00.000Z", status: "upcoming" },
  { id: "r-10", round: 10, name: "Canadian GP", circuit: "Gilles Villeneuve", circuitId: "villeneuve", location: "Montreal", country: "Canada", flagEmoji: "🇨🇦", date: "2026-06-21", startsAt: "2026-06-21T18:00:00.000Z", status: "upcoming" },
];

export const F1_DATA: F1Data = {
  season: 2026,
  drivers: DRIVERS,
  constructors: CONSTRUCTORS,
  races: RACES,
};
