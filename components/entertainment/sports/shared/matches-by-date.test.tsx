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
import { StandingsTable } from "./standings-table";
import { SavedTeamFilterProvider } from "./team-filter-context";
import { TeamPicksProvider } from "./team-picks";
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
 * The list on an Overview tab of a sport shell, as a sport's page sets it.
 * `saved` is what the page read for this list; without it nothing is saved.
 */
function renderList(
  matches: Match[],
  saved: SavedTeamFilter | null = null,
  { table = false }: { table?: boolean } = {}
): ReturnType<typeof render> {
  const list = <MatchesByDate matches={matches} teams={teams} />;
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
                {table ? (
                  // As a sport's Overview sets it: the list and the table share one pick.
                  <TeamPicksProvider>
                    {list}
                    <StandingsTable
                      standings={[...teams.keys()].map((teamId, i) => ({
                        teamId,
                        position: i + 1,
                        played: 9,
                        won: 5,
                        drawn: 2,
                        lost: 2,
                        goalsFor: 15,
                        goalsAgainst: 10,
                        points: 17,
                      }))}
                      teams={teams}
                      competition="la-liga"
                      label="La Liga"
                    />
                  </TeamPicksProvider>
                ) : (
                  list
                )}
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
  screen.queryByRole("button", { name: /^Earlier: Show / });

const teamFilter = (): HTMLElement | null => screen.queryByRole("button", { name: /^Filter by team/ });

/** The heading line over `day`'s matches. */
const headingLine = (container: HTMLElement, day: string): HTMLElement =>
  container.querySelector(`[data-day="${day}"]`)!.firstElementChild as HTMLElement;

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

  it("goes back far enough for as many results as it is asked for, or to the first", () => {
    expect(openingDayIndex(days(season), TODAY, 3)).toBe(0);
    expect(openingDayIndex(days(season), TODAY, 2)).toBe(1);
    expect(openingDayIndex(days(season.slice(1)), TODAY, 3)).toBe(0);
  });
});

describe("MatchesByDate", () => {
  it("opens on the freshest results and keeps the days before behind Earlier", () => {
    const { container } = renderList(season);
    expect(shownDays(container)).toEqual(["2026-10-17", "2026-10-18", "2026-10-21"]);
    // It says what a tap brings in, by the dates.
    expect(earlierButton()).toHaveAccessibleName("Earlier: Show Oct 10 – Oct 14");
    expect(earlierButton()).toHaveTextContent(/^Earlier$/);
    expect(earlierButton()!.querySelector("svg")).not.toBeNull();
    expect(screen.getByText(/^Today · /)).toBeInTheDocument();
  });

  it("puts the team filter and Earlier on the first day's heading line, not on a row of their own", () => {
    const { container } = renderList(season);
    const line = headingLine(container, "2026-10-17");
    expect(line).toContainElement(teamFilter());
    expect(line).toContainElement(earlierButton());
    // The day, then the teams, then the days before: nothing else.
    expect(line).toHaveTextContent(/^Saturday, October 17, 2026All teamsEarlier$/);
    for (const day of ["2026-10-18", "2026-10-21"]) {
      expect(within(headingLine(container, day)).queryByRole("button")).toBeNull();
    }
  });

  it("takes the filter up to the new first day as Earlier brings days in", () => {
    const { container } = renderList(season);

    fireEvent.click(earlierButton()!);

    // Nothing earlier is left, so the filter has the line to itself.
    expect(headingLine(container, "2026-10-10")).toHaveTextContent(/^Saturday, October 10, 2026All teams$/);
    expect(within(headingLine(container, "2026-10-17")).queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Filter by team/ })).toHaveLength(1);
  });

  it("shows no filter with a single team to pick", () => {
    // A final whose other side is still to be decided.
    const { container } = renderList([match("final", "2026-10-21T20:00:00Z", "scheduled", "rma", "tbd")]);
    expect(teamFilter()).toBeNull();
    expect(headingLine(container, "2026-10-21")).toHaveTextContent(/^Wednesday, October 21, 2026$/);
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

    expect(earlierButton()).toHaveAccessibleName("Earlier: Show Oct 11 – Oct 15");
    fireEvent.click(earlierButton()!);
    expect(shownDays(container).slice(0, 4)).toEqual(["2026-10-11", "2026-10-13", "2026-10-15", "2026-10-17"]);
    expect(earlierButton()).toHaveAccessibleName("Earlier: Show Oct 5 – Oct 9");
    expect(container.querySelector("[data-day]")).toContainElement(earlierButton());
    expect(document.activeElement).toBe(earlierButton());

    fireEvent.click(earlierButton()!);
    expect(shownDays(container)[0]).toBe("2026-10-05");
    expect(earlierButton()).toHaveAccessibleName("Earlier: Show Oct 3");

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

  it("keeps the team filter in its tab's list, not in the sport bar, and takes it away with the tab", () => {
    renderList(season);
    expect(screen.getByRole("tabpanel")).toContainElement(teamFilter());
    expect(teamFilter()).toHaveTextContent("All teams");

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Knockout" }), { button: 0 });

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Bracket");
    expect(teamFilter()).toBeNull();
  });

  it("opens a team's fixtures on its last three results and what is next, named on the filter", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const games = [match("oct-3", "2026-10-03T20:00:00Z", "ft", "atm", "bar"), ...season];
    const { container } = renderList(games);
    expect(shownDays(container)).toEqual(["2026-10-17", "2026-10-18", "2026-10-21"]);

    pickTeam(/Barcelona/);

    expect(shownDays(container)).toEqual(["2026-10-10", "2026-10-14", "2026-10-17", "2026-10-18", "2026-10-21"]);
    expect(earlierButton()).toHaveAccessibleName("Earlier: Show Oct 3");
    expect(teamFilter()).toHaveAccessibleName("Filter by team: Barcelona");
  });

  it("narrows to a team tapped in a match card or the table, and back on a second tap", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = renderList(league, null, { table: true });
    fireEvent.click(within(screen.getByRole("table", { name: "La Liga" })).getByRole("button", { name: "Filter matches: Atlético" }));
    expect(shownDays(container)).toEqual(["2026-10-18"]);
    expect(teamFilter()).toHaveAccessibleName("Filter by team: Atlético");
    expect(within(screen.getByRole("table")).getByRole("button", { name: "Filter matches: Atlético" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    // Sevilla, from the card it is in: one team at a time.
    const list = container.querySelector<HTMLElement>("[data-day]")!;
    fireEvent.click(within(list).getByRole("button", { name: "Filter matches: Sevilla" }));
    expect(shownDays(container)).toEqual(["2026-10-18", "2026-10-21"]);
    expect(teamFilter()).toHaveAccessibleName("Filter by team: Sevilla");

    fireEvent.click(within(list).getByRole("button", { name: "Filter matches: Sevilla" }));
    expect(teamFilter()).toHaveAccessibleName("Filter by team: All teams");
    expect(shownDays(container)).toEqual(["2026-10-17", "2026-10-18", "2026-10-21"]);
  });

  it("saves a team tapped in the table, as a pick in the menu is", () => {
    renderList(league, { list: LA_LIGA, teamIds: [] }, { table: true });
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Filter matches: Barcelona" }));
    expect(setSportTeamFilterAction).toHaveBeenCalledWith({ ...LA_LIGA, teamIds: ["bar"] });
  });

  it("leaves the names in a list with no view around it as plain text", () => {
    renderList(league);
    expect(screen.queryByRole("button", { name: /^Filter matches:/ })).toBeNull();
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

  it("counts the day's scroll margin, which clears the bar, as under it", () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    // globals.css gives what follows the sport bar this margin: below md, the header and the bar.
    const margin = document.createElement("style");
    margin.textContent = "[data-day] { scroll-margin-top: 104px; }";
    document.head.appendChild(margin);
    try {
      const { container } = renderList(season);
      // On screen, but up under the bar.
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
        this: HTMLElement
      ) {
        const top = this.hasAttribute("data-day") ? 60 : 0;
        return { top, bottom: top + 100, left: 0, right: 0, width: 0, height: 100, x: 0, y: top } as DOMRect;
      });

      pickTeam(/Barcelona/);

      expect(listScrolls(scrolled)).toEqual([container.querySelector("[data-day]")]);
    } finally {
      margin.remove();
    }
  });

  it("leaves the clearing of the bar to globals.css: no scroll margin of its own", () => {
    const { container } = renderList(season);
    for (const day of container.querySelectorAll("[data-day]")) {
      expect(day.className).not.toMatch(/scroll-m/);
    }
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

  it("names a single earlier day by its date alone", () => {
    renderList(season.slice(1));
    expect(earlierButton()).toHaveAccessibleName("Earlier: Show Oct 14");
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

  it("heads each day with a level-2 heading, the filter and Earlier beside it rather than in it", () => {
    renderList(season);
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "Saturday, October 17, 2026",
      "Today · Sunday, October 18, 2026",
      "Wednesday, October 21, 2026",
    ]);
    expect(headings[0]).not.toContainElement(teamFilter());
    expect(headings[0]).not.toContainElement(earlierButton());
  });

  it("lists a day's games, one item a card, and no empty item for a game with a side to come", () => {
    const { container } = renderList([
      ...season,
      match("final", "2026-10-21T22:00:00Z", "scheduled", "rma", "tbd"),
    ]);
    const day = container.querySelector<HTMLElement>('[data-day="2026-10-21"]')!;
    expect(within(within(day).getByRole("list")).getAllByRole("listitem")).toHaveLength(1);
  });

  it("says each card's status in words, and keeps the live minute's green off its words", () => {
    const live: Match = { ...match("live", "2026-10-18T20:00:00Z", "live"), minute: 67 };
    renderList([
      match("ft", "2026-10-17T14:00:00Z", "ft"),
      match("aet", "2026-10-17T16:00:00Z", "aet"),
      match("ppd", "2026-10-17T18:00:00Z", "postponed"),
      match("can", "2026-10-17T20:00:00Z", "cancelled"),
      live,
    ]);
    for (const [code, words] of [
      ["FT", "Full time"],
      ["AET", "After extra time"],
      ["PPD", "Postponed"],
      ["CAN", "Cancelled"],
      ["67'", "Live, minute 67"],
    ]) {
      expect(screen.getByText(code)).toHaveAttribute("aria-hidden");
      expect(screen.getByText(words)).toHaveClass("sr-only");
    }
    const status = screen.getByText("67'").parentElement!;
    expect(status).toHaveClass("text-foreground");
    expect(status).not.toHaveClass("text-success");
    expect(status.querySelector("[aria-hidden].bg-success")).not.toBeNull();
  });

  it("names the filter's menu, and keeps a tick a tick rather than a selection", () => {
    Element.prototype.scrollIntoView = vi.fn();
    renderList(league);
    openFilter();

    expect(screen.getByRole("dialog", { name: "Filter by team" })).toBeInTheDocument();
    const list = screen.getByRole("listbox", { name: "Teams, pick one or more" });
    // cmdk marks its highlight aria-selected, which a multi-select list would read as picked.
    expect(list).not.toHaveAttribute("aria-multiselectable");
    // A listbox holds options and groups only.
    expect(within(list).queryByRole("separator")).toBeNull();
    expect(within(list).getByRole("option", { name: /All teams/ })).toHaveAttribute("aria-checked", "true");
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
    // The crests are pictures: the name says whose they are.
    expect(teamFilter()).toHaveAccessibleName("Filter by team: 2 teams (Real Madrid, Sevilla)");

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
    tick(/Barcelona/);
    tick(/Sevilla/);
    expect(setSportTeamFilterAction).not.toHaveBeenCalled();
    closeFilter();

    expect(setSportTeamFilterAction).toHaveBeenCalledOnce();
    expect(setSportTeamFilterAction).toHaveBeenCalledWith({ ...LA_LIGA, teamIds: ["bar", "sev"] });
  });

  it("keeps the menu open, its search and its focus, and saves the pick when a tick moves the filter to another day", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = renderList(league, { list: LA_LIGA, teamIds: [] });

    openFilter();
    const search = screen.getByRole("combobox", { name: "Search teams" });
    expect(document.activeElement).toBe(search);
    fireEvent.change(search, { target: { value: "sev" } });
    // Sevilla's first game is a day later: the list now opens on that day,
    // and the filter goes with it.
    tick(/Sevilla/);
    expect(headingLine(container, "2026-10-18")).toContainElement(teamFilter());
    expect(screen.getByRole("combobox", { name: "Search teams" })).toBe(search);
    expect(search).toHaveValue("sev");
    expect(document.activeElement).toBe(search);

    fireEvent.change(search, { target: { value: "" } });
    tick(/Barcelona/);
    closeFilter();

    expect(setSportTeamFilterAction).toHaveBeenCalledOnce();
    expect(setSportTeamFilterAction).toHaveBeenCalledWith({ ...LA_LIGA, teamIds: ["sev", "bar"] });
  });

  it("saves nothing when the menu closes as it opened", () => {
    Element.prototype.scrollIntoView = vi.fn();
    renderList(league, { list: LA_LIGA, teamIds: ["bar"] });

    openFilter();
    tick(/Sevilla/);
    tick(/Sevilla/);
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

  it("keeps its filter beside Earlier outside a sport shell", () => {
    const { container } = render(
      <ReaderTimeZoneProvider timeZone={ZONE}>
        <SportsTodayProvider today={TODAY}>
          <MatchesByDate matches={season} teams={teams} />
        </SportsTodayProvider>
      </ReaderTimeZoneProvider>
    );
    const line = headingLine(container, "2026-10-17");
    expect(line).toContainElement(teamFilter());
    expect(line).toContainElement(earlierButton());
  });
});
