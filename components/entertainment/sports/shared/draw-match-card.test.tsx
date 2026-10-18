// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DrawMatchCard, playerEntry } from "./draw-match-card";
import type { BracketMatch } from "@/types/sports";

const players = new Map([
  playerEntry("alcaraz", "C. Alcaraz", "🇪🇸", 2),
  playerEntry("sinner", "J. Sinner", "🇮🇹", 1),
]);

const final = {
  id: "f",
  homeTeamId: "alcaraz",
  awayTeamId: "sinner",
  winnerTeamId: "alcaraz",
  date: "2025-09-07",
  legs: [
    { homeScore: 6, awayScore: 2 },
    { homeScore: 3, awayScore: 6 },
    { homeScore: 6, awayScore: 1 },
    { homeScore: 6, awayScore: 4 },
  ],
} as BracketMatch;

describe("DrawMatchCard", () => {
  it("reads the date as a calendar day, not a UTC instant", () => {
    // `new Date("2025-09-07")` is UTC midnight, which anybody west of
    // Greenwich renders as the 6th. A match is played on a date.
    render(<DrawMatchCard match={final} teams={players} />);
    expect(screen.getByText(/Sep 7/)).toBeInTheDocument();
  });

  it("shows every set for both players", () => {
    render(<DrawMatchCard match={final} teams={players} />);
    // 6–2 3–6 6–1 6–4: three sixes for Alcaraz and one for Sinner. Counting
    // every single digit would also catch the seed numbers beside the names.
    expect(screen.getAllByText("6")).toHaveLength(4);
    expect(screen.getAllByText("4")).toHaveLength(1);
  });

  it("says who is still in it", () => {
    render(<DrawMatchCard match={final} teams={players} />);
    expect(screen.getByText("C. Alcaraz").className).toContain("font-semibold");
    expect(screen.getByText("J. Sinner").className).not.toContain("font-semibold");
  });

  it("renders an undecided tie without inventing a player", () => {
    render(
      <DrawMatchCard
        match={{ id: "x", homeTeamId: null, awayTeamId: null } as BracketMatch}
        teams={players}
      />
    );
    expect(screen.getAllByText("TBD")).toHaveLength(2);
  });
});
