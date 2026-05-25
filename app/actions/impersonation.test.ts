import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Next.js `redirect()` throws a special control-flow error in real usage. We
// emulate that so the action call returns control to the test via a throw.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const cookieSet = vi.fn();
const cookieDelete = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (...args: unknown[]) => cookieSet(...args),
    delete: (...args: unknown[]) => cookieDelete(...args),
  }),
}));

vi.mock("@/lib/services/auth-server", () => ({
  requireAdmin: vi.fn(),
}));

// The action imports `db` and `users` and queries via `select().from().where()`.
// We model the chain as thenable so `await db.select()...where()` resolves to
// the array we control per-test.
const selectMock = vi.fn();
vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  users: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ __eq: [a, b] })),
}));

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/services/auth-server";

import {
  startImpersonationAction,
  stopImpersonationAction,
} from "./impersonation";

// zod v4 enforces v4 UUIDs (version digit 4, variant digit 8-b).
const ADMIN_ID = "00000000-0000-4000-8000-0000000000aa";
const TARGET_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ADMIN_ID = "22222222-2222-4222-8222-222222222222";

function buildSelectChain(rows: Array<{ id: string; role: "admin" | "user" }>) {
  // db.select(cols).from(t).where(c) → Promise<rows>
  // Implemented as a thenable on the `.where()` return.
  const thenable = {
    then: (resolve: (v: typeof rows) => void) => resolve(rows),
  };
  const fromChain = {
    where: vi.fn(() => thenable),
  };
  selectMock.mockReturnValueOnce({
    from: vi.fn(() => fromChain),
  });
}

beforeEach(() => {
  vi.mocked(requireAdmin).mockResolvedValue({
    id: ADMIN_ID,
  } as unknown as Awaited<ReturnType<typeof requireAdmin>>);
});

afterEach(() => {
  vi.clearAllMocks();
  selectMock.mockReset();
});

describe("startImpersonationAction", () => {
  it("sets the impersonation cookie, revalidates layout, and redirects to /portal (happy path)", async () => {
    buildSelectChain([{ id: TARGET_ID, role: "user" }]);

    const formData = new FormData();
    formData.set("userId", TARGET_ID);

    await expect(startImpersonationAction(formData)).rejects.toThrow(
      `NEXT_REDIRECT:/portal`,
    );

    expect(requireAdmin).toHaveBeenCalledTimes(1);
    expect(cookieSet).toHaveBeenCalledTimes(1);
    expect(cookieSet).toHaveBeenCalledWith(
      "cg_impersonating",
      TARGET_ID,
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 60,
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(redirect).toHaveBeenCalledWith("/portal");
  });

  it("throws 'Invalid user id' when the form payload is not a uuid (safeParse fails)", async () => {
    const formData = new FormData();
    formData.set("userId", "not-a-uuid");

    await expect(startImpersonationAction(formData)).rejects.toThrow(
      "Invalid user id",
    );

    expect(selectMock).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("throws 'Invalid user id' when the userId field is missing entirely", async () => {
    const formData = new FormData();
    // no userId set

    await expect(startImpersonationAction(formData)).rejects.toThrow(
      "Invalid user id",
    );

    expect(cookieSet).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("rejects self-impersonation before hitting the database", async () => {
    const formData = new FormData();
    formData.set("userId", ADMIN_ID);

    await expect(startImpersonationAction(formData)).rejects.toThrow(
      "You cannot impersonate yourself",
    );

    expect(selectMock).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("throws 'User not found' when the target id has no matching row", async () => {
    buildSelectChain([]);

    const formData = new FormData();
    formData.set("userId", TARGET_ID);

    await expect(startImpersonationAction(formData)).rejects.toThrow(
      "User not found",
    );

    expect(cookieSet).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("refuses to impersonate another admin", async () => {
    buildSelectChain([{ id: OTHER_ADMIN_ID, role: "admin" }]);

    const formData = new FormData();
    formData.set("userId", OTHER_ADMIN_ID);

    await expect(startImpersonationAction(formData)).rejects.toThrow(
      "Admins cannot impersonate other admins",
    );

    expect(cookieSet).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("propagates the admin-required rejection from requireAdmin", async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(
      new Error("Forbidden: Admin access required"),
    );

    const formData = new FormData();
    formData.set("userId", TARGET_ID);

    await expect(startImpersonationAction(formData)).rejects.toThrow(
      "Forbidden: Admin access required",
    );

    expect(selectMock).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("stopImpersonationAction", () => {
  it("deletes the cookie, revalidates layout, and redirects to admin users (happy path)", async () => {
    await expect(stopImpersonationAction()).rejects.toThrow(
      "NEXT_REDIRECT:/portal/admin/users",
    );

    expect(requireAdmin).toHaveBeenCalledTimes(1);
    expect(cookieDelete).toHaveBeenCalledWith("cg_impersonating");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(redirect).toHaveBeenCalledWith("/portal/admin/users");
  });

  it("propagates the admin-required rejection without touching cookies", async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(
      new Error("Forbidden: Admin access required"),
    );

    await expect(stopImpersonationAction()).rejects.toThrow(
      "Forbidden: Admin access required",
    );

    expect(cookieDelete).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
