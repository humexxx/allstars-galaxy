// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import type { Match, Team } from "@/types/sports";

import { MatchesByDate } from "./matches-by-date";
import { OverviewSplit } from "./overview-split";
import { SportsTodayProvider } from "./time-zone-context";

const TEAMS = new Map<string, Team>([
  ["rma", { id: "rma", name: "Real Madrid", shortName: "Real Madrid", code: "RMA" }],
  ["bar", { id: "bar", name: "Barcelona", shortName: "Barcelona", code: "BAR" }],
]);

const MATCH: Match = {
  id: "clasico",
  homeTeamId: "rma",
  awayTeamId: "bar",
  homeScore: 2,
  awayScore: 1,
  kickoff: "2026-10-17T20:00:00Z",
  status: "ft",
};

const VIEW = 800;
const STUCK_AT = 48;

/**
 * jsdom has no layout: stage a sticky section `height` tall in a viewport
 * `VIEW` high, nothing between them scrolling.
 */
function stage(height: number): void {
  const real = window.getComputedStyle;
  vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
    const style = real(el, pseudo);
    if (el instanceof HTMLElement && el.tagName === "SECTION") {
      return { ...style, position: "sticky", top: `${STUCK_AT}px` } as CSSStyleDeclaration;
    }
    return style;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(height);
  vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(VIEW);
}

const tableSection = (): HTMLElement => screen.getByText("Standings").closest("section")!;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OverviewSplit", () => {
  it("sticks the table by its top right under the sport bar, as the day headings do", () => {
    stage(VIEW - STUCK_AT - 40);
    render(<OverviewSplit matches={<div>Games</div>} table={<div>Rows</div>} tableLabel="Standings" />);
    expect(tableSection()).toHaveClass("@4xl:sticky", "@4xl:top-12");
    expect(tableSection()).not.toHaveClass("@4xl:bottom-6");
  });

  it("sticks a table taller than the room by its foot, so its last rows stay reachable", () => {
    stage(VIEW);
    render(<OverviewSplit matches={<div>Games</div>} table={<div>Rows</div>} tableLabel="Standings" />);
    expect(tableSection()).toHaveClass("@4xl:sticky", "@4xl:bottom-6", "@4xl:self-end");
    expect(tableSection()).not.toHaveClass("@4xl:top-12");
  });

  it("opens the table on a line set like a day heading, so the two cards start level", () => {
    const { container } = render(
      <ReaderTimeZoneProvider timeZone="UTC">
        <SportsTodayProvider today="2026-10-18">
          <OverviewSplit
            matches={<MatchesByDate matches={[MATCH]} teams={TEAMS} />}
            table={<div>Rows</div>}
            tableLabel="Standings"
          />
        </SportsTodayProvider>
      </ReaderTimeZoneProvider>
    );
    const day = container.querySelector<HTMLElement>("[data-day]")!;
    const heading = day.firstElementChild!;
    const label = screen.getByText("Standings");

    // Both columns open on the list, not a label row above it.
    expect(day.parentElement!.parentElement!.firstElementChild).toBe(day.parentElement);
    expect(tableSection().firstElementChild).toBe(label);
    for (const cls of ["text-2xs", "py-1"]) {
      expect(heading).toHaveClass(cls);
      expect(label).toHaveClass(cls);
    }
    expect(day).toHaveClass("gap-2");
    expect(tableSection()).toHaveClass("gap-2");
  });

  it("gives the matches the whole row without a table", () => {
    const { container } = render(<OverviewSplit matches={<div>Games</div>} table={false} />);
    expect(container.querySelector("section")).toBeNull();
    expect(container.firstElementChild).not.toHaveClass("@4xl:grid-cols-[2fr_1fr]");
  });
});
