// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import type { BracketLink, BracketMatch, BracketRound, Team } from "@/types/sports";

import { KnockoutBracket, shortRoundLabel } from "./knockout-bracket";

/** A Major's draw on day one: 64 to the final, nothing played. */
const SIZES = [32, 16, 8, 4, 2, 1];
const LABELS = ["Round of 64", "Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "Final"];
const IDS = ["round-of-64", "round-of-32", "round-of-16", "quarter-final", "semi-final", "final"] as const;

const teams = new Map<string, Team>(
  Array.from({ length: 64 }, (_, i) => [`t${i}`, { id: `t${i}`, name: `Team ${i}`, shortName: `T${i}`, code: `T${i}` }])
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

function bracket(list: BracketRound[], links?: BracketLink[]): React.ReactElement {
  return (
    <ReaderTimeZoneProvider timeZone="America/Costa_Rica">
      <KnockoutBracket rounds={list} teams={teams} links={links} />
    </ReaderTimeZoneProvider>
  );
}

function renderBracket(list: BracketRound[] = rounds, links?: BracketLink[]): HTMLElement {
  return render(bracket(list, links)).container;
}

const columns = (container: HTMLElement): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>("[data-column]"),
];
const heading = (column: HTMLElement): string | null => column.firstElementChild?.textContent ?? null;
const ties = (column: HTMLElement): number => within(column).getAllByRole("listitem").length;

/** A sideways swipe across the bracket, as a finger on a phone makes it. */
function swipe(container: HTMLElement, dx: number, dy = 0): void {
  const surface = columns(container)[0].closest<HTMLElement>("[class*=bracket-column]")!;
  fireEvent.touchStart(surface, { touches: [{ clientX: 200, clientY: 100 }] });
  fireEvent.touchEnd(surface, { changedTouches: [{ clientX: 200 + dx, clientY: 100 + dy }] });
}

describe("KnockoutBracket", () => {
  it("opens on the round being played, one-sided, with the rounds after it", () => {
    const container = renderBracket();
    expect(columns(container).map(heading)).toEqual([
      "Round of 64",
      "Round of 32",
      "Round of 16",
      "Quarter-finals",
      "Semi-finals",
      "Final",
    ]);
  });

  it("names each column's round and the round being played, its ties a list", () => {
    const container = renderBracket();
    expect(columns(container).map((column) => column.getAttribute("aria-label"))).toEqual([
      "Round of 64, being played",
      "Round of 32",
      "Round of 16",
      "Quarter-finals",
      "Semi-finals",
      "Final",
    ]);
    // The group names the round, so the label on screen is not read twice.
    expect(columns(container)[0].firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("radio", { name: "Round of 64, being played" })).toHaveAttribute("data-state", "on");
  });

  it("moves the focus with the round tabs, putting the rounds before it away", () => {
    const container = renderBracket();
    fireEvent.click(screen.getByRole("radio", { name: "Quarter-finals" }));
    const all = columns(container);
    expect(all.map(heading)).toEqual(["Quarter-finals", "Semi-finals", "Final"]);
    expect(all.map(ties)).toEqual([4, 2, 1]);
  });

  it("shows a round of more than eight ties a section at a time, each with its way to the final", () => {
    const container = renderBracket();
    // 32 ties: four sections of eight, and each section's share of every round after.
    expect(within(screen.getByRole("group", { name: "Section of the draw" })).getAllByRole("radio")).toHaveLength(4);
    expect(columns(container).map(ties)).toEqual([8, 4, 2, 1, 1, 1]);
    expect(columns(container)[0].textContent).toContain("T0");
    expect(columns(container)[0].textContent).not.toContain("T16");

    fireEvent.click(screen.getByRole("radio", { name: "Section 4 of 4" }));
    expect(columns(container)[0].textContent).toContain("T48");
    expect(columns(container)[0].textContent).not.toContain("T0");
    expect(columns(container).map(ties)).toEqual([8, 4, 2, 1, 1, 1]);
  });

  it("keeps the same part of the draw when the focus moves on a round", () => {
    renderBracket();
    fireEvent.click(screen.getByRole("radio", { name: "Section 4 of 4" }));
    // The last quarter of the round of 64 feeds the bottom half of the round of 32.
    fireEvent.click(screen.getByRole("radio", { name: "Round of 32" }));
    expect(screen.getByRole("radio", { name: "Bottom half" })).toHaveAttribute("data-state", "on");
  });

  it("goes on a round with a swipe to the left and back with one to the right, not with a scroll down", () => {
    const container = renderBracket();
    swipe(container, -120);
    expect(heading(columns(container)[0])).toBe("Round of 32");
    swipe(container, 120);
    expect(heading(columns(container)[0])).toBe("Round of 64");
    // Too short, or more down than across: the page scrolling, not a swipe.
    swipe(container, -30);
    swipe(container, -80, 200);
    expect(heading(columns(container)[0])).toBe("Round of 64");
    // Nothing before the first round.
    swipe(container, 120);
    expect(heading(columns(container)[0])).toBe("Round of 64");
  });

  it("opens a decided bracket on its last eight", () => {
    const decided = rounds.map((round) => ({
      ...round,
      matches: round.matches.map((m) => ({ ...m, homeTeamId: "t0", awayTeamId: "t1", winnerTeamId: "t0" })),
    }));
    expect(columns(renderBracket(decided)).map(heading)).toEqual(["Quarter-finals", "Semi-finals", "Final"]);
  });

  it("says no round is being played once every tie is decided", () => {
    const decided: BracketRound[] = [
      {
        id: "semi-final",
        label: "Semi-finals",
        matches: [
          { id: "s0", homeTeamId: "t0", awayTeamId: "t1", winnerTeamId: "t0" },
          { id: "s1", homeTeamId: "t2", awayTeamId: "t3", winnerTeamId: "t3" },
        ],
      },
      { id: "final", label: "Final", matches: [{ id: "f", homeTeamId: "t0", awayTeamId: "t3", winnerTeamId: "t3" }] },
    ];
    renderBracket(decided);
    for (const group of screen.getAllByRole("group")) expect(group).not.toHaveAccessibleName(/being played/);
  });

  it("opens a tie's details on a click or a tap, and says who went through", () => {
    // Level on aggregate, settled on penalties: only the details have the legs.
    const tie: BracketRound[] = [
      {
        id: "final",
        label: "Final",
        matches: [
          {
            id: "f",
            homeTeamId: "t0",
            awayTeamId: "t1",
            winnerTeamId: "t1",
            aggregateHome: 2,
            aggregateAway: 2,
            legs: [
              { homeScore: 1, awayScore: 1, date: "2026-05-02T19:00:00Z" },
              { homeScore: 1, awayScore: 1, date: "2026-05-09T19:00:00Z" },
            ],
          },
        ],
      },
    ];
    renderBracket(tie);
    const box = screen.getByRole("button", { name: /T1, won/ });
    expect(box).not.toHaveAccessibleName(/T0, won/);
    // The box's small print says "L1", "L2"; a listener hears the legs.
    expect(box).toHaveAccessibleName(/Leg 1 .+ · Leg 2 /);
    expect(box).not.toHaveAccessibleName(/L1/);
    fireEvent.click(box);
    const details = screen.getByRole("dialog", { name: "Match details" });
    expect(details).toHaveTextContent("T0 2–2 T1");
    expect(details).toHaveTextContent(/Leg 1 · .+ · 1–1/);
    expect(details).toHaveTextContent(/Leg 2 · .+ · 1–1/);

    // Tab from the details closes them, back on the box, not off the bracket.
    fireEvent.keyDown(details, { key: "Tab" });
    expect(screen.queryByRole("dialog", { name: "Match details" })).toBeNull();
    expect(box).toHaveAttribute("aria-expanded", "false");
  });

  it("puts the third-place match under the final", () => {
    const withThird: BracketRound[] = [
      ...rounds,
      { id: "third-place", label: "Third place", matches: [{ id: "tp", homeTeamId: "t1", awayTeamId: "t2" }] },
    ];
    const all = columns(renderBracket(withThird));
    expect(all).toHaveLength(6);
    expect(all[5].textContent).toContain("Third place");
    // Not a round of its own to move to.
    expect(screen.queryByRole("radio", { name: "Third place" })).toBeNull();
  });

  it("draws a double elimination with its own branches, the lower bracket captioned", () => {
    const m = (id: string, home: string, away: string, side: "upper" | "lower"): BracketMatch => ({
      id,
      homeTeamId: home,
      awayTeamId: away,
      winnerTeamId: home,
      side,
    });
    // Four rounds of even sizes that do not halve: no sections to cut.
    const doubleElimination: BracketRound[] = [
      { id: "round-1", label: "Round 1", matches: [m("a", "t0", "t1", "upper"), m("b", "t2", "t3", "upper")] },
      { id: "round-2", label: "Round 2", matches: [m("c", "t0", "t2", "upper"), m("d", "t1", "t3", "lower")] },
      { id: "round-3", label: "Round 3", matches: [m("e", "t2", "t1", "lower")] },
      { id: "round-4", label: "Final", matches: [m("f", "t0", "t2", "upper")] },
    ];
    const container = renderBracket(doubleElimination, [
      { from: "a", to: "c" },
      { from: "b", to: "c" },
      { from: "d", to: "e" },
      { from: "c", to: "f" },
      { from: "e", to: "f" },
    ]);
    fireEvent.click(screen.getByRole("radio", { name: "Round 1" }));
    const all = columns(container);
    expect(all.map(heading)).toEqual(["Round 1", "Round 2", "Round 3", "Final"]);
    expect(all[1].textContent).toContain("Lower bracket");
    expect(all[0].textContent).not.toContain("Lower bracket");
    expect(screen.queryByRole("group", { name: "Section of the draw" })).toBeNull();
  });

  it("splits no even-sized rounds that do not halve past the first, given no branches", () => {
    const tie = (id: string, home: string | null, away: string | null): BracketMatch => ({
      id,
      homeTeamId: home,
      awayTeamId: away,
    });
    // A league's double elimination by its schedule's blocks: 4, 2, 2, 1.
    const even: BracketRound[] = [
      { id: "round-1", label: "Round 1", matches: [tie("a", "t0", "t1"), tie("b", "t2", "t3"), tie("c", "t4", "t5"), tie("d", "t6", "t7")] },
      { id: "round-2", label: "Upper final", matches: [tie("e", "t0", "t2"), tie("g", "t4", "t6")] },
      { id: "round-3", label: "Lower final", matches: [tie("h", "t1", "t3"), tie("i", "t5", "t7")] },
      { id: "final", label: "Final", matches: [tie("f", null, null)] },
    ];
    expect(columns(renderBracket(even)).map(heading)).toEqual(["Round 1", "Upper final", "Lower final", "Final"]);
  });

  it("opens on the round being played once a bracket that opened undrawn is drawn", () => {
    const undrawn = rounds.map((round) => ({
      ...round,
      matches: round.matches.map((m) => ({ ...m, homeTeamId: null, awayTeamId: null })),
    }));
    const { container, rerender } = render(bracket(undrawn));
    expect(screen.getByText("The bracket is not drawn yet")).toBeInTheDocument();

    rerender(bracket(rounds));
    expect(heading(columns(container)[0])).toBe("Round of 64");
  });
});

describe("shortRoundLabel", () => {
  it("shortens the rounds every sport names alike, and leaves the rest", () => {
    expect(
      ["Round 1", "Round of 16", "First Round", "Quarter-finals", "Quarterfinals", "Semi-finals", "Final", "Wild Card"].map(
        shortRoundLabel
      )
    ).toEqual(["R1", "R16", "R1", "QF", "QF", "SF", "Final", "Wild Card"]);
  });
});
