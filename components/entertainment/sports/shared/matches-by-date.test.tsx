// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { matchDays } from "@/lib/sports/match-days";
import type { Match, MatchStatus, Team } from "@/types/sports";

import { MatchesByDate, openingDayIndex } from "./matches-by-date";
import { SportShell } from "./sport-shell";
import { SportsTodayProvider } from "./time-zone-context";

const TODAY = "2026-10-18";
const ZONE = "America/Costa_Rica";

const teams = new Map<string, Team>([
  ["rma", { id: "rma", name: "Real Madrid", shortName: "Real Madrid", code: "RMA" }],
  ["bar", { id: "bar", name: "Barcelona", shortName: "Barcelona", code: "BAR" }],
]);

const match = (id: string, kickoff: string, status: MatchStatus): Match => {
  const played = status === "ft" || status === "aet" || status === "pen";
  return {
    id,
    homeTeamId: "rma",
    awayTeamId: "bar",
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

/** The list on an Overview tab of a sport shell, whose bar holds its filter. */
function renderList(matches: Match[]): ReturnType<typeof render> {
  return render(
    <ReaderTimeZoneProvider timeZone={ZONE}>
      <SportsTodayProvider today={TODAY}>
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
      </SportsTodayProvider>
    </ReaderTimeZoneProvider>
  );
}

const shownDays = (container: HTMLElement): (string | null)[] =>
  [...container.querySelectorAll("[data-day]")].map((el) => el.getAttribute("data-day"));

const earlierButton = (): HTMLElement | null =>
  screen.queryByRole("button", { name: /Earlier results/ });

const teamFilter = (): HTMLElement | null => screen.queryByRole("combobox", { name: "Filter by team" });

/** The sticky row the tablist sits in (through its sideways scroller). */
const sportBar = (): HTMLElement => screen.getByRole("tablist").closest<HTMLElement>(".sticky")!;

// jsdom has neither; the tests that need them lend them.
const { scrollIntoView, hasPointerCapture } = Element.prototype;

/** Radix's Select asks for pointer capture and scrolls its options into view. */
function pickTeam(name: RegExp): void {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  fireEvent.keyDown(teamFilter()!, { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name }));
}

afterEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
  Element.prototype.hasPointerCapture = hasPointerCapture;
  vi.restoreAllMocks();
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
  it("opens on the freshest results and keeps the days before behind Earlier", () => {
    const { container } = renderList(season);
    expect(shownDays(container)).toEqual(["2026-10-17", "2026-10-18", "2026-10-21"]);
    expect(earlierButton()).toHaveAccessibleName("Earlier results, 2 days");
    expect(earlierButton()).toHaveTextContent(/^Earlier$/);
    expect(screen.getByText(/^Today · /)).toBeInTheDocument();
  });

  it("puts Earlier on the first day's heading line, not on a row of its own", () => {
    const { container } = renderList(season);
    const heading = container.querySelector('[data-day="2026-10-17"]')!.firstElementChild!;
    expect(heading).toContainElement(earlierButton());
    expect(heading).toHaveTextContent(/^Saturday, October 17, 2026Earlier$/);
  });

  it("opens on a day heading: no label row above the first day", () => {
    const { container } = renderList(season);
    const list = container.querySelector("[data-day]")!.parentElement!;
    expect(list.parentElement!.firstElementChild).toBe(list);
    expect(screen.queryByText("Matches")).toBeNull();
  });

  it("reveals the earlier days and moves focus to the newest of them", () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    const { container } = renderList(season);

    fireEvent.click(earlierButton()!);

    expect(shownDays(container)).toEqual([
      "2026-10-10",
      "2026-10-14",
      "2026-10-17",
      "2026-10-18",
      "2026-10-21",
    ]);
    expect(earlierButton()).toBeNull();
    const newest = container.querySelector('[data-day="2026-10-14"]');
    expect(document.activeElement).toBe(newest);
    expect(scrolled).toHaveBeenCalledWith({ block: "start" });
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
    expect(within(sportBar()).queryByRole("combobox")).toBeNull();
  });

  it("opens another team's fixtures on its freshest results again, its crest in the bar", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = renderList(season);
    fireEvent.click(earlierButton()!);
    expect(shownDays(container)).toHaveLength(5);

    pickTeam(/Barcelona/);

    expect(shownDays(container)).toEqual(["2026-10-17", "2026-10-18", "2026-10-21"]);
    expect(earlierButton()).toHaveAccessibleName("Earlier results, 2 days");
    expect(teamFilter()).toHaveTextContent("Barcelona");
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

    const first = container.querySelector("[data-day]");
    expect(scrolled).toHaveBeenCalledTimes(1);
    expect(scrolled.mock.contexts[0]).toBe(first);
    expect(scrolled).toHaveBeenCalledWith({ block: "start" });
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

    expect(scrolled).not.toHaveBeenCalled();
  });

  it("says one day in the singular", () => {
    renderList(season.slice(1));
    expect(earlierButton()).toHaveAccessibleName("Earlier results, 1 day");
  });

  it("shows every day, and no Earlier, before the first result", () => {
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
