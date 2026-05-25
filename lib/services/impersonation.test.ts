import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

// ---------- Mocks ----------
//
// impersonation.ts touches three external boundaries:
//   1. `@/db`             — select(users) for the target lookup, insert(impersonationLogs)
//   2. `@/lib/services/auth-server` — cached "who am I + what role" helpers
//   3. `next/headers`     — `cookies()` to read the impersonation cookie
//
// We mock all three so the service can be exercised in pure Node.

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

const getCurrentUserCached = vi.fn();
const getUserRoleCached = vi.fn();

vi.mock("@/lib/services/auth-server", () => ({
  getCurrentUserCached: (...args: unknown[]) => getCurrentUserCached(...args),
  getUserRoleCached: (...args: unknown[]) => getUserRoleCached(...args),
  // The real module also exports `requireAuth`, `requireAdmin`, `getUserRole` —
  // include stubs so any other importer picked up via the test runtime is safe.
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  getUserRole: vi.fn(),
}));

const cookiesGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookiesGet(name),
  }),
}));

import { db } from "@/db";
import {
  IMPERSONATION_COOKIE,
  getEffectiveContext,
  logImpersonatedMutation,
  requireEffectiveContext,
} from "./impersonation";

const dbMock = vi.mocked(db, true);

// ---------- Fixtures ----------

const ADMIN_USER = {
  id: "admin-1111-1111-1111-111111111111",
  email: "admin@example.com",
} as unknown as User;

const NORMAL_USER = {
  id: "user-2222-2222-2222-222222222222",
  email: "user@example.com",
} as unknown as User;

const TARGET_ROW = {
  id: "target-3333-3333-3333-333333333333",
  email: "target@example.com",
  fullName: "Target User",
};

// ---------- DB chain helpers ----------
//
// loadEffectiveContext awaits the select chain directly:
//   db.select(...).from(users).where(eq(users.id, id))
// So `where` is the terminal thenable in the select path.
function mockSelectRows(rows: unknown[]) {
  const thenable = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  dbMock.select.mockReturnValue(thenable as never);
  return thenable;
}

function mockInsert() {
  const thenable = {
    values: vi.fn().mockResolvedValue(undefined),
  };
  dbMock.insert.mockReturnValue(thenable as never);
  return thenable;
}

beforeEach(() => {
  // Default: no cookie present.
  cookiesGet.mockReturnValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------- getEffectiveContext / requireEffectiveContext ----------

describe("getEffectiveContext", () => {
  it("returns null when there is no authenticated user", async () => {
    getCurrentUserCached.mockResolvedValueOnce(null);

    await expect(getEffectiveContext()).resolves.toBeNull();
  });

  it("returns own-id context for an admin with no impersonation cookie", async () => {
    getCurrentUserCached.mockResolvedValueOnce(ADMIN_USER);
    getUserRoleCached.mockResolvedValueOnce("admin");

    const ctx = await getEffectiveContext();

    expect(ctx).toEqual({
      realUser: ADMIN_USER,
      realRole: "admin",
      impersonatedUser: null,
      effectiveUserId: ADMIN_USER.id,
      isImpersonating: false,
    });
    // No target lookup should happen if there is no cookie.
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("returns target-id context for an admin actively impersonating", async () => {
    getCurrentUserCached.mockResolvedValueOnce(ADMIN_USER);
    getUserRoleCached.mockResolvedValueOnce("admin");
    cookiesGet.mockReturnValue({ value: TARGET_ROW.id });
    mockSelectRows([TARGET_ROW]);

    const ctx = await getEffectiveContext();

    expect(cookiesGet).toHaveBeenCalledWith(IMPERSONATION_COOKIE);
    expect(dbMock.select).toHaveBeenCalledOnce();
    expect(ctx).toEqual({
      realUser: ADMIN_USER,
      realRole: "admin",
      impersonatedUser: TARGET_ROW,
      effectiveUserId: TARGET_ROW.id,
      isImpersonating: true,
    });
  });

  it("falls back to own-id when the impersonated target no longer exists", async () => {
    getCurrentUserCached.mockResolvedValueOnce(ADMIN_USER);
    getUserRoleCached.mockResolvedValueOnce("admin");
    cookiesGet.mockReturnValue({ value: "missing-target" });
    mockSelectRows([]);

    const ctx = await getEffectiveContext();

    expect(ctx?.isImpersonating).toBe(false);
    expect(ctx?.effectiveUserId).toBe(ADMIN_USER.id);
    expect(ctx?.impersonatedUser).toBeNull();
  });

  it("ignores the impersonation cookie when the real user is not an admin", async () => {
    getCurrentUserCached.mockResolvedValueOnce(NORMAL_USER);
    getUserRoleCached.mockResolvedValueOnce("user");
    cookiesGet.mockReturnValue({ value: TARGET_ROW.id });

    const ctx = await getEffectiveContext();

    expect(ctx).toEqual({
      realUser: NORMAL_USER,
      realRole: "user",
      impersonatedUser: null,
      effectiveUserId: NORMAL_USER.id,
      isImpersonating: false,
    });
    // Crucially: we never hit the DB to resolve the target row.
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("ignores impersonation when role lookup returns null", async () => {
    getCurrentUserCached.mockResolvedValueOnce(NORMAL_USER);
    getUserRoleCached.mockResolvedValueOnce(null);
    cookiesGet.mockReturnValue({ value: TARGET_ROW.id });

    const ctx = await getEffectiveContext();

    expect(ctx?.isImpersonating).toBe(false);
    expect(ctx?.effectiveUserId).toBe(NORMAL_USER.id);
    expect(dbMock.select).not.toHaveBeenCalled();
  });
});

describe("requireEffectiveContext", () => {
  it("throws Unauthorized when there is no signed-in user", async () => {
    getCurrentUserCached.mockResolvedValueOnce(null);

    await expect(requireEffectiveContext()).rejects.toThrow("Unauthorized");
  });

  it("resolves with the context for an authenticated user", async () => {
    getCurrentUserCached.mockResolvedValueOnce(NORMAL_USER);
    getUserRoleCached.mockResolvedValueOnce("user");

    const ctx = await requireEffectiveContext();

    expect(ctx.effectiveUserId).toBe(NORMAL_USER.id);
    expect(ctx.isImpersonating).toBe(false);
  });
});

// ---------- logImpersonatedMutation ----------

describe("logImpersonatedMutation", () => {
  it("is a no-op when the caller is not impersonating", async () => {
    getCurrentUserCached.mockResolvedValueOnce(ADMIN_USER);
    getUserRoleCached.mockResolvedValueOnce("admin");

    await logImpersonatedMutation({ action: "create.thing" });

    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("is a no-op when no user is signed in at all", async () => {
    getCurrentUserCached.mockResolvedValueOnce(null);

    await logImpersonatedMutation({ action: "create.thing" });

    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("writes an audit row when impersonating, with adminId + impersonatedUserId", async () => {
    getCurrentUserCached.mockResolvedValueOnce(ADMIN_USER);
    getUserRoleCached.mockResolvedValueOnce("admin");
    cookiesGet.mockReturnValue({ value: TARGET_ROW.id });
    mockSelectRows([TARGET_ROW]);
    const insertChain = mockInsert();

    await logImpersonatedMutation({
      action: "update.transaction",
      entityTable: "transactions",
      entityId: "tx-1",
    });

    expect(dbMock.insert).toHaveBeenCalledOnce();
    expect(insertChain.values).toHaveBeenCalledOnce();
    const row = insertChain.values.mock.calls[0][0] as Record<string, unknown>;
    expect(row.adminId).toBe(ADMIN_USER.id);
    expect(row.impersonatedUserId).toBe(TARGET_ROW.id);
    expect(row.action).toBe("update.transaction");
    expect(row.entityTable).toBe("transactions");
    expect(row.entityId).toBe("tx-1");
    // No before/after/metadata supplied → metadata column stays null.
    expect(row.metadata).toBeNull();
  });

  it("serializes before/after/metadata into the metadata JSON column", async () => {
    getCurrentUserCached.mockResolvedValueOnce(ADMIN_USER);
    getUserRoleCached.mockResolvedValueOnce("admin");
    cookiesGet.mockReturnValue({ value: TARGET_ROW.id });
    mockSelectRows([TARGET_ROW]);
    const insertChain = mockInsert();

    await logImpersonatedMutation({
      action: "update.transaction",
      entityTable: "transactions",
      entityId: "tx-1",
      before: { amount: "10" },
      after: { amount: "20" },
      metadata: { reason: "correction" },
    });

    const row = insertChain.values.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof row.metadata).toBe("string");
    const parsed = JSON.parse(row.metadata as string);
    expect(parsed).toEqual({
      reason: "correction",
      before: { amount: "10" },
      after: { amount: "20" },
    });
  });

  it("omits before/after keys from metadata when not supplied", async () => {
    getCurrentUserCached.mockResolvedValueOnce(ADMIN_USER);
    getUserRoleCached.mockResolvedValueOnce("admin");
    cookiesGet.mockReturnValue({ value: TARGET_ROW.id });
    mockSelectRows([TARGET_ROW]);
    const insertChain = mockInsert();

    await logImpersonatedMutation({
      action: "delete.thing",
      metadata: { note: "cleanup" },
    });

    const row = insertChain.values.mock.calls[0][0] as Record<string, unknown>;
    const parsed = JSON.parse(row.metadata as string);
    expect(parsed).toEqual({ note: "cleanup" });
    expect(parsed).not.toHaveProperty("before");
    expect(parsed).not.toHaveProperty("after");
  });

  it("does NOT log when a non-admin somehow has the impersonation cookie set", async () => {
    getCurrentUserCached.mockResolvedValueOnce(NORMAL_USER);
    getUserRoleCached.mockResolvedValueOnce("user");
    cookiesGet.mockReturnValue({ value: TARGET_ROW.id });

    await logImpersonatedMutation({ action: "evil.attempt" });

    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});
