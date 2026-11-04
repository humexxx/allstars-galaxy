// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./confetti", () => ({ burstConfetti: vi.fn() }));

import type { BracketMatch, Team } from "@/types/sports";

import { ChampionCard } from "./champion-card";
import { burstConfetti } from "./confetti";

const teams = new Map<string, Team>([
  ["arg", { id: "arg", name: "Argentina", shortName: "Argentina", code: "ARG" }],
  ["fra", { id: "fra", name: "France", shortName: "France", code: "FRA" }],
]);

const final: BracketMatch = {
  id: "final-1",
  homeTeamId: "fra",
  awayTeamId: "arg",
  homeScore: 1,
  awayScore: 2,
  winnerTeamId: "arg",
  date: "2026-07-19T19:00:00Z",
};

describe("ChampionCard", () => {
  it("names the champion and how the final went, from the champion's side", () => {
    render(<ChampionCard competition="FIFA World Cup 2026" championId="arg" final={final} teams={teams} />);
    expect(screen.getByText("Argentina")).toBeInTheDocument();
    expect(screen.getByText("FIFA World Cup 2026 champions")).toBeInTheDocument();
    expect(screen.getByText(/^Beat France 2–1 in the final/)).toBeInTheDocument();
  });

  it("tells a final settled on penalties by its draw and the shoot-out, the champion's tally first", () => {
    const shootOut = { ...final, homeScore: 1, awayScore: 1, penalties: { home: 3, away: 4 } };
    render(<ChampionCard competition="FIFA World Cup 2026" championId="arg" final={shootOut} teams={teams} />);
    expect(screen.getByText(/^Beat France 1–1, 4–3 on penalties, in the final/)).toBeInTheDocument();
  });

  it("says only that it won where the final has no score", () => {
    const unscored = { ...final, homeScore: null, awayScore: null, date: undefined };
    render(<ChampionCard competition="MSI 2026" championId="arg" final={unscored} teams={teams} />);
    expect(screen.getByText("Won the final")).toBeInTheDocument();
  });

  it("celebrates a champion once a visit, not on every return", () => {
    vi.mocked(burstConfetti).mockClear();
    const card = <ChampionCard competition="Copa 2026" championId="arg" final={final} teams={teams} />;
    const { unmount } = render(card);
    unmount();
    render(card);
    expect(burstConfetti).toHaveBeenCalledTimes(1);
  });
});
