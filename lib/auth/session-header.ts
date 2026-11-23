import type { User } from "@supabase/supabase-js";

/**
 * The signed-in user the proxy already verified, carried to the server
 * components and actions of the same request so they do not ask Supabase a
 * second time. The proxy deletes any copy the browser sent before it sets its
 * own, and it runs on every route that renders or acts, so the value can only
 * be the proxy's.
 */
export const SESSION_USER_HEADER = "x-session-user";

export type SessionUser = Pick<User, "id" | "email" | "user_metadata">;

export function encodeSessionUser(user: SessionUser): string {
  return encodeURIComponent(JSON.stringify({ id: user.id, email: user.email, user_metadata: user.user_metadata }));
}

export function decodeSessionUser(value: string | null | undefined): SessionUser | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (!parsed || typeof parsed !== "object") return null;
    const { id, email, user_metadata } = parsed as Record<string, unknown>;
    if (typeof id !== "string" || id.length === 0) return null;
    return {
      id,
      email: typeof email === "string" ? email : undefined,
      user_metadata: user_metadata && typeof user_metadata === "object" ? (user_metadata as SessionUser["user_metadata"]) : {},
    };
  } catch {
    return null;
  }
}
