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
  requireAdminCached: vi.fn(),
}));

const getImpersonationTarget = vi.fn();
vi.mock("@/lib/services/impersonation", () => ({
  IMPERSONATION_COOKIE: "cg_impersonating",
  getImpersonationTarget: (...args: unknown[]) => getImpersonationTarget(...args),
}));

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminCached } from "@/lib/services/auth-server";

import {
  startImpersonationAction,
  stopImpersonationAction,
} from "./impersonation";

// zod v4 enforces v4 UUIDs (version digit 4, variant digit 8-b).
const ADMIN_ID = "00000000-0000-4000-8000-0000000000aa";
const TARGET_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ADMIN_ID = "22222222-2222-4222-8222-222222222222";

function givenTarget(target: { id: string; role: "admin" | "user" } | null) {
  getImpersonationTarget.mockResolvedValueOnce(
    target && { ...target, email: null, fullName: null },
  );
}

beforeEach(() => {
  vi.mocked(requireAdminCached).mockResolvedValue({
    id: ADMIN_ID,
  } as unknown as Awaited<ReturnType<typeof requireAdminCached>>);
});

afterEach(() => {
  vi.clearAllMocks();
  getImpersonationTarget.mockReset();
});

describe("startImpersonationAction", () => {
  it("sets the impersonation cookie, revalidates layout, and redirects to /portal (happy path)", async () => {
    givenTarget({ id: TARGET_ID, role: "user" });

    const formData = new FormData();
    formData.set("userId", TARGET_ID);

    await expect(startImpersonationAction(formData)).rejects.toThrow(
      `NEXT_REDIRECT:/portal`,
    );

    expect(requireAdminCached).toHaveBeenCalledTimes(1);
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

    expect(getImpersonationTarget).not.toHaveBeenCalled();
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

    expect(getImpersonationTarget).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("throws 'User not found' when the target id has no matching row", async () => {
    givenTarget(null);

    const formData = new FormData();
    formData.set("userId", TARGET_ID);

    await expect(startImpersonationAction(formData)).rejects.toThrow(
      "User not found",
    );

    expect(cookieSet).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("refuses to impersonate another admin", async () => {
    givenTarget({ id: OTHER_ADMIN_ID, role: "admin" });

    const formData = new FormData();
    formData.set("userId", OTHER_ADMIN_ID);

    await expect(startImpersonationAction(formData)).rejects.toThrow(
      "Admins cannot impersonate other admins",
    );

    expect(cookieSet).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("propagates the admin-required rejection from requireAdminCached", async () => {
    vi.mocked(requireAdminCached).mockRejectedValueOnce(
      new Error("Forbidden: Admin access required"),
    );

    const formData = new FormData();
    formData.set("userId", TARGET_ID);

    await expect(startImpersonationAction(formData)).rejects.toThrow(
      "Forbidden: Admin access required",
    );

    expect(getImpersonationTarget).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("stopImpersonationAction", () => {
  it("deletes the cookie, revalidates layout, and redirects to admin users (happy path)", async () => {
    await expect(stopImpersonationAction()).rejects.toThrow(
      "NEXT_REDIRECT:/portal/admin/users",
    );

    expect(requireAdminCached).toHaveBeenCalledTimes(1);
    expect(cookieDelete).toHaveBeenCalledWith("cg_impersonating");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(redirect).toHaveBeenCalledWith("/portal/admin/users");
  });

  it("propagates the admin-required rejection without touching cookies", async () => {
    vi.mocked(requireAdminCached).mockRejectedValueOnce(
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
