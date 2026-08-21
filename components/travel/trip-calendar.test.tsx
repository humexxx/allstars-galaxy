// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TripCalendar } from "./trip-calendar";
import type { TripItemWithStops, TripWithRelations } from "@/types/travel";

const item = (over: Partial<TripItemWithStops>): TripItemWithStops =>
  ({
    id: "x", title: "Something", category: "activity", price: null, priceMax: null,
    priceUnit: "total", scheduledOn: "2027-01-15", endsOn: null, fromCode: null,
    toCode: null, roundTrip: false, link: null, videoUrl: null, notes: null,
    stops: [], ...over,
  }) as TripItemWithStops;

const trip = (items: TripItemWithStops[]): TripWithRelations =>
  ({
    id: "t1", currency: "USD", startDate: "2027-01-15", endDate: "2027-01-24", items,
  }) as TripWithRelations;

const CRUISE = item({
  id: "c", title: "Star of the Seas", category: "cruise",
  scheduledOn: "2027-01-17", endsOn: "2027-01-24",
  price: "1900.00", priceUnit: "per_person",
});

describe("TripCalendar", () => {
  it("opens on the trip's month and draws all of it", () => {
    const { container } = render(<TripCalendar trip={trip([CRUISE])} />);

    expect(screen.getByText("January 2027")).toBeInTheDocument();
    // January 2027 opens on a Friday and closes on a Sunday, so padding it
    // out to whole weeks gives six rows of seven. Both the 31st of December
    // and the 31st of January are on screen, which is why the count is what
    // gets asserted rather than any one day.
    const days = container.querySelectorAll("div.grid.grid-cols-7 > div.flex-col");
    expect(days).toHaveLength(6 * 7);
  });

  it("moves between months and offers the way back", () => {
    render(<TripCalendar trip={trip([CRUISE])} />);

    fireEvent.click(screen.getByLabelText("Next month"));
    expect(screen.getByText("February 2027")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Trip" }));
    expect(screen.getByText("January 2027")).toBeInTheDocument();
  });

  it("does not offer a way back to a month already showing", () => {
    render(<TripCalendar trip={trip([CRUISE])} />);
    expect(screen.getByRole("button", { name: "Trip" })).toBeDisabled();
  });

  it("draws a stay as one bar across the days it covers", () => {
    // The whole reason a cruise or a hotel is worth seeing on a calendar: the
    // length of the bar IS the information.
    const { container } = render(<TripCalendar trip={trip([CRUISE])} />);
    const bars = [...container.querySelectorAll("[title]")];
    // Sun 17 to Sun 24 crosses a week boundary, so it is two segments: six
    // days to Saturday the 23rd, then one more.
    expect(bars).toHaveLength(2);
    expect(bars[0].className).toContain("col-span-7");
    expect(bars[1].className).toContain("col-span-1");
  });

  it("draws a return flight as the day out and the day back, nothing between", () => {
    const flight = item({
      id: "f", title: "SJO ⇄ MCO", category: "flight",
      scheduledOn: "2027-01-15", endsOn: "2027-01-24",
    });
    const { container } = render(<TripCalendar trip={trip([flight])} />);
    const bars = [...container.querySelectorAll("[title]")];

    expect(bars).toHaveLength(2);
    expect(bars.every((b) => b.className.includes("col-span-1"))).toBe(true);
  });

  it("names an item on the day it begins and only threads it after", () => {
    // Repeating "Star of the Seas" for eight days says nothing and crowds out
    // the days that have something new on them. The run crosses a week
    // boundary, so there are two bars and only the first carries the label.
    const { container } = render(<TripCalendar trip={trip([CRUISE])} />);
    const labelled = [...container.querySelectorAll("[title]")].filter((b) =>
      b.textContent?.includes("Star of the Seas")
    );

    expect(labelled).toHaveLength(1);
  });

  it("puts the price on the bar it belongs to, not on the day", () => {
    // A day with two bookings showed one number in the cell belonging to
    // neither. On the bar it is unambiguous.
    const { container } = render(<TripCalendar trip={trip([CRUISE])} partySize={2} />);

    const bar = container.querySelector('[title*="Star of the Seas"]')!;
    expect(bar.textContent).toContain("Star of the Seas · $3,800");
  });

  it("re-costs the calendar for the selected traveller", () => {
    render(
      <TripCalendar
        trip={trip([CRUISE])}
        partySize={2}
        viewer={{
          name: "Bruno Fabián",
          isYou: false,
          lines: new Map([["c", { low: 1900, high: 1900 }]]),
        }}
      />
    );

    const bar = document.querySelector('[title*="Star of the Seas"]')!;
    expect(bar.textContent).toContain("$1,900");
    expect(screen.getByText("Bruno Fabián's share")).toBeInTheDocument();
  });

  it("dims the days that sit outside the trip", () => {
    const { container } = render(<TripCalendar trip={trip([CRUISE])} />);
    const outside = screen.getByText("10").closest("div")!;
    const inside = screen.getByText("17").closest("div")!;

    expect(outside.className).toContain("bg-muted/30");
    expect(inside.className).not.toContain("bg-muted/30");
    expect(container).toBeTruthy();
  });
});
