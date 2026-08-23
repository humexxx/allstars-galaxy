import { describe, expect, it } from "vitest";

import {
  allowsPriceUnit,
  deriveTitle,
  endDayLabel,
  itemFields,
  priceUnitOptions,
  showsEndDay,
  spansDays,
} from "./item-fields";
import { tripItemCategoryEnum } from "@/db/schema";

describe("priceUnitOptions", () => {
  it("never offers a nightly rate for a flight", () => {
    // per_night multiplies by the nights between the two dates, and a
    // flight's second date is its return. Offering it would turn one fare
    // into nine nights of fares.
    expect(priceUnitOptions("flight")).not.toContain("per_night");
    expect(priceUnitOptions("flight")).toEqual(["total", "per_person"]);
  });

  it("offers a nightly rate where the end day is a stay", () => {
    expect(priceUnitOptions("lodging")).toContain("per_night");
    expect(priceUnitOptions("cruise")).toContain("per_night");
  });

  it("leads with the unit the category is usually quoted in", () => {
    // The list is also the order they appear in, so the common case is first
    // rather than buried under one nobody picks.
    for (const c of tripItemCategoryEnum.enumValues) {
      expect(priceUnitOptions(c)[0]).toBe(itemFields(c).defaultPriceUnit);
    }
  });

  it("every category can accept the unit it defaults to", () => {
    // The invariant that keeps the two lists from drifting: a default the
    // dropdown does not offer would render as a blank control.
    for (const c of tripItemCategoryEnum.enumValues) {
      expect(allowsPriceUnit(c, itemFields(c).defaultPriceUnit)).toBe(true);
    }
  });

  it("keeps showing a stored unit its category no longer offers", () => {
    // An item moved into a narrower category still costs what it costs.
    // Dropping the unit would blank the control while the database kept it,
    // and the price on screen would stop explaining itself.
    expect(priceUnitOptions("flight", "per_night")).toContain("per_night");
  });

  it("does not duplicate a stored unit the category already offers", () => {
    const opts = priceUnitOptions("lodging", "per_night");
    expect(opts.filter((u) => u === "per_night")).toHaveLength(1);
  });
});

describe("allowsPriceUnit", () => {
  it("rejects a unit the category cannot honestly use", () => {
    expect(allowsPriceUnit("flight", "per_night")).toBe(false);
    expect(allowsPriceUnit("food", "per_night")).toBe(false);
  });

  it("accepts per-person everywhere, since anything can be split by head", () => {
    for (const c of tripItemCategoryEnum.enumValues) {
      expect(allowsPriceUnit(c, "per_person")).toBe(true);
    }
  });
});

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

describe("spansDays", () => {
  it("runs a stay across every day it covers", () => {
    expect(spansDays("lodging")).toBe(true);
    expect(spansDays("cruise")).toBe(true);
  });

  it("does not run a return flight across the days between", () => {
    // The flight's second date is the day it comes back, not a day it
    // occupies. Drawn as a span it painted itself across the whole trip.
    expect(spansDays("flight")).toBe(false);
  });

  it("treats a one-day thing as one day", () => {
    expect(spansDays("food")).toBe(false);
    expect(spansDays("transport")).toBe(false);
  });
});

describe("titlePlaceholder", () => {
  it("gives an example of the thing, not of the field", () => {
    expect(itemFields("lodging").titlePlaceholder).toMatch(/hotel/i);
    expect(itemFields("food").titlePlaceholder).toMatch(/dinner/i);
  });

  it("never leaves a category prompting for the wrong answer", () => {
    // A hotel example under a form set to Food asks for the wrong entry, and
    // the placeholder is the only part of the form that says what a good one
    // looks like.
    const seen = new Set<string>();
    for (const c of tripItemCategoryEnum.enumValues) {
      const p = itemFields(c).titlePlaceholder;
      expect(p.length).toBeGreaterThan(0);
      seen.add(p);
    }
    // Flight and cruise derive their titles, so a shared default is fine for
    // the rest only if it is not shared by everyone.
    expect(seen.size).toBeGreaterThan(4);
  });
});
