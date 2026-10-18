import { describe, expect, it } from "vitest";

import { airportQuerySchema, tripItemSchema, updateTripItemSchema } from "./travel";

describe("a backwards date range", () => {
  const base = {
    title: "Hotel",
    category: "lodging" as const,
    scheduledOn: "2027-01-14",
    endsOn: "2027-01-12",
  };

  it("is rejected when an item is created", () => {
    expect(tripItemSchema.safeParse(base).success).toBe(false);
  });

  it("is rejected when an item is edited", () => {
    // The update schema extended the unchecked one, so this path was open
    // even after the create path was closed.
    const parsed = updateTripItemSchema.safeParse({
      ...base,
      id: "11111111-1111-4111-8111-111111111111",
    });
    expect(parsed.success).toBe(false);
  });

  it("lets a same-day item through", () => {
    const parsed = tripItemSchema.safeParse({
      ...base,
      endsOn: "2027-01-14",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("airportQuerySchema", () => {
  it("trims and accepts a normal query", () => {
    expect(airportQuerySchema.parse("  lis ")).toBe("lis");
  });

  it("rejects a query too short to narrow anything", () => {
    expect(airportQuerySchema.safeParse(" a ").success).toBe(false);
  });

  it("rejects an unbounded query", () => {
    expect(airportQuerySchema.safeParse("x".repeat(65)).success).toBe(false);
  });
});
