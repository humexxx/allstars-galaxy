import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// road-path-service uses two access shapes:
//   - `db.query.<table>.findMany / findFirst` (relational query API)
//   - `db.insert / update / delete` (builder API, terminated by `.returning()`
//     or `.where()`).
// We mock all of them at the `@/db` boundary so the service can be exercised
// without a real Postgres connection.

const roadPathsFindMany = vi.fn();
const roadPathsFindFirst = vi.fn();
const selectMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
    query: {
      roadPaths: {
        findMany: (...args: unknown[]) => roadPathsFindMany(...args),
        findFirst: (...args: unknown[]) => roadPathsFindFirst(...args),
      },
    },
    insert: (...args: unknown[]) => insertMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
    transaction: (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        insert: (...args: unknown[]) => insertMock(...args),
        update: (...args: unknown[]) => updateMock(...args),
        delete: (...args: unknown[]) => deleteMock(...args),
      }),
  },
}));

import {
  createRoadPath,
  deleteRoadPath,
  getRoadPath,
  getCheckInMessage,
  getRoadPathDetail,
  getUserRoadPaths,
  reorderRoadPaths,
  updateRoadPath,
} from "./road-path-service";
import type { RoadPath, RoadPathWithCheckIns } from "@/types";

const USER_ID = "00000000-0000-0000-0000-000000000001";
const ROAD_PATH_ID = "00000000-0000-0000-0000-0000000000aa";

// ---------- chain builders ----------

function mockInsertReturning<T>(row: T) {
  // db.insert(table).values(...).returning() -> [row]
  const chain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([row]),
  };
  insertMock.mockReturnValue(chain);
  return chain;
}

function mockUpdateReturning<T>(row: T) {
  // db.update(table).set(...).where(...).returning() -> [row]
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([row]),
  };
  updateMock.mockReturnValue(chain);
  return chain;
}

function mockDeleteWhere() {
  // db.delete(table).where(...)
  const chain = {
    where: vi.fn().mockResolvedValue(undefined),
  };
  deleteMock.mockReturnValue(chain);
  return chain;
}

// ---------- fixture factories ----------

function buildPath(overrides: Partial<RoadPath> = {}): RoadPath {
  return {
    id: ROAD_PATH_ID,
    userId: USER_ID,
    title: "Test Path",
    description: null,
    targetValue: "100",
    currentValue: "0",
    unit: "km",
    startDate: new Date("2026-01-01T00:00:00Z"),
    targetDate: new Date("2026-12-31T00:00:00Z"),
    autoCreateTasks: false,
    taskFrequency: null,
    scheduleDays: null,
    scheduleSince: null,
    lastTaskCreatedAt: null,
    completedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as unknown as RoadPath;
}

function buildPathWithDetails(
  overrides: Partial<RoadPathWithCheckIns> = {}
): RoadPathWithCheckIns {
  return {
    ...buildPath(),
    checkIns: [],
    ...overrides,
  } as unknown as RoadPathWithCheckIns;
}


// ---------- shared lifecycle ----------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------- getUserRoadPaths ----------

describe("getUserRoadPaths", () => {
  it("returns paths fetched with relations for the given user", async () => {
    const rows = [buildPathWithDetails(), buildPathWithDetails({ id: "p-2" })];
    roadPathsFindMany.mockResolvedValueOnce(rows);

    const result = await getUserRoadPaths(USER_ID);

    expect(result).toEqual(rows);
    expect(roadPathsFindMany).toHaveBeenCalledTimes(1);
    const opts = roadPathsFindMany.mock.calls[0][0];
    // Sanity-check that relations were requested.
    // The cards need the check-ins for their streak and week.
    expect(opts.with.checkIns).toBeTruthy();
  });

  it("returns [] when the user has no paths", async () => {
    roadPathsFindMany.mockResolvedValueOnce([]);
    await expect(getUserRoadPaths(USER_ID)).resolves.toEqual([]);
  });
});

// ---------- getRoadPath ----------

describe("getRoadPath", () => {
  it("returns the path when found", async () => {
    const path = buildPathWithDetails();
    roadPathsFindFirst.mockResolvedValueOnce(path);

    const result = await getRoadPath(ROAD_PATH_ID, USER_ID);

    expect(result).toEqual(path);
    expect(roadPathsFindFirst).toHaveBeenCalledTimes(1);
  });

  it("returns null when no path matches", async () => {
    roadPathsFindFirst.mockResolvedValueOnce(undefined);
    await expect(getRoadPath(ROAD_PATH_ID, USER_ID)).resolves.toBeNull();
  });
});

// ---------- createRoadPath ----------

describe("createRoadPath", () => {
  const TODAY = "2026-10-19";

  it("inserts a new path and returns it", async () => {
    const created = buildPath();
    const chain = mockInsertReturning(created);

    const result = await createRoadPath(
      USER_ID,
      {
        title: "Run",
        description: "5 km",
        startDate: new Date("2026-01-01T00:00:00Z"),
        scheduleDays: [5, 1, 3],
      },
      TODAY
    );

    expect(result).toEqual(created);
    const values = chain.values.mock.calls[0][0];
    expect(values.userId).toBe(USER_ID);
    expect(values.title).toBe("Run");
    expect(values.scheduleDays).toEqual([1, 3, 5]);
    // Started in the past: judged from today, so January is not all misses.
    expect(values.scheduleSince).toBe(TODAY);
  });

  it("judges a future start from its own day", async () => {
    const chain = mockInsertReturning(buildPath());

    await createRoadPath(
      USER_ID,
      { title: "Swim", startDate: new Date("2026-11-02T00:00:00Z"), scheduleDays: [2] },
      TODAY
    );

    expect(chain.values.mock.calls[0][0].scheduleSince).toBe("2026-11-02");
  });
});

// ---------- updateRoadPath ----------

describe("updateRoadPath", () => {
  const TODAY = "2026-10-19";

  it("drops the goal an old road path carried the first time it is saved", async () => {
    roadPathsFindFirst.mockResolvedValueOnce(buildPath({ targetValue: "365" }));
    const updated = buildPath({ title: "Work" });
    const chain = mockUpdateReturning(updated);

    const result = await updateRoadPath(ROAD_PATH_ID, USER_ID, { scheduleDays: [1, 2, 3, 4, 5] }, TODAY);

    expect(result).toEqual(updated);
    const setPayload = chain.set.mock.calls[0][0];
    expect(setPayload).toEqual(
      expect.objectContaining({ targetValue: null, unit: null, targetDate: null, scheduleDays: [1, 2, 3, 4, 5] })
    );
    expect(setPayload.updatedAt).toBeInstanceOf(Date);
  });

  it("returns null without writing when the path is not the user's", async () => {
    roadPathsFindFirst.mockResolvedValueOnce(undefined);

    expect(await updateRoadPath(ROAD_PATH_ID, USER_ID, { title: "x" }, TODAY)).toBeNull();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("starts a changed schedule today", async () => {
    roadPathsFindFirst.mockResolvedValueOnce(buildPath({ scheduleDays: [1, 3, 5] }));
    const chain = mockUpdateReturning(buildPath());

    await updateRoadPath(ROAD_PATH_ID, USER_ID, { scheduleDays: [1, 2, 3, 4, 5] }, TODAY);

    const payload = chain.set.mock.calls[0][0];
    expect(payload.scheduleDays).toEqual([1, 2, 3, 4, 5]);
    expect(payload.scheduleSince).toBe(TODAY);
  });

  it("leaves the schedule and its start alone when the days did not change", async () => {
    roadPathsFindFirst.mockResolvedValueOnce(buildPath({ scheduleDays: [1, 3, 5] }));
    const chain = mockUpdateReturning(buildPath());

    await updateRoadPath(ROAD_PATH_ID, USER_ID, { scheduleDays: [5, 3, 1] }, TODAY);

    const payload = chain.set.mock.calls[0][0];
    expect(payload).not.toHaveProperty("scheduleDays");
    expect(payload).not.toHaveProperty("scheduleSince");
  });

  it("carries a new title onto the path's open tasks from today on", async () => {
    roadPathsFindFirst.mockResolvedValueOnce(buildPath({ title: "Exercise" }));
    const chain = mockUpdateReturning(buildPath({ title: "Gym" }));

    await updateRoadPath(ROAD_PATH_ID, USER_ID, { title: "Gym" }, TODAY);

    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(chain.set.mock.calls[1][0]).toEqual(expect.objectContaining({ title: "Gym" }));
  });
});

// ---------- deleteRoadPath ----------

describe("reorderRoadPaths", () => {
  const A = "00000000-0000-0000-0000-0000000000a1";
  const B = "00000000-0000-0000-0000-0000000000b2";
  const owned = (rows: { id: string }[]) =>
    selectMock.mockReturnValueOnce({ from: () => ({ where: async () => rows }) });

  it("numbers the user's paths in the order given, in one statement", async () => {
    owned([{ id: A }, { id: B }]);
    const chain = mockUpdateReturning(buildPath());

    await expect(reorderRoadPaths(USER_ID, [B, A])).resolves.toBe(true);

    expect(chain.set).toHaveBeenCalledTimes(1);
    expect(new PgDialect().sqlToQuery(chain.set.mock.calls[0][0].position)).toMatchObject({
      sql: 'case "road_paths"."id" when $1::uuid then $2::int when $3::uuid then $4::int end',
      params: [B, 0, A, 1],
    });
  });

  it("writes nothing when a path is listed twice", async () => {
    owned([{ id: A }]);

    await expect(reorderRoadPaths(USER_ID, [A, A])).resolves.toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("writes nothing when a path is not the user's", async () => {
    owned([{ id: A }]);

    await expect(reorderRoadPaths(USER_ID, [A, B])).resolves.toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("deleteRoadPath", () => {
  it("issues a delete scoped by id + userId", async () => {
    const chain = mockDeleteWhere();
    await deleteRoadPath(ROAD_PATH_ID, USER_ID);
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(chain.where).toHaveBeenCalledTimes(1);
  });
});

describe("getRoadPathDetail", () => {
  it("measures the habit from its check-ins", async () => {
    roadPathsFindFirst.mockResolvedValueOnce(
      buildPathWithDetails({
        startDate: new Date("2026-10-12T00:00:00Z"),
        scheduleDays: [1, 3, 5],
        scheduleSince: "2026-10-12",
        checkIns: [{ day: "2026-10-12" }, { day: "2026-10-14" }, { day: "2026-10-16" }] as RoadPathWithCheckIns["checkIns"],
      })
    );

    const detail = await getRoadPathDetail(ROAD_PATH_ID, USER_ID, "2026-10-19", "America/Costa_Rica");

    expect(detail?.stats).toEqual(
      expect.objectContaining({ currentStreak: 3, doneDue: 3, due: 3, completionRate: 1 })
    );
  });

  it("returns null when the path is missing", async () => {
    roadPathsFindFirst.mockResolvedValueOnce(undefined);

    await expect(
      getRoadPathDetail(ROAD_PATH_ID, USER_ID, "2026-10-19", "UTC")
    ).resolves.toBeNull();
  });
});

describe("getCheckInMessage", () => {
  it("names the streak the check-in makes, against the best run before it", async () => {
    // Mon/Wed/Fri from Oct 5. Oct 5, 7 done, Oct 9 missed; Oct 12, 14 done and now Oct 16.
    roadPathsFindFirst.mockResolvedValueOnce(
      buildPathWithDetails({
        title: "Gym",
        startDate: new Date("2026-10-05T00:00:00Z"),
        scheduleDays: [1, 3, 5],
        scheduleSince: "2026-10-05",
        checkIns: ["2026-10-05", "2026-10-07", "2026-10-12", "2026-10-14", "2026-10-16"].map(
          (day) => ({ day })
        ) as RoadPathWithCheckIns["checkIns"],
      })
    );

    await expect(
      getCheckInMessage(ROAD_PATH_ID, USER_ID, "2026-10-16", "2026-10-16", "America/Costa_Rica")
    ).resolves.toBe("Gym done — 3 in a row, your best yet.");
  });

  it("is null for a path that is not the user's", async () => {
    roadPathsFindFirst.mockResolvedValueOnce(undefined);

    await expect(
      getCheckInMessage(ROAD_PATH_ID, USER_ID, "2026-10-16", "2026-10-16", "UTC")
    ).resolves.toBeNull();
  });
});
