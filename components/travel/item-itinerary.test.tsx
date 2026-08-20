// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
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

describe("ItemItinerary", () => {
  it("lists every stop with its day number", () => {
    render(<ItemItinerary stops={STOPS} />);

    expect(screen.getByText("Day 1")).toBeInTheDocument();
    expect(screen.getByText("Day 3")).toBeInTheDocument();
    expect(screen.getByText("Cozumel, Mexico")).toBeInTheDocument();
  });

  it("prints the operator's own wording rather than parsing times", () => {
    // Itineraries state arrival and departure inconsistently; normalising
    // them would lose what the traveller actually needs to read.
    render(<ItemItinerary stops={STOPS} />);

    expect(screen.getByText("Departs 4:30 PM")).toBeInTheDocument();
  });

  it("formats a stop's date when it has one", () => {
    render(<ItemItinerary stops={STOPS} />);

    expect(screen.getByText(/Sun 17 Jan/)).toBeInTheDocument();
  });

  it("survives a stop with no date and no note", () => {
    render(<ItemItinerary stops={[STOPS[2]]} />);

    expect(screen.getByText("Cozumel, Mexico")).toBeInTheDocument();
  });

  it("renders nothing at all when there is no itinerary", () => {
    // An activity without stops must look like one, not like an empty list.
    const { container } = render(<ItemItinerary stops={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
