// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
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
  stops: [], photos: [], cost: { low: 300, high: 400 }, rate: null,
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

  it("shows a whole-trip link the planner's arithmetic under each figure", () => {
    // It printed a three-night total over a bare "/ night", which reads as the
    // nightly rate; the planner says "$120 / night × 3".
    const hotel: PublicTripItem = {
      ...FLIGHT, id: "h", title: "Hotel", category: "lodging", link: null,
      videoUrl: null, fromCode: null, toCode: null, roundTrip: false,
      endsOn: "2027-01-18", notes: null,
      cost: { low: 360, high: 360 },
      rate: { low: 120, high: 120, unit: "per_night", times: 3 },
    };
    const cruise: PublicTripItem = {
      ...hotel, id: "c", title: "Star of the Seas", category: "cruise",
      scheduledOn: "2027-01-17", endsOn: "2027-01-24",
      cost: { low: 5700, high: 5700 },
      rate: { low: 1900, high: 1900, unit: "per_person", times: 3 },
    };
    const flight: PublicTripItem = {
      ...hotel, id: "f", title: "SJO ⇄ MCO", category: "flight",
      scheduledOn: "2027-01-24", endsOn: null,
      cost: { low: 600, high: 800 }, rate: null,
    };

    render(
      PublicTripViewRenderer({
        view: view({ items: [hotel, cruise, flight], scope: null, share: { ...SHARE, memberId: null } }),
      })
    );

    expect(screen.getByText("$120 / night × 3")).toBeInTheDocument();
    expect(screen.getByText("$1,900 / person × 3")).toBeInTheDocument();
    // The banner adds up the same figures the rows show.
    expect(screen.getByText("$6,660 ~ $6,860")).toBeInTheDocument();
    expect(screen.getByText("trip total")).toBeInTheDocument();
  });
});
