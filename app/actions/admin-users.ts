"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { requireAdminCached } from "@/lib/services/auth-server";
import { updateUserRole } from "@/lib/services/user-service";
import { updateUserRoleSchema, type UpdateUserRoleData } from "@/schemas/admin";

export async function updateUserRoleAction(
  input: UpdateUserRoleData,
): Promise<ActionResult> {
  return safe("admin-users", async () => {
    const admin = await requireAdminCached();

    const parsed = updateUserRoleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }

    if (parsed.data.userId === admin.id && parsed.data.role !== "admin") {
      return { success: false, error: "You cannot demote yourself" };
    }

    if (!(await updateUserRole(parsed.data.userId, parsed.data.role))) {
      return { success: false, error: "User not found" };
    }

    revalidatePath("/portal/admin/users");
    return { success: true };
  });
}
