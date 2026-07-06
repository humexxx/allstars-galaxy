import type { ReactNode } from "react";

import { ContextAvatar } from "@/components/portal/context-avatar";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { getUserPreferences } from "@/lib/services/user-preferences-service";

/**
 * Appends the finance mascot (a bean mining gold) after the content of every
 * plans page. Rendered from the layout so list/detail/compare all get it
 * without each page opting in. Hidden via the `showContextAvatar` preference.
 */
export default async function PlansLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = await requireEffectiveContext();
  const { showContextAvatar } = await getUserPreferences(ctx.effectiveUserId);

  return (
    <>
      {children}
      {showContextAvatar && <ContextAvatar variant="finance" />}
    </>
  );
}
