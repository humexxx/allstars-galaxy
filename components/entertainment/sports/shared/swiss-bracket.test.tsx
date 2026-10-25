// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import type { SwissMatch, SwissStage, Team } from "@/types/sports";

import { SwissBracket } from "./swiss-bracket";

const teams = new Map<string, Team>(
  Array.from({ length: 4 }, (_, i) => [`t${i}`, { id: `t${i}`, name: `Team ${i}`, shortName: `T${i}`, code: `T${i}` }])
);

const match = (id: string, home: string, away: string, rest: Partial<SwissMatch>): SwissMatch => ({
  id,
  homeTeamId: home,
  awayTeamId: away,
  status: "scheduled",
  bestOf: 3,
  ...rest,
});

/** Four teams, two wins through and two losses out, a round under way. */
const stage: SwissStage = {
  winsToAdvance: 2,
  lossesToExit: 2,
  rounds: [
    [
      {
        wins: 0,
        losses: 0,
        matches: [
          match("a", "t0", "t1", { status: "ft", homeScore: 2, awayScore: 0, winnerTeamId: "t0" }),
          match("b", "t2", "t3", { status: "live", homeScore: 1, awayScore: 0 }),
        ],
      },
    ],
    [
      { wins: 1, losses: 0, matches: [match("c", "t0", "t2", { status: "postponed" })] },
      { wins: 0, losses: 1, matches: [match("d", "t1", "t3", {})] },
    ],
    [{ wins: 1, losses: 1, matches: [] }],
  ],
  exits: [
    { wins: 2, losses: 0, advanced: true, slots: 1, teamIds: [] },
    { wins: 0, losses: 2, advanced: false, slots: 1, teamIds: [] },
    { wins: 2, losses: 1, advanced: true, slots: 1, teamIds: [] },
    { wins: 1, losses: 2, advanced: false, slots: 1, teamIds: [] },
  ],
};

function renderStage(): void {
  render(
    <ReaderTimeZoneProvider timeZone="America/Costa_Rica">
      <SwissBracket stage={stage} teams={teams} />
    </ReaderTimeZoneProvider>
  );
}

describe("SwissBracket", () => {
  it("groups each pool and exit by its record in words, without a landmark apiece", () => {
    renderStage();
    expect(screen.queryAllByRole("region")).toHaveLength(0);
    for (const name of ["0 wins, 0 losses", "1 win, 0 losses", "1 win, 1 loss"]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("group", { name: "2 wins, 0 losses, through" })).toHaveTextContent("Through");
    expect(screen.getByRole("group", { name: "0 wins, 2 losses, eliminated" })).toHaveTextContent("Out");
  });

  it("names each round's column, and the one being played", () => {
    renderStage();
    for (const name of ["Round 1, being played", "Round 2", "Round 3", "Result"]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
  });

  it("says a match is live in words, not only by its dot", () => {
    renderStage();
    const pool = screen.getByRole("group", { name: "0 wins, 0 losses" });
    const [played, live] = within(pool).getAllByRole("button");
    expect(live).toHaveTextContent(/T2.*, live/);
    expect(played).not.toHaveTextContent(/live/);
  });

  it("says who won a match, not only in bold", () => {
    renderStage();
    const [played] = within(screen.getByRole("group", { name: "0 wins, 0 losses" })).getAllByRole("button");
    expect(played).toHaveTextContent(/T0, won/);
    expect(played).not.toHaveTextContent(/T1, won/);
  });

  it("spells a pool's best-of out for a screen reader", () => {
    renderStage();
    const pool = screen.getByRole("group", { name: "1 win, 0 losses" });
    expect(within(pool).getByText("Best of 3")).toHaveClass("sr-only");
    expect(within(pool).getByText("BO3")).toHaveAttribute("aria-hidden", "true");
  });

  it("opens a match's status on a click or a tap", () => {
    renderStage();
    fireEvent.click(within(screen.getByRole("group", { name: "1 win, 0 losses" })).getByRole("button"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Best of 3 · Postponed");
  });
});
