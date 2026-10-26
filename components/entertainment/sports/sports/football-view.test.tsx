// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/sports", () => ({ setSportTeamFilterAction: vi.fn() }));

import { getFootballLeague } from "@/lib/data/sports/football";
import type { BracketRound, FootballLeagueId } from "@/types/sports";

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

  it("heads the table at level 2, names it after the league, and keys its zones", () => {
    renderLeague("la-liga");
    expect(screen.getByRole("heading", { level: 2, name: "Table" })).toBeInTheDocument();
    const { league, standings } = getFootballLeague("la-liga");
    const table = screen.getByRole("table", { name: league.name });
    expect(within(table).getAllByRole("rowheader")).toHaveLength(standings.length);
    const key = screen.getByRole("list", { name: "Key" });
    expect(within(key).getByText("Champions League")).toBeInTheDocument();
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

  it("switches competition from its title, a menu of every league on offer", () => {
    renderLeague("uefa-champions-league");
    const title = within(screen.getByRole("heading", { level: 1 })).getByRole("button", {
      name: "UEFA Champions League",
    });
    expect(within(tabsRow()).queryByRole("combobox")).toBeNull();

    // Radix opens its menu on pointerdown, which jsdom's clicks lack; Enter opens it too.
    fireEvent.keyDown(title, { key: "Enter" });
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitemradio").map((l) => l.textContent)).toContain("La Liga");
    expect(within(menu).getByRole("menuitemradio", { checked: true })).toHaveTextContent(
      "UEFA Champions League"
    );
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

  it("shows MLS one conference at a time, East first, with its play-off zones", () => {
    renderLeague("mls");
    const toggle = screen.getByRole("group", { name: "Conference" });
    expect(within(toggle).getAllByRole("radio").map((r) => r.textContent)).toEqual(["East", "West"]);
    const east = screen.getByRole("table", { name: "Major League Soccer, East" });
    expect(within(east).getAllByRole("rowheader")[0]).toHaveTextContent("Nashville");
    const key = screen.getByRole("list", { name: "Key" });
    expect(within(key).getAllByRole("listitem").map((i) => i.textContent)).toEqual(["Round One", "Wild card"]);

    fireEvent.click(screen.getByRole("radio", { name: "West" }));

    expect(screen.queryByRole("table", { name: "Major League Soccer, East" })).toBeNull();
    const west = screen.getByRole("table", { name: "Major League Soccer, West" });
    expect(within(west).getAllByRole("rowheader")[0]).toHaveTextContent("Vancouver");
  });

  it("keeps the Knockout tab locked until the play-offs are drawn", () => {
    renderLeague("mls");
    expect(tabs()).toEqual(["Overview", "Knockout"]);
    expect(openTab()).toBe("Overview");
    expect(screen.getByRole("tab", { name: "Knockout" })).toBeDisabled();
  });

  it("opens on the play-offs once they are drawn", () => {
    const league = getFootballLeague("mls");
    const knockout: BracketRound[] = [
      {
        id: "semi-final",
        label: "Conference finals",
        matches: [
          { id: "mls-sf-0", homeTeamId: "nsh", awayTeamId: "mia", homeScore: 2, awayScore: 1, winnerTeamId: "nsh" },
          { id: "mls-sf-1", homeTeamId: "van", awayTeamId: "lafc", homeScore: 1, awayScore: 1, penalties: { home: 4, away: 3 }, winnerTeamId: "van" },
        ],
      },
      {
        id: "final",
        label: "MLS Cup",
        matches: [{ id: "mls-final", homeTeamId: "nsh", awayTeamId: "van", homeScore: null, awayScore: null, winnerTeamId: null }],
      },
    ];
    render(<FootballView league={{ ...league, knockout }} options={OPTIONS} />);
    expect(openTab()).toBe("Knockout");
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("MLS Cup")).toBeInTheDocument();
    // A side each: the East's conference final on the left, the West's on the right.
    expect(within(panel).getAllByText("Conference finals")).toHaveLength(2);
  });

  it("gives Costa Rica one table, its top four into the semi-finals", () => {
    renderLeague("costa-rica");
    expect(screen.queryByRole("group", { name: "Conference" })).toBeNull();
    const { league, standings } = getFootballLeague("costa-rica");
    const table = screen.getByRole("table", { name: league.name });
    expect(within(table).getAllByRole("rowheader")).toHaveLength(standings.length);
    expect(within(screen.getByRole("list", { name: "Key" })).getByText("Semi-finals")).toBeInTheDocument();
  });
});
