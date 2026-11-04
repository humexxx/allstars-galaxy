import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { getFootballLeague } from "@/lib/data/sports/football";
import { NFL_DATA } from "@/lib/data/sports/nfl";
import { WORLD_CUP_DATA } from "@/lib/data/sports/world-cup";

import { footballLeagueFrom, loadSport } from "./load";

describe("footballLeagueFrom", () => {
  it("takes a league the picker offers", () => {
    expect(footballLeagueFrom("serie-a")).toBe("serie-a");
  });

  it("offers the World Cup among football's competitions", () => {
    expect(footballLeagueFrom("world-cup")).toBe("world-cup");
  });

  it("falls back to the first league for anything else", () => {
    expect(footballLeagueFrom(undefined)).toBe("uefa-champions-league");
    expect(footballLeagueFrom("nope")).toBe("uefa-champions-league");
  });
});

describe("loadSport", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
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

  it("fetches only the league in the URL", async () => {
    // All four leagues were eight of football-data's ten requests a minute.
    vi.stubEnv("FOOTBALL_DATA_API_KEY", "test-key");
    const fetchSpy = vi.fn((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.includes("/standings")
              ? {
                  season: { startDate: "2026-08-23", endDate: "2027-05-30" },
                  standings: [
                    {
                      type: "TOTAL",
                      table: [
                        {
                          position: 1,
                          team: { id: 108, name: "Inter", shortName: "Inter", tla: "INT" },
                          playedGames: 7,
                          won: 6,
                          draw: 1,
                          lost: 0,
                          goalsFor: 15,
                          goalsAgainst: 4,
                          points: 19,
                        },
                      ],
                    },
                  ],
                }
              : { matches: [] }
          ),
          { status: 200 }
        )
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    const payload = await loadSport("football", { league: "serie-a" });

    // Two football-data requests, both for the league asked for; the news is
    // ESPN's and costs football-data nothing.
    const urls = fetchSpy.mock.calls.map(([url]) => url);
    const footballData = urls.filter((url) => !url.includes("site.api.espn.com"));
    expect(footballData).toHaveLength(2);
    for (const url of footballData) expect(url).toContain("/competitions/SA/");
    expect(urls.filter((url) => url.includes("site.api.espn.com"))).toEqual([
      "https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/news?limit=24",
    ]);
    expect(payload).toMatchObject({ sport: "football", sample: false });
    if (payload.sport !== "football") throw new Error("not football");
    expect(payload.league.league.id).toBe("serie-a");
    expect(payload.options.map((o) => o.id)).toEqual([
      "uefa-champions-league",
      "la-liga",
      "premier-league",
      "serie-a",
      "ligue-1",
      "bundesliga",
      "mls",
      "costa-rica",
      "world-cup",
    ]);
  });

  it.each([
    ["mls", "usa.1", "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/news?limit=24"],
    ["costa-rica", "crc.1", "https://site.api.espn.com/apis/site/v2/sports/soccer/crc.1/news?limit=24&lang=es&region=cr"],
  ])("reads %s from ESPN alone, spending no football-data request", async (league, slug, newsUrl) => {
    vi.stubEnv("FOOTBALL_DATA_API_KEY", "test-key");
    const event = {
      id: "761904",
      date: "2026-10-26T01:00:00Z",
      season: 2026,
      seasonType: "1",
      fullStatus: { type: { name: "STATUS_SCHEDULED", state: "pre", shortDetail: "Scheduled" } },
      competitors: [
        { homeAway: "home", abbreviation: "LAFC", displayName: "LAFC", name: "LAFC", score: "" },
        { homeAway: "away", abbreviation: "LA", displayName: "LA Galaxy", name: "LA Galaxy", score: "" },
      ],
    };
    const fetchSpy = vi.fn((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            url.includes("/scoreboard/header")
              ? { sports: [{ leagues: [{ events: [event] }] }] }
              : url.includes("/standings")
                ? { children: [] }
                : url.includes("/teams")
                  ? { sports: [] }
                  : { articles: [] }
          ),
          { status: 200 }
        )
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    const payload = await loadSport("football", { league });

    const urls: string[] = fetchSpy.mock.calls.map(([url]) => url);
    expect(urls.filter((url) => url.includes("football-data.org"))).toEqual([]);
    expect(urls.filter((url) => url.includes("/scoreboard/header")).every((url) => url.includes(`league=${slug}`))).toBe(true);
    expect(urls).toContain(newsUrl);
    if (payload.sport !== "football") throw new Error("not football");
    expect(payload.sample).toBe(false);
    expect(payload.league.league.id).toBe(league);
    expect(payload.league.matches.map((m) => m.id)).toEqual(["761904"]);
  });

  it("flags MLS when ESPN does not answer, showing its fixture", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const payload = await loadSport("football", { league: "mls" });
    expect(payload.sample).toBe(true);
    expect(payload.sport === "football" && payload.league).toBe(getFootballLeague("mls"));
  });

  it("reads the World Cup from its own feed when football picks it", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const payload = await loadSport("football", { league: "world-cup" });
    if (payload.sport !== "football") throw new Error("not football");
    expect(payload.league).toBe(WORLD_CUP_DATA);
    expect(payload.sample).toBe(true);
  });

  it("flags a league that is showing its fixture", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const payload = await loadSport("football", { league: "la-liga" });
    expect(payload.sample).toBe(true);
    expect(payload.sport === "football" && payload.league).toBe(getFootballLeague("la-liga"));
  });
});
