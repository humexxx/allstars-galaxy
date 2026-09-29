import { describe, expect, it } from "vitest";

import { searchAirportsAction } from "./airports";

describe("searchAirportsAction", () => {
  it("finds an airport by its code", async () => {
    const result = await searchAirportsAction("MCO");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data[0]?.code).toBe("MCO");
  });

  it("returns nothing, not an error, for a query too short to search", async () => {
    await expect(searchAirportsAction("m")).resolves.toEqual({ success: true, data: [] });
  });

  it("refuses to scan an unbounded query", async () => {
    await expect(searchAirportsAction("x".repeat(500))).resolves.toEqual({
      success: true,
      data: [],
    });
  });

  it("finds nothing for a payload that is not a string", async () => {
    // A server action is a public POST endpoint; the argument is whatever was sent.
    await expect(searchAirportsAction(42 as unknown as string)).resolves.toEqual({
      success: true,
      data: [],
    });
  });
});
