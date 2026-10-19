// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/racquet", () => ({
  getRacquetDrawAction: vi.fn(),
}));

import { getRacquetDrawAction } from "@/app/actions/racquet";
import type {
  BracketRound,
  PadelData,
  RacquetData,
  RacquetDraw,
  RacquetTournament,
  Team,
  TennisData,
} from "@/types/sports";

import { SportsTodayProvider } from "../shared/time-zone-context";
import { PadelView } from "./padel-view";
import { TennisView } from "./tennis-view";

const pair = (id: string, name: string, shortName: string, seed = ""): Team => ({
  id,
  name,
  shortName,
  code: seed,
});

const PAIRS = [
  pair("65-66", "A. Coello / A. Tapia", "Coello / Tapia", "1"),
  pair("84-88", "L. Augsburger / J. Lebron", "Augsburger / Lebron", "3"),
  pair("63-67", "A. Galan / F. Chingotto", "Galan / Chingotto", "2"),
  pair("70-71", "F. Stupaczuk / M. Yanguas", "Stupaczuk / Yanguas", "4"),
];

/** The last two rounds of a draw: enough for a bracket with branches. */
function finalRounds(prefix: string): BracketRound[] {
  return [
    {
      id: "semi-final",
      label: "Semi-finals",
      matches: [
        { id: `${prefix}-sf1`, homeTeamId: "65-66", awayTeamId: "70-71", winnerTeamId: "65-66", legs: [{ homeScore: 6, awayScore: 2 }, { homeScore: 6, awayScore: 4 }] },
        { id: `${prefix}-sf2`, homeTeamId: "63-67", awayTeamId: "84-88", winnerTeamId: "84-88", legs: [{ homeScore: 3, awayScore: 6 }, { homeScore: 4, awayScore: 6 }] },
      ],
    },
    {
      id: "final",
      label: "Final",
      matches: [
        { id: `${prefix}-f`, homeTeamId: "65-66", awayTeamId: "84-88", winnerTeamId: "65-66", legs: [{ homeScore: 4, awayScore: 6 }, { homeScore: 6, awayScore: 3 }, { homeScore: 6, awayScore: 2 }] },
      ],
    },
  ];
}

const tournament = (
  id: number,
  name: string,
  status: RacquetTournament["status"],
  startDate: string,
  endDate: string,
  extra: Partial<RacquetTournament> = {}
): RacquetTournament => ({
  id: `padelapi-${id}`,
  name,
  location: "—",
  startDate,
  endDate,
  status,
  tier: "P1",
  ...extra,
});

// Premier Padel's men on 2026-10-18: Milano just finished, Kuwait next.
const MEN: RacquetData = {
  tour: "wpt-men",
  season: 2026,
  rankings: [],
  tournaments: [
    tournament(744, "Paris Major 2026", "completed", "2026-09-28", "2026-10-04", { tier: "Major", champion: "A. Galan / F. Chingotto" }),
    tournament(746, "Dubai P1 2026", "completed", "2026-10-05", "2026-10-11", { champion: "A. Coello / A. Tapia", runnerUp: "A. Galan / F. Chingotto" }),
    tournament(747, "Milano P1 2026", "completed", "2026-10-12", "2026-10-18", {
      location: "Milan",
      venue: "Allianz Cloud Milano",
      prize: { amount: 479068, currency: "EUR" },
      champion: "A. Coello / A. Tapia",
      runnerUp: "L. Augsburger / J. Lebron",
      bracket: finalRounds("milano"),
    }),
    tournament(748, "Kuwait P1 2026", "upcoming", "2026-10-26", "2026-10-31", {
      location: "Kuwait City",
      venue: "Sheikh Saad Al-Abdullah Complex",
      imageUrl: "https://media.padelapi.org/tournament-api/kuwait-p1-2026.webp",
      prize: { amount: 525000, currency: "EUR" },
    }),
    tournament(749, "Mexico P1 2026", "upcoming", "2026-11-09", "2026-11-15"),
    tournament(750, "Barcelona Master 2026", "upcoming", "2026-11-23", "2026-11-29"),
    tournament(751, "Finals 2026", "upcoming", "2026-12-14", "2026-12-20", { tier: "Finals" }),
  ],
  calendar: [
    { id: "padelapi-701", name: "Madrid P1 2026", startDate: "2026-04-06", endDate: "2026-04-12", status: "completed", champion: "A. Coello / A. Tapia" },
    { id: "padelapi-744", name: "Paris Major 2026", startDate: "2026-09-28", endDate: "2026-10-04", status: "completed" },
    { id: "padelapi-747", name: "Milano P1 2026", startDate: "2026-10-12", endDate: "2026-10-18", status: "completed" },
  ],
  drawPlayers: PAIRS,
};

const PADEL: PadelData = {
  men: MEN,
  women: { ...MEN, tour: "wpt-women", tournaments: [], calendar: [], drawPlayers: [] },
};

const DUBAI_DRAW: RacquetDraw = {
  tournamentId: "padelapi-746",
  rounds: finalRounds("dubai"),
  players: PAIRS,
  champion: "A. Coello / A. Tapia",
};

function stubViewport(phone: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: phone, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
}

function renderPadel(): void {
  render(
    <SportsTodayProvider today="2026-10-18">
      <PadelView data={PADEL} />
    </SportsTodayProvider>
  );
}

const openTab = (name: string): void => {
  // Radix tabs switch on mousedown, not click.
  fireEvent.mouseDown(screen.getByRole("tab", { name }));
};

const sheet = (): HTMLElement => screen.getByRole("dialog");

beforeEach(() => {
  stubViewport(false);
  vi.mocked(getRacquetDrawAction).mockResolvedValue({
    success: false,
    error: "The draw could not be loaded",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("RacquetView, the tabs", () => {
  it("offers Current, Tournaments and Rankings, and opens on Current", () => {
    renderPadel();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Current",
      "Tournaments",
      "Rankings",
    ]);
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Current");
  });

  it("shows the tournament just finished on Current, with its champions and its draw", () => {
    renderPadel();
    expect(screen.getByRole("heading", { name: "Milano P1 2026" })).toBeInTheDocument();
    expect(screen.getByText("Just finished")).toBeInTheDocument();
    expect(screen.getByText("d. L. Augsburger / J. Lebron", { exact: false })).toBeInTheDocument();
    // The bracket itself: its rounds, and each pair as two names.
    expect(screen.getByText("Final")).toBeInTheDocument();
    expect(screen.getByText("Semi-finals")).toBeInTheDocument();
    expect(screen.getAllByText("Coello").length).toBeGreaterThan(0);
    expect(getRacquetDrawAction).not.toHaveBeenCalled();
  });
});

describe("RacquetView, the Tournaments tab", () => {
  it("features the next tournament with its poster, tier, venue and prize", () => {
    renderPadel();
    openTab("Tournaments");
    expect(screen.getByText("Next up")).toBeInTheDocument();
    const featured = screen.getByRole("heading", { name: "Kuwait P1 2026" });
    expect(featured.tagName).toBe("H3");
    const card = featured.closest("[data-slot='card']") as HTMLElement;
    expect(within(card).getByText("P1")).toBeInTheDocument();
    expect(within(card).getByText("Sheikh Saad Al-Abdullah Complex, Kuwait City")).toBeInTheDocument();
    expect(within(card).getByText("€525,000")).toBeInTheDocument();
    expect(card.querySelector("img")?.getAttribute("src")).toBe(
      "https://media.padelapi.org/tournament-api/kuwait-p1-2026.webp"
    );
  });

  it("lists the last three results, champions d. runners-up, then the next three", () => {
    renderPadel();
    openTab("Tournaments");
    const finished = screen.getByRole("heading", { name: "Just finished" }).closest("section")!;
    expect(within(finished).getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual([
      "Milano P1 2026",
      "Dubai P1 2026",
      "Paris Major 2026",
    ]);
    expect(within(finished).getByText("d. L. Augsburger / J. Lebron", { exact: false })).toBeInTheDocument();
    const next = screen.getByRole("heading", { name: "Coming up" }).closest("section")!;
    expect(within(next).getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual([
      "Mexico P1 2026",
      "Barcelona Master 2026",
      "Finals 2026",
    ]);
  });

  it("lists the whole season by month under Full calendar", () => {
    renderPadel();
    openTab("Tournaments");
    expect(screen.queryByText("April 2026")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Full calendar/ }));
    expect(screen.getByText("April 2026")).toBeInTheDocument();
    expect(screen.getByText("December 2026")).toBeInTheDocument();
    // A line only the calendar has still opens its sheet.
    fireEvent.click(screen.getByRole("button", { name: /Madrid P1 2026/ }));
    expect(within(sheet()).getByRole("heading", { name: "Madrid P1 2026" })).toBeInTheDocument();
  });
});

describe("RacquetView, the tournament sheet", () => {
  it("opens a draw that came with the page without asking for it", () => {
    renderPadel();
    openTab("Tournaments");
    fireEvent.click(screen.getByRole("button", { name: "Milano P1 2026" }));
    const details = sheet();
    expect(within(details).getByRole("heading", { name: "Milano P1 2026" })).toBeInTheDocument();
    expect(within(details).getByText("€479,068")).toBeInTheDocument();
    expect(within(details).getByText("Final")).toBeInTheDocument();
    expect(getRacquetDrawAction).not.toHaveBeenCalled();
  });

  it("slides in from the right on a desktop", () => {
    renderPadel();
    openTab("Tournaments");
    fireEvent.click(screen.getByRole("button", { name: "Kuwait P1 2026" }));
    expect(sheet()).toHaveAttribute("data-side", "right");
  });

  it("comes up from the bottom on a phone", () => {
    stubViewport(true);
    renderPadel();
    openTab("Tournaments");
    fireEvent.click(screen.getByRole("button", { name: "Kuwait P1 2026" }));
    expect(sheet()).toHaveAttribute("data-side", "bottom");
  });

  it("loads any other draw when it is opened, once", async () => {
    let answer: (value: Awaited<ReturnType<typeof getRacquetDrawAction>>) => void = () => {};
    vi.mocked(getRacquetDrawAction).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderPadel();
    openTab("Tournaments");
    fireEvent.click(screen.getByRole("button", { name: "Dubai P1 2026" }));

    expect(within(sheet()).getByRole("status", { name: "Loading the draw" })).toBeInTheDocument();
    expect(getRacquetDrawAction).toHaveBeenCalledWith({
      sport: "padel",
      tour: "wpt-men",
      tournamentId: "padelapi-746",
    });

    answer({ success: true, data: DUBAI_DRAW });
    expect(await within(sheet()).findByText("Final")).toBeInTheDocument();

    fireEvent.keyDown(sheet(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Dubai P1 2026" }));
    expect(within(sheet()).getByText("Final")).toBeInTheDocument();
    expect(getRacquetDrawAction).toHaveBeenCalledTimes(1);
  });

  it("offers another try when the draw does not load", async () => {
    vi.mocked(getRacquetDrawAction)
      .mockResolvedValueOnce({ success: false, error: "The draw could not be loaded" })
      .mockResolvedValueOnce({ success: true, data: DUBAI_DRAW });
    renderPadel();
    openTab("Tournaments");
    fireEvent.click(screen.getByRole("button", { name: "Dubai P1 2026" }));

    expect(await within(sheet()).findByText("The draw could not be loaded")).toBeInTheDocument();
    fireEvent.click(within(sheet()).getByRole("button", { name: "Try again" }));
    expect(await within(sheet()).findByText("Final")).toBeInTheDocument();
    expect(getRacquetDrawAction).toHaveBeenCalledTimes(2);
  });

  it("shows only the champions when the provider withholds an old draw's results", async () => {
    vi.mocked(getRacquetDrawAction).mockResolvedValue({
      success: true,
      data: { tournamentId: "padelapi-701", rounds: [], players: [], resultsHidden: true },
    });
    renderPadel();
    openTab("Tournaments");
    fireEvent.click(screen.getByRole("button", { name: /Full calendar/ }));
    fireEvent.click(screen.getByRole("button", { name: /Madrid P1 2026/ }));

    expect(await within(sheet()).findByText(/only kept for about six months/)).toBeInTheDocument();
    expect(within(sheet()).getAllByText("A. Coello / A. Tapia").length).toBeGreaterThan(0);
  });

  it("asks for no draw weeks before one can exist", () => {
    renderPadel();
    openTab("Tournaments");
    fireEvent.click(screen.getByRole("button", { name: "Mexico P1 2026" }));
    expect(within(sheet()).getByText("The draw is not out yet")).toBeInTheDocument();
    expect(getRacquetDrawAction).not.toHaveBeenCalled();
  });

  it("never asks for a fixture tournament's draw", () => {
    const fixture: PadelData = {
      ...PADEL,
      men: {
        ...MEN,
        tournaments: [
          { id: "wpt-m-doha", name: "Qatar Major", location: "Doha", startDate: "2026-02-23", endDate: "2026-03-01", status: "completed", champion: "Coello / Tapia" },
        ],
        calendar: [],
      },
    };
    render(
      <SportsTodayProvider today="2026-10-18">
        <PadelView data={fixture} />
      </SportsTodayProvider>
    );
    openTab("Tournaments");
    fireEvent.click(screen.getByRole("button", { name: "Qatar Major" }));
    expect(within(sheet()).getByText("This draw is not available")).toBeInTheDocument();
    expect(getRacquetDrawAction).not.toHaveBeenCalled();
  });
});

describe("RacquetView, tennis", () => {
  const atp: RacquetData = {
    tour: "atp",
    season: 2026,
    rankings: [],
    tournaments: [
      {
        id: "espn-315-2026-mens-singles",
        name: "Rolex Shanghai Masters",
        location: "Shanghai",
        venue: "Shanghai, China PR",
        startDate: "2026-10-05",
        endDate: "2026-10-18",
        status: "completed",
        champion: "A. Davidovich Fokina",
        runnerUp: "R. Jodar",
      },
      {
        id: "espn-422-2026-mens-singles",
        name: "Erste Bank Open",
        location: "Vienna",
        startDate: "2026-10-19",
        endDate: "2026-10-25",
        status: "live",
        defendingChampion: "J. Sinner",
      },
    ],
    calendar: [],
    drawPlayers: [],
  };
  const tennis: TennisData = { atp, wta: { ...atp, tour: "wta", tournaments: [] } };

  it("features the event being played, with last year's champion", async () => {
    vi.mocked(getRacquetDrawAction).mockResolvedValue({
      success: true,
      data: { tournamentId: "espn-vienna", rounds: [], players: [] },
    });
    render(
      <SportsTodayProvider today="2026-10-19">
        <TennisView data={tennis} />
      </SportsTodayProvider>
    );
    // Current opens on the tournament being played, not on last week's final,
    // and asks for its draw when the feed did not ship one.
    expect(screen.getByRole("heading", { name: "Erste Bank Open" })).toBeInTheDocument();
    expect(await screen.findByText("The draw has not been published")).toBeInTheDocument();
    expect(getRacquetDrawAction).toHaveBeenCalledTimes(1);
    openTab("Tournaments");
    expect(screen.getByText("On now")).toBeInTheDocument();
    expect(screen.getByText("defends the title", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Shanghai, China PR")).toBeInTheDocument();
  });
});
