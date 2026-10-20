// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TripItemWithStops, TripWithRelations } from "@/types/travel";
import type { TripPreview } from "@/types/travel-assistant";

import { TripItinerary } from "../trip-itinerary";
import { PendingMarks } from "./pending-preview";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/travel", () => ({
  addTripItemAction: vi.fn(),
  deleteTripItemAction: vi.fn(),
  updateTripItemAction: vi.fn(),
}));

const item = (over: Partial<TripItemWithStops>): TripItemWithStops =>
  ({
    id: "x", title: "Something", category: "activity", price: null, priceMax: null,
    priceUnit: "total", scheduledOn: "2027-01-18", endsOn: null, fromCode: null, toCode: null,
    roundTrip: false, link: null, videoUrl: null, notes: null, stops: [], photos: [],
    payerIds: [], attendeeIds: [], ...over,
  }) as TripItemWithStops;

const PARK = item({ id: "park", title: "Islands of Adventure", price: "120.00" });
const DINNER = item({ id: "dinner", title: "Toothsome", category: "food", price: "90.00", scheduledOn: "2027-01-17" });
const DINNER_WAS = { ...DINNER, price: "60.00", scheduledOn: "2027-01-16" };
const TOUR = item({ id: "tour", title: "Swamp tour", price: "200.00" });

const trip = (items: TripItemWithStops[]): TripWithRelations =>
  ({ id: "t1", currency: "USD", startDate: "2027-01-16", endDate: "2027-01-24", items, members: [] }) as unknown as TripWithRelations;

const preview: TripPreview = {
  tripId: "t1",
  trip: trip([PARK, DINNER]),
  isNew: false,
  marks: { park: "add", dinner: "change", tour: "remove" },
  fields: { dinner: ["price", "scheduledOn"] },
  itemsBefore: { dinner: DINNER_WAS },
  removed: { items: [TOUR], members: [], photos: [], payments: [] },
  before: null,
};

describe("a previewed proposal on the itinerary", () => {
  it("lights up what is new, shows what changed and crosses out what goes", () => {
    render(
      <PendingMarks preview={preview}>
        <TripItinerary trip={trip([PARK, DINNER])} />
      </PendingMarks>
    );

    const row = (title: string): HTMLElement => screen.getByText(title).closest("li")!;
    expect(within(row("Islands of Adventure")).getByText("New")).toBeInTheDocument();

    const dinner = row("Toothsome");
    expect(within(dinner).getByText("Changes")).toBeInTheDocument();
    expect(within(dinner).getByText("$60")).toHaveClass("line-through");
    expect(within(dinner).getByText("moved from Jan 16")).toBeInTheDocument();

    const tour = row("Swamp tour");
    expect(within(tour).getByText("Removing")).toBeInTheDocument();
    expect(screen.getByText("Swamp tour")).toHaveClass("line-through");

    // Three rows wait on the user: the new one, the changed one, the going one.
    expect(screen.getByText("3 pending")).toBeInTheDocument();
    // The 18th's subtotal counts the park, not the tour that is going.
    const subtotal = screen.getByText("Monday, Jan 18").closest("section")!.querySelector("h3 + span");
    expect(subtotal).toHaveTextContent("$120");
  });

  it("draws the trip as it is when nothing is waiting", () => {
    render(<TripItinerary trip={trip([PARK])} />);
    expect(screen.queryByText("New")).toBeNull();
    expect(screen.queryByText(/pending/)).toBeNull();
  });
});
