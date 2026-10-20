import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  airportQuerySchema,
  createTripShareSchema,
  tripItemSchema,
  updateTripItemSchema,
  updateTripShareExpirySchema,
} from "./travel";

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

describe("a share link's expiry", () => {
  const SHARE_ID = "44444444-4444-4444-8444-444444444444";
  const NOW = new Date("2026-10-18T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts an instant still ahead, as a Date or as the string it travels as", () => {
    const parsed = createTripShareSchema.parse({ expiresAt: "2027-01-17T07:59:59.999Z" });
    expect(parsed.expiresAt).toEqual(new Date("2027-01-17T07:59:59.999Z"));

    const update = updateTripShareExpirySchema.parse({
      shareId: SHARE_ID,
      expiresAt: new Date("2026-10-19T12:00:00.000Z"),
    });
    expect(update.expiresAt).toEqual(new Date("2026-10-19T12:00:00.000Z"));
  });

  it("rejects one in the past, with the message the panel shows", () => {
    for (const result of [
      createTripShareSchema.safeParse({ expiresAt: "2026-10-18T11:59:59.999Z" }),
      updateTripShareExpirySchema.safeParse({
        shareId: SHARE_ID,
        expiresAt: new Date("2026-01-01T00:00:00Z"),
      }),
    ]) {
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]).toMatchObject({
        path: ["expiresAt"],
        message: "Pick an expiry in the future",
      });
    }
  });

  it("rejects now itself: a link that expires as it is made is already dead", () => {
    expect(createTripShareSchema.safeParse({ expiresAt: NOW }).success).toBe(false);
  });

  it("allows null, which is a link that lives until it is revoked", () => {
    expect(createTripShareSchema.parse({ expiresAt: null }).expiresAt).toBeNull();
    expect(
      updateTripShareExpirySchema.parse({ shareId: SHARE_ID, expiresAt: null }).expiresAt
    ).toBeNull();
  });

  it("may be left out when a link is created", () => {
    expect(createTripShareSchema.parse({}).expiresAt).toBeUndefined();
  });

  it("has to be stated when a link's expiry is changed", () => {
    // Absent could mean "never" or "leave it", which are opposites.
    expect(updateTripShareExpirySchema.safeParse({ shareId: SHARE_ID }).success).toBe(false);
  });

  it("rejects a date that does not parse, and a share id that is not one", () => {
    expect(createTripShareSchema.safeParse({ expiresAt: "next week" }).success).toBe(false);
    expect(
      updateTripShareExpirySchema.safeParse({ shareId: "s-1", expiresAt: null }).success
    ).toBe(false);
  });
});
