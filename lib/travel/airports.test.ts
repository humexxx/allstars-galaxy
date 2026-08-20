import { describe, expect, it } from "vitest";

import { countryFlag, findAirport, searchAirports } from "./airports";

describe("countryFlag", () => {
  it("builds a flag from an ISO-2 code", () => {
    expect(countryFlag("CR")).toBe("🇨🇷");
    expect(countryFlag("us")).toBe("🇺🇸");
  });

  it("returns nothing rather than mojibake for a bad code", () => {
    expect(countryFlag("USA")).toBe("");
    expect(countryFlag("")).toBe("");
  });
});

describe("searchAirports", () => {
  it("puts the exact code first", () => {
    // "SJO" must be San José, not buried under names containing those letters.
    const [first] = searchAirports("SJO");
    expect(first.code).toBe("SJO");
    expect(first.city).toBe("San Jose");
    expect(first.country).toBe("CR");
    expect(first.flag).toBe("🇨🇷");
  });

  it("finds an airport by city", () => {
    const hits = searchAirports("orlando");
    expect(hits.some((a) => a.code === "MCO")).toBe(true);
  });

  it("finds an airport by name", () => {
    const hits = searchAirports("juan santamaria");
    expect(hits[0].code).toBe("SJO");
  });

  it("is case and space insensitive", () => {
    expect(searchAirports("  mco  ")[0].code).toBe("MCO");
  });

  it("returns nothing for a query too short to mean anything", () => {
    // One letter would match thousands and help nobody.
    expect(searchAirports("m")).toEqual([]);
    expect(searchAirports("")).toEqual([]);
  });

  it("caps how many it hands back", () => {
    expect(searchAirports("san").length).toBeLessThanOrEqual(8);
  });

  it("returns nothing for a query that matches nothing", () => {
    expect(searchAirports("zzzzzznotanairport")).toEqual([]);
  });
});

describe("findAirport", () => {
  it("resolves a saved code to its details", () => {
    expect(findAirport("mco")?.city).toBe("Orlando");
  });

  it("returns null for an unknown or empty code", () => {
    expect(findAirport("ZZZ")).toBeNull();
    expect(findAirport(null)).toBeNull();
  });
});
