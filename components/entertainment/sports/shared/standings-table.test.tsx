// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Standing, StandingBand, Team } from "@/types/sports";

import { StandingsTable } from "./standings-table";

const CLUBS = [
  "Real Madrid",
  "Barcelona",
  "Atlético",
  "Girona",
  "Athletic",
  "Betis",
  "Sevilla",
  "Villarreal",
  "Valencia",
  "Getafe",
  "Cádiz",
  "Almería",
];

const TEAMS = new Map<string, Team>(
  CLUBS.map((name, i) => [`t${i + 1}`, { id: `t${i + 1}`, name, shortName: name, code: name.slice(0, 3) }])
);

const row = (position: number, band: StandingBand = null): Standing => ({
  position,
  teamId: `t${position}`,
  played: 30,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 40 - position,
  goalsAgainst: 30,
  points: 80 - position,
  band,
});

const positionCell = (position: number): HTMLElement =>
  within(screen.getAllByRole("row")[position]).getAllByRole("cell")[0];

const key = (): (string | null)[] =>
  within(screen.getByRole("list", { name: "Key" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);

describe("StandingsTable", () => {
  it("is named, its abbreviated headers spelled out, and every row read by its club", () => {
    render(
      <StandingsTable standings={[row(1), row(2)]} teams={TEAMS} competition="la-liga" label="La Liga" />
    );
    const table = screen.getByRole("table", { name: "La Liga" });

    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual(["#", "Club", "MP", "GD", "Pts"]);
    ["Position", "Club", "Matches played", "Goal difference", "Points"].forEach((name, i) =>
      expect(headers[i]).toHaveAccessibleName(name)
    );

    const clubs = within(table).getAllByRole("rowheader");
    expect(clubs).toHaveLength(2);
    expect(clubs[0]).toHaveAccessibleName("Real Madrid");
    expect(clubs[1]).toHaveAccessibleName("Barcelona");
  });

  it("names each row's zone in its position cell, and keys the colours under the table", () => {
    render(
      <StandingsTable
        standings={[row(1, "champions"), row(2, "europa"), row(3, "conference"), row(4), row(5, "relegation")]}
        teams={TEAMS}
        competition="la-liga"
      />
    );
    expect(positionCell(1)).toHaveTextContent("1, Champions League");
    expect(positionCell(2)).toHaveTextContent("2, Europa League");
    expect(positionCell(4)).toHaveTextContent(/^4$/);
    expect(positionCell(5)).toHaveTextContent("5, Relegation");
    expect(key()).toEqual(["Champions League", "Europa League", "Conference League", "Relegation"]);
  });

  it("names a band by where it leads in that competition", () => {
    const { unmount } = render(
      <StandingsTable
        standings={[row(1, "champions"), row(2, "champions"), row(3, "playoff"), row(4)]}
        teams={TEAMS}
        competition="world-cup"
      />
    );
    expect(positionCell(1)).toHaveTextContent("1, Round of 32");
    expect(key()).toEqual(["Round of 32", "Best third places"]);
    unmount();

    render(
      <StandingsTable
        standings={[row(1, "champions"), row(2, "playoff")]}
        teams={TEAMS}
        competition="uefa-champions-league"
      />
    );
    expect(key()).toEqual(["Round of 16", "Knockout play-off"]);
  });

  it("keys only the zones of the rows on show", () => {
    const standings = CLUBS.map((_, i) => row(i + 1, i === 0 ? "champions" : i >= 10 ? "relegation" : null));
    render(<StandingsTable standings={standings} teams={TEAMS} competition="la-liga" />);
    expect(key()).toEqual(["Champions League"]);

    fireEvent.click(screen.getByRole("button", { name: "Show 2 more" }));
    expect(key()).toEqual(["Champions League", "Relegation"]);
  });

  it("has no key for a table without zones", () => {
    render(<StandingsTable standings={[row(1), row(2)]} teams={TEAMS} competition="la-liga" />);
    expect(screen.queryByRole("list")).toBeNull();
  });
});
