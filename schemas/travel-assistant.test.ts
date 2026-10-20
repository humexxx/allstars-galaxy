import { describe, expect, it } from "vitest";

import { travelChangeSetSchema } from "./travel-assistant";

const TRIP = "22222222-2222-4222-8222-222222222222";
const item = { title: "Universal Studios", category: "activity" } as const;

describe("travelChangeSetSchema", () => {
  it("lets an item name a trip created earlier in the same proposal", () => {
    const parsed = travelChangeSetSchema.safeParse({
      summary: "Orlando",
      changes: [
        { op: "create_trip", ref: "orl", trip: { title: "Orlando", startDate: "2027-01-16" } },
        { op: "add_item", tripRef: "orl", item },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses a ref used before the trip it names is created", () => {
    const parsed = travelChangeSetSchema.safeParse({
      summary: "Orlando",
      changes: [
        { op: "add_item", tripRef: "orl", item },
        { op: "create_trip", ref: "orl", trip: { title: "Orlando", startDate: "2027-01-16" } },
      ],
    });
    expect(parsed.error?.issues[0].message).toBe('No trip with ref "orl" is created before this change');
  });

  it("wants exactly one of tripId and tripRef", () => {
    const both = travelChangeSetSchema.safeParse({
      summary: "x",
      changes: [{ op: "add_item", tripId: TRIP, tripRef: "orl", item }],
    });
    const neither = travelChangeSetSchema.safeParse({ summary: "x", changes: [{ op: "add_item", item }] });
    expect(both.success).toBe(false);
    expect(neither.success).toBe(false);
  });

  it("takes a price as the number the model writes", () => {
    const parsed = travelChangeSetSchema.parse({
      summary: "x",
      changes: [{ op: "add_item", tripId: TRIP, item: { ...item, price: 450, priceMax: 512.5 } }],
    });
    expect(parsed.changes[0]).toMatchObject({ item: { price: "450.00", priceMax: "512.50" } });
  });
});
