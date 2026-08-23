// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
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
    photos: [],
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

    expect(screen.getByText("$800 ~ $1,200")).toBeInTheDocument();
    expect(screen.queryByText("$800")).not.toBeInTheDocument();
  });

  it("is the sum of the rows above it", () => {
    render(<TripItinerary trip={trip(FRIDAY)} partySize={2} />);

    expect(screen.getByText("$600 ~ $800")).toBeInTheDocument();
    expect(screen.getByText("$200 ~ $400")).toBeInTheDocument();
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

    expect(screen.getByText("$400 ~ $600")).toBeInTheDocument();
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
    expect(screen.getAllByText("$300 ~ $400")).toHaveLength(2);
    expect(screen.getByText("of $600 ~ $800")).toBeInTheDocument();
    expect(screen.getByText("your share")).toBeInTheDocument();
  });
});

describe("price column alignment", () => {
  it("reserves nothing at the right of a row", () => {
    // The row is the control now. Anything held there — a menu, or the
    // spacer that stood in for it — pushed every price and subtotal off the
    // card's edge, which is the whole complaint this answers.
    const { container } = render(<TripItinerary trip={trip(FRIDAY)} partySize={2} />);

    expect(container.querySelector("span[aria-hidden]")).toBeNull();
    expect(screen.queryByLabelText(/^Actions for/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete item")).not.toBeInTheDocument();
  });

  it("treats the row as something you can click", () => {
    const { container } = render(<TripItinerary trip={trip(FRIDAY)} partySize={2} />);

    const row = container.querySelector("li")!;
    expect(row.className).toContain("cursor-pointer");
  });

  it("opens the item when its row is clicked", () => {
    render(<TripItinerary trip={trip(FRIDAY)} partySize={2} />);

    fireEvent.click(screen.getByText("Hotel in Orlando"));
    // The editor is open: its own controls are on screen, delete among them.
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("does not open the item when a link inside it is clicked", () => {
    // A row that swallows its own links is worse than one you cannot click.
    const withLink = [
      item({ id: "l", title: "Booking", link: "https://example.com", price: "10.00" }),
    ];
    render(<TripItinerary trip={trip(withLink)} partySize={2} />);

    fireEvent.click(screen.getByRole("link", { name: /link/i }));
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("never breaks a price across two lines", () => {
    // "$600 –" on one line and "$800" on the next reads as two prices.
    render(<TripItinerary trip={trip(FRIDAY)} partySize={2} />);

    expect(screen.getByText("$600 ~ $800").className).toContain("whitespace-nowrap");
  });
});
