// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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

  it("lists every team, not the top eight", () => {
    renderLeague("uefa-champions-league");
    expect(tabs()).toEqual(["Overview", "Knockout"]);
    expect(openTab()).toBe("Knockout");

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Overview" }), { button: 0 });

    expect(getFootballLeague("uefa-champions-league").standings.length).toBeGreaterThan(8);
    expect(tableRows()).toBe(getFootballLeague("uefa-champions-league").standings.length);
  });

  it("lets the matches fill the row while there is no table", () => {
    renderLeague("premier-league");
    expect(screen.queryByText("Table")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("is headed by the competition's name", () => {
    renderLeague("la-liga");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("La Liga");
  });
});
