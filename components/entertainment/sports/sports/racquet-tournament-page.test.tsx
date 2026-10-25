// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));
vi.mock("@/app/actions/sports", () => ({ setSportFavoriteAction: vi.fn() }));

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

function renderPage(
  tournament: RacquetTournament,
  draw: DrawState,
  { sport = "padel", tab }: { sport?: "padel" | "tennis"; tab?: string } = {}
): void {
  render(
    <RacquetTournamentPage
      sport={sport}
      tournament={tournament}
      draw={draw}
      today="2026-10-18"
      season={2026}
      favoriteSportIds={["f1", "padel"]}
      initialTab={tab}
    />
  );
}

const ready = (rounds = ROUNDS): DrawState => ({
  status: "ready",
  draw: { tournamentId: "padelapi-747", rounds, players: PAIRS, champion: "A. Coello / A. Tapia" },
});

const openTab = (): string | null => screen.getByRole("tab", { selected: true }).textContent;

afterEach(() => {
  refresh.mockClear();
  push.mockClear();
});

describe("RacquetTournamentPage", () => {
  it("keeps the sport's own name row: its tile, its line, the favourites and the sports", () => {
    renderPage(MILANO, ready());
    expect(screen.getByText("Premier Padel · Season 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage favorites (2)" })).toBeInTheDocument();
    const sports = screen.getByRole("group", { name: "Sports" });
    expect(within(sports).getByRole("link", { current: "page" })).toHaveAccessibleName("Padel (favorite)");
  });

  it("makes the title a breadcrumb, the sport its way back", () => {
    renderPage(MILANO, ready());
    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(trail).getByRole("link", { name: "Padel" })).toHaveAttribute(
      "href",
      "/portal/entertainment/sports?sport=padel"
    );
    expect(screen.getByRole("heading", { level: 1, name: "Milano P1 2026" })).toBeInTheDocument();
    expect(trail).not.toContainElement(screen.getByRole("heading", { level: 1 }));
  });

  it("goes to a sport picked, its own included", () => {
    renderPage(MILANO, ready());
    const sports = screen.getByRole("group", { name: "Sports" });
    fireEvent.click(within(sports).getByRole("link", { name: /^Padel/ }));
    expect(push).toHaveBeenLastCalledWith("/portal/entertainment/sports?sport=padel");
    fireEvent.click(within(sports).getByRole("link", { name: /^F1/ }));
    expect(push).toHaveBeenLastCalledWith("/portal/entertainment/sports?sport=f1");
  });

  it("opens on the bracket, the whole draw, the Overview beside it", () => {
    renderPage(MILANO, ready());
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Overview", "Bracket"]);
    expect(openTab()).toBe("Bracket");
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Final")).toBeInTheDocument();
    expect(within(panel).getAllByText("Semi-finals")).toHaveLength(2);
  });

  it("opens on the Overview when the address asks for it", () => {
    renderPage(MILANO, ready(), { tab: "overview" });
    expect(openTab()).toBe("Overview");
  });

  it("names its tier, when and where, its prize and its champions on the Overview", () => {
    renderPage(MILANO, ready(), { tab: "overview" });
    expect(screen.getByText("P1")).toBeInTheDocument();
    // Once, in the facts: the venue already names the city.
    expect(screen.getAllByText("Oct 12 – 18, 2026")).toHaveLength(1);
    expect(screen.getByText("Allianz Cloud Milano")).toBeInTheDocument();
    expect(screen.getByText("€479,068")).toBeInTheDocument();
    const runnerUp = screen.getByText("L. Augsburger / J. Lebron", { exact: false });
    expect(within(runnerUp).getByText("d.")).toHaveAttribute("aria-hidden", "true");
    expect(within(runnerUp).getByText("defeated")).toHaveClass("sr-only");
  });

  it("shows the draw's three best seeds", () => {
    renderPage({ ...MILANO, status: "live" }, ready(), { tab: "overview" });
    const seeds = screen.getByRole("list", { name: "Top seeds" });
    expect(within(seeds).getAllByRole("listitem").map((li) => li.getAttribute("title"))).toEqual([
      "Seed 1: A. Coello / A. Tapia",
      "Seed 2: A. Galan / F. Chingotto",
      "Seed 3: L. Augsburger / J. Lebron",
    ]);
  });

  it("sets the seeds beside the facts, off the poster, which shows whole", () => {
    renderPage({ ...KUWAIT, status: "live" }, ready(), { tab: "overview" });
    const img = document.querySelector("img")!;
    expect(screen.getAllByRole("list", { name: "Top seeds" })).toHaveLength(1);
    expect(img.parentElement).not.toContainElement(screen.getByRole("list", { name: "Top seeds" }));

    fireEvent.error(img);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getAllByRole("list", { name: "Top seeds" })).toHaveLength(1);
  });

  it("says when a tournament not drawn yet starts, and that its draw is not out", () => {
    renderPage(KUWAIT, { status: "pending" });
    expect(screen.getByText("The draw is not out yet")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Overview" }), { button: 0 });
    expect(screen.getByText("Starts in 8 days")).toBeInTheDocument();
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

  it("goes back to Tennis from a tennis tournament, under the ATP's line", () => {
    renderPage({ ...MILANO, id: "espn-315-2026-mens-singles", name: "Rolex Shanghai Masters" }, ready(), {
      sport: "tennis",
    });
    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(trail).getByRole("link", { name: "Tennis" })).toHaveAttribute(
      "href",
      "/portal/entertainment/sports?sport=tennis"
    );
    expect(screen.getByText("ATP · Season 2026")).toBeInTheDocument();
  });
});
