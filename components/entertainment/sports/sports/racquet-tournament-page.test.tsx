// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
// The view's draw loader shares the module; the page never calls it.
vi.mock("@/app/actions/racquet", () => ({ getRacquetDrawAction: vi.fn() }));

import type { BracketRound, DrawState, RacquetTournament, Team } from "@/types/sports";

import { RacquetTournamentPage } from "./racquet-tournament-page";

const pair = (id: string, name: string, shortName: string, seed = ""): Team => ({ id, name, shortName, code: seed });

const PAIRS = [
  pair("65-66", "A. Coello / A. Tapia", "Coello / Tapia", "1"),
  pair("84-88", "L. Augsburger / J. Lebron", "Augsburger / Lebron", "3"),
  pair("63-67", "A. Galan / F. Chingotto", "Galan / Chingotto", "2"),
  pair("70-71", "F. Stupaczuk / M. Yanguas", "Stupaczuk / Yanguas", "4"),
];

const ROUNDS: BracketRound[] = [
  {
    id: "semi-final",
    label: "Semi-finals",
    matches: [
      { id: "sf1", homeTeamId: "65-66", awayTeamId: "70-71", winnerTeamId: "65-66", legs: [{ homeScore: 6, awayScore: 2 }, { homeScore: 6, awayScore: 4 }] },
      { id: "sf2", homeTeamId: "63-67", awayTeamId: "84-88", winnerTeamId: "84-88", legs: [{ homeScore: 3, awayScore: 6 }, { homeScore: 4, awayScore: 6 }] },
    ],
  },
  {
    id: "final",
    label: "Final",
    matches: [{ id: "f", homeTeamId: "65-66", awayTeamId: "84-88", winnerTeamId: "65-66", legs: [{ homeScore: 6, awayScore: 3 }, { homeScore: 6, awayScore: 2 }] }],
  },
];

const MILANO: RacquetTournament = {
  id: "padelapi-747",
  name: "Milano P1 2026",
  tier: "P1",
  location: "Milan",
  venue: "Allianz Cloud Milano",
  prize: { amount: 479068, currency: "EUR" },
  startDate: "2026-10-12",
  endDate: "2026-10-18",
  status: "completed",
  champion: "A. Coello / A. Tapia",
  runnerUp: "L. Augsburger / J. Lebron",
};

const KUWAIT: RacquetTournament = {
  id: "padelapi-748",
  name: "Kuwait P1 2026",
  tier: "P1",
  location: "Kuwait City",
  imageUrl: "https://media.padelapi.org/tournament-api/kuwait-p1-2026.webp",
  startDate: "2026-10-26",
  endDate: "2026-10-31",
  status: "upcoming",
};

function renderPage(tournament: RacquetTournament, draw: DrawState, sport: "padel" | "tennis" = "padel"): void {
  render(<RacquetTournamentPage sport={sport} tournament={tournament} draw={draw} today="2026-10-18" />);
}

const ready = (rounds = ROUNDS): DrawState => ({
  status: "ready",
  draw: { tournamentId: "padelapi-747", rounds, players: PAIRS, champion: "A. Coello / A. Tapia" },
});

afterEach(() => {
  refresh.mockClear();
});

describe("RacquetTournamentPage", () => {
  it("leads with the way back to the sport and the hub", () => {
    renderPage(MILANO, ready());
    const trail = screen.getByRole("navigation", { name: "breadcrumb" });
    expect(within(trail).getByRole("link", { name: "Sports" })).toHaveAttribute("href", "/portal/entertainment/sports");
    expect(within(trail).getByRole("link", { name: "Padel" })).toHaveAttribute(
      "href",
      "/portal/entertainment/sports?sport=padel"
    );
    expect(within(trail).getByText("Milano P1 2026")).toHaveAttribute("aria-current", "page");
  });

  it("names the tournament, its tier, when and where, its prize and its champions", () => {
    renderPage(MILANO, ready());
    expect(screen.getByRole("heading", { level: 1, name: "Milano P1 2026" })).toBeInTheDocument();
    // Once, in the facts: the venue already names the city.
    expect(screen.getAllByText("Oct 12 – 18, 2026")).toHaveLength(1);
    expect(screen.getByText("Allianz Cloud Milano")).toBeInTheDocument();
    expect(screen.getByText("€479,068")).toBeInTheDocument();
    expect(screen.getByText("d. L. Augsburger / J. Lebron", { exact: false })).toBeInTheDocument();
  });

  it("draws the whole bracket the width of the page, a semi-final each side of the final", () => {
    renderPage(MILANO, ready());
    const draw = screen.getByRole("heading", { name: "Draw" }).closest("section")!;
    expect(within(draw).getByText("Final")).toBeInTheDocument();
    expect(within(draw).getAllByText("Semi-finals")).toHaveLength(2);
  });

  it("shows the draw's three best seeds", () => {
    renderPage({ ...MILANO, status: "live" }, ready());
    const seeds = screen.getByRole("list", { name: "Top seeds" });
    expect(within(seeds).getAllByRole("listitem").map((li) => li.getAttribute("title"))).toEqual([
      "Seed 1: A. Coello / A. Tapia",
      "Seed 2: A. Galan / F. Chingotto",
      "Seed 3: L. Augsburger / J. Lebron",
    ]);
  });

  it("says when a tournament not drawn yet starts, and that its draw is not out", () => {
    renderPage(KUWAIT, { status: "pending" });
    expect(screen.getByText("Starts in 8 days")).toBeInTheDocument();
    expect(screen.getByText("The draw is not out yet")).toBeInTheDocument();
    expect(document.querySelector("img")?.getAttribute("src")).toBe(KUWAIT.imageUrl);
  });

  it("asks again by refreshing the page when the draw did not load", () => {
    renderPage(MILANO, { status: "error" });
    expect(screen.getByText("The draw could not be loaded")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows only the champions when the provider withholds an old draw's results", () => {
    renderPage(MILANO, {
      status: "ready",
      draw: { tournamentId: "padelapi-747", rounds: [], players: [], resultsHidden: true },
    });
    expect(screen.getByText(/only kept for about six months/)).toBeInTheDocument();
  });

  it("says a fixture tournament's draw is not available", () => {
    renderPage({ ...MILANO, id: "wpt-m-doha" }, { status: "unavailable" });
    expect(screen.getByText("This draw is not available")).toBeInTheDocument();
  });

  it("goes back to Tennis from a tennis tournament", () => {
    renderPage({ ...MILANO, id: "espn-315-2026-mens-singles", name: "Rolex Shanghai Masters" }, ready(), "tennis");
    expect(screen.getByRole("link", { name: "Tennis" })).toHaveAttribute("href", "/portal/entertainment/sports?sport=tennis");
  });
});
