import { describe, expect, it } from "vitest";

import { matchTimeFormat } from "./match-time";

describe("matchTimeFormat", () => {
  const kickoff = "2026-07-05T20:00:00Z";

  it("prints a kickoff in the zone it is given, not the runtime's", () => {
    // The bug: the server printed 8:00 PM (UTC), the browser 2:00 PM.
    const costaRica = matchTimeFormat("America/Costa_Rica");
    expect(costaRica.time(kickoff)).toBe("2:00 PM");
    expect(costaRica.dayTime(kickoff)).toBe("Sun, Jul 5, 2:00 PM");
    expect(matchTimeFormat("UTC").time(kickoff)).toBe("8:00 PM");
  });

  it("moves the day with the zone", () => {
    expect(matchTimeFormat("Asia/Tokyo").shortDay(kickoff)).toBe("Jul 6");
  });

  it("keeps a date-only string on its calendar day in every zone", () => {
    expect(matchTimeFormat("America/Los_Angeles").day("2026-03-08")).toBe("Mar 8, 2026");
    expect(matchTimeFormat("Pacific/Auckland").shortDay("2026-03-08")).toBe("Mar 8");
  });

  it("ignores a zone Intl does not know", () => {
    expect(() => matchTimeFormat("Not/AZone").time(kickoff)).not.toThrow();
  });
});
