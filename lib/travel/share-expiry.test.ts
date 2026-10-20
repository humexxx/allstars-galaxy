import { describe, expect, it } from "vitest";

import {
  addDays,
  defaultShareExpiry,
  draftForShare,
  readerToday,
  resolveShareExpiry,
  shareExpiryLabel,
  tripEndExpiry,
} from "./share-expiry";

// Oct 18 2026, 23:30 in Los Angeles — already Oct 19 in UTC.
const NOW = Date.parse("2026-10-19T06:30:00Z");
const LA = "America/Los_Angeles";
const TRIP = { endDate: "2027-01-16" };
/** End of Jan 16 on a Los Angeles clock. */
const TRIP_END_LA = "2027-01-17T07:59:59.999Z";

describe("readerToday / addDays", () => {
  it("is the reader's day, not the server's", () => {
    expect(readerToday(LA, NOW)).toBe("2026-10-18");
    expect(readerToday("UTC", NOW)).toBe("2026-10-19");
  });

  it("moves across month and year ends", () => {
    expect(addDays("2026-10-18", 7)).toBe("2026-10-25");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
  });
});

describe("tripEndExpiry", () => {
  it("is the end of the trip's last day in the reader's zone", () => {
    expect(tripEndExpiry(TRIP, LA, NOW)?.toISOString()).toBe(TRIP_END_LA);
    expect(tripEndExpiry(TRIP, "Asia/Tokyo", NOW)?.toISOString()).toBe(
      "2027-01-16T14:59:59.999Z"
    );
  });

  it("is not on offer for an open-ended trip", () => {
    expect(tripEndExpiry({ endDate: null }, LA, NOW)).toBeNull();
  });

  it("is not on offer once the trip is over", () => {
    expect(tripEndExpiry({ endDate: "2026-10-01" }, LA, NOW)).toBeNull();
  });

  it("is still on offer on the trip's last evening", () => {
    // 23:30 on Oct 18 in Los Angeles: half an hour of the trip left there,
    // although UTC has already moved on to the 19th.
    expect(tripEndExpiry({ endDate: "2026-10-18" }, LA, NOW)?.toISOString()).toBe(
      "2026-10-19T06:59:59.999Z"
    );
    expect(tripEndExpiry({ endDate: "2026-10-18" }, "UTC", NOW)).toBeNull();
  });
});

describe("defaultShareExpiry", () => {
  it("lasts as long as the trip when it has an end", () => {
    expect(defaultShareExpiry(TRIP, LA, NOW)).toEqual({
      choice: "trip-end",
      day: "2027-01-16",
    });
  });

  it("keeps the old never-expires behaviour for an open-ended trip", () => {
    expect(defaultShareExpiry({ endDate: null }, LA, NOW)).toEqual({
      choice: "never",
      day: "2026-10-25",
    });
  });

  it("keeps it for a trip that is over", () => {
    expect(defaultShareExpiry({ endDate: "2026-09-30" }, LA, NOW).choice).toBe("never");
  });
});

describe("resolveShareExpiry", () => {
  const resolve = (choice: Parameters<typeof resolveShareExpiry>[0]["choice"], day = "") =>
    resolveShareExpiry({ choice, day }, TRIP, LA, NOW)?.toISOString() ?? null;

  it("turns each choice into the instant stored on the link", () => {
    expect(resolve("trip-end")).toBe(TRIP_END_LA);
    expect(resolve("1d")).toBe("2026-10-20T06:30:00.000Z");
    expect(resolve("7d")).toBe("2026-10-26T06:30:00.000Z");
    expect(resolve("30d")).toBe("2026-11-18T06:30:00.000Z");
    expect(resolve("custom", "2026-12-24")).toBe("2026-12-25T07:59:59.999Z");
    expect(resolve("never")).toBeNull();
  });

  it("ends a picked day at the end of that day for the reader", () => {
    expect(
      resolveShareExpiry({ choice: "custom", day: "2026-12-24" }, TRIP, "Europe/Madrid", NOW)
        ?.toISOString()
    ).toBe("2026-12-24T22:59:59.999Z");
  });
});

describe("draftForShare", () => {
  it("reads a link that ends with the trip as that choice", () => {
    expect(draftForShare(new Date(TRIP_END_LA), TRIP, LA, NOW)).toEqual({
      choice: "trip-end",
      day: "2027-01-16",
    });
  });

  it("reads any other expiry as its day in the reader's zone", () => {
    // 05:00 UTC on Dec 2 is still the evening of Dec 1 in Los Angeles.
    expect(draftForShare("2026-12-02T05:00:00Z", TRIP, LA, NOW)).toEqual({
      choice: "custom",
      day: "2026-12-01",
    });
  });

  it("reads no expiry as never", () => {
    expect(draftForShare(null, TRIP, LA, NOW).choice).toBe("never");
  });

  it("starts an expired link from the default, since its own day has passed", () => {
    expect(draftForShare("2026-10-01T00:00:00Z", TRIP, LA, NOW)).toEqual(
      defaultShareExpiry(TRIP, LA, NOW)
    );
  });
});

describe("shareExpiryLabel", () => {
  it("names the day in the reader's zone", () => {
    expect(shareExpiryLabel(new Date(TRIP_END_LA), LA, NOW)).toBe("Expires Jan 16");
    expect(shareExpiryLabel(new Date(TRIP_END_LA), "Asia/Tokyo", NOW)).toBe("Expires Jan 17");
    expect(shareExpiryLabel("2026-12-02T05:00:00Z", LA, NOW)).toBe("Expires Dec 1");
    expect(shareExpiryLabel("2026-12-02T05:00:00Z", "UTC", NOW)).toBe("Expires Dec 2");
  });

  it("adds the year once month and day would point at an earlier one", () => {
    // The reader's today is Oct 18, 2026: "Oct 18" alone would read as today.
    expect(shareExpiryLabel("2027-10-17T12:00:00Z", LA, NOW)).toBe("Expires Oct 17");
    expect(shareExpiryLabel("2027-10-18T12:00:00Z", LA, NOW)).toBe("Expires Oct 18, 2027");
  });

  it("says so when a link never expires", () => {
    expect(shareExpiryLabel(null, LA, NOW)).toBe("Never expires");
  });
});
