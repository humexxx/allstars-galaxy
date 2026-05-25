import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// user-service has two terminal chains:
//   db.select({...}).from(users).orderBy(sql`...`)
//   db.update(users).set({...}).where(eq(users.id, userId))
// Per-test thenables are wired in via the helpers below so we can both seed
// resolved rows and inspect call args.
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

import { db } from "@/db";
import { getAllUsers, updateUserRole } from "./user-service";

const dbMock = vi.mocked(db, true) as unknown as {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

// ---------- Helpers ----------

function mockSelect(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
  dbMock.select.mockReturnValue(chain as never);
  return chain;
}

function mockUpdate() {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  dbMock.update.mockReturnValue(chain as never);
  return chain;
}

const USER_ID = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  vi.useFakeTimers();
  // Pin "now" so updatedAt timestamps are deterministic.
  vi.setSystemTime(new Date("2026-05-24T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------- getAllUsers ----------

describe("getAllUsers", () => {
  it("returns the rows the DB resolved, projected to UserListItem shape", async () => {
    const rows = [
      {
        id: USER_ID,
        email: "alice@example.com",
        fullName: "Alice",
        role: "admin" as const,
        avatarUrl: "https://cdn.example.com/a.png",
      },
      {
        id: "00000000-0000-0000-0000-000000000002",
        email: "bob@example.com",
        fullName: "Bob",
        role: "user" as const,
        avatarUrl: null,
      },
    ];
    const chain = mockSelect(rows);

    const result = await getAllUsers();

    expect(result).toEqual(rows);
    expect(dbMock.select).toHaveBeenCalledOnce();
    // Verify the projection is the exact UserListItem shape the type expects.
    expect(dbMock.select.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        id: expect.anything(),
        email: expect.anything(),
        fullName: expect.anything(),
        role: expect.anything(),
        avatarUrl: expect.anything(),
      })
    );
    expect(chain.from).toHaveBeenCalledOnce();
    expect(chain.orderBy).toHaveBeenCalledOnce();
  });

  it("returns an empty array when there are no users", async () => {
    mockSelect([]);
    await expect(getAllUsers()).resolves.toEqual([]);
  });

  it("preserves the ordering the DB returns (NULLS LAST handled in SQL)", async () => {
    // Service relies on the DB's ORDER BY clause; it must not re-sort in JS.
    // We seed an order that is *not* alphabetical to prove it.
    const rows = [
      {
        id: "z",
        email: "z@example.com",
        fullName: "Zed",
        role: "user" as const,
        avatarUrl: null,
      },
      {
        id: "a",
        email: "a@example.com",
        fullName: "Aaron",
        role: "admin" as const,
        avatarUrl: null,
      },
      {
        id: "n",
        email: "n@example.com",
        fullName: null,
        role: "user" as const,
        avatarUrl: null,
      },
    ];
    mockSelect(rows);

    const result = await getAllUsers();

    expect(result.map((r) => r.id)).toEqual(["z", "a", "n"]);
  });

  it("tolerates rows with null email / fullName / role / avatarUrl", async () => {
    const rows = [
      {
        id: USER_ID,
        email: null,
        fullName: null,
        role: null,
        avatarUrl: null,
      },
    ];
    mockSelect(rows);

    const result = await getAllUsers();

    expect(result).toEqual(rows);
    expect(result[0].email).toBeNull();
    expect(result[0].role).toBeNull();
  });

  it("propagates DB errors to the caller", async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockRejectedValue(new Error("connection refused")),
    };
    dbMock.select.mockReturnValue(chain as never);

    await expect(getAllUsers()).rejects.toThrow("connection refused");
  });
});

// ---------- updateUserRole ----------

describe("updateUserRole", () => {
  it("promotes a user to admin and stamps updatedAt with the current time", async () => {
    const chain = mockUpdate();

    await updateUserRole(USER_ID, "admin");

    expect(dbMock.update).toHaveBeenCalledOnce();
    expect(chain.set).toHaveBeenCalledOnce();
    const setArg = chain.set.mock.calls[0][0] as {
      role: "admin" | "user";
      updatedAt: Date;
    };
    expect(setArg.role).toBe("admin");
    expect(setArg.updatedAt).toBeInstanceOf(Date);
    expect(setArg.updatedAt.toISOString()).toBe("2026-05-24T12:00:00.000Z");
    expect(chain.where).toHaveBeenCalledOnce();
  });

  it("demotes an admin to user", async () => {
    const chain = mockUpdate();

    await updateUserRole(USER_ID, "user");

    expect(dbMock.update).toHaveBeenCalledOnce();
    const setArg = chain.set.mock.calls[0][0] as { role: "admin" | "user" };
    expect(setArg.role).toBe("user");
    expect(chain.where).toHaveBeenCalledOnce();
  });

  it("returns void (no value) on success", async () => {
    mockUpdate();
    await expect(updateUserRole(USER_ID, "user")).resolves.toBeUndefined();
  });

  it("issues exactly one UPDATE per call", async () => {
    mockUpdate();

    await updateUserRole(USER_ID, "admin");
    await updateUserRole(USER_ID, "user");

    expect(dbMock.update).toHaveBeenCalledTimes(2);
  });

  it("scopes the UPDATE to a single user via .where (no global writes)", async () => {
    const chain = mockUpdate();

    await updateUserRole(USER_ID, "admin");

    // The exact eq() expression is a Drizzle SQL fragment, so we only assert
    // .where was invoked once with one argument — the service must never
    // issue an unfiltered UPDATE.
    expect(chain.where).toHaveBeenCalledOnce();
    expect(chain.where.mock.calls[0]).toHaveLength(1);
    expect(chain.where.mock.calls[0][0]).toBeDefined();
  });

  it("propagates DB errors to the caller", async () => {
    const chain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockRejectedValue(new Error("permission denied")),
    };
    dbMock.update.mockReturnValue(chain as never);

    await expect(updateUserRole(USER_ID, "admin")).rejects.toThrow(
      "permission denied"
    );
  });

  it("uses a fresh updatedAt timestamp for each call (no stale closures)", async () => {
    const chain = mockUpdate();

    await updateUserRole(USER_ID, "admin");
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    await updateUserRole(USER_ID, "user");

    const first = chain.set.mock.calls[0][0] as { updatedAt: Date };
    const second = chain.set.mock.calls[1][0] as { updatedAt: Date };
    expect(first.updatedAt.toISOString()).toBe("2026-05-24T12:00:00.000Z");
    expect(second.updatedAt.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });
});
