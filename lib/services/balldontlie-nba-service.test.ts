import { describe, expect, it } from "vitest";

import { __testing } from "./balldontlie-nba-service";

const { currentSeason, seasonLabel, recentAndNext, statusFrom, gameWindow } = __testing;

const game = (date: string, final = false) => ({
    id: 1,
    date,
    datetime: `${date}T00:00:00Z`,
    season: 2025,
    status: final ? "Final" : date,
    status_state: final ? "final" : "scheduled",
    postseason: false,
    postponed: false,
    home_team_score: 0,
    visitor_team_score: 0,
});

describe("currentSeason", () => {
  it("names a season by the year it starts in", () => {
    // The NBA labels 2026–27 as "2026", and before October the season that
    // matters is still the previous one.
    expect(currentSeason(new Date("2026-08-24"))).toBe(2025);
    expect(currentSeason(new Date("2026-10-20"))).toBe(2026);
  });

  it("spans the new year", () => {
    expect(seasonLabel(2025)).toBe("2025–26");
    expect(seasonLabel(2099)).toBe("2099–00");
  });
});

describe("recentAndNext", () => {
  it("keeps the last results and the next fixtures out of one window", () => {
    // Out of season the nearest games are months away in BOTH directions:
    // June's finals behind, October's opener ahead. One wide request has to
    // serve both, because the free tier allows five a minute.
    const games = [
      ...["2026-06-03", "2026-06-05", "2026-06-08"].map((d) => game(d, true)),
      ...["2026-10-20", "2026-10-21"].map((d) => game(d)),
    ];
    const out = recentAndNext(games as never);

    expect(out.map((g) => g.date)).toEqual([
      "2026-06-03", "2026-06-05", "2026-06-08", "2026-10-20", "2026-10-21",
    ]);
  });

  it("trims a long season down to six either side of today", () => {
    const games = Array.from({ length: 20 }, (_, i) =>
      game(`2026-01-${String(i + 1).padStart(2, "0")}`, i < 10)
    );
    const out = recentAndNext(games as never);

    expect(out).toHaveLength(12);
    expect(out[0].date).toBe("2026-01-05");
  });
});

describe("statusFrom", () => {
  it("reads the state, not the human-readable clock", () => {
    expect(statusFrom(game("2026-06-03", true) as never)).toBe("ft");
    expect(statusFrom(game("2026-10-20") as never)).toBe("scheduled");
    expect(statusFrom({ ...game("2026-10-20"), status_state: "in" } as never)).toBe("live");
    expect(statusFrom({ ...game("2026-10-20"), postponed: true } as never)).toBe("postponed");
  });
});

describe("gameWindow", () => {
  it("asks for a few nights either side of today in season", () => {
    // One page is the OLDEST hundred games in the range. ±130 days in
    // December would have stopped at the season's first fortnight.
    expect(gameWindow(new Date(2026, 11, 15, 12))).toEqual({
      start: "2026-12-11",
      end: "2026-12-19",
    });
  });

  it("starts at the finals out of season, never on a March night", () => {
    expect(gameWindow(new Date(2026, 6, 1, 12))).toEqual({
      start: "2026-06-01",
      end: "2026-11-08",
    });
  });

  it("keeps the finals in view until the new season has a week of games", () => {
    expect(gameWindow(new Date(2026, 9, 18, 12)).start).toBe("2026-06-01");
    expect(gameWindow(new Date(2026, 9, 28, 12))).toEqual({
      start: "2026-10-24",
      end: "2026-11-01",
    });
  });

  it("stays narrow while the finals are still being played", () => {
    expect(gameWindow(new Date(2026, 5, 10, 12)).start).toBe("2026-06-06");
  });
});
