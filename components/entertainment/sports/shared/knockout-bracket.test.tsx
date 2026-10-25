// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import type { BracketLink, BracketMatch, BracketRound, Team } from "@/types/sports";

import { KnockoutBracket } from "./knockout-bracket";

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

/**
 * jsdom lays nothing out: give the scroller and its columns a width, as a
 * card 400px wide around eleven 200px columns would.
 */
function layOut(container: HTMLElement): { viewport: HTMLElement; scrollTo: ReturnType<typeof vi.fn> } {
  const all = columns(container);
  const viewport = all[0].closest<HTMLElement>(".overflow-x-auto")!;
  const width = all.length * 200;
  Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 400 });
  Object.defineProperty(viewport, "scrollWidth", { configurable: true, value: width });
  all.forEach((column, i) => {
    Object.defineProperty(column, "offsetLeft", { configurable: true, value: i * 200 });
  });
  const scrollTo = vi.fn(({ left }: ScrollToOptions) => {
    viewport.scrollLeft = Math.max(0, Math.min(left ?? 0, width - 400));
    fireEvent.scroll(viewport);
  });
  viewport.scrollTo = scrollTo as unknown as HTMLElement["scrollTo"];
  fireEvent.scroll(viewport);
  return { viewport, scrollTo };
}

describe("KnockoutBracket", () => {
  it("draws the top half on the left, the final between, the bottom half mirrored on the right", () => {
    const container = renderBracket();
    const all = columns(container);
    expect(all.map(heading)).toEqual([
      "Round of 64",
      "Round of 32",
      "Round of 16",
      "Quarter-finals",
      "Semi-finals",
      "Final",
      "Semi-finals",
      "Quarter-finals",
      "Round of 16",
      "Round of 32",
      "Round of 64",
    ]);
    // Each half holds half of each round: the first column the draw's top 16 ties.
    expect(all[0].textContent).toContain("T0");
    expect(all[0].textContent).not.toContain("T32");
    expect(all[10].textContent).toContain("T32");
    expect(all[10].textContent).not.toContain("T0");
  });

  it("names each column's round, its half, and the round being played, its ties a list", () => {
    const container = renderBracket();
    const groups = screen.getAllByRole("group");
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual([
      "Round of 64, top half, being played",
      "Round of 32, top half",
      "Round of 16, top half",
      "Quarter-finals, top half",
      "Semi-finals, top half",
      "Final",
      "Semi-finals, bottom half",
      "Quarter-finals, bottom half",
      "Round of 16, bottom half",
      "Round of 32, bottom half",
      "Round of 64, bottom half, being played",
    ]);
    // The group names the round, so the label on screen is not read twice.
    expect(columns(container)[0].firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(within(groups[0]).getAllByRole("listitem")).toHaveLength(16);
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
    expect(all).toHaveLength(11);
    expect(all[5].textContent).toContain("Third place");
  });

  it("draws a double elimination one-sided, its own branches, the lower bracket captioned", () => {
    const m = (id: string, home: string, away: string, side: "upper" | "lower"): BracketMatch => ({
      id,
      homeTeamId: home,
      awayTeamId: away,
      winnerTeamId: home,
      side,
    });
    // Four rounds of even sizes that do not halve: no halves to split.
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
    const all = columns(container);
    expect(all.map(heading)).toEqual(["Round 1", "Round 2", "Round 3", "Final"]);
    expect(all[1].textContent).toContain("Lower bracket");
    expect(all[0].textContent).not.toContain("Lower bracket");
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

  it("has no buttons while the whole bracket fits", () => {
    renderBracket();
    expect(screen.queryByRole("button", { name: "Right end of the bracket" })).toBeNull();
  });

  it("goes straight to either end, and a column at a time", () => {
    const container = renderBracket();
    const { viewport, scrollTo } = layOut(container);
    const button = (name: string): HTMLElement => screen.getByRole("button", { name });

    // Day one opens on the first round: the left end.
    expect(button("Left end of the bracket")).toHaveAttribute("aria-disabled", "true");
    expect(button("Scroll left")).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(button("Right end of the bracket"));
    expect(viewport.scrollLeft).toBe(1800);
    expect(button("Right end of the bracket")).toHaveAttribute("aria-disabled", "true");
    expect(button("Scroll right")).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(button("Scroll left"));
    expect(viewport.scrollLeft).toBe(1600);

    fireEvent.click(button("Left end of the bracket"));
    expect(viewport.scrollLeft).toBe(0);
    fireEvent.click(button("Scroll right"));
    expect(viewport.scrollLeft).toBe(200);
    expect(scrollTo).toHaveBeenCalledTimes(4);
  });

  it("keeps the focus on a button that reaches its end, and does nothing more from there", () => {
    const { scrollTo } = layOut(renderBracket());
    const end = screen.getByRole("button", { name: "Right end of the bracket" });
    end.focus();
    fireEvent.click(end);
    // Disabled under focus, a button drops that focus to the page.
    expect(end).not.toBeDisabled();
    expect(end).toHaveFocus();
    expect(end).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(end);
    fireEvent.click(screen.getByRole("button", { name: "Scroll right" }));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("follows the reader's scrolling once a bracket that opened undrawn is drawn", () => {
    const undrawn = rounds.map((round) => ({
      ...round,
      matches: round.matches.map((m) => ({ ...m, homeTeamId: null, awayTeamId: null })),
    }));
    const { container, rerender } = render(bracket(undrawn));
    expect(screen.getByText("The bracket is not drawn yet")).toBeInTheDocument();

    rerender(bracket(rounds));
    const { viewport } = layOut(container);
    const button = (name: string): HTMLElement => screen.getByRole("button", { name });
    expect(button("Right end of the bracket")).toHaveAttribute("aria-disabled", "false");

    viewport.scrollLeft = 1800;
    fireEvent.scroll(viewport);
    expect(button("Right end of the bracket")).toHaveAttribute("aria-disabled", "true");
    expect(button("Left end of the bracket")).toHaveAttribute("aria-disabled", "false");
  });
});
