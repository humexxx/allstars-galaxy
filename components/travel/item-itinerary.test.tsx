// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ItemItinerary } from "./item-itinerary";
import type { TripItemStop } from "@/types/travel";

const STOPS: TripItemStop[] = [
  {
    id: "s1", itemId: "i1", dayNumber: 1, stopOn: "2027-01-17",
    place: "Orlando (Port Canaveral), Florida", note: "Departs 4:30 PM",
  },
  {
    id: "s2", itemId: "i1", dayNumber: 2, stopOn: "2027-01-18",
    place: "At sea", note: "Star of the Seas",
  },
  {
    id: "s3", itemId: "i1", dayNumber: 3, stopOn: null,
    place: "Cozumel, Mexico", note: null,
  },
];

/** Collapsed by default, so every assertion about content opens it first. */
function renderOpen(stops = STOPS) {
  render(<ItemItinerary stops={stops} />);
  fireEvent.click(screen.getByRole("button"));
}

describe("ItemItinerary", () => {
  it("starts collapsed, summarising instead of listing", () => {
    // Eight ports under an activity you were only glancing at is a wall.
    render(<ItemItinerary stops={STOPS} />);

    expect(screen.getByText(/Itinerary · 3 days/)).toBeInTheDocument();
    expect(screen.queryByText("Cozumel, Mexico")).not.toBeInTheDocument();
  });

  it("lists every stop with its day number", () => {
    renderOpen();

    expect(screen.getByText("Day 1")).toBeInTheDocument();
    expect(screen.getByText("Day 3")).toBeInTheDocument();
    expect(screen.getByText("Cozumel, Mexico")).toBeInTheDocument();
  });

  it("prints the operator's own wording rather than parsing times", () => {
    // Itineraries state arrival and departure inconsistently; normalising
    // them would lose what the traveller actually needs to read.
    renderOpen();

    expect(screen.getByText("Departs 4:30 PM")).toBeInTheDocument();
  });

  it("formats a stop's date when it has one", () => {
    renderOpen();

    expect(screen.getByText(/Sun 17 Jan/)).toBeInTheDocument();
  });

  it("survives a stop with no date and no note", () => {
    renderOpen([STOPS[2]]);

    expect(screen.getByText("Cozumel, Mexico")).toBeInTheDocument();
  });

  it("renders nothing at all when there is no itinerary", () => {
    // An activity without stops must look like one, not like an empty list.
    const { container } = render(<ItemItinerary stops={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
