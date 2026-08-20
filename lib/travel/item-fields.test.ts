import { describe, expect, it } from "vitest";

import { deriveTitle, endDayLabel, itemFields, showsEndDay } from "./item-fields";

describe("itemFields", () => {
  it("gives a hotel check-in and check-out, not 'Day'", () => {
    const spec = itemFields("lodging");
    expect(spec.startLabel).toBe("Check in");
    expect(spec.endLabel).toBe("Check out");
    expect(spec.route).toBe(false);
  });

  it("does not ask a flight for a video", () => {
    // A walkthrough of a plane seat is not a thing anyone has.
    expect(itemFields("flight").video).toBe(false);
  });

  it("does ask a hotel and a cruise for one", () => {
    expect(itemFields("lodging").video).toBe(true);
    expect(itemFields("cruise").video).toBe(true);
  });

  it("gives a route only to things that travel", () => {
    for (const c of ["flight", "cruise", "transport"] as const) {
      expect(itemFields(c).route).toBe(true);
    }
    for (const c of ["lodging", "food", "activity", "shopping"] as const) {
      expect(itemFields(c).route).toBe(false);
    }
  });

  it("offers a round trip only for flights", () => {
    expect(itemFields("flight").roundTrip).toBe(true);
    expect(itemFields("cruise").roundTrip).toBe(false);
  });

  it("keeps the itinerary to cruises", () => {
    expect(itemFields("cruise").itinerary).toBe(true);
    expect(itemFields("activity").itinerary).toBe(false);
  });

  it("drops the end day where a span makes no sense", () => {
    // A dinner does not run until Thursday.
    expect(itemFields("food").endDay).toBe(false);
    expect(itemFields("transport").endDay).toBe(false);
  });
});

describe("showsEndDay", () => {
  it("hides it on a one-way flight and reveals it on a return", () => {
    const flight = itemFields("flight");
    expect(showsEndDay(flight, false)).toBe(false);
    expect(showsEndDay(flight, true)).toBe(true);
  });

  it("keeps it visible for a hotel regardless", () => {
    expect(showsEndDay(itemFields("lodging"), false)).toBe(true);
  });
});

describe("endDayLabel", () => {
  it("calls a return flight's end day 'Returns'", () => {
    expect(endDayLabel(itemFields("flight"), true)).toBe("Returns");
  });

  it("uses the category's own wording otherwise", () => {
    expect(endDayLabel(itemFields("lodging"), false)).toBe("Check out");
    expect(endDayLabel(itemFields("cruise"), false)).toBe("Disembarks");
  });
});

describe("deriveTitle", () => {
  it("names a one-way flight by its route", () => {
    expect(
      deriveTitle("flight", { fromCode: "SJO", toCode: "MCO" }, "Flight")
    ).toBe("SJO → MCO");
  });

  it("uses a double arrow for a return", () => {
    expect(
      deriveTitle("flight", { fromCode: "SJO", toCode: "MCO", roundTrip: true }, "Flight")
    ).toBe("SJO ⇄ MCO");
  });

  it("says what it knows when only one end is filled in", () => {
    expect(deriveTitle("flight", { toCode: "MCO" }, "Flight")).toBe("Flight to MCO");
    expect(deriveTitle("flight", { fromCode: "SJO" }, "Flight")).toBe("Flight from SJO");
  });

  it("never derives an empty title from an empty form", () => {
    // The column is NOT NULL; a half-filled form must still save.
    expect(deriveTitle("flight", {}, "Flight")).toBe("Flight");
  });

  it("asks for a title everywhere a route would not describe the thing", () => {
    expect(itemFields("lodging").title).toBe(true);
    expect(itemFields("flight").title).toBe(false);
  });
});
