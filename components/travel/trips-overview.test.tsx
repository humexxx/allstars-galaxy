// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Trip } from "@/types/travel";

import { relativeDays, TripsCalendar, TripsOverview } from "./trips-overview";

const today = "2026-09-30";

describe("relativeDays", () => {
  it("counts down to a trip that has not started", () => {
    expect(relativeDays({ startDate: "2026-10-01", endDate: null }, today)).toBe("Tomorrow");
    expect(relativeDays({ startDate: "2026-10-09", endDate: "2026-10-12" }, today)).toBe(
      "In 9 days"
    );
    expect(relativeDays({ startDate: "2026-12-27", endDate: "2027-01-09" }, today)).toBe(
      "In 3 mo"
    );
  });

  it("says when a trip under way ends, not how long ago it began", () => {
    // It read "2 days ago" — as if the week in the forest were already over.
    expect(relativeDays({ startDate: "2026-09-28", endDate: "2026-10-03" }, today)).toBe(
      "Ends in 3 days"
    );
    expect(relativeDays({ startDate: "2026-09-28", endDate: "2026-10-01" }, today)).toBe(
      "Ends tomorrow"
    );
    expect(relativeDays({ startDate: "2026-09-28", endDate: "2026-09-30" }, today)).toBe(
      "Ends today"
    );
    expect(relativeDays({ startDate: "2026-09-30", endDate: "2026-10-04" }, today)).toBe(
      "Starts today"
    );
  });

  it("counts a past trip from its last day", () => {
    expect(relativeDays({ startDate: "2026-09-20", endDate: "2026-09-29" }, today)).toBe(
      "Yesterday"
    );
    // Mar 22 is 192 days back; from the start it read "200 days ago".
    expect(relativeDays({ startDate: "2026-03-14", endDate: "2026-03-22" }, today)).toBe(
      "6 mo ago"
    );
  });
});

const trip = (over: Partial<Trip>): Trip =>
  ({
    id: "t", title: "Trip", destination: null, color: "var(--chart-1)",
    coverPhotoUrl: null, startDate: "2027-01-12", endDate: null, ...over,
  }) as Trip;

// The owner's January: Charlotte ends on the Saturday Orlando starts.
const CHARLOTTE = trip({
  id: "c", title: "Charlotte & Snowboard", startDate: "2027-01-12", endDate: "2027-01-16",
});
const ORLANDO = trip({
  id: "o", title: "Orlando", startDate: "2027-01-16", endDate: "2027-01-24",
});

const bars = (container: HTMLElement, title: string) =>
  [...container.querySelectorAll<HTMLElement>("[data-slot=trip-bar]")].filter(
    (b) => b.textContent === title
  );

describe("TripsCalendar", () => {
  const draw = () => render(<TripsCalendar trips={[CHARLOTTE, ORLANDO]} today="2027-01-05" />);

  it("draws a trip as one bar a week, not a block a day", () => {
    const { container } = draw();
    // Tue 12 to Sat 16 is one week: one bar, five days long.
    const [charlotte, ...more] = bars(container, "Charlotte & Snowboard");
    expect(more).toHaveLength(0);
    expect(charlotte.style.gridColumn).toBe("3 / span 5");
    // Sat 16 to Sun 24 crosses two week boundaries: three bars, 1 + 7 + 1.
    expect(bars(container, "Orlando").map((b) => b.style.gridColumn)).toEqual([
      "7 / span 1",
      "1 / span 7",
      "1 / span 1",
    ]);
  });

  it("stacks trips that share a day, and grows that week to fit", () => {
    const { container } = draw();
    const [first] = bars(container, "Orlando");
    expect(bars(container, "Charlotte & Snowboard")[0].style.gridRow).toBe("1");
    expect(first.style.gridRow).toBe("2");

    const weeks = [...container.querySelectorAll<HTMLElement>("[data-slot=calendar-week]")];
    expect(weeks.map((w) => w.style.minHeight)).toEqual([
      "64px", "64px", "74px", "64px", "64px", "64px",
    ]);
  });

  it("squares the ends where a week cuts a trip", () => {
    const { container } = draw();
    const [out, through, back] = bars(container, "Orlando");
    expect(out.className).toContain("rounded-l-sm");
    expect(out.className).toContain("rounded-r-none");
    expect(through.className).toContain("rounded-l-none");
    expect(through.className).toContain("rounded-r-none");
    expect(back.className).toContain("rounded-l-none");
    expect(back.className).toContain("rounded-r-sm");
  });

  it("announces a trip once, however many weeks it crosses", () => {
    draw();
    // One link per trip in the tab order; the other bars repeat it.
    expect(screen.getAllByRole("link", { name: /^Orlando,/ })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Orlando, Jan 16 – 24, 2027" })).toHaveAttribute(
      "href",
      "/portal/entertainment/travel-planner/o"
    );
  });

  it("has no New trip button of its own", () => {
    draw();
    expect(screen.queryByRole("link", { name: "New trip" })).toBeNull();
    // Each day of the month still is one.
    expect(screen.getByRole("link", { name: "New trip on Jan 20, 2027" })).toHaveAttribute(
      "href",
      "/portal/entertainment/travel-planner/new?startDate=2027-01-20"
    );
  });
});

describe("TripsOverview", () => {
  it("puts the List / Calendar switch and the one New trip in the header", () => {
    render(<TripsOverview trips={[CHARLOTTE, ORLANDO]} today="2027-01-05" />);
    const header = screen.getByRole("banner");
    expect(header).toHaveTextContent("Travel Planner");
    expect(header).toContainElement(screen.getByRole("tab", { name: "Calendar" }));
    expect(screen.getAllByRole("link", { name: "New trip" })).toHaveLength(1);
  });

  it("offers New trip once when there are no trips yet", () => {
    render(<TripsOverview trips={[]} today="2027-01-05" />);
    expect(screen.getByText("No trips yet")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getAllByRole("link", { name: "New trip" })).toHaveLength(1);
  });
});
