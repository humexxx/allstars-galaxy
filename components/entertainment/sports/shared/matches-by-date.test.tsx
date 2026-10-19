// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import { matchDays } from "@/lib/sports/match-days";
import type { Match, MatchStatus, Team } from "@/types/sports";

import { MatchesByDate, openingDayIndex } from "./matches-by-date";
import { SportsTodayProvider } from "./time-zone-context";

const TODAY = "2026-10-18";
const ZONE = "America/Costa_Rica";

const teams = new Map<string, Team>([
  ["rma", { id: "rma", name: "Real Madrid", shortName: "Real Madrid", code: "RMA" }],
  ["bar", { id: "bar", name: "Barcelona", shortName: "Barcelona", code: "BAR" }],
]);

const match = (id: string, kickoff: string, status: MatchStatus): Match => {
  const played = status === "ft" || status === "aet" || status === "pen";
  return {
    id,
    homeTeamId: "rma",
    awayTeamId: "bar",
    homeScore: played ? 2 : null,
    awayScore: played ? 1 : null,
    kickoff,
    status,
  };
};

// 20:00 UTC is 14:00 in Costa Rica, so each kickoff keeps its UTC day.
const season = [
  match("oct-10", "2026-10-10T20:00:00Z", "ft"),
  match("oct-14", "2026-10-14T20:00:00Z", "aet"),
  match("oct-17", "2026-10-17T20:00:00Z", "ft"),
  match("oct-18", "2026-10-18T20:00:00Z", "scheduled"),
  match("oct-21", "2026-10-21T20:00:00Z", "scheduled"),
];

function renderList(matches: Match[]): ReturnType<typeof render> {
  return render(
    <ReaderTimeZoneProvider timeZone={ZONE}>
      <SportsTodayProvider today={TODAY}>
        <MatchesByDate matches={matches} teams={teams} />
      </SportsTodayProvider>
    </ReaderTimeZoneProvider>
  );
}

const shownDays = (container: HTMLElement): (string | null)[] =>
  [...container.querySelectorAll("[data-day]")].map((el) => el.getAttribute("data-day"));

const earlierButton = (): HTMLElement | null =>
  screen.queryByRole("button", { name: /Earlier results/ });

// jsdom has neither; the tests that need them lend them.
const { scrollIntoView, hasPointerCapture } = Element.prototype;

afterEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
  Element.prototype.hasPointerCapture = hasPointerCapture;
});

describe("openingDayIndex", () => {
  const days = (matches: Match[]) => matchDays(matches, ZONE);

  it("opens on the latest day with a result", () => {
    expect(openingDayIndex(days(season), TODAY)).toBe(2);
  });

  it("opens on today once today has a result", () => {
    const list = season.map((m) => (m.id === "oct-18" ? { ...m, status: "ft" as const } : m));
    expect(openingDayIndex(days(list), TODAY)).toBe(3);
  });

  it("ignores a result dated after today", () => {
    const list = season.map((m) => (m.id === "oct-21" ? { ...m, status: "ft" as const } : m));
    expect(openingDayIndex(days(list), TODAY)).toBe(2);
  });

  it("opens on the first day before any result, and on the last once all are in", () => {
    expect(openingDayIndex(days(season.slice(3)), TODAY)).toBe(0);
    expect(openingDayIndex(days(season.slice(0, 3)), TODAY)).toBe(2);
    expect(openingDayIndex([], TODAY)).toBe(0);
  });

  it("does not count a postponed match as a result", () => {
    const list = [match("off", "2026-10-16T20:00:00Z", "postponed"), ...season.slice(3)];
    expect(openingDayIndex(days(list), TODAY)).toBe(0);
  });
});

describe("MatchesByDate", () => {
  it("opens on the freshest results and keeps the days before behind a button", () => {
    const { container } = renderList(season);
    expect(shownDays(container)).toEqual(["2026-10-17", "2026-10-18", "2026-10-21"]);
    expect(earlierButton()).toHaveTextContent("Earlier results (2 days)");
    expect(screen.getByText(/^Today · /)).toBeInTheDocument();
  });

  it("reveals the earlier days and moves focus to the newest of them", () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    const { container } = renderList(season);

    fireEvent.click(earlierButton()!);

    expect(shownDays(container)).toEqual([
      "2026-10-10",
      "2026-10-14",
      "2026-10-17",
      "2026-10-18",
      "2026-10-21",
    ]);
    expect(earlierButton()).toBeNull();
    const newest = container.querySelector('[data-day="2026-10-14"]');
    expect(document.activeElement).toBe(newest);
    expect(scrolled).toHaveBeenCalledWith({ block: "start" });
  });

  it("opens another team's fixtures on its freshest results again", () => {
    // Radix's Select asks for pointer capture and scrolls its options into view.
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    const { container } = renderList(season);
    fireEvent.click(earlierButton()!);
    expect(shownDays(container)).toHaveLength(5);

    fireEvent.keyDown(screen.getByRole("combobox", { name: "Filter by team" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: /Barcelona/ }));

    expect(shownDays(container)).toEqual(["2026-10-17", "2026-10-18", "2026-10-21"]);
    expect(earlierButton()).toHaveTextContent("Earlier results (2 days)");
  });

  it("says one day in the singular", () => {
    renderList(season.slice(1));
    expect(earlierButton()).toHaveTextContent("Earlier results (1 day)");
  });

  it("shows every day, and no button, before the first result", () => {
    const { container } = renderList(season.slice(3));
    expect(shownDays(container)).toEqual(["2026-10-18", "2026-10-21"]);
    expect(earlierButton()).toBeNull();
  });

  it("has no scroller of its own: the page scrolls it", () => {
    const { container } = renderList(season);
    expect(screen.queryByRole("region")).toBeNull();
    expect(container.querySelector('[tabindex="0"]')).toBeNull();
  });

  it("keeps its empty state", () => {
    renderList([]);
    expect(screen.getByText("No matches available yet")).toBeInTheDocument();
    expect(earlierButton()).toBeNull();
  });
});
