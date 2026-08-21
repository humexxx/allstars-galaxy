// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TripItinerary } from "./trip-itinerary";
import type { ItineraryViewer } from "@/lib/travel/viewer";
import type { TripItemWithStops, TripWithRelations } from "@/types/travel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/travel", () => ({
  addTripItemAction: vi.fn(),
  deleteTripItemAction: vi.fn(),
  updateTripItemAction: vi.fn(),
}));

const item = (over: Partial<TripItemWithStops>): TripItemWithStops =>
  ({
    id: "x",
    title: "Something",
    category: "activity",
    price: null,
    priceMax: null,
    priceUnit: "total",
    scheduledOn: "2027-01-15",
    endsOn: null,
    fromCode: null,
    toCode: null,
    roundTrip: false,
    link: null,
    videoUrl: null,
    notes: null,
    stops: [],
    ...over,
  }) as TripItemWithStops;

/** The real Friday of the Orlando trip: a ranged flight and a ranged hotel. */
const FRIDAY: TripItemWithStops[] = [
  item({
    id: "flight",
    title: "SJO ⇄ MCO",
    category: "flight",
    price: "600.00",
    priceMax: "800.00",
    priceUnit: "total",
  }),
  item({
    id: "hotel",
    title: "Hotel in Orlando",
    category: "lodging",
    price: "100.00",
    priceMax: "200.00",
    priceUnit: "per_night",
    endsOn: "2027-01-17",
  }),
];

const trip = (items: TripItemWithStops[]): TripWithRelations =>
  ({ id: "t1", currency: "USD", startDate: "2027-01-15", items }) as TripWithRelations;

describe("TripItinerary day subtotals", () => {
  it("adds up both ends of the day, not just the low one", () => {
    // The bug: the subtotal took `tripCost(...).low` and reported a $600–$800
    // flight plus a $200–$400 hotel as a flat $800 — a figure that is neither
    // end of the range and cannot be reached by adding what is on screen.
    render(<TripItinerary trip={trip(FRIDAY)} partySize={2} />);

    expect(screen.getByText("$800 – $1,200")).toBeInTheDocument();
    expect(screen.queryByText("$800")).not.toBeInTheDocument();
  });

  it("is the sum of the rows above it", () => {
    render(<TripItinerary trip={trip(FRIDAY)} partySize={2} />);

    expect(screen.getByText("$600 – $800")).toBeInTheDocument();
    expect(screen.getByText("$200 – $400")).toBeInTheDocument();
  });

  it("collapses to one figure when the day holds no estimates", () => {
    const exact = [item({ id: "c", title: "Cruise", price: "1900.00", priceUnit: "per_person" })];
    render(<TripItinerary trip={trip(exact)} partySize={2} />);

    expect(screen.getAllByText("$3,800").length).toBeGreaterThan(0);
  });

  it("re-costs the day for the selected traveller", () => {
    // Half the flight and half the hotel: $300–$400 plus $100–$200.
    const viewer: ItineraryViewer = {
      name: "Bruno Fabián",
      isYou: false,
      lines: new Map([
        ["flight", { low: 300, high: 400 }],
        ["hotel", { low: 100, high: 200 }],
      ]),
    };
    render(<TripItinerary trip={trip(FRIDAY)} partySize={2} viewer={viewer} />);

    expect(screen.getByText("$400 – $600")).toBeInTheDocument();
    expect(screen.getByText("Bruno Fabián's share")).toBeInTheDocument();
  });

  it("keeps the real booking price in view while showing a share", () => {
    // Their half is what they owe; the full price is what the hotel's site
    // will actually quote, and losing it makes the row uncheckable.
    const viewer: ItineraryViewer = {
      name: "Jason",
      isYou: true,
      lines: new Map([["flight", { low: 300, high: 400 }]]),
    };
    render(<TripItinerary trip={trip([FRIDAY[0]])} partySize={2} viewer={viewer} />);

    // Twice: the row itself, and the one-item day's subtotal agreeing with it.
    expect(screen.getAllByText("$300 – $400")).toHaveLength(2);
    expect(screen.getByText("of $600 – $800")).toBeInTheDocument();
    expect(screen.getByText("your share")).toBeInTheDocument();
  });
});

describe("price column alignment", () => {
  it("reserves the same width for the row control and the header spacer", () => {
    // The control holds its space even while invisible, so without a matching
    // spacer the day subtotal ran to the card's edge while the item prices it
    // sums sat inset from it. The two widths agreeing IS the fix, so the
    // agreement is what gets asserted rather than either value.
    const { container } = render(<TripItinerary trip={trip(FRIDAY)} partySize={2} />);

    const spacer = container.querySelector("span[aria-hidden]");
    const controls = container
      .querySelector('[aria-label^="Actions for"]')
      ?.closest("div");

    const widths = (el: Element | null | undefined) =>
      (el?.className ?? "").split(/\s+/).filter((c) => /^(sm:)?w-\d/.test(c)).sort();

    expect(widths(spacer)).not.toEqual([]);
    expect(widths(spacer)).toEqual(widths(controls));
  });

  it("gives each row one menu rather than two buttons", () => {
    // Two cost 80px of gutter and pushed every price that far off the right
    // edge — and each was 36px on a phone, under what a thumb wants.
    render(<TripItinerary trip={trip(FRIDAY)} partySize={2} />);

    expect(screen.getAllByLabelText(/^Actions for/)).toHaveLength(2);
    expect(screen.queryByLabelText("Delete item")).not.toBeInTheDocument();
  });

  it("never breaks a price across two lines", () => {
    // "$600 –" on one line and "$800" on the next reads as two prices.
    render(<TripItinerary trip={trip(FRIDAY)} partySize={2} />);

    expect(screen.getByText("$600 – $800").className).toContain("whitespace-nowrap");
  });
});
