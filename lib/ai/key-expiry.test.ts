import { describe, expect, it } from "vitest";

import { keyExpiryWarning } from "./key-expiry";

const EXPIRES = "2027-10-19";
const on = (today: string) => keyExpiryWarning(EXPIRES, today);

describe("keyExpiryWarning", () => {
  it("stays quiet more than a month out, or with no date", () => {
    expect(on("2027-09-18")).toBeNull();
    expect(keyExpiryWarning(null, "2027-10-18")).toBeNull();
  });

  it("warns once a month out, once at twenty days and once at ten", () => {
    expect(on("2027-09-19")).toEqual({ stage: "2027-10-19/30", daysLeft: 30 });
    expect(on("2027-09-28")).toEqual({ stage: "2027-10-19/30", daysLeft: 21 });
    expect(on("2027-09-29")).toEqual({ stage: "2027-10-19/20", daysLeft: 20 });
    expect(on("2027-10-08")).toEqual({ stage: "2027-10-19/20", daysLeft: 11 });
  });

  it("warns every day of the last ten, and every day after", () => {
    expect(on("2027-10-09")).toEqual({ stage: "2027-10-19/day:2027-10-09", daysLeft: 10 });
    expect(on("2027-10-19")).toEqual({ stage: "2027-10-19/day:2027-10-19", daysLeft: 0 });
    expect(on("2027-10-21")).toEqual({ stage: "2027-10-19/expired:2027-10-21", daysLeft: -2 });
  });

  it("starts over for a new key", () => {
    expect(keyExpiryWarning("2028-10-19", "2028-09-29")?.stage).toBe("2028-10-19/20");
    expect(on("2027-09-29")?.stage).not.toBe(keyExpiryWarning("2028-10-19", "2028-09-29")?.stage);
  });
});
