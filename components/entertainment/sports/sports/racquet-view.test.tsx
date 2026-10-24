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
  PlayerRanking,
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

const ranking = (position: number): PlayerRanking => ({
  position,
  name: `Player ${position}`,
  shortName: `P. ${position}`,
  countryCode: "ES",
  flagEmoji: "🇪🇸",
  points: 20000 - position * 100,
  movement: 0,
});

const tile = (id: string): HTMLElement => document.querySelector<HTMLElement>(`[data-tournament="${id}"]`)!;
const section = (title: string): HTMLElement => screen.getByRole("heading", { name: title }).closest("section")!;
const tiles = (title: string): string[] =>
  [...section(title).querySelectorAll("[data-tournament]")].map((t) => t.getAttribute("data-tournament")!);
/** The tournaments played come in from the pill on their heading, three a tap. */
const earlier = (): void => {
  fireEvent.click(screen.getByRole("button", { name: /^Earlier:/ }));
};

describe("RacquetView, the tabs", () => {
  it("offers Overview and Draw, and opens on Overview", () => {
    renderPadel();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Overview", "Draw"]);
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Overview");
  });

  it("puts the tour's rankings beside the tournaments, ten rows and a button for the rest", () => {
    const ranked: PadelData = {
      ...PADEL,
      men: { ...MEN, rankings: Array.from({ length: 12 }, (_, i) => ranking(i + 1)) },
    };
    render(
      <SportsTodayProvider today="2026-10-18">
        <PadelView data={ranked} />
      </SportsTodayProvider>
    );
    const rows = (): number => within(screen.getByRole("table")).getAllByRole("row").length - 1;
    expect(screen.getByText("Rankings")).toBeInTheDocument();
    expect(rows()).toBe(10);

    fireEvent.click(screen.getByRole("button", { name: "Show 2 more" }));
    expect(rows()).toBe(12);
    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(rows()).toBe(10);
  });

  it("leaves the tournaments the whole row when the tour publishes no rankings", () => {
    renderPadel();
    expect(screen.queryByText("Rankings")).toBeNull();
  });
});

describe("RacquetView, Overview", () => {
  it("features the next tournament as F1 does its next race: poster, tier, venue, prize, when it starts", () => {
    renderPadel();
    expect(screen.getByRole("heading", { name: "Next up" })).toBeInTheDocument();
    const card = screen.getByRole("heading", { name: "Kuwait P1 2026" }).closest<HTMLElement>("[data-slot='card']")!;
    expect(within(card).getByText("P1")).toBeInTheDocument();
    expect(within(card).getByText("Sheikh Saad Al-Abdullah Complex, Kuwait City")).toBeInTheDocument();
    expect(within(card).getByText("€525,000")).toBeInTheDocument();
    expect(within(card).getByText("Starts in 8 days")).toBeInTheDocument();
    expect(card.querySelector("img")?.getAttribute("src")).toBe(
      "https://media.padelapi.org/tournament-api/kuwait-p1-2026.webp"
    );
    // Not one big button that greys on hover: "View details" opens it.
    expect(card.className).not.toMatch(/hover:bg/);
    fireEvent.click(within(card).getByRole("button", { name: "View details: Kuwait P1 2026" }));
    expect(within(sheet()).getByRole("heading", { name: "Kuwait P1 2026" })).toBeInTheDocument();
  });

  it("lists every tournament still to come under Coming up", () => {
    renderPadel();
    expect(tiles("Coming up")).toEqual(["padelapi-749", "padelapi-750", "padelapi-751"]);
  });

  it("brings in the tournaments played three a tap, latest first, the calendar's own included", () => {
    renderPadel();
    expect(tiles("Earlier tournaments")).toEqual([]);

    earlier();
    expect(tiles("Earlier tournaments")).toEqual(["padelapi-747", "padelapi-746", "padelapi-744"]);
    expect(within(tile("padelapi-747")).getByText("d. L. Augsburger / J. Lebron", { exact: false })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Earlier:/ }));

    earlier();
    expect(tiles("Earlier tournaments")).toEqual(["padelapi-747", "padelapi-746", "padelapi-744", "padelapi-701"]);
    // Nothing older: the pill goes, and the keyboard lands on what it brought in.
    expect(screen.queryByRole("button", { name: /^Earlier:/ })).toBeNull();
    expect(document.activeElement).toBe(tile("padelapi-701"));
  });
});

describe("RacquetView, the Draw tab", () => {
  it("draws the tournament just finished, with its champions, the whole width", () => {
    renderPadel();
    openTab("Draw");
    expect(screen.getByRole("heading", { name: "Milano P1 2026" })).toBeInTheDocument();
    expect(screen.getByText("Just finished")).toBeInTheDocument();
    expect(screen.getByText("d. L. Augsburger / J. Lebron", { exact: false })).toBeInTheDocument();
    // The bracket itself, a semi-final each side of the final, each pair as two names.
    expect(screen.getByText("Final")).toBeInTheDocument();
    expect(screen.getAllByText("Semi-finals")).toHaveLength(2);
    expect(screen.getAllByText("Coello").length).toBeGreaterThan(0);
    expect(getRacquetDrawAction).not.toHaveBeenCalled();
  });

  it("puts the bracket on the whole screen on Expand", () => {
    renderPadel();
    openTab("Draw");
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    const full = screen.getByRole("dialog");
    expect(within(full).getByRole("heading", { name: "Milano P1 2026" })).toBeInTheDocument();
    expect(within(full).getByText("Final")).toBeInTheDocument();
  });

  it("opens the tournament's sheet from View details", () => {
    renderPadel();
    openTab("Draw");
    fireEvent.click(screen.getByRole("button", { name: "View details: Milano P1 2026" }));
    expect(within(sheet()).getByRole("heading", { name: "Milano P1 2026" })).toBeInTheDocument();
  });
});

describe("RacquetView, the tournament sheet", () => {
  it("opens a draw that came with the page without asking for it", () => {
    renderPadel();
    earlier();
    fireEvent.click(tile("padelapi-747"));
    const details = sheet();
    expect(within(details).getByRole("heading", { name: "Milano P1 2026" })).toBeInTheDocument();
    expect(within(details).getByText("€479,068")).toBeInTheDocument();
    expect(within(details).getByText("Final")).toBeInTheDocument();
    expect(getRacquetDrawAction).not.toHaveBeenCalled();
  });

  it("slides in from the right on a desktop", () => {
    renderPadel();
    fireEvent.click(screen.getByRole("button", { name: "View details: Kuwait P1 2026" }));
    expect(sheet()).toHaveAttribute("data-side", "right");
  });

  it("comes up from the bottom on a phone", () => {
    stubViewport(true);
    renderPadel();
    fireEvent.click(screen.getByRole("button", { name: "View details: Kuwait P1 2026" }));
    expect(sheet()).toHaveAttribute("data-side", "bottom");
  });

  it("loads any other draw when it is opened, once", async () => {
    let answer: (value: Awaited<ReturnType<typeof getRacquetDrawAction>>) => void = () => {};
    vi.mocked(getRacquetDrawAction).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderPadel();
    earlier();
    fireEvent.click(tile("padelapi-746"));

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
    fireEvent.click(tile("padelapi-746"));
    expect(within(sheet()).getByText("Final")).toBeInTheDocument();
    expect(getRacquetDrawAction).toHaveBeenCalledTimes(1);
  });

  it("offers another try when the draw does not load", async () => {
    vi.mocked(getRacquetDrawAction)
      .mockResolvedValueOnce({ success: false, error: "The draw could not be loaded" })
      .mockResolvedValueOnce({ success: true, data: DUBAI_DRAW });
    renderPadel();
    earlier();
    fireEvent.click(tile("padelapi-746"));

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
    earlier();
    earlier();
    fireEvent.click(tile("padelapi-701"));

    expect(await within(sheet()).findByText(/only kept for about six months/)).toBeInTheDocument();
    expect(within(sheet()).getAllByText("A. Coello / A. Tapia").length).toBeGreaterThan(0);
  });

  it("asks for no draw weeks before one can exist", () => {
    renderPadel();
    fireEvent.click(tile("padelapi-749"));
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
    // A season over shows its last tournaments from the start.
    expect(screen.getByText("The season is over")).toBeInTheDocument();
    fireEvent.click(tile("wpt-m-doha"));
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

  it("picks between the tournaments being played, and loads the one picked", async () => {
    vi.mocked(getRacquetDrawAction).mockResolvedValue({
      success: true,
      data: { tournamentId: "espn-basel", rounds: [], players: [] },
    });
    const basel: RacquetTournament = {
      id: "espn-328-2026-mens-singles",
      name: "Swiss Indoors Basel",
      location: "Basel",
      startDate: "2026-10-19",
      endDate: "2026-10-25",
      status: "live",
    };
    const two: TennisData = { ...tennis, atp: { ...atp, tournaments: [...atp.tournaments, basel] } };
    render(
      <SportsTodayProvider today="2026-10-19">
        <TennisView data={two} />
      </SportsTodayProvider>
    );
    const picker = screen.getByRole("group", { name: "Tournaments on now" });
    expect(within(picker).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Vienna", "Basel"]);
    expect(within(picker).getByRole("radio", { name: "Erste Bank Open" })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(within(picker).getByRole("radio", { name: "Swiss Indoors Basel" }));

    expect(screen.getByRole("heading", { name: "Swiss Indoors Basel" })).toBeInTheDocument();
    await waitFor(() =>
      expect(getRacquetDrawAction).toHaveBeenCalledWith(
        expect.objectContaining({ tournamentId: "espn-328-2026-mens-singles" })
      )
    );
    // The Draw tab draws the one picked too.
    openTab("Draw");
    expect(screen.getByRole("heading", { name: "Swiss Indoors Basel" })).toBeInTheDocument();
  });

  it("shows no picker with one tournament being played", () => {
    render(
      <SportsTodayProvider today="2026-10-19">
        <TennisView data={tennis} />
      </SportsTodayProvider>
    );
    expect(screen.queryByRole("group", { name: "Tournaments on now" })).toBeNull();
  });

  it("features the event being played, with last year's champion, and draws it on Draw", async () => {
    vi.mocked(getRacquetDrawAction).mockResolvedValue({
      success: true,
      data: { tournamentId: "espn-vienna", rounds: [], players: [] },
    });
    render(
      <SportsTodayProvider today="2026-10-19">
        <TennisView data={tennis} />
      </SportsTodayProvider>
    );
    // Overview opens on the tournament being played, not on last week's final.
    expect(screen.getByRole("heading", { name: "On now" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Erste Bank Open" })).toBeInTheDocument();
    expect(screen.getByText("defends the title", { exact: false })).toBeInTheDocument();
    earlier();
    expect(within(tile("espn-315-2026-mens-singles")).getByText("Shanghai, China PR")).toBeInTheDocument();

    // Its draw, asked for when the feed did not ship one.
    openTab("Draw");
    expect(await screen.findByText("The draw has not been published")).toBeInTheDocument();
    expect(getRacquetDrawAction).toHaveBeenCalledTimes(1);
  });
});
