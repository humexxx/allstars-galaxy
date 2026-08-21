// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
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
  it("draws whole weeks around the trip, not whole months", () => {
    // A ten-day trip mid-January was drawing two empty weeks above it and the
    // whole of February below — pages of nothing, to place ten days.
    render(<TripCalendar trip={trip([CRUISE])} />);

    // Jan 15 falls on a Friday, so the grid opens on Sunday the 10th and
    // closes on Saturday the 30th. Nothing from December, nothing from Feb.
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
    expect(screen.queryByText("February 2027")).not.toBeInTheDocument();
  });

  it("occupies every day an item spans, not only the day it starts", () => {
    // The whole reason a cruise or a hotel is worth seeing on a calendar.
    const { container } = render(<TripCalendar trip={trip([CRUISE])} />);
    const cells = container.querySelectorAll("div.grid.grid-cols-7 > div");
    const withItems = [...cells].filter((c) => c.querySelector("li"));
    expect(withItems).toHaveLength(8); // 17th through 24th
  });

  it("names an item on the day it begins and only threads it after", () => {
    // Repeating "Star of the Seas" for eight days says nothing and crowds out
    // the days that have something new on them.
    render(<TripCalendar trip={trip([CRUISE])} />);

    expect(screen.getAllByText("Star of the Seas")).toHaveLength(1);
  });

  it("charges a day's cost to the day the item starts", () => {
    render(<TripCalendar trip={trip([CRUISE])} partySize={2} />);

    const cell = screen.getByText("17").closest("div")!;
    expect(within(cell).getByText("$3,800")).toBeInTheDocument();
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

    const cell = screen.getByText("17").closest("div")!;
    expect(within(cell).getByText("$1,900")).toBeInTheDocument();
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
