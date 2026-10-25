// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/sports", () => ({ setSportTeamFilterAction: vi.fn() }));

import { getFootballLeague } from "@/lib/data/sports/football";
import type { FootballLeagueId } from "@/types/sports";

import { FootballView } from "./football-view";

const OPTIONS = [
  { id: "uefa-champions-league", name: "UEFA Champions League" },
  { id: "la-liga", name: "La Liga" },
] as const;

function renderLeague(id: FootballLeagueId): void {
  render(<FootballView league={getFootballLeague(id)} options={OPTIONS} />);
}

const tabs = (): (string | null)[] => screen.getAllByRole("tab").map((t) => t.textContent);
const openTab = (): string | null => screen.getByRole("tab", { selected: true }).textContent;
const tableRows = (): number => within(screen.getByRole("table")).getAllByRole("row").length - 1;
const teamFilter = (): HTMLElement | null => screen.queryByRole("button", { name: /^Filter by team/ });
/** The sticky row the tablist sits in. */
const tabsRow = (): HTMLElement => screen.getByRole("tablist").closest<HTMLElement>(".sticky")!;

describe("FootballView", () => {
  it("has no Table tab: the whole table is on Overview, beside the matches", () => {
    renderLeague("la-liga");
    const league = getFootballLeague("la-liga");
    expect(tabs()).toEqual(["Overview"]);
    expect(openTab()).toBe("Overview");
    expect(screen.getByText("Table")).toBeInTheDocument();
    expect(tableRows()).toBe(league.standings.length);
    // The compact columns: #, club, MP, GD, Pts.
    expect(screen.getAllByRole("columnheader")).toHaveLength(5);
  });

  it("lists ten teams, and the rest on a tap", () => {
    renderLeague("uefa-champions-league");
    expect(tabs()).toEqual(["Overview", "Knockout"]);
    expect(openTab()).toBe("Knockout");

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Overview" }), { button: 0 });

    const teams = getFootballLeague("uefa-champions-league").standings.length;
    expect(teams).toBeGreaterThan(10);
    expect(tableRows()).toBe(10);
    fireEvent.click(screen.getByRole("button", { name: `Show ${teams - 10} more` }));
    expect(tableRows()).toBe(teams);
  });

  it("lets the matches fill the row while there is no table", () => {
    renderLeague("premier-league");
    expect(screen.queryByText("Table")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("keeps the League picker at the end of the tabs row, on every tab", () => {
    renderLeague("uefa-champions-league");
    const league = (): HTMLElement => screen.getByRole("combobox", { name: "League" });
    expect(openTab()).toBe("Knockout");
    expect(tabsRow()).toContainElement(league());
    expect(tabsRow().lastElementChild).toContainElement(league());
    expect(screen.getByRole("tabpanel")).not.toContainElement(league());

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Overview" }), { button: 0 });

    expect(tabsRow().lastElementChild).toContainElement(league());
  });

  it("puts the team filter on the first day's heading in Overview, and only there", () => {
    renderLeague("uefa-champions-league");
    expect(openTab()).toBe("Knockout");
    expect(teamFilter()).toBeNull();

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Overview" }), { button: 0 });

    const filter = teamFilter()!;
    expect(filter).toHaveAccessibleName("Filter by team: All teams");
    const panel = screen.getByRole("tabpanel");
    expect(panel).toContainElement(filter);
    expect(tabsRow()).not.toContainElement(filter);
    const firstDay = panel.querySelector("[data-day]")!;
    expect(firstDay.firstElementChild).toContainElement(filter);

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Knockout" }), { button: 0 });

    expect(teamFilter()).toBeNull();
  });

  it("is headed by the competition's name", () => {
    renderLeague("la-liga");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("La Liga");
  });

  it("has a News tab for a league with news, opening on it for ?tab=news", () => {
    render(
      <FootballView
        league={getFootballLeague("la-liga")}
        options={OPTIONS}
        news={[
          {
            id: "espn-1",
            headline: "El Clásico is served",
            description: null,
            href: "https://www.espn.com/soccer/story/_/id/1",
            external: true,
            image: null,
            at: "2026-10-24T10:00:00Z",
            kind: "story",
            about: ["Barcelona", "Real Madrid"],
          },
        ]}
        initialTab="news"
      />
    );
    expect(tabs()).toEqual(["Overview", "News"]);
    expect(openTab()).toBe("News");
    expect(screen.getByRole("heading", { name: "El Clásico is served" })).toBeInTheDocument();
  });
});
