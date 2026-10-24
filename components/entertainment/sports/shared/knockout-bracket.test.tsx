// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import type { BracketMatch, BracketRound, Team } from "@/types/sports";

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

function renderBracket(list: BracketRound[] = rounds): HTMLElement {
  const { container } = render(
    <ReaderTimeZoneProvider timeZone="America/Costa_Rica">
      <KnockoutBracket rounds={list} teams={teams} />
    </ReaderTimeZoneProvider>
  );
  return container;
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
  viewport.getBoundingClientRect = () => ({ left: 0 }) as DOMRect;
  all.forEach((column, i) => {
    column.getBoundingClientRect = () => ({ left: i * 200 - viewport.scrollLeft }) as DOMRect;
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

  it("puts the third-place match under the final", () => {
    const withThird: BracketRound[] = [
      ...rounds,
      { id: "third-place", label: "Third place", matches: [{ id: "tp", homeTeamId: "t1", awayTeamId: "t2" }] },
    ];
    const all = columns(renderBracket(withThird));
    expect(all).toHaveLength(11);
    expect(all[5].textContent).toContain("Third place");
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
    expect(button("Left end of the bracket")).toBeDisabled();
    expect(button("Scroll left")).toBeDisabled();

    fireEvent.click(button("Right end of the bracket"));
    expect(viewport.scrollLeft).toBe(1800);
    expect(button("Right end of the bracket")).toBeDisabled();
    expect(button("Scroll right")).toBeDisabled();

    fireEvent.click(button("Scroll left"));
    expect(viewport.scrollLeft).toBe(1600);

    fireEvent.click(button("Left end of the bracket"));
    expect(viewport.scrollLeft).toBe(0);
    fireEvent.click(button("Scroll right"));
    expect(viewport.scrollLeft).toBe(200);
    expect(scrollTo).toHaveBeenCalledTimes(4);
  });
});
