// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/sports", () => ({ setSportTeamFilterAction: vi.fn() }));

import { NFL_DATA } from "@/lib/data/sports/nfl";

import { NflView } from "./nfl-view";

describe("NflView", () => {
  it("is headed by the league, and opens on Overview with the bracket locked", () => {
    render(<NflView data={{ ...NFL_DATA, playoffs: [] }} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("NFL");
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Overview");
    expect(screen.getByRole("tab", { name: "Playoffs" })).toBeDisabled();
  });

  it("puts the standings beside the games, in the shared split", () => {
    const { container } = render(<NflView data={{ ...NFL_DATA, playoffs: [] }} />);
    const standings = screen.getByText("Standings").closest("section")!;
    const games = container.querySelector("[data-day]")!.closest("section")!;

    expect(standings.parentElement).toBe(games.parentElement);
    expect(standings.parentElement).toHaveClass("@4xl:grid-cols-[2fr_1fr]");
    expect(standings).toHaveClass("@4xl:sticky");
    expect(within(standings).getByRole("group", { name: "Conference" })).toBeInTheDocument();
    expect(within(standings).getByRole("table")).toBeInTheDocument();
  });
});
