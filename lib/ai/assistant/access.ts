import "server-only";

import type { EffectiveContext } from "@/lib/services/impersonation";

/**
 * Who gets the app's assistants (Travel, Sports): admins, on a server with an
 * API key.
 *
 * Admins only because every message spends the owner's API credit, and any
 * signed-in account could otherwise spend it. Read per request — never at
 * import, which the CI build (no secrets) would trip over.
 */
export function canUseAssistant(ctx: Pick<EffectiveContext, "realRole">): boolean {
  return ctx.realRole === "admin" && Boolean(process.env.ANTHROPIC_API_KEY);
}
