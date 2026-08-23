import { describe, expect, it } from "vitest";

import { itemCost, nightsBetween, tripCost, unitSuffix } from "./pricing";
import type { PricedItem } from "./pricing";

const item = (over: Partial<PricedItem> = {}): PricedItem => ({
  price: "100.00",
  priceMax: null,
  priceUnit: "total",
  scheduledOn: null,
  endsOn: null,
  ...over,
});

describe("nightsBetween", () => {
  it("counts nights, not days", () => {
    // The 15th to the 17th is two nights. Counting three overstates every
    // hotel by one.
    expect(nightsBetween("2027-01-15", "2027-01-17")).toBe(2);
  });

  it("falls back to one night when the range is missing or backwards", () => {
    // A stay with no dates still costs something; zero would be a lie.
    expect(nightsBetween("2027-01-15", null)).toBe(1);
    expect(nightsBetween(null, null)).toBe(1);
    expect(nightsBetween("2027-01-17", "2027-01-15")).toBe(1);
    expect(nightsBetween("2027-01-15", "2027-01-15")).toBe(1);
  });
});

describe("itemCost", () => {
  it("leaves a plain total alone", () => {
    const cost = itemCost(item({ price: "1900.00" }), 4);
    expect(cost.low).toBe(1900);
    expect(cost.times).toBe(1);
  });

  it("multiplies a nightly rate by the nights", () => {
    const cost = itemCost(
      item({
        price: "100.00", priceMax: "200.00", priceUnit: "per_night",
        scheduledOn: "2027-01-15", endsOn: "2027-01-17",
      }),
      2
    );
    expect(cost.times).toBe(2);
    expect(cost.low).toBe(200);
    expect(cost.high).toBe(400);
    // The entered figures survive so the UI can still show "$100 ~ $200/night".
    expect(cost.unitLow).toBe(100);
    expect(cost.unitHigh).toBe(200);
  });

  it("multiplies a per-person price by the party", () => {
    const cost = itemCost(item({ price: "1900.00", priceUnit: "per_person" }), 3);
    expect(cost.low).toBe(5700);
  });

  it("treats a party of zero as one person", () => {
    // Nobody has planned a trip for nobody.
    expect(itemCost(item({ price: "500.00", priceUnit: "per_person" }), 0).low).toBe(500);
  });

  it("uses the price as the estimate when no upper bound is set", () => {
    // A missing max must not read as a maximum of zero.
    const cost = itemCost(item({ price: "640.00", priceMax: null }), 1);
    expect(cost.low).toBe(640);
    expect(cost.high).toBe(640);
    expect(cost.ranged).toBe(false);
  });

  it("ignores an upper bound below the price rather than inverting the range", () => {
    const cost = itemCost(item({ price: "500.00", priceMax: "100.00" }), 1);
    expect(cost.low).toBe(500);
    expect(cost.high).toBe(500);
  });
});

describe("tripCost", () => {
  const orlando: PricedItem[] = [
    { price: "600.00", priceMax: "800.00", priceUnit: "per_person", scheduledOn: "2027-01-15", endsOn: "2027-01-24" },
    { price: "100.00", priceMax: "200.00", priceUnit: "per_night", scheduledOn: "2027-01-15", endsOn: "2027-01-17" },
    { price: "1900.00", priceMax: null, priceUnit: "per_person", scheduledOn: "2027-01-17", endsOn: "2027-01-24" },
  ];

  it("adds up the real Orlando trip for one traveller", () => {
    // 600-800 flight + 100-200 x 2 nights + 1900 cruise.
    const cost = tripCost(orlando, 1);
    expect(cost.low).toBe(2700);
    expect(cost.high).toBe(3100);
    expect(cost.ranged).toBe(true);
    expect(cost.perPerson).toBe(true);
  });

  it("scales the per-person parts with the party, and not the hotel", () => {
    // Two people: flight (1200-1600) and cruise (3800) double, the room
    // (200-400) does not.
    const cost = tripCost(orlando, 2);
    expect(cost.low).toBe(5200);
    expect(cost.high).toBe(5800);
  });

  it("skips items with no price rather than counting them as free", () => {
    const cost = tripCost([item({ price: null }), item({ price: "50.00" })], 1);
    expect(cost.low).toBe(50);
  });

  it("says nothing depends on the party when nothing is per-person", () => {
    expect(tripCost([item({ price: "10.00" })], 5).perPerson).toBe(false);
  });
});

describe("unitSuffix", () => {
  it("labels the unit, and says nothing for a plain total", () => {
    expect(unitSuffix("per_night")).toBe("/ night");
    expect(unitSuffix("per_person")).toBe("/ person");
    expect(unitSuffix("total")).toBe("");
  });
});
