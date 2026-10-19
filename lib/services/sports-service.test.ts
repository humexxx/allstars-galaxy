import { afterEach, describe, expect, it, vi } from "vitest";

// All DB chains in sports-service.ts terminate with await — the chainable mock
// returns `this` for builder methods and a thenable for the terminal one.
// Setting `select`/`insert`/`delete` per-test lets us inspect call args while
// controlling the resolved value.
const selectChain = {
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
};
const insertChain = {
  values: vi.fn(),
  onConflictDoNothing: vi.fn(),
};
const deleteChain = {
  where: vi.fn(),
};

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

import { db } from "@/db";
import type { DashboardMatch, DashboardSportCard } from "@/types/sports";

import gamesOct18 from "./__fixtures__/balldontlie-nba-games-2026-10-18.json";
import { fakeLolesports } from "./__fixtures__/lolesports";
import {
  __testing,
  getDashboardSportCard,
  listUserFavoriteSportIds,
  listUserSportsFavorites,
  setSportFavorite,
} from "./sports-service";

const dbMock = vi.mocked(db, true);

afterEach(() => {
  vi.clearAllMocks();
});

// ---------- Helpers ----------

function mockSelect(rows: unknown[]) {
  const thenable = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
  dbMock.select.mockReturnValue(thenable as never);
  selectChain.from = thenable.from;
  selectChain.where = thenable.where;
  selectChain.orderBy = thenable.orderBy;
  return thenable;
}

function mockInsert() {
  const thenable = {
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  };
  dbMock.insert.mockReturnValue(thenable as never);
  insertChain.values = thenable.values;
  insertChain.onConflictDoNothing = thenable.onConflictDoNothing;
  return thenable;
}

function mockDelete() {
  const thenable = {
    where: vi.fn().mockResolvedValue(undefined),
  };
  dbMock.delete.mockReturnValue(thenable as never);
  deleteChain.where = thenable.where;
  return thenable;
}

const USER_ID = "00000000-0000-0000-0000-000000000001";

// ---------- listUserSportsFavorites / listUserFavoriteSportIds ----------

describe("listUserSportsFavorites", () => {
  it("queries by userId and returns rows in creation order", async () => {
    const rows = [
      { id: "a", userId: USER_ID, sportId: "football", createdAt: new Date() },
      { id: "b", userId: USER_ID, sportId: "nba", createdAt: new Date() },
    ];
    const chain = mockSelect(rows);

    const result = await listUserSportsFavorites(USER_ID);

    expect(result).toEqual(rows);
    expect(dbMock.select).toHaveBeenCalledOnce();
    expect(chain.from).toHaveBeenCalledOnce();
    expect(chain.where).toHaveBeenCalledOnce();
    expect(chain.orderBy).toHaveBeenCalledOnce();
  });
});

describe("listUserFavoriteSportIds", () => {
  it("projects rows down to sportId strings", async () => {
    mockSelect([
      { id: "a", userId: USER_ID, sportId: "football", createdAt: new Date() },
      { id: "b", userId: USER_ID, sportId: "f1", createdAt: new Date() },
    ]);

    const ids = await listUserFavoriteSportIds(USER_ID);

    expect(ids).toEqual(["football", "f1"]);
  });

  it("returns an empty array when the user has no favourites", async () => {
    mockSelect([]);
    await expect(listUserFavoriteSportIds(USER_ID)).resolves.toEqual([]);
  });
});

// ---------- setSportFavorite ----------

describe("setSportFavorite", () => {
  it("upserts via insert + onConflictDoNothing when isFavorite=true", async () => {
    const chain = mockInsert();

    await setSportFavorite(USER_ID, "football", true);

    expect(dbMock.insert).toHaveBeenCalledOnce();
    expect(chain.values).toHaveBeenCalledWith({ userId: USER_ID, sportId: "football" });
    // The conflict target must scope by (userId, sportId) so we cannot dedupe
    // across users — the implementation passes a target object; we only assert
    // that it was called with one.
    expect(chain.onConflictDoNothing).toHaveBeenCalledOnce();
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it("deletes the row when isFavorite=false", async () => {
    const chain = mockDelete();

    await setSportFavorite(USER_ID, "football", false);

    expect(dbMock.delete).toHaveBeenCalledOnce();
    expect(chain.where).toHaveBeenCalledOnce();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

// ---------- getDashboardSportsSummary ----------

describe("getDashboardSportCard", () => {
  const nbaTeam = (id: number, name: string, abbreviation: string) => ({
    id,
    full_name: `${name} full`,
    name,
    abbreviation,
    conference: "East",
  });
  const nbaGame = (id: number, state: string, home: number, visitor: number) => ({
    id,
    date: "2026-10-20",
    datetime: "2026-10-20T23:00:00Z",
    season: 2026,
    status: state === "final" ? "Final" : "2026-10-20T23:00:00Z",
    status_state: state,
    postseason: false,
    postponed: false,
    home_team_score: home,
    visitor_team_score: visitor,
    home_team: nbaTeam(20, "Knicks", "NYK"),
    visitor_team: nbaTeam(2, "Celtics", "BOS"),
  });
  /**
   * The NBA's feeds on a fixed day: balldontlie's page, and ESPN answering
   * with no table and no preseason.
   */
  async function withNbaGames<T>(
    games: unknown[],
    run: () => Promise<T>,
    now = new Date(2026, 9, 21, 12)
  ): Promise<T> {
    vi.stubEnv("BALLDONTLIE_API_KEY", "test-key");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          new Response(JSON.stringify(url.includes("api.balldontlie.io") ? { data: games } : {}), {
            status: 200,
          })
        )
      )
    );
    try {
      return await run();
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new Error("fetch is disabled in unit tests")))
      );
    }
  }

  it("has no card for F1, which owns its own, or for sports it does not know", async () => {
    await expect(getDashboardSportCard("f1")).resolves.toBeNull();
    await expect(getDashboardSportCard("totally-unknown" as never)).resolves.toBeNull();
  });

  it("gives football the Champions League's featured match, what follows and its table", async () => {
    const card = (await getDashboardSportCard("football"))!;

    expect(card).toMatchObject({ sportId: "football", label: "Football", emoji: "⚽" });
    expect(card.context).toMatch(/Champions League/);
    expect(card.featured).toBeDefined();
    expect(card.matches.length).toBeLessThanOrEqual(2);
    expect(card.tables.map((t) => t.id)).toEqual(["table"]);
    expect(card.tables[0].rows).toHaveLength(5);
    expect(card.tables[0].rows[0]).toMatchObject({ position: 1, value: expect.stringMatching(/ pts$/) });
  });

  it("gives the NBA both conferences, each a W–L table", async () => {
    const card = (await getDashboardSportCard("nba"))!;

    expect(card.tables.map((t) => t.label)).toEqual(["East", "West"]);
    for (const table of card.tables) {
      expect(table.rows.map((r) => r.position)).toEqual([1, 2, 3, 4, 5]);
      expect(table.rows[0].value).toMatch(/^\d+–\d+$/);
    }
    expect(card.note).toBeUndefined();
  });

  it("puts last season's champion where the NBA's table will be, until the opener", async () => {
    const card = await withNbaGames(
      gamesOct18.data,
      () => getDashboardSportCard("nba"),
      new Date(2026, 9, 18, 12)
    );

    expect(card?.context).toBe("Season 2026–27");
    expect(card?.tables).toEqual([]);
    expect(card?.note).toEqual({
      title: "2025–26 champions",
      text: "New York Knicks, 4–1 over San Antonio",
      when: { label: "Tips off", startsAt: "2026-10-20T19:00:00.000Z" },
    });
    // The opener leads the card; June's finals are last season's.
    expect(card?.featured).toMatchObject({ status: "upcoming", home: { code: "DET" }, away: { code: "BOS" } });
  });

  it("says when the NBA's table starts when last season's finals are not on the page", async () => {
    const openers = gamesOct18.data.filter((g) => g.season === 2026);
    const card = await withNbaGames(openers, () => getDashboardSportCard("nba"), new Date(2026, 9, 18, 12));

    expect(card?.note).toEqual({
      title: "Standings start with the opener",
      when: { label: "Tips off", startsAt: "2026-10-20T19:00:00.000Z" },
    });
  });

  it("has no NBA note from the opener on", async () => {
    const card = await withNbaGames([nbaGame(1, "final", 110, 102)], () => getDashboardSportCard("nba"));
    expect(card?.note).toBeUndefined();
  });

  it("reads the NBA from the live feed, not the fixture", async () => {
    const card = await withNbaGames([nbaGame(1, "scheduled", 0, 0)], () => getDashboardSportCard("nba"));

    expect(card?.featured).toMatchObject({
      status: "upcoming",
      home: { name: "Knicks", score: null },
      away: { name: "Celtics", score: null },
    });
  });

  it("marks the winner of a finished game, and nobody's before it is played", async () => {
    const card = await withNbaGames([nbaGame(1, "final", 110, 102)], () => getDashboardSportCard("nba"));

    expect(card?.featured).toMatchObject({
      status: "result",
      home: { name: "Knicks", score: 110, winner: true },
      away: { name: "Celtics", score: 102, winner: false },
    });
  });

  it("gives tennis its tournament and both tours' rankings, with flags for the players", async () => {
    const card = (await getDashboardSportCard("tennis"))!;

    expect(card.featured).toBeUndefined();
    expect(card.tables.map((t) => t.label)).toEqual(["ATP", "WTA"]);
    expect(card.tables[0].rows[0]).toMatchObject({ position: 1, flagEmoji: expect.any(String) });
    expect(card.tables[0].rows[0].code).toBeUndefined();
  });

  it("features LoL's first match in display order and lists the next ones", async () => {
    const card = (await getDashboardSportCard("lol"))!;

    expect(card.featured).toBeDefined();
    expect(card.featured?.label).toMatch(/BO[135]$/);
    expect(card.matches.length).toBeLessThanOrEqual(4);
  });
});

describe("the LoL card across a season", () => {
  async function lolCardOn(now: string): Promise<DashboardSportCard> {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
    vi.stubGlobal("fetch", vi.fn(fakeLolesports(now)));
    return (await getDashboardSportCard("lol"))!;
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("fetch is disabled in unit tests")))
    );
  });

  const line = (m: DashboardMatch) => `${m.home.code} v ${m.away.code} ${m.status}`;
  const table = (card: DashboardSportCard) =>
    card.tables.map((t) => ({ label: t.label, rows: t.rows.map((r) => `${r.name} ${r.value}`) }));

  it("during the Swiss stage: the next match, four more and the records so far", async () => {
    const card = await lolCardOn("2026-10-23T23:00:00Z");

    expect(card.context).toBe("Worlds 2026 · Swiss");
    expect(line(card.featured!)).toBe("T1 v FLY upcoming");
    // "Up next" first, the latest result filling the rest.
    expect(card.matches.map(line)).toEqual([
      "AL v HLE upcoming",
      "TES v G2 upcoming",
      "PSG v GEN upcoming",
      "100T v BLG result",
    ]);
    expect(card.tables.map((t) => t.id)).toEqual(["swiss"]);
    expect(card.tables[0].rows.slice(0, 4).map((r) => r.value)).toEqual(["1–0", "1–0", "1–0", "1–0"]);
  });

  it("through the knockouts: no stale Swiss table, and six matches in its room", async () => {
    const card = await lolCardOn("2026-11-04T12:00:00Z");

    expect(card.context).toBe("Worlds 2026 · Quarterfinals");
    expect(card.tables).toEqual([]);
    expect(line(card.featured!)).toBe("AL v T1 upcoming");
    expect(card.matches.map(line)).toEqual([
      "HLE v CFO upcoming",
      "G2 v GEN upcoming",
      "KT v TES result",
      "T1 v MKOI result",
      "BLG v TES result",
      "FLY v CFO result",
    ]);
  });

  for (const day of ["2026-11-20", "2026-12-10", "2027-01-05"]) {
    it(`after the final (${day}): the final, the other knockouts and the season's champions`, async () => {
      const card = await lolCardOn(`${day}T12:00:00Z`);

      expect(card.context).toBe("Worlds 2026 · Finals");
      expect(card.featured).toMatchObject({
        status: "result",
        label: "Finals · BO5",
        startsAt: "2026-11-14T19:00:00Z",
        home: { code: "T1", score: 3, winner: true },
        away: { code: "GEN", score: 2, winner: false },
      });
      expect(card.matches.map(line)).toEqual([
        "HLE v GEN result",
        "KT v T1 result",
        "G2 v GEN result",
        "HLE v CFO result",
      ]);
      // Each region's from its Finals: LPL's last round (IG) is not its final.
      expect(table(card)).toEqual([
        {
          label: "2026 champions",
          rows: ["T1 Worlds", "Team Liquid LCS", "G2 Esports LEC", "Anyone's Legend LPL", "Gen.G LCK"],
        },
      ]);
      expect(card.tables[0].unranked).toBe(true);
    });
  }

  it("once LCK's new season starts: its next match, its results and its table", async () => {
    const card = await lolCardOn("2027-01-14T12:00:00Z");

    expect(card.context).toBe("LCK Split 1 · Week 1");
    expect(line(card.featured!)).toBe("HLE v BFX upcoming");
    expect(card.matches.map(line)).toEqual(["T1 v GEN result", "DK v KT result"]);
    expect(table(card)).toEqual([{ label: "Standings", rows: ["DK 1–0", "KT 0–1"] }]);
  });
});

describe("swissRecords", () => {
  const tie = (id: string, home: string | null, away: string | null, winner: string | null = null) => ({
    id,
    homeTeamId: home,
    awayTeamId: away,
    winnerTeamId: winner,
    status: winner ? ("ft" as const) : ("scheduled" as const),
  });

  it("is empty until a match has been decided", () => {
    const stage = {
      winsToAdvance: 3,
      lossesToExit: 3,
      rounds: [[{ wins: 0, losses: 0, matches: [tie("1", "gen", "ig"), tie("2", "t1", "los")] }]],
      exits: [],
    };
    expect(__testing.swissRecords(stage)).toEqual([]);
  });

  it("ranks every team by its record so far, best first", () => {
    const stage = {
      winsToAdvance: 3,
      lossesToExit: 3,
      rounds: [
        [{ wins: 0, losses: 0, matches: [tie("1", "gen", "ig", "gen"), tie("2", "t1", "los", "t1")] }],
        [
          { wins: 1, losses: 0, matches: [tie("3", "gen", "t1", "t1")] },
          { wins: 0, losses: 1, matches: [tie("4", "ig", "los")] },
        ],
      ],
      exits: [],
    };
    expect(__testing.swissRecords(stage).map((r) => [r.teamId, `${r.wins}-${r.losses}`])).toEqual([
      ["t1", "2-0"],
      ["gen", "1-1"],
      ["ig", "0-1"],
      ["los", "0-1"],
    ]);
  });

  it("does not count a series still being played, even with a leader", () => {
    const live = { ...tie("3", "gen", "t1", "t1"), status: "live" as const };
    const stage = {
      winsToAdvance: 3,
      lossesToExit: 3,
      rounds: [
        [{ wins: 0, losses: 0, matches: [tie("1", "gen", "ig", "gen"), tie("2", "t1", "los", "t1")] }],
        [{ wins: 1, losses: 0, matches: [live] }],
      ],
      exits: [],
    };
    expect(__testing.swissRecords(stage).map((r) => [r.teamId, `${r.wins}-${r.losses}`])).toEqual([
      ["gen", "1-0"],
      ["t1", "1-0"],
      ["ig", "0-1"],
      ["los", "0-1"],
    ]);
  });
});
