import type { SurfData, SurfEvent, SurfHeat, SurfSurfer } from "@/types/sports";

/**
 * A sample men's Championship Tour, shown when the WSL's pages cannot be
 * read: three stops surfed, one on now with its draw part-way through, two to
 * come. Written by hand, so no face or flag points at the WSL's image host.
 */

const surfer = (athleteId: string, name: string, score: number | null, place?: number): SurfSurfer => ({
  athleteId,
  name,
  score,
  ...(place ? { place } : {}),
});

const heat = (id: string, number: number, status: SurfHeat["status"], surfers: SurfSurfer[]): SurfHeat => ({
  id,
  number,
  status,
  surfers,
});

export const SURF_DATA: SurfData = {
  season: 2026,
  events: [
    {
      id: "sample-bells",
      slug: "rip-curl-pro-bells-beach",
      name: "Rip Curl Pro Bells Beach",
      location: "Bells Beach, Victoria, Australia",
      startDate: "2026-04-01",
      endDate: "2026-04-11",
      status: "completed",
      stop: 1,
      winner: "Jack Robinson",
      runnerUp: "Italo Ferreira",
    },
    {
      id: "sample-margaret-river",
      slug: "margaret-river-pro",
      name: "Margaret River Pro",
      location: "Margaret River, Western Australia, Australia",
      startDate: "2026-04-16",
      endDate: "2026-04-26",
      status: "completed",
      stop: 2,
      winner: "Yago Dora",
      runnerUp: "Ethan Ewing",
    },
    {
      id: "sample-gold-coast",
      slug: "gold-coast-pro",
      name: "Gold Coast Pro",
      location: "Snapper Rocks, Queensland, Australia",
      startDate: "2026-05-01",
      endDate: "2026-05-11",
      status: "completed",
      stop: 3,
      winner: "Italo Ferreira",
      runnerUp: "Griffin Colapinto",
    },
    {
      id: "sample-tahiti",
      slug: "tahiti-pro",
      name: "Tahiti Pro",
      location: "Teahupoʻo, Tahiti, French Polynesia",
      startDate: "2026-08-08",
      endDate: "2026-08-18",
      status: "live",
      stop: 4,
    },
    {
      id: "sample-trestles",
      slug: "trestles-pro",
      name: "Trestles Pro",
      location: "Lower Trestles, San Clemente, California, United States",
      startDate: "2026-09-11",
      endDate: "2026-09-20",
      status: "upcoming",
      stop: 5,
    },
    {
      id: "sample-pipe",
      slug: "pipe-masters",
      name: "Pipe Masters",
      location: "Banzai Pipeline, Oahu, Hawaii, United States",
      startDate: "2026-12-08",
      endDate: "2026-12-20",
      status: "upcoming",
      stop: 6,
    },
  ],
  draw: {
    eventId: "sample-tahiti",
    rounds: [
      {
        label: "Round 1",
        heats: [
          heat("sample-r1h1", 1, "completed", [
            surfer("s-dora", "Yago Dora", 14.83, 1),
            surfer("s-robson", "Callum Robson", 11.2, 2),
          ]),
          heat("sample-r1h2", 2, "completed", [
            surfer("s-vaast", "Kauli Vaast", 16.5, 1),
            surfer("s-pupo-s", "Samuel Pupo", 12.07, 2),
          ]),
          heat("sample-r1h3", 3, "completed", [
            surfer("s-medina", "Gabriel Medina", 15.6, 1),
            surfer("s-igarashi", "Kanoa Igarashi", 13.4, 2),
          ]),
        ],
      },
      {
        label: "Round 2",
        heats: [
          heat("sample-r2h1", 1, "completed", [
            surfer("s-dora", "Yago Dora", 13.17, 2),
            surfer("s-vaast", "Kauli Vaast", 17.04, 1),
          ]),
          heat("sample-r2h2", 2, "live", [
            surfer("s-medina", "Gabriel Medina", 9.83, 1),
            surfer("s-ferreira", "Italo Ferreira", 7.5, 2),
          ]),
          heat("sample-r2h3", 3, "upcoming", [
            surfer("s-colapinto-g", "Griffin Colapinto", null),
            surfer("s-robinson", "Jack Robinson", null),
          ]),
        ],
      },
      {
        label: "Quarterfinals",
        heats: [
          heat("sample-qf1", 1, "upcoming", [
            { name: "Winner of Heat 1", score: null },
            { name: "Winner of Heat 2", score: null },
          ]),
        ],
      },
    ],
  },
  rankings: [
    { position: 1, athleteId: "s-ferreira", name: "Italo Ferreira", country: "Brazil", points: 25_190 },
    { position: 2, athleteId: "s-dora", name: "Yago Dora", country: "Brazil", points: 24_330 },
    { position: 3, athleteId: "s-robinson", name: "Jack Robinson", country: "Australia", points: 21_480 },
    { position: 4, athleteId: "s-colapinto-g", name: "Griffin Colapinto", country: "United States", points: 19_955 },
    { position: 5, athleteId: "s-ewing", name: "Ethan Ewing", country: "Australia", points: 17_640 },
    { position: 6, athleteId: "s-medina", name: "Gabriel Medina", country: "Brazil", points: 15_410 },
    { position: 7, athleteId: "s-vaast", name: "Kauli Vaast", country: "France", points: 13_870 },
    { position: 8, athleteId: "s-igarashi", name: "Kanoa Igarashi", country: "Japan", points: 12_565 },
    { position: 9, athleteId: "s-fioravanti", name: "Leonardo Fioravanti", country: "Italy", points: 11_020 },
    { position: 10, athleteId: "s-pupo-s", name: "Samuel Pupo", country: "Brazil", points: 10_385 },
    { position: 11, athleteId: "s-robson", name: "Callum Robson", country: "Australia", points: 9_740 },
    { position: 12, athleteId: "s-pupo-m", name: "Miguel Pupo", country: "Brazil", points: 8_905 },
  ],
};

/**
 * The stop to lead with: the one on now, else the next, else the last one
 * surfed. Shared by the service, which reads that stop's draw, and the view.
 */
export function featuredEvent<E extends SurfEvent>(events: readonly E[]): E | undefined {
  return (
    events.find((e) => e.status === "live") ??
    events.find((e) => e.status === "upcoming") ??
    events.findLast((e) => e.status === "completed")
  );
}
