import type { ReactElement } from "react";

import { ContextAvatar, type ContextAvatarProps } from "@/components/portal/context-avatar";
import { getEffectiveContext } from "@/lib/services/impersonation";
import { getUserPreferences } from "@/lib/services/user-preferences-service";

/**
 * The module mascot for whoever is signed in, or nothing when they turned it
 * off. Reads the preference itself, so mount it inside a `<Suspense
 * fallback={null}>` after the page content and the page never waits on it.
 */
export async function ModuleMascot(props: ContextAvatarProps): Promise<ReactElement | null> {
  const ctx = await getEffectiveContext();
  if (!ctx) return null;
  const { showContextAvatar } = await getUserPreferences(ctx.effectiveUserId);
  return showContextAvatar ? <ContextAvatar {...props} /> : null;
}
