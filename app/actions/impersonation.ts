"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

import { requireAdmin } from "@/lib/services/auth-server";
import { IMPERSONATION_COOKIE } from "@/lib/services/impersonation";

const impersonateSchema = z.object({
  userId: z.string().uuid(),
});

export async function startImpersonationAction(formData: FormData) {
  const admin = await requireAdmin();

  const parsed = impersonateSchema.safeParse({
    userId: formData.get("userId"),
  });
  if (!parsed.success) {
    throw new Error("Invalid user id");
  }

  if (parsed.data.userId === admin.id) {
    throw new Error("You cannot impersonate yourself");
  }

  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, parsed.data.userId));

  if (!target) {
    throw new Error("User not found");
  }
  if (target.role === "admin") {
    throw new Error("Admins cannot impersonate other admins");
  }

  // Auto-expire after 30 minutes so a forgotten session does not leave the
  // admin browsing as another user indefinitely.
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, target.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 60,
  });

  revalidatePath("/", "layout");
  redirect("/portal");
}

export async function stopImpersonationAction() {
  await requireAdmin();

  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);

  revalidatePath("/", "layout");
  redirect("/portal/admin/users");
}
