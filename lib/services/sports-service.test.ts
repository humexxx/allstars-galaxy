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
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { db } from "@/db";
import { getFootballLeague } from "@/lib/data/sports/football";
import { WORLD_CUP_DATA } from "@/lib/data/sports/world-cup";
import type { BracketMatch, DashboardMatch, DashboardSportCard, LolRegion, LolSplit, RacquetData, RacquetTournament, SurfData, SurfEvent, SwissMatch, SwissStage, Team } from "@/types/sports";

import gamesOct18 from "./__fixtures__/balldontlie-nba-games-2026-10-18.json";
import { fakeLolesports } from "./__fixtures__/lolesports";
import {
  __testing,
  getDashboardSportCard,
  listUserFavoriteSportIds,
  listUserFavoriteSports,
  listUserSportsFavorites,
  getSportTeamFilter,
  setSportCompetition,
  setSportFavorite,
  setSportTeamFilter,
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

function mockUpdate(rows: unknown[]) {
  const thenable = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  };
  dbMock.update.mockReturnValue(thenable as never);
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

describe("listUserFavoriteSports", () => {
  it("carries each favourite's championship, null where none is set", async () => {
    mockSelect([
      { id: "a", userId: USER_ID, sportId: "lol", competition: "lck", createdAt: new Date() },
      { id: "b", userId: USER_ID, sportId: "nba", competition: null, createdAt: new Date() },
    ]);

    await expect(listUserFavoriteSports(USER_ID)).resolves.toEqual([
      { sportId: "lol", competition: "lck" },
      { sportId: "nba", competition: null },
    ]);
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

// ---------- setSportCompetition ----------

describe("setSportCompetition", () => {
  it("updates only the caller's favourite row for that sport and hands it back", async () => {
    const row = { id: "a", userId: USER_ID, sportId: "lol", competition: "lck", createdAt: new Date() };
    const chain = mockUpdate([row]);

    await expect(setSportCompetition(USER_ID, "lol", "lck")).resolves.toEqual(row);

    expect(dbMock.update).toHaveBeenCalledOnce();
    expect(chain.set).toHaveBeenCalledWith({ competition: "lck" });
    expect(chain.where).toHaveBeenCalledOnce();
    // Never an insert: a card, and so a choice, exists only for a favourite.
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("stores null for the card's own pick", async () => {
    const chain = mockUpdate([{ id: "a" }]);

    await setSportCompetition(USER_ID, "lol", null);

    expect(chain.set).toHaveBeenCalledWith({ competition: null });
  });

  it("is null when the sport is not one of the caller's favourites", async () => {
    mockUpdate([]);

    await expect(setSportCompetition(USER_ID, "lol", "lck")).resolves.toBeNull();
  });
});

// ---------- team filters ----------

describe("getSportTeamFilter", () => {
  function mockFilterRow(rows: unknown[]) {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(rows),
    };
    dbMock.select.mockReturnValue(chain as never);
    return chain;
  }

  it("hands back the teams last picked in that list", async () => {
    const chain = mockFilterRow([{ teamIds: ["arsenal", "chelsea"] }]);

    await expect(
      getSportTeamFilter(USER_ID, { sportId: "football", competition: "premier-league" })
    ).resolves.toEqual(["arsenal", "chelsea"]);
    expect(chain.where).toHaveBeenCalledOnce();
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it("is every team, [], when nothing is remembered", async () => {
    mockFilterRow([]);

    await expect(getSportTeamFilter(USER_ID, { sportId: "nba", competition: "nba" })).resolves.toEqual([]);
  });
});

describe("setSportTeamFilter", () => {
  function mockUpsert(rows: unknown[]) {
    const chain = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue(rows),
    };
    dbMock.insert.mockReturnValue(chain as never);
    return chain;
  }

  it("upserts the caller's row for that list, each team once, in the order picked", async () => {
    const row = { id: "f", teamIds: ["chelsea", "arsenal"] };
    const chain = mockUpsert([row]);

    await expect(
      setSportTeamFilter(USER_ID, { sportId: "football", competition: "premier-league" }, [
        "chelsea",
        "arsenal",
        "chelsea",
      ])
    ).resolves.toEqual(row);

    expect(chain.values).toHaveBeenCalledWith({
      userId: USER_ID,
      sportId: "football",
      competition: "premier-league",
      teamIds: ["chelsea", "arsenal"],
    });
    const [conflict] = chain.onConflictDoUpdate.mock.calls[0];
    expect(conflict.target).toHaveLength(3);
    expect(conflict.set.teamIds).toEqual(["chelsea", "arsenal"]);
    expect(conflict.set.updatedAt).toBeInstanceOf(Date);
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it("deletes the row for every team rather than keep an empty one", async () => {
    const chain = mockDelete();

    await expect(setSportTeamFilter(USER_ID, { sportId: "nfl", competition: "nfl" }, [])).resolves.toBeNull();

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
    // Stepped through in the lead box rather than listed under it.
    expect(card.following!.length).toBeLessThanOrEqual(4);
    expect(card.matches).toEqual([]);
    expect(card.tables.map((t) => t.id)).toEqual(["table"]);
    expect(card.tables[0].rows).toHaveLength(5);
    expect(card.tables[0].rows[0]).toMatchObject({ position: 1, value: expect.stringMatching(/ pts$/) });
  });

  it("gives football, the NBA and the NFL their latest ESPN news, and no clips", async () => {
    const article = (id: number, type: string, headline: string) => ({
      id,
      type,
      headline,
      published: `2026-10-24T0${id}:00:00Z`,
      images: [{ type: "header", url: `https://a.espncdn.com/photo/${id}.jpg`, width: 600 }],
      links: { web: { href: `https://www.espn.com/nba/story/_/id/${id}` } },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("site.api.espn.com") && url.includes("/news")
          ? new Response(
              JSON.stringify({
                articles: [
                  article(1, "HeadlineNews", "Giannis stays hot"),
                  article(2, "Media", "Game Highlights"),
                  article(3, "Recap", "Lakers past Clippers"),
                ],
              }),
              { status: 200 }
            )
          : Promise.reject(new Error("fetch is disabled in unit tests"))
      )
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      for (const sport of ["football", "nba", "nfl"] as const) {
        const card = (await getDashboardSportCard(sport))!;
        expect(card.news?.map((n) => n.headline)).toEqual(["Lakers past Clippers", "Giannis stays hot"]);
      }
    } finally {
      vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("fetch is disabled in unit tests"))));
    }
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

  it("steps through the four games after the featured one, soonest first", async () => {
    const at = (id: number, hour: number) => {
      const datetime = `2026-10-22T0${hour}:00:00Z`;
      return { ...nbaGame(id, "scheduled", 0, 0), date: "2026-10-22", datetime, status: datetime };
    };
    const games = [at(5, 5), at(1, 1), at(7, 7), at(3, 3), at(2, 2), at(6, 6), at(4, 4)];
    const card = (await withNbaGames(games, () => getDashboardSportCard("nba")))!;

    const hours = [card.featured!, ...card.following!].map((m) => new Date(m.startsAt).getUTCHours());
    expect(hours).toEqual([1, 2, 3, 4, 5]);
    expect(card.matches).toEqual([]);
  });

  it("steps through the day's games in the order they are played, the results first", async () => {
    const at = (id: number, state: string, hour: number) => {
      const datetime = `2026-10-21T0${hour}:00:00Z`;
      return { ...nbaGame(id, state, 50, 40), date: "2026-10-21", datetime, status: state === "final" ? "Final" : datetime };
    };
    const busy = (await withNbaGames(
      [at(1, "scheduled", 9), at(2, "in", 1), at(3, "in", 2), at(4, "final", 0)],
      () => getDashboardSportCard("nba")
    ))!;
    expect([busy.featured!, ...busy.following!].map((m) => m.status)).toEqual(["result", "live", "live", "upcoming"]);

    const over = (await withNbaGames(
      [at(1, "final", 1), at(2, "final", 3), at(3, "final", 2)],
      () => getDashboardSportCard("nba")
    ))!;
    const hours = [over.featured!, ...over.following!].map((m) => new Date(m.startsAt).getUTCHours());
    expect(hours).toEqual([1, 2, 3]);
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

  it("gives tennis its tournament and the ATP's rankings, with flags for the players", async () => {
    const card = (await getDashboardSportCard("tennis"))!;

    expect(card.featured).toBeUndefined();
    expect(card.context).toBe("ATP");
    expect(card.tables.map((t) => t.label)).toEqual(["Rankings"]);
    expect(card.tables[0].rows[0]).toMatchObject({ position: 1, flagEmoji: expect.any(String) });
    expect(card.tables[0].rows[0].code).toBeUndefined();
  });

  it("offers football's leagues, the Champions League shown when none is chosen", async () => {
    const card = (await getDashboardSportCard("football"))!;

    expect(card.competitions).toEqual({
      value: "uefa-champions-league",
      options: [
        { id: "uefa-champions-league", label: "UEFA Champions League" },
        { id: "la-liga", label: "LaLiga" },
        { id: "premier-league", label: "Premier League" },
        { id: "serie-a", label: "Serie A" },
        { id: "ligue-1", label: "Ligue 1" },
        { id: "bundesliga", label: "Bundesliga" },
        { id: "mls", label: "Major League Soccer" },
        { id: "costa-rica", label: "Primera División de Costa Rica" },
        { id: "world-cup", label: "FIFA World Cup 2026" },
      ],
    });
  });

  it("reads the league football's card is set to", async () => {
    const card = (await getDashboardSportCard("football", "la-liga"))!;

    expect(card.context).toBe(getFootballLeague("la-liga").league.name);
    expect(card.competitions?.value).toBe("la-liga");
    expect(card.tables[0].rows).toHaveLength(5);
  });

  it("gives MLS a table a conference, East and West", async () => {
    const card = (await getDashboardSportCard("football", "mls"))!;

    expect(card.context).toBe("Major League Soccer");
    expect(card.competitions?.value).toBe("mls");
    expect(card.tables.map((t) => t.label)).toEqual(["East", "West"]);
    expect(card.tables[0].rows[0]).toMatchObject({ position: 1, name: "Nashville", value: "70 pts" });
    expect(card.tables[1].rows).toHaveLength(5);
  });

  it("reads Costa Rica's one table", async () => {
    const card = (await getDashboardSportCard("football", "costa-rica"))!;

    expect(card.tables.map((t) => t.label)).toEqual(["Table"]);
    expect(card.tables[0].rows[0]).toMatchObject({ position: 1, name: "Saprissa" });
  });

  it("reads the World Cup from its own feed", async () => {
    const card = (await getDashboardSportCard("football", "world-cup"))!;

    expect(card.context).toBe(WORLD_CUP_DATA.league.name);
    expect(card.competitions?.value).toBe("world-cup");
    expect(card.featured).toBeDefined();
  });

  it("falls back to the Champions League for a league football no longer offers", async () => {
    const card = (await getDashboardSportCard("football", "eredivisie"))!;

    expect(card.context).toMatch(/Champions League/);
    expect(card.competitions?.value).toBe("uefa-champions-league");
  });

  it("offers no tour to pick for tennis or padel, whatever is stored: men only", async () => {
    // A favourite set to the WTA or the women's draw before they were dropped.
    const tennis = (await getDashboardSportCard("tennis", "wta"))!;
    const padel = (await getDashboardSportCard("padel", "women"))!;

    expect(tennis.competitions).toBeUndefined();
    expect(tennis.tables[0].rows[0].name).not.toBe("I. Świątek");
    expect(padel.competitions).toBeUndefined();
    expect(padel.context).toBe("Premier Padel");
    expect(padel.tables.map((t) => t.label)).toEqual(["Rankings"]);
  });

  it("offers no choice for the NBA, whatever is stored", async () => {
    const card = (await getDashboardSportCard("nba", "east"))!;

    expect(card.competitions).toBeUndefined();
    expect(card.tables.map((t) => t.label)).toEqual(["East", "West"]);
  });

  it("features LoL's first match in display order and lists the next ones", async () => {
    const card = (await getDashboardSportCard("lol"))!;

    expect(card.featured).toBeDefined();
    expect(card.featured?.label).toMatch(/BO[135]$/);
    expect(card.matches.length).toBeLessThanOrEqual(4);
  });
});

describe("the LoL card across a season", () => {
  async function lolCardOn(now: string, competition: string | null = null): Promise<DashboardSportCard> {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
    vi.stubGlobal("fetch", vi.fn(fakeLolesports(now)));
    return (await getDashboardSportCard("lol", competition))!;
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

  it("during the Swiss stage: yesterday's results and the next games in the box, and the stage by record", async () => {
    const card = await lolCardOn("2026-10-23T23:00:00Z");

    expect(card.context).toBe("Worlds 2026 · Swiss");
    // The latest three of yesterday's and today's, then two still to come, in the order played.
    expect([card.featured!, ...card.following!].map(line)).toEqual([
      "FNC v CFO result",
      "MKOI v KT result",
      "100T v BLG result",
      "T1 v FLY upcoming",
      "AL v HLE upcoming",
    ]);
    expect(card.matches).toEqual([]);
    expect(card.tables).toEqual([]);
    // Best record first; the teams yet to play their first series are on 0–0.
    expect(card.swiss!.pools.map((p) => [p.label, p.teams.map((t) => t.code)])).toEqual([
      ["1–0", ["TSW", "CFO", "KT", "100T"]],
      ["0–0", ["T1", "FLY", "AL", "HLE", "TES", "G2", "PSG", "GEN"]],
      ["0–1", ["VKS", "FNC", "MKOI", "BLG"]],
    ]);
  });

  it("puts those through and those out on a row each, the rest by record", () => {
    const played = (id: string, home: string, away: string, winner: string | null): SwissMatch => ({
      id,
      homeTeamId: home,
      awayTeamId: away,
      winnerTeamId: winner,
      status: winner ? "ft" : "scheduled",
    });
    const stage: SwissStage = {
      winsToAdvance: 2,
      lossesToExit: 2,
      rounds: [
        [{ wins: 0, losses: 0, matches: [played("1", "A", "B", "A"), played("2", "C", "D", "C"), played("3", "E", "F", null)] }],
        [
          { wins: 1, losses: 0, matches: [played("4", "A", "C", "A")] },
          { wins: 0, losses: 1, matches: [played("5", "B", "D", "B")] },
        ],
      ],
      exits: [
        { wins: 2, losses: 0, advanced: true, slots: 1, teamIds: ["A"] },
        { wins: 0, losses: 2, advanced: false, slots: 1, teamIds: [] },
      ],
    };
    const swiss = __testing.lolSwiss({ swiss: stage } as LolSplit, new Map());
    expect(swiss!.pools.map((p) => [p.label, p.outcome, p.teams.map((t) => t.name)])).toEqual([
      ["Through", "through", ["A"]],
      ["1–1", undefined, ["B", "C"]],
      ["0–0", undefined, ["E", "F"]],
      ["Out", "out", ["D"]],
    ]);
  });

  it("through the knockouts: no stale Swiss stage, the latest result and the games still to come", async () => {
    const card = await lolCardOn("2026-11-04T12:00:00Z");

    expect(card.context).toBe("Worlds 2026 · Quarterfinals");
    expect(card.tables).toEqual([]);
    expect(card.swiss).toBeUndefined();
    expect([card.featured!, ...card.following!].map(line)).toEqual([
      "KT v TES result",
      "AL v T1 upcoming",
      "HLE v CFO upcoming",
      "G2 v GEN upcoming",
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
      expect(card.following!.map(line)).toEqual([
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

  it("offers the events in today's feed, following what's on until one is chosen", async () => {
    const card = await lolCardOn("2026-10-23T23:00:00Z");

    expect(card.competitions?.value).toBeNull();
    expect(card.competitions?.automatic).toBe("Follow what's on");
    // The feed's order: the event on, then the splits by how recently they ended.
    expect(card.competitions?.options).toEqual([
      { id: "worlds", label: "Worlds 2026" },
      { id: "lcs", label: "LCS Split 3" },
      { id: "lec", label: "LEC Split 3" },
      { id: "lpl", label: "LPL Split 3" },
      { id: "lck", label: "LCK Split 3" },
    ]);
  });

  it("shows the split it is set to, during Worlds too", async () => {
    const card = await lolCardOn("2026-10-23T23:00:00Z", "lck");

    expect(card.competitions?.value).toBe("lck");
    expect(card.context).toBe("LCK Split 3 · Finals");
    expect(card.tables.map((t) => t.label)).toEqual(["Standings"]);
  });

  it("follows what's on when the event it was set to is not in today's feed", async () => {
    // MSI is over: out of season the feed lists no international event but Worlds.
    const card = await lolCardOn("2026-10-23T23:00:00Z", "msi");

    expect(card.context).toBe("Worlds 2026 · Swiss");
    expect(card.competitions?.value).toBeNull();
    expect(card.competitions?.options.map((o) => o.id)).not.toContain("msi");
    // Still stored, and back when MSI is: the picker ticks it so it can be cleared.
    expect(card.competitions?.waiting).toEqual({ id: "msi", label: "MSI" });
  });

  it("has nothing waiting when the stored split is on, or none is stored", async () => {
    expect((await lolCardOn("2026-10-23T23:00:00Z", "lck")).competitions?.waiting).toBeUndefined();
    expect((await lolCardOn("2026-10-23T23:00:00Z")).competitions?.waiting).toBeUndefined();
  });

  it("once LCK's new season starts: its next match, its results and its table", async () => {
    const card = await lolCardOn("2027-01-14T12:00:00Z");

    expect(card.context).toBe("LCK Split 1 · Week 1");
    // Yesterday's and today's results, then tomorrow's game.
    expect([card.featured!, ...card.following!].map(line)).toEqual([
      "DK v KT result",
      "T1 v GEN result",
      "HLE v BFX upcoming",
    ]);
    expect(table(card)).toEqual([{ label: "Standings", rows: ["DK 1–0", "KT 0–1"] }]);
  });
});

describe("the LoL card after MSI or First Stand", () => {
  const base = { sportId: "lol", label: "League of Legends", emoji: "🎮" } as const;
  const team = (code: string): Team => ({ id: code.toLowerCase(), name: code, shortName: code, code });
  function finished(
    region: LolRegion,
    name: string,
    [winner, loser]: [string, string],
    date: string
  ): LolSplit {
    const final: BracketMatch = {
      id: `${region}-final`,
      homeTeamId: winner.toLowerCase(),
      awayTeamId: loser.toLowerCase(),
      homeScore: 3,
      awayScore: 1,
      winnerTeamId: winner.toLowerCase(),
      date,
      bestOf: 5,
    };
    return {
      region,
      name,
      season: "2027",
      ...(region === "msi" || region === "first-stand" ? { international: true } : {}),
      teams: [team(winner), team(loser)],
      standings: [],
      matches: [],
      playoffs: [{ id: "final", label: "Finals", matches: [final] }],
      champion: { teamId: final.winnerTeamId!, final },
    };
  }

  it.each([
    ["first-stand", "First Stand 2027"],
    ["msi", "MSI 2027"],
  ] as const)("after %s's final the split winners are the latest champions, not the season's", (region, name) => {
    const card = __testing.lolCard(base, {
      splits: [
        finished(region, name, ["GEN", "BLG"], "2027-03-22T12:00:00Z"),
        finished("lck", "LCK Split 1", ["HLE", "T1"], "2027-03-01T08:00:00Z"),
        finished("lec", "LEC Split 1", ["G2", "FNC"], "2027-03-08T16:00:00Z"),
      ],
    });

    expect(card.context).toBe(`${name} · Finals`);
    expect(card.tables.map((t) => ({ label: t.label, rows: t.rows.map((r) => `${r.code} ${r.value}`) }))).toEqual([
      { label: "Latest champions", rows: [`GEN ${region === "msi" ? "MSI" : "First Stand"}`, "HLE LCK", "G2 LEC"] },
    ]);
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

describe("racquetCard", () => {
  const tournament = (id: string, status: RacquetTournament["status"]): RacquetTournament => ({
    id,
    name: id,
    location: "Somewhere",
    startDate: "2026-10-19",
    endDate: "2026-10-25",
    status,
  });
  const tour = (tournaments: RacquetTournament[]): RacquetData => ({
    tour: "atp",
    season: 2026,
    rankings: [],
    tournaments,
  });
  const base = { sportId: "tennis", label: "Tennis", emoji: "🎾" } as const;

  it("leads with the tournament on, else the next to start", () => {
    const week = tour([tournament("Paris Masters", "upcoming"), tournament("Vienna", "live")]);
    expect(__testing.racquetCard(base, week, "ATP").event).toMatchObject({ name: "Vienna", status: "live" });
    const off = tour([tournament("Paris Masters", "upcoming")]);
    expect(__testing.racquetCard(base, off, "ATP").event).toMatchObject({ name: "Paris Masters", status: "upcoming" });
  });

  it("links the tournament to its own page, not the sport's", () => {
    const week = tour([tournament("vienna-2026", "live")]);
    expect(__testing.racquetCard(base, week, "ATP").event?.href).toBe("/portal/entertainment/sports/tennis/vienna-2026");
    const padel = { ...base, sportId: "padel", label: "Padel" } as const;
    expect(__testing.racquetCard(padel, week, "Premier Padel").event?.href).toBe(
      "/portal/entertainment/sports/padel/vienna-2026"
    );
  });
});

describe("surfCard", () => {
  const stop = (id: string, status: SurfEvent["status"], startDate: string): SurfEvent => ({
    id,
    slug: id,
    name: id,
    location: "Supertubos, Peniche, Portugal",
    startDate,
    endDate: startDate,
    status,
    stop: 1,
  });
  const base = { sportId: "surf", label: "Surfing", emoji: "🏄" } as const;
  const data = (events: SurfEvent[]): SurfData => ({
    season: 2026,
    events,
    rankings: [{ position: 1, athleteId: "3994", name: "Yago Dora", country: "Brazil", points: 48865 }],
  });

  it("leads with the stop on now, else the next, beside the tour's rankings", () => {
    const on = __testing.surfCard(base, data([stop("Pipe", "upcoming", "2026-12-08"), stop("Portugal", "live", "2026-10-16")]));
    expect(on.event).toMatchObject({ name: "Portugal", status: "live" });
    expect(on.tables[0]).toMatchObject({ label: "Rankings", rows: [{ position: 1, name: "Yago Dora", value: "48,865" }] });

    const off = __testing.surfCard(base, data([stop("Pipe", "upcoming", "2026-12-08"), stop("Philippines", "upcoming", "2026-10-31")]));
    expect(off.event).toMatchObject({ name: "Philippines", status: "upcoming" });
  });
});

describe("leadGames", () => {
  const game = (id: string, status: DashboardMatch["status"], startsAt: string): DashboardMatch => ({
    id,
    status,
    startsAt,
    home: { name: "H", code: "H", score: status === "upcoming" ? null : 1, winner: false },
    away: { name: "A", code: "A", score: status === "upcoming" ? null : 0, winner: false },
  });
  const ids = (lead: Pick<DashboardSportCard, "featured" | "following">): string[] =>
    [lead.featured, ...(lead.following ?? [])].filter((m) => m !== undefined).map((m) => m.id);
  // Sunday Oct 25, 9:30pm in Costa Rica.
  const clock = { timeZone: "America/Costa_Rica", now: Date.parse("2026-10-26T03:30:00Z") };

  it("takes yesterday and today on the reader's calendar, not UTC's", () => {
    const lead = __testing.leadGames(
      [
        // Friday evening in Costa Rica, though Saturday in UTC: two days back.
        game("fri", "result", "2026-10-24T02:00:00Z"),
        game("sat", "result", "2026-10-24T20:00:00Z"),
        game("sun", "result", "2026-10-25T20:00:00Z"),
        game("mon", "upcoming", "2026-10-26T20:00:00Z"),
      ],
      clock
    );
    expect(ids(lead)).toEqual(["sat", "sun", "mon"]);
  });

  it("keeps the latest three results and at least two games to come, five in all", () => {
    const results = ["r1", "r2", "r3", "r4"].map((id, i) => game(id, "result", `2026-10-25T1${i}:00:00Z`));
    const ahead = ["u1", "u2", "u3", "u4"].map((id, i) => game(id, "upcoming", `2026-10-27T1${i}:00:00Z`));
    expect(ids(__testing.leadGames([...ahead, ...results], clock))).toEqual(["r2", "r3", "r4", "u1", "u2"]);
    // Nothing played lately: the games to come fill the box.
    expect(ids(__testing.leadGames(ahead, clock))).toEqual(["u1", "u2", "u3", "u4"]);
  });

  it("puts what is live between the results and the games to come", () => {
    const lead = __testing.leadGames(
      [
        game("u1", "upcoming", "2026-10-26T20:00:00Z"),
        game("live", "live", "2026-10-26T02:00:00Z"),
        game("r1", "result", "2026-10-25T18:00:00Z"),
        game("u2", "upcoming", "2026-10-27T20:00:00Z"),
      ],
      clock
    );
    expect(ids(lead)).toEqual(["r1", "live", "u1", "u2"]);
  });

  it("shows the latest results when nothing is recent or ahead, and nothing at all with no games", () => {
    const old = ["a", "b"].map((id, i) => game(id, "result", `2026-09-0${i + 1}T20:00:00Z`));
    expect(ids(__testing.leadGames(old, clock))).toEqual(["a", "b"]);
    expect(__testing.leadGames([], clock)).toEqual({ following: [] });
  });
});

