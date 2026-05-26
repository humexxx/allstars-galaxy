"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase-server";

/**
 * Server action for sign-out. Runs the supabase auth signOut against the
 * SSR client (so the session cookie is cleared server-side) and redirects to
 * `/login`. Callable from forms or `onClick` handlers.
 *
 * The remaining auth flows (password login, OAuth, magic link, password
 * reset) intentionally stay client-side via `AuthService` — Supabase's
 * recommended pattern for those depends on `window.location.origin` to build
 * the email/OAuth redirect URL, and converting them to server actions adds
 * complexity without a security benefit.
 */
export async function signOutAction(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
