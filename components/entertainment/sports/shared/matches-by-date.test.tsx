// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/sports", () => ({
  setSportTeamFilterAction: vi.fn(async () => ({ success: true })),
}));

import { setSportTeamFilterAction } from "@/app/actions/sports";
import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { matchDays } from "@/lib/sports/match-days";
import type { Match, MatchStatus, SavedTeamFilter, Team } from "@/types/sports";

import { MatchesByDate, openingDayIndex } from "./matches-by-date";
import { SportShell } from "./sport-shell";
import { SavedTeamFilterProvider } from "./team-filter-context";
import { SportsTodayProvider } from "./time-zone-context";

const TODAY = "2026-10-18";
const ZONE = "America/Costa_Rica";

const teams = new Map<string, Team>([
  ["rma", { id: "rma", name: "Real Madrid", shortName: "Real Madrid", code: "RMA" }],
  ["bar", { id: "bar", name: "Barcelona", shortName: "Barcelona", code: "BAR" }],
  ["atm", { id: "atm", name: "Atlético de Madrid", shortName: "Atlético", code: "ATM" }],
  ["sev", { id: "sev", name: "Sevilla FC", shortName: "Sevilla", code: "SEV" }],
]);

const match = (id: string, kickoff: string, status: MatchStatus, home = "rma", away = "bar"): Match => {
  const played = status === "ft" || status === "aet" || status === "pen";
  return {
    id,
    homeTeamId: home,
    awayTeamId: away,
    homeScore: played ? 2 : null,
    awayScore: played ? 1 : null,
    kickoff,
    status,
  };
};

// 20:00 UTC is 14:00 in Costa Rica, so each kickoff keeps its UTC day.
const season = [
  match("oct-10", "2026-10-10T20:00:00Z", "ft"),
  match("oct-14", "2026-10-14T20:00:00Z", "aet"),
  match("oct-17", "2026-10-17T20:00:00Z", "ft"),
  match("oct-18", "2026-10-18T20:00:00Z", "scheduled"),
  match("oct-21", "2026-10-21T20:00:00Z", "scheduled"),
];

// Four teams over three days: the Clásico, then Atlético–Sevilla, then Barça–Sevilla.
const league = [
  match("clasico", "2026-10-17T20:00:00Z", "ft"),
  match("derbi", "2026-10-18T20:00:00Z", "scheduled", "atm", "sev"),
  match("visit", "2026-10-21T20:00:00Z", "scheduled", "bar", "sev"),
];

const LA_LIGA = { sportId: "football", competition: "la-liga" } as const;

/**
 * The list on an Overview tab of a sport shell, whose bar holds its filter.
 * `saved` is what the page read for this list; without it nothing is saved.
 */
function renderList(matches: Match[], saved: SavedTeamFilter | null = null): ReturnType<typeof render> {
  return render(
    <ReaderTimeZoneProvider timeZone={ZONE}>
      <SportsTodayProvider today={TODAY}>
        <SavedTeamFilterProvider filter={saved}>
          <Tabs defaultValue="overview">
            <SportShell
              title="La Liga"
              tabs={
                <TabsList variant="line">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="knockout">Knockout</TabsTrigger>
                </TabsList>
              }
            >
              <TabsContent value="overview">
                <MatchesByDate matches={matches} teams={teams} />
              </TabsContent>
              <TabsContent value="knockout">Bracket</TabsContent>
            </SportShell>
          </Tabs>
        </SavedTeamFilterProvider>
      </SportsTodayProvider>
    </ReaderTimeZoneProvider>
  );
}

const shownDays = (container: HTMLElement): (string | null)[] =>
  [...container.querySelectorAll("[data-day]")].map((el) => el.getAttribute("data-day"));

const earlierButton = (): HTMLElement | null =>
  screen.queryByRole("button", { name: /^Show \d+ earlier day/ });

const teamFilter = (): HTMLElement | null => screen.queryByRole("button", { name: /^Filter by team/ });

/** The sticky row the tablist sits in (through its sideways scroller). */
const sportBar = (): HTMLElement => screen.getByRole("tablist").closest<HTMLElement>(".sticky")!;

// jsdom has no scrollIntoView; cmdk scrolls its highlighted option with it.
const { scrollIntoView } = Element.prototype;

const openFilter = (): void => {
  fireEvent.click(teamFilter()!);
};
const tick = (name: RegExp): void => {
  fireEvent.click(screen.getByRole("option", { name }));
};
const closeFilter = (): void => {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
};

/** Open the menu, tick one team, close it. */
function pickTeam(name: RegExp): void {
  openFilter();
  tick(name);
  closeFilter();
}

/** The scrolls the list asked for, not cmdk's own (`block: "nearest"`). */
const listScrolls = (scrolled: ReturnType<typeof vi.fn>): unknown[] =>
  scrolled.mock.contexts.filter((_, i) => (scrolled.mock.calls[i][0] as ScrollIntoViewOptions)?.block === "start");

afterEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
  vi.restoreAllMocks();
  vi.mocked(setSportTeamFilterAction).mockClear();
});

describe("openingDayIndex", () => {
  const days = (matches: Match[]) => matchDays(matches, ZONE);

  it("opens on the latest day with a result", () => {
    expect(openingDayIndex(days(season), TODAY)).toBe(2);
  });

  it("opens on today once today has a result", () => {
    const list = season.map((m) => (m.id === "oct-18" ? { ...m, status: "ft" as const } : m));
    expect(openingDayIndex(days(list), TODAY)).toBe(3);
  });

  it("ignores a result dated after today", () => {
    const list = season.map((m) => (m.id === "oct-21" ? { ...m, status: "ft" as const } : m));
    expect(openingDayIndex(days(list), TODAY)).toBe(2);
  });

  it("opens on the first day before any result, and on the last once all are in", () => {
    expect(openingDayIndex(days(season.slice(3)), TODAY)).toBe(0);
    expect(openingDayIndex(days(season.slice(0, 3)), TODAY)).toBe(2);
    expect(openingDayIndex([], TODAY)).toBe(0);
  });

  it("does not count a postponed match as a result", () => {
    const list = [match("off", "2026-10-16T20:00:00Z", "postponed"), ...season.slice(3)];
    expect(openingDayIndex(days(list), TODAY)).toBe(0);
  });
});

describe("MatchesByDate", () => {
  it("opens on the freshest results and keeps the days before behind a clock", () => {
    const { container } = renderList(season);
    expect(shownDays(container)).toEqual(["2026-10-17", "2026-10-18", "2026-10-21"]);
    expect(earlierButton()).toHaveAccessibleName("Show 2 earlier days");
    // An icon: the name is for a screen reader, the tooltip for the eye.
    expect(earlierButton()).toHaveTextContent("");
    expect(earlierButton()!.querySelector("svg")).not.toBeNull();
    expect(screen.getByText(/^Today · /)).toBeInTheDocument();
  });

  it("puts the clock on the first day's heading line, not on a row of its own", () => {
    const { container } = renderList(season);
    const heading = container.querySelector('[data-day="2026-10-17"]')!.firstElementChild!;
    expect(heading).toContainElement(earlierButton());
    expect(heading).toHaveTextContent(/^Saturday, October 17, 2026$/);
  });

  it("opens on a day heading: no label row above the first day", () => {
    const { container } = renderList(season);
    const list = container.querySelector("[data-day]")!.parentElement!;
    expect(list.parentElement!.firstElementChild).toBe(list);
    expect(screen.queryByText("Matches")).toBeNull();
  });

  it("brings in the last earlier days without scrolling, then focuses the top of the list", () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    const { container } = renderList(season);

    fireEvent.click(earlierButton()!);

    expect(shownDays(container)).toEqual([
      "2026-10-10",
      "2026-10-14",
      "2026-10-17",
      "2026-10-18",
      "2026-10-21",
    ]);
    // Nothing older: the clock goes, and the keyboard lands where it was.
    expect(earlierButton()).toBeNull();
    expect(document.activeElement).toBe(container.querySelector('[data-day="2026-10-10"]'));
    expect(scrolled).not.toHaveBeenCalled();
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("brings in three days a tap, keeping the clock on top, focused, for the next three", () => {
    // Eight results, a few days apart, then today's fixture.
    const long = [3, 5, 7, 9, 11, 13, 15, 17].map((d) =>
      match(`d${d}`, `2026-10-${String(d).padStart(2, "0")}T20:00:00Z`, "ft")
    );
    const { container } = renderList([...long, match("oct-18", "2026-10-18T20:00:00Z", "scheduled")]);
    expect(shownDays(container)).toEqual(["2026-10-17", "2026-10-18"]);

    fireEvent.click(earlierButton()!);
    expect(shownDays(container).slice(0, 4)).toEqual(["2026-10-11", "2026-10-13", "2026-10-15", "2026-10-17"]);
    expect(earlierButton()).toHaveAccessibleName("Show 3 earlier days");
    expect(container.querySelector("[data-day]")).toContainElement(earlierButton());
    expect(document.activeElement).toBe(earlierButton());

    fireEvent.click(earlierButton()!);
    expect(shownDays(container)[0]).toBe("2026-10-05");
    expect(earlierButton()).toHaveAccessibleName("Show 1 earlier day");

    fireEvent.click(earlierButton()!);
    expect(shownDays(container)).toHaveLength(9);
    expect(earlierButton()).toBeNull();
  });

  it("holds the page still while the days go in: scroll anchoring off, then back", () => {
    vi.useFakeTimers();
    try {
      renderList(season);
      fireEvent.click(earlierButton()!);
      expect(document.body.style.overflowAnchor).toBe("none");
      vi.advanceTimersByTime(1000);
      expect(document.body.style.overflowAnchor).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("puts the team filter at the end of the sport bar, out of the list", () => {
    const { container } = renderList(season);
    const filter = teamFilter()!;
    expect(sportBar()).toContainElement(filter);
    expect(screen.getByRole("tabpanel")).not.toContainElement(filter);
    expect(filter.compareDocumentPosition(screen.getByRole("tablist")) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(filter).toHaveTextContent("All teams");
    expect(container.querySelector("[data-day]")).not.toBeNull();
  });

  it("takes the filter away with its tab", () => {
    renderList(season);
    expect(teamFilter()).not.toBeNull();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Knockout" }), { button: 0 });

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Bracket");
    expect(teamFilter()).toBeNull();
    expect(within(sportBar()).queryByRole("button")).toBeNull();
  });

  it("opens another team's fixtures on its freshest results again, its crest in the bar", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = renderList(season);
    fireEvent.click(earlierButton()!);
    expect(shownDays(container)).toHaveLength(5);

    pickTeam(/Barcelona/);

    expect(shownDays(container)).toEqual(["2026-10-17", "2026-10-18", "2026-10-21"]);
    expect(earlierButton()).toHaveAccessibleName("Show 2 earlier days");
    expect(teamFilter()).toHaveAccessibleName("Filter by team: Barcelona");
  });

  it("brings a team picked deep in the list back to its first day, under the bar", () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    const { container } = renderList(season);
    // Read far down: the first day's top is well above the screen.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      const top = this.hasAttribute("data-day") ? -900 : 0;
      return { top, bottom: top + 100, left: 0, right: 0, width: 0, height: 100, x: 0, y: top } as DOMRect;
    });

    pickTeam(/Barcelona/);

    expect(listScrolls(scrolled)).toEqual([container.querySelector("[data-day]")]);
  });

  it("leaves the page alone when the picked team's list already starts in view", () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    renderList(season);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 300,
      bottom: 400,
      left: 0,
      right: 0,
      width: 0,
      height: 100,
      x: 0,
      y: 300,
    } as DOMRect);

    pickTeam(/Barcelona/);

    expect(listScrolls(scrolled)).toEqual([]);
  });

  it("says one day in the singular", () => {
    renderList(season.slice(1));
    expect(earlierButton()).toHaveAccessibleName("Show 1 earlier day");
  });

  it("shows every day, and no clock, before the first result", () => {
    const { container } = renderList(season.slice(3));
    expect(shownDays(container)).toEqual(["2026-10-18", "2026-10-21"]);
    expect(earlierButton()).toBeNull();
  });

  it("has no scroller of its own: the page scrolls it", () => {
    const { container } = renderList(season);
    const list = container.querySelector("[data-day]")!.closest("section")!;
    expect(screen.queryByRole("region")).toBeNull();
    expect(list).not.toHaveAttribute("tabindex");
    expect(list.querySelector('[tabindex="0"]')).toBeNull();
  });

  it("keeps its empty state", () => {
    renderList([]);
    expect(screen.getByText("No matches available yet")).toBeInTheDocument();
    expect(earlierButton()).toBeNull();
  });

  it("narrows to several teams at once, ticked in one menu", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = renderList(league);

    openFilter();
    tick(/Real Madrid/);
    expect(shownDays(container)).toEqual(["2026-10-17"]);
    tick(/Sevilla/);

    expect(shownDays(container)).toEqual(["2026-10-17", "2026-10-18", "2026-10-21"]);
    expect(screen.getByRole("option", { name: /Real Madrid/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("option", { name: /Sevilla/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("option", { name: /Barcelona/ })).toHaveAttribute("aria-checked", "false");
    expect(teamFilter()).toHaveAccessibleName("Filter by team: 2 teams");

    // Unticking one keeps the other; All teams lets both go.
    tick(/Sevilla/);
    expect(shownDays(container)).toEqual(["2026-10-17"]);
    tick(/All teams/);
    expect(shownDays(container)).toEqual(["2026-10-17", "2026-10-18", "2026-10-21"]);
    expect(teamFilter()).toHaveAccessibleName("Filter by team: All teams");
  });

  it("finds a team by name through the search", () => {
    Element.prototype.scrollIntoView = vi.fn();
    renderList(league);
    openFilter();

    fireEvent.change(screen.getByRole("combobox", { name: "Search teams" }), { target: { value: "atl" } });

    expect(screen.getByRole("option", { name: /Atlético/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Barcelona/ })).toBeNull();
  });

  it("opens on the teams last picked in this list", () => {
    const { container } = renderList(league, { list: LA_LIGA, teamIds: ["atm"] });
    expect(shownDays(container)).toEqual(["2026-10-18"]);
    expect(teamFilter()).toHaveAccessibleName("Filter by team: Atlético");
  });

  it("lets go of a remembered team that is no longer in the list", () => {
    const { container } = renderList(league, { list: LA_LIGA, teamIds: ["gone", "sev"] });
    expect(shownDays(container)).toEqual(["2026-10-18", "2026-10-21"]);
    expect(teamFilter()).toHaveAccessibleName("Filter by team: Sevilla");
  });

  it("saves the pick once, when the menu closes having changed", () => {
    Element.prototype.scrollIntoView = vi.fn();
    renderList(league, { list: LA_LIGA, teamIds: [] });

    openFilter();
    tick(/Sevilla/);
    tick(/Barcelona/);
    expect(setSportTeamFilterAction).not.toHaveBeenCalled();
    closeFilter();

    expect(setSportTeamFilterAction).toHaveBeenCalledOnce();
    expect(setSportTeamFilterAction).toHaveBeenCalledWith({ ...LA_LIGA, teamIds: ["sev", "bar"] });
  });

  it("saves nothing when the menu closes as it opened", () => {
    Element.prototype.scrollIntoView = vi.fn();
    renderList(league, { list: LA_LIGA, teamIds: ["sev"] });

    openFilter();
    tick(/Barcelona/);
    tick(/Barcelona/);
    closeFilter();

    expect(setSportTeamFilterAction).not.toHaveBeenCalled();
  });

  it("saves nothing for a list the page did not name", () => {
    Element.prototype.scrollIntoView = vi.fn();
    renderList(league);

    pickTeam(/Sevilla/);

    expect(teamFilter()).toHaveAccessibleName("Filter by team: Sevilla");
    expect(setSportTeamFilterAction).not.toHaveBeenCalled();
  });

  it("has nowhere to put a filter outside a sport shell, and renders without one", () => {
    render(
      <ReaderTimeZoneProvider timeZone={ZONE}>
        <SportsTodayProvider today={TODAY}>
          <MatchesByDate matches={season} teams={teams} />
        </SportsTodayProvider>
      </ReaderTimeZoneProvider>
    );
    expect(teamFilter()).toBeNull();
    expect(earlierButton()).not.toBeNull();
  });
});
