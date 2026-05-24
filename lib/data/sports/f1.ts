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

const RACES: F1Race[] = [
  { id: "r-1", round: 1, name: "Bahrain Grand Prix", circuit: "Bahrain International Circuit", location: "Sakhir", flagEmoji: "🇧🇭", date: "2026-03-08", status: "completed", podium: ["ANT", "RUS", "LEC"] },
  { id: "r-2", round: 2, name: "Saudi Arabian GP", circuit: "Jeddah Corniche", location: "Jeddah", flagEmoji: "🇸🇦", date: "2026-03-15", status: "completed", podium: ["ANT", "VER", "RUS"] },
  { id: "r-3", round: 3, name: "Australian GP", circuit: "Albert Park", location: "Melbourne", flagEmoji: "🇦🇺", date: "2026-03-29", status: "completed", podium: ["RUS", "ANT", "PIA"] },
  { id: "r-4", round: 4, name: "Japanese GP", circuit: "Suzuka", location: "Suzuka", flagEmoji: "🇯🇵", date: "2026-04-12", status: "completed", podium: ["ANT", "HAM", "LEC"] },
  { id: "r-5", round: 5, name: "Chinese GP", circuit: "Shanghai International", location: "Shanghai", flagEmoji: "🇨🇳", date: "2026-04-26", status: "completed", podium: ["ANT", "NOR", "LEC"] },
  { id: "r-6", round: 6, name: "Miami GP", circuit: "Miami International", location: "Miami", flagEmoji: "🇺🇸", date: "2026-05-10", status: "completed", podium: ["VER", "ANT", "HAM"] },
  { id: "r-7", round: 7, name: "Emilia Romagna GP", circuit: "Imola", location: "Imola", flagEmoji: "🇮🇹", date: "2026-05-24", status: "upcoming" },
  { id: "r-8", round: 8, name: "Monaco GP", circuit: "Circuit de Monaco", location: "Monte Carlo", flagEmoji: "🇲🇨", date: "2026-06-07", status: "upcoming" },
  { id: "r-9", round: 9, name: "Spanish GP", circuit: "Circuit de Barcelona", location: "Barcelona", flagEmoji: "🇪🇸", date: "2026-06-14", status: "upcoming" },
  { id: "r-10", round: 10, name: "Canadian GP", circuit: "Gilles Villeneuve", location: "Montreal", flagEmoji: "🇨🇦", date: "2026-06-21", status: "upcoming" },
];

export const F1_DATA: F1Data = {
  season: 2026,
  drivers: DRIVERS,
  constructors: CONSTRUCTORS,
  races: RACES,
};
