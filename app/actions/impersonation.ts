"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAdminCached } from "@/lib/services/auth-server";
import {
  IMPERSONATION_COOKIE,
  getImpersonationTarget,
} from "@/lib/services/impersonation";
import { impersonationSchema } from "@/schemas/impersonation";

/**
 * Throws and redirects rather than returning an `ActionResult`: this is a
 * `<form action>` target, so a failure lands on the admin error boundary.
 */
export async function startImpersonationAction(formData: FormData): Promise<never> {
  const admin = await requireAdminCached();

  const parsed = impersonationSchema.safeParse({
    userId: formData.get("userId"),
  });
  if (!parsed.success) {
    throw new Error("Invalid user id");
  }

  if (parsed.data.userId === admin.id) {
    throw new Error("You cannot impersonate yourself");
  }

  const target = await getImpersonationTarget(parsed.data.userId);

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

export async function stopImpersonationAction(): Promise<never> {
  await requireAdminCached();

  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);

  revalidatePath("/", "layout");
  redirect("/portal/admin/users");
}
