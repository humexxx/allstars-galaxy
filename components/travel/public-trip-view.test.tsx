import { describe, expect, it, vi } from "vitest";

import { PublicTripViewRenderer } from "./public-trip-view";
import { PublicTripViews } from "./public-trip-views";
import type { PublicTripItem, PublicTripView, Trip, TripShare } from "@/types/travel";

vi.mock("@/app/actions/travel", () => ({ moveTripItemAction: vi.fn() }));

const TRIP: Trip = {
  id: "t1", userId: "owner-auth-id", title: "Orlando", destination: "Florida",
  description: null, startDate: "2027-01-15", endDate: "2027-01-24",
  coverPhotoUrl: null, currency: "USD", color: "var(--chart-1)",
  createdAt: new Date("2026-08-01"), updatedAt: new Date("2026-08-01"),
};

const SHARE: TripShare = {
  id: "s1", tripId: "t1", token: "tok", inviteeEmail: null, memberId: "bruno",
  expiresAt: null, revokedAt: null, showPrices: true, showMembers: false,
  createdAt: new Date("2026-08-01"),
};

const FLIGHT: PublicTripItem = {
  id: "f", title: "SJO ⇄ MCO", category: "flight", link: "https://example.com/booking",
  videoUrl: "https://youtu.be/dQw4w9WgXcQ", fromCode: "SJO", toCode: "MCO",
  roundTrip: true, scheduledOn: "2027-01-15", endsOn: "2027-01-24",
  stops: [], photos: [], cost: { low: 300, high: 400 }, priceUnit: null,
  notes: "Seat 14C",
};

const view = (over: Partial<PublicTripView> = {}): PublicTripView => ({
  trip: TRIP,
  items: [FLIGHT],
  photos: [],
  share: SHARE,
  scope: { memberName: "Bruno Fabián", owedLow: 300, owedHigh: 400, paid: 0 },
  ...over,
});

describe("PublicTripViewRenderer", () => {
  it("hands the client calendar only what it draws", () => {
    // These props are serialised into a page anybody with the link can open.
    // The list renders on the server, so the link, the note and the video
    // reach the browser only as the markup they become — never as props.
    const el = PublicTripViewRenderer({ view: view() });

    expect(el.type).toBe(PublicTripViews);
    expect(el.props.calendar).toEqual({
      startDate: "2027-01-15",
      endDate: "2027-01-24",
      currency: "USD",
      items: [
        {
          id: "f",
          title: "SJO ⇄ MCO",
          category: "flight",
          scheduledOn: "2027-01-15",
          endsOn: "2027-01-24",
          cost: { low: 300, high: 400 },
        },
      ],
    });
    expect(el.props.viewerName).toBe("Bruno Fabián");
  });

  it("names nobody on a link without a scope", () => {
    const el = PublicTripViewRenderer({ view: view({ scope: null }) });
    expect(el.props.viewerName).toBeNull();
  });
});
