"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/services/auth-server";
import { updateUserRole } from "@/lib/services/user-service";

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "user"]),
});

export async function updateUserRoleAction(
  input: z.infer<typeof updateRoleSchema>
): Promise<{ success: true } | { success: false; error: string }> {
  const admin = await requireAdmin();

  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input" };
  }

  if (parsed.data.userId === admin.id && parsed.data.role === "user") {
    return { success: false, error: "You cannot demote yourself" };
  }

  await updateUserRole(parsed.data.userId, parsed.data.role);

  revalidatePath("/portal/admin/users");
  return { success: true };
}
