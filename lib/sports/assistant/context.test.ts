import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services/sports-service", () => ({ listUserSportsFavorites: vi.fn(async () => []) }));
vi.mock("@/lib/services/football-service", () => ({ FOOTBALL_COMPETITIONS: [] }));
vi.mock("@/lib/sports/load", () => ({ footballLeagueFrom: (league?: string) => league ?? "PL" }));

import { describePage } from "./context";

describe("describePage", () => {
  it("decodes a tournament id from the path", () => {
    expect(describePage("/portal/entertainment/sports/padel/premier%20padel", [])).toContain(
      "tournament with id premier padel"
    );
  });

  it("keeps a malformed escape as it came instead of throwing", () => {
    // "%E0" is not valid UTF-8: decodeURIComponent threw and the POST was a 500.
    expect(describePage("/portal/entertainment/sports/tennis/%E0", [])).toContain("tournament with id %E0");
  });
});
