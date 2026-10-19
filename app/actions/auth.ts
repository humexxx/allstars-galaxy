"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { IMPERSONATION_COOKIE } from "@/lib/services/impersonation";
import { createClient } from "@/lib/supabase-server";

/**
 * Server action for sign-out. Ends any impersonation, runs the supabase auth
 * signOut against the SSR client (so the session cookie is cleared
 * server-side) and redirects to `/login`. Callable from forms or `onClick`
 * handlers.
 *
 * The remaining auth flows (password login, OAuth, magic link, password
 * reset) intentionally stay client-side via `AuthService` — Supabase's
 * recommended pattern for those depends on `window.location.origin` to build
 * the email/OAuth redirect URL, and converting them to server actions adds
 * complexity without a security benefit.
 */
export async function signOutAction(): Promise<never> {
  // Supabase's signOut clears only its own cookies. Left behind, this one let
  // an admin who signed back in within its 30 minutes resume impersonating
  // without being asked.
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);

  const supabase = await createClient();
  // `scope: "local"` ends the session for THIS browser only. Supabase defaults
  // to "global", which revokes every refresh token the user holds — logging out
  // on a laptop would silently sign them out on their phone too. A deliberate
  // "sign out everywhere" belongs in its own action.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
