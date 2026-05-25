import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/auth-server", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/services/user-service", () => ({
  updateUserRole: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/services/auth-server";
import { updateUserRole } from "@/lib/services/user-service";

import { updateUserRoleAction } from "./admin-users";

// zod v4's `z.string().uuid()` enforces v4 variant + version bits.
const ADMIN_ID = "00000000-0000-4000-8000-0000000000aa";
const TARGET_USER_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.mocked(requireAdmin).mockResolvedValue({
    id: ADMIN_ID,
  } as unknown as Awaited<ReturnType<typeof requireAdmin>>);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("updateUserRoleAction", () => {
  it("promotes a user to admin (happy path)", async () => {
    const result = await updateUserRoleAction({
      userId: TARGET_USER_ID,
      role: "admin",
    });

    expect(result).toEqual({ success: true });
    expect(requireAdmin).toHaveBeenCalledTimes(1);
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

  it("throws Invalid input on malformed payload and does not touch the service", async () => {
    await expect(
      updateUserRoleAction({
        userId: "not-a-uuid",
        role: "admin",
      } as never),
    ).rejects.toThrow("Invalid input");

    expect(updateUserRole).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws Invalid input on an unknown role", async () => {
    await expect(
      updateUserRoleAction({
        userId: TARGET_USER_ID,
        role: "superuser",
      } as never),
    ).rejects.toThrow("Invalid input");

    expect(updateUserRole).not.toHaveBeenCalled();
  });

  it("prevents an admin from demoting themselves", async () => {
    await expect(
      updateUserRoleAction({
        userId: ADMIN_ID,
        role: "user",
      }),
    ).rejects.toThrow("You cannot demote yourself");

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

  it("propagates the rejection when the caller is not an admin", async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(
      new Error("Forbidden: Admin access required"),
    );

    await expect(
      updateUserRoleAction({
        userId: TARGET_USER_ID,
        role: "admin",
      }),
    ).rejects.toThrow("Forbidden: Admin access required");

    expect(updateUserRole).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("surfaces service-layer failures to the caller", async () => {
    vi.mocked(updateUserRole).mockRejectedValueOnce(new Error("pg boom"));

    await expect(
      updateUserRoleAction({
        userId: TARGET_USER_ID,
        role: "admin",
      }),
    ).rejects.toThrow("pg boom");

    // revalidate only runs after the service call resolves successfully
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
