"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/services/auth-server";
import { updateUserRole } from "@/lib/services/user-service";
import { updateUserRoleSchema, type UpdateUserRoleData } from "@/schemas/admin";

export async function updateUserRoleAction(
  input: UpdateUserRoleData,
): Promise<{ success: true }> {
  const admin = await requireAdmin();

  const parsed = updateUserRoleSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  if (parsed.data.userId === admin.id && parsed.data.role === "user") {
    throw new Error("You cannot demote yourself");
  }

  await updateUserRole(parsed.data.userId, parsed.data.role);

  revalidatePath("/portal/admin/users");
  return { success: true };
}
