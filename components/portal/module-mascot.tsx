import type { ReactElement } from "react";

import { ContextAvatar, type ContextAvatarProps } from "@/components/portal/context-avatar";
import { getEffectiveContext } from "@/lib/services/impersonation";
import { getUserPreferences } from "@/lib/services/user-preferences-service";

/**
 * The module mascot for whoever is signed in, drawn as the character they
 * picked, or nothing when they turned it off. Reads the preference itself, so mount it inside a `<Suspense
 * fallback={null}>` after the page content and the page never waits on it.
 */
export async function ModuleMascot(props: ContextAvatarProps): Promise<ReactElement | null> {
  const ctx = await getEffectiveContext();
  if (!ctx) return null;
  const { showContextAvatar, mascotCharacter } = await getUserPreferences(ctx.effectiveUserId);
  return showContextAvatar ? <PageMascot><ContextAvatar {...props} character={mascotCharacter} /></PageMascot> : null;
}

/**
 * A page's own mascot, at the foot of the page. The portal shell looks for
 * this marker to make such a page a little taller than the window, so the
 * scene only peeks in under the fold; a scene drawn anywhere else (a preview
 * in Settings) does not carry it.
 */
export function PageMascot({ children }: { children: ReactElement }): ReactElement {
  return (
    <div data-page-mascot className="mt-auto">
      {children}
    </div>
  );
}
