// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Match, Team } from "@/types/sports";

import { ScoreCard } from "./score-card";

const teams = new Map<string, Team>([
  ["germany", { id: "germany", name: "Germany", shortName: "Germany", code: "GER" }],
  ["paraguay", { id: "paraguay", name: "Paraguay", shortName: "Paraguay", code: "PAR" }],
]);

const shootout: Match = {
  id: "m-1",
  homeTeamId: "germany",
  awayTeamId: "paraguay",
  homeScore: 1,
  awayScore: 1,
  penalties: { home: 3, away: 4 },
  kickoff: "2026-06-29T19:00:00Z",
  status: "pen",
  stageLabel: "Round of 32",
};

describe("ScoreCard", () => {
  it("prints a shoot-out beside the score, not inside it", () => {
    render(<ScoreCard match={shootout} teams={teams} />);
    expect(screen.getByText("PEN 3–4")).toBeInTheDocument();
    expect(screen.getAllByText("1")).toHaveLength(2);
  });

  it("marks the side that won the shoot-out", () => {
    render(<ScoreCard match={shootout} teams={teams} />);
    expect(screen.getByText("Paraguay")).toHaveClass("font-semibold");
    expect(screen.getByText("Germany")).not.toHaveClass("font-semibold");
  });
});
