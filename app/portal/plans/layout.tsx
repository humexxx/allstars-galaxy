import type { ReactNode } from "react";

import { ContextAvatar } from "@/components/portal/context-avatar";
import { PortalPageContainer } from "@/components/portal/page-container";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { getFinanceMood } from "@/lib/services/finance-plan-service";
import { getUserPreferences } from "@/lib/services/user-preferences-service";

/**
 * Appends the finance mascot (a bean mining gold) after the content of every
 * plans page. Rendered from the layout so list/detail/compare all get it
 * without each page opting in. Hidden via the `showContextAvatar` preference.
 *
 * The mascot's pose comes from the user's main plan, so it reads as a status
 * glyph rather than clip-art. `getFinanceMood` is request-cached and reuses the
 * cached `getPlanWithLines`, so this costs no extra query when the page below
 * already loaded that plan.
 */
export default async function PlansLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = await requireEffectiveContext();
  const { showContextAvatar } = await getUserPreferences(ctx.effectiveUserId);

  // Declared once here so every plans route (index, new, [id], compare) shares
  // the wide data layout without the container knowing about routes.
  if (!showContextAvatar) {
    return <PortalPageContainer width="wide">{children}</PortalPageContainer>;
  }

  const mood = await getFinanceMood(ctx.effectiveUserId);

  return (
    <PortalPageContainer width="wide">
      {children}
      <ContextAvatar variant="finance" mood={mood} />
    </PortalPageContainer>
  );
}
