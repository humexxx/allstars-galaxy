// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import type { BracketMatch, BracketRound, Team } from "@/types/sports";

import { KnockoutBracket } from "./knockout-bracket";

/** A Major's draw on day one: 64 to the final, nothing played. */
const SIZES = [32, 16, 8, 4, 2, 1];
const LABELS = ["Round of 64", "Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "Final"];
const IDS = ["round-of-64", "round-of-32", "round-of-16", "quarter-final", "semi-final", "final"] as const;

const teams = new Map<string, Team>(
  Array.from({ length: 64 }, (_, i) => [`t${i}`, { id: `t${i}`, name: `Team ${i}`, shortName: `T${i}`, code: "" }])
);
const rounds: BracketRound[] = SIZES.map((size, r) => ({
  id: IDS[r],
  label: LABELS[r],
  matches: Array.from(
    { length: size },
    (_, i): BracketMatch => ({
      id: `${r}-${i}`,
      homeTeamId: r === 0 ? `t${i * 2}` : null,
      awayTeamId: r === 0 ? `t${i * 2 + 1}` : null,
    })
  ),
}));

function renderBracket(): void {
  render(
    <ReaderTimeZoneProvider timeZone="America/Costa_Rica">
      <KnockoutBracket rounds={rounds} teams={teams} />
    </ReaderTimeZoneProvider>
  );
}

const shown = (): string | null =>
  screen.getByText(/ – /, { selector: "span, p, div" }).textContent;

describe("KnockoutBracket", () => {
  it("goes straight to the rounds that end in the final, and back to the first", () => {
    renderBracket();
    expect(shown()).toBe("Round of 64 – Quarter-finals");
    expect(screen.getByRole("button", { name: "First round" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "To the final" }));
    expect(shown()).toBe("Round of 16 – Final");
    expect(screen.getByRole("button", { name: "To the final" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Later rounds" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "First round" }));
    expect(shown()).toBe("Round of 64 – Quarter-finals");
  });

  it("still steps a round at a time", () => {
    renderBracket();
    fireEvent.click(screen.getByRole("button", { name: "Later rounds" }));
    expect(shown()).toBe("Round of 32 – Semi-finals");
    fireEvent.click(screen.getByRole("button", { name: "Earlier rounds" }));
    expect(shown()).toBe("Round of 64 – Quarter-finals");
  });
});
