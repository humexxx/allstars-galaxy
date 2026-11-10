"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { requireAdminCached } from "@/lib/services/auth-server";
import { setModuleEnabled } from "@/lib/services/module-access-service";
import { updateUserRole } from "@/lib/services/user-service";
import {
  setUserModuleSchema,
  updateUserRoleSchema,
  type SetUserModuleData,
  type UpdateUserRoleData,
} from "@/schemas/admin";

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

/**
 * Turns one module on or off for an account. Takes effect on that account's
 * next request: its nav greys the module out and its pages, actions and
 * assistant refuse it.
 */
export async function setUserModuleAction(input: SetUserModuleData): Promise<ActionResult> {
  return safe("admin-users", async () => {
    await requireAdminCached();

    const parsed = setUserModuleSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    if (!(await setModuleEnabled(parsed.data.userId, parsed.data.module, parsed.data.enabled))) {
      return { success: false, error: "User not found" };
    }

    revalidatePath("/portal/admin/users");
    return { success: true };
  });
}
