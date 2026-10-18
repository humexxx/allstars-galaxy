import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { NFL_DATA } from "@/lib/data/sports/nfl";

import { loadSport } from "./load";

describe("loadSport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("fetch is disabled in unit tests")))
    );
  });

  it("flags a sport that is showing its fixture", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // The test setup refuses every fetch, so the feed has no live answer.
    const payload = await loadSport("nfl");
    expect(payload).toMatchObject({ sport: "nfl", sample: true });
    expect(payload.sport === "nfl" && payload.data).toBe(NFL_DATA);
  });

  it("does not flag a live answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              url.includes("/standings")
                ? { children: [] }
                : {
                    season: { year: 2026, type: 2 },
                    events: [
                      {
                        id: "1",
                        season: { year: 2026, type: 2 },
                        week: { number: 6 },
                        competitions: [
                          {
                            date: "2026-10-19T00:20Z",
                            status: { type: { name: "STATUS_SCHEDULED", state: "pre" } },
                            competitors: [
                              { homeAway: "home", score: "0", team: { abbreviation: "GB" } },
                              { homeAway: "away", score: "0", team: { abbreviation: "DAL" } },
                            ],
                          },
                        ],
                      },
                    ],
                  }
            ),
            { status: 200 }
          )
        )
      )
    );
    const payload = await loadSport("nfl");
    expect(payload.sample).toBe(false);
    expect(payload.sport === "nfl" && payload.data.games[0].stageLabel).toBe("Week 6");
  });
});
