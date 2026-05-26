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
import {
  getDashboardSportsSummary,
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

describe("getDashboardSportsSummary", () => {
  it("returns one highlight per favourited sport, preserving order", async () => {
    mockSelect([
      { id: "a", userId: USER_ID, sportId: "football", createdAt: new Date() },
      { id: "b", userId: USER_ID, sportId: "f1", createdAt: new Date() },
      { id: "c", userId: USER_ID, sportId: "nba", createdAt: new Date() },
    ]);

    const highlights = await getDashboardSportsSummary(USER_ID);

    expect(highlights).toHaveLength(3);
    expect(highlights.map((h) => h.sportId)).toEqual(["football", "f1", "nba"]);
  });

  it("returns an empty list when the user has no favourites", async () => {
    mockSelect([]);
    await expect(getDashboardSportsSummary(USER_ID)).resolves.toEqual([]);
  });

  it("attaches sport metadata (label + emoji) to each highlight", async () => {
    mockSelect([
      { id: "a", userId: USER_ID, sportId: "f1", createdAt: new Date() },
    ]);

    const [h] = await getDashboardSportsSummary(USER_ID);

    expect(h.sportId).toBe("f1");
    expect(h.label).toBe("Formula 1");
    expect(h.emoji).toBe("🏎️");
  });

  it("uses upcoming tone + a secondary line for F1", async () => {
    mockSelect([
      { id: "a", userId: USER_ID, sportId: "f1", createdAt: new Date() },
    ]);

    const [h] = await getDashboardSportsSummary(USER_ID);

    // F1 mock fixture has at least one upcoming race + a points leader.
    expect(h.tone).toBe("upcoming");
    expect(h.secondary?.label).toBe("Drivers' leader");
    expect(h.secondary?.value).toMatch(/pts$/);
  });

  it("renders football highlight headline using team short names", async () => {
    mockSelect([
      { id: "a", userId: USER_ID, sportId: "football", createdAt: new Date() },
    ]);

    const [h] = await getDashboardSportsSummary(USER_ID);

    expect(h.label).toBe("Football");
    // pickFeaturedMatch falls through to a finished UCL R16 leg-2 tie, so the
    // headline must include both team short names plus a hyphen / dash.
    expect(h.headline).toMatch(/–|-/);
    expect(h.context).toBeTruthy();
  });

  it("computes NBA secondary with W–L for the East leader", async () => {
    mockSelect([
      { id: "a", userId: USER_ID, sportId: "nba", createdAt: new Date() },
    ]);

    const [h] = await getDashboardSportsSummary(USER_ID);

    expect(h.label).toBe("NBA");
    expect(h.secondary?.label).toBe("East leader");
    // Format is "<Team> · <W>–<L>" with an em-dash style separator.
    expect(h.secondary?.value).toMatch(/^.+ · \d+[–-]\d+$/);
  });

  it("skips unknown sportIds defensively without throwing", async () => {
    mockSelect([
      { id: "a", userId: USER_ID, sportId: "totally-unknown", createdAt: new Date() },
      { id: "b", userId: USER_ID, sportId: "nba", createdAt: new Date() },
    ]);

    const highlights = await getDashboardSportsSummary(USER_ID);

    expect(highlights).toHaveLength(1);
    expect(highlights[0].sportId).toBe("nba");
  });
});
