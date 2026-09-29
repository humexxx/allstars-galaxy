import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/auth-server", () => ({
  requireAdminCached: vi.fn(),
}));

vi.mock("@/lib/services/user-service", () => ({
  updateUserRole: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { requireAdminCached } from "@/lib/services/auth-server";
import { updateUserRole } from "@/lib/services/user-service";

import { updateUserRoleAction } from "./admin-users";

// zod v4's `z.string().uuid()` enforces v4 variant + version bits.
const ADMIN_ID = "00000000-0000-4000-8000-0000000000aa";
const TARGET_USER_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.mocked(requireAdminCached).mockResolvedValue({
    id: ADMIN_ID,
  } as unknown as Awaited<ReturnType<typeof requireAdminCached>>);
  vi.mocked(updateUserRole).mockResolvedValue(true);
  // safe() logs unexpected failures; keep the test output quiet.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("updateUserRoleAction", () => {
  it("promotes a user to admin (happy path)", async () => {
    const result = await updateUserRoleAction({
      userId: TARGET_USER_ID,
      role: "admin",
    });

    expect(result).toEqual({ success: true });
    expect(requireAdminCached).toHaveBeenCalledTimes(1);
    expect(updateUserRole).toHaveBeenCalledWith(TARGET_USER_ID, "admin");
    expect(revalidatePath).toHaveBeenCalledWith("/portal/admin/users");
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("demotes a different user from admin to user", async () => {
    const result = await updateUserRoleAction({
      userId: TARGET_USER_ID,
      role: "user",
    });

    expect(result).toEqual({ success: true });
    expect(updateUserRole).toHaveBeenCalledWith(TARGET_USER_ID, "user");
    expect(revalidatePath).toHaveBeenCalledWith("/portal/admin/users");
  });

  it("returns Invalid input on malformed payload and does not touch the service", async () => {
    await expect(
      updateUserRoleAction({
        userId: "not-a-uuid",
        role: "admin",
      } as never),
    ).resolves.toEqual({ success: false, error: "Invalid input" });

    expect(updateUserRole).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns Invalid input on an unknown role", async () => {
    await expect(
      updateUserRoleAction({
        userId: TARGET_USER_ID,
        role: "superuser",
      } as never),
    ).resolves.toEqual({ success: false, error: "Invalid input" });

    expect(updateUserRole).not.toHaveBeenCalled();
  });

  it("prevents an admin from demoting themselves", async () => {
    await expect(
      updateUserRoleAction({
        userId: ADMIN_ID,
        role: "user",
      }),
    ).resolves.toEqual({ success: false, error: "You cannot demote yourself" });

    expect(updateUserRole).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("allows an admin to re-affirm their own admin role", async () => {
    const result = await updateUserRoleAction({
      userId: ADMIN_ID,
      role: "admin",
    });

    expect(result).toEqual({ success: true });
    expect(updateUserRole).toHaveBeenCalledWith(ADMIN_ID, "admin");
  });

  it("fails generically when the caller is not an admin", async () => {
    vi.mocked(requireAdminCached).mockRejectedValueOnce(
      new Error("Forbidden: Admin access required"),
    );

    await expect(
      updateUserRoleAction({
        userId: TARGET_USER_ID,
        role: "admin",
      }),
    ).resolves.toEqual({ success: false, error: "Action failed" });

    expect(updateUserRole).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("turns service-layer failures into a generic error", async () => {
    vi.mocked(updateUserRole).mockRejectedValueOnce(new Error("pg boom"));

    await expect(
      updateUserRoleAction({
        userId: TARGET_USER_ID,
        role: "admin",
      }),
    ).resolves.toEqual({ success: false, error: "Action failed" });

    // revalidate only runs after the service call resolves successfully
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a user that no longer exists", async () => {
    vi.mocked(updateUserRole).mockResolvedValueOnce(false);

    const result = await updateUserRoleAction({
      userId: TARGET_USER_ID,
      role: "admin",
    });

    expect(result).toEqual({ success: false, error: "User not found" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
