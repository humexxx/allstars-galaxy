import { describe, expect, it } from "vitest";

import { tripItemSchemaChecked, updateTripItemSchema } from "./travel";

describe("a backwards date range", () => {
  const base = {
    title: "Hotel",
    category: "lodging" as const,
    scheduledOn: "2027-01-14",
    endsOn: "2027-01-12",
  };

  it("is rejected when an item is created", () => {
    expect(tripItemSchemaChecked.safeParse(base).success).toBe(false);
  });

  it("is rejected when an item is edited", () => {
    // The update schema extended the unchecked one, so this path was open
    // even after the create path was closed.
    const parsed = updateTripItemSchema.safeParse({
      ...base,
      id: "11111111-1111-1111-1111-111111111111",
    });
    expect(parsed.success).toBe(false);
  });

  it("lets a same-day item through", () => {
    const parsed = tripItemSchemaChecked.safeParse({
      ...base,
      endsOn: "2027-01-14",
    });
    expect(parsed.success).toBe(true);
  });
});
