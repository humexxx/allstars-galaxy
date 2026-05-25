import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

// `next/navigation`'s `redirect()` throws internally in real Next runtime; we
// emulate that by throwing a unique sentinel error so tests can assert the
// redirect was triggered (and short-circuit further code) without bringing in
// the full Next runtime.
class RedirectSentinel extends Error {
  constructor(public target: string) {
    super(`REDIRECT:${target}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new RedirectSentinel(target);
  }),
}));

// Supabase client mock — `auth.getUser()` is reseeded per test via `seedUser`.
const getUserMock = vi.fn();
vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}));

// DB mock — the role lookup chains `.select().from().where()` and awaits the
// final builder. The thenable is reseeded per test via `seedRole`.
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  getCurrentUser,
  getCurrentUserCached,
  getUserRole,
  getUserRoleCached,
  requireAdmin,
  requireAdminCached,
  requireAdminOrRedirect,
  requireAuth,
  requireAuthCached,
} from "./auth-server";

const dbMock = vi.mocked(db, true);
const redirectMock = vi.mocked(redirect);

const USER_ID = "00000000-0000-0000-0000-000000000001";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    ...overrides,
  } as unknown as User;
}

function seedUser(user: User | null) {
  getUserMock.mockResolvedValue({ data: { user }, error: null });
}

function seedRole(role: "admin" | "user" | null) {
  const rows = role === null ? [] : [{ role }];
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  dbMock.select.mockReturnValue(chain as unknown as ReturnType<typeof db.select>);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------- getCurrentUser / getCurrentUserCached ----------

describe("getCurrentUser", () => {
  it("returns the supabase auth user when a session exists", async () => {
    const user = makeUser();
    seedUser(user);

    await expect(getCurrentUser()).resolves.toEqual(user);
  });

  it("returns null when no session exists", async () => {
    seedUser(null);

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});

describe("getCurrentUserCached", () => {
  it("returns the supabase auth user when a session exists", async () => {
    const user = makeUser();
    seedUser(user);

    await expect(getCurrentUserCached()).resolves.toEqual(user);
  });
});

// ---------- getUserRole / getUserRoleCached ----------

describe("getUserRole", () => {
  it("returns the admin role when the user row has role=admin", async () => {
    seedRole("admin");

    await expect(getUserRole(USER_ID)).resolves.toBe("admin");
    expect(dbMock.select).toHaveBeenCalledOnce();
  });

  it("returns the user role when the user row has role=user", async () => {
    seedRole("user");

    await expect(getUserRole(USER_ID)).resolves.toBe("user");
  });

  it("returns null when the lookup yields no row", async () => {
    seedRole(null);

    await expect(getUserRole(USER_ID)).resolves.toBeNull();
  });
});

describe("getUserRoleCached", () => {
  it("returns the role from the cached lookup", async () => {
    seedRole("admin");

    await expect(getUserRoleCached(USER_ID)).resolves.toBe("admin");
  });
});

// ---------- requireAuth / requireAuthCached ----------

describe("requireAuth", () => {
  it("returns the auth user when a session exists", async () => {
    const user = makeUser();
    seedUser(user);

    await expect(requireAuth()).resolves.toEqual(user);
  });

  it("throws Unauthorized when no session exists", async () => {
    seedUser(null);

    await expect(requireAuth()).rejects.toThrow("Unauthorized");
  });
});

describe("requireAuthCached", () => {
  it("returns the auth user when a session exists", async () => {
    const user = makeUser();
    seedUser(user);

    await expect(requireAuthCached()).resolves.toEqual(user);
  });

  it("throws Unauthorized when no session exists", async () => {
    seedUser(null);

    await expect(requireAuthCached()).rejects.toThrow("Unauthorized");
  });
});

// ---------- requireAdmin / requireAdminCached ----------

describe("requireAdmin", () => {
  it("returns the user when the db role is admin", async () => {
    const user = makeUser();
    seedUser(user);
    seedRole("admin");

    await expect(requireAdmin()).resolves.toEqual(user);
  });

  it("throws Forbidden when the db role is user", async () => {
    seedUser(makeUser());
    seedRole("user");

    await expect(requireAdmin()).rejects.toThrow(/Forbidden/);
  });

  it("throws Forbidden when the user row is missing entirely", async () => {
    seedUser(makeUser());
    seedRole(null);

    await expect(requireAdmin()).rejects.toThrow(/Forbidden/);
  });

  it("propagates Unauthorized when no session exists (skipping role lookup)", async () => {
    seedUser(null);

    await expect(requireAdmin()).rejects.toThrow("Unauthorized");
    expect(dbMock.select).not.toHaveBeenCalled();
  });
});

describe("requireAdminCached", () => {
  it("returns the user when the cached db role is admin", async () => {
    const user = makeUser();
    seedUser(user);
    seedRole("admin");

    await expect(requireAdminCached()).resolves.toEqual(user);
  });

  it("throws Forbidden when the cached db role is not admin", async () => {
    seedUser(makeUser());
    seedRole("user");

    await expect(requireAdminCached()).rejects.toThrow(/Forbidden/);
  });
});

// ---------- requireAdminOrRedirect ----------

describe("requireAdminOrRedirect", () => {
  it("returns the user when the caller is an admin", async () => {
    const user = makeUser();
    seedUser(user);
    seedRole("admin");

    await expect(requireAdminOrRedirect()).resolves.toEqual(user);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to /portal by default when the caller is not an admin", async () => {
    seedUser(makeUser());
    seedRole("user");

    // The mocked redirect throws our sentinel so the call short-circuits.
    await expect(requireAdminOrRedirect()).rejects.toBeInstanceOf(RedirectSentinel);
    expect(redirectMock).toHaveBeenCalledOnce();
    expect(redirectMock).toHaveBeenCalledWith("/portal");
  });

  it("redirects to /portal by default when no session exists", async () => {
    seedUser(null);

    await expect(requireAdminOrRedirect()).rejects.toBeInstanceOf(RedirectSentinel);
    expect(redirectMock).toHaveBeenCalledWith("/portal");
  });

  it("redirects to the supplied fallback path when provided", async () => {
    seedUser(makeUser());
    seedRole("user");

    await expect(requireAdminOrRedirect("/login")).rejects.toBeInstanceOf(RedirectSentinel);
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
