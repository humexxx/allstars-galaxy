import { Suspense, type ReactNode } from "react";

import { PlansAssistant } from "@/components/finance/assistant/plans-assistant";
import { ContextAvatar } from "@/components/portal/context-avatar";
import { PortalPageContainer } from "@/components/portal/page-container";
import { canUseAssistant } from "@/lib/ai/assistant/access";
import { getEffectiveContext, requireEffectiveContext } from "@/lib/services/impersonation";
import { getFinanceMood } from "@/lib/services/finance-snapshot-service";
import { getUserPreferences } from "@/lib/services/user-preferences-service";

/**
 * Appends the finance mascot (a bean mining a gold cube) after the content of every
 * plans page, and the plans assistant's corner button when it is on. Rendered from the layout so list/detail/compare all get it
 * without each page opting in. Hidden via the `showContextAvatar` preference.
 *
 * The layout itself awaits nothing: an async layout sits above the segment's
 * `loading.tsx`, so while it waited the reader got the portal's dashboard
 * skeleton instead of the plans one. Every plans page runs its own auth gate.
 */
export default function PlansLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PortalPageContainer>
      {children}
      <Suspense fallback={null}>
        <FinanceMascot />
      </Suspense>
      <Suspense fallback={null}>
        <PlansAssistantGate />
      </Suspense>
    </PortalPageContainer>
  );
}

/**
 * The mascot's pose comes from the user's main plan, so it reads as a status
 * glyph rather than clip-art. `getFinanceMood` is request-cached and reuses the
 * cached `getPlanWithLines`, so this costs no extra query when the page above
 * already loaded that plan.
 */
async function FinanceMascot(): Promise<React.ReactElement | null> {
  const ctx = await requireEffectiveContext();
  const { showContextAvatar } = await getUserPreferences(ctx.effectiveUserId);
  if (!showContextAvatar) return null;

  const mood = await getFinanceMood(ctx.effectiveUserId);
  return <ContextAvatar variant="finance" mood={mood} />;
}

/** The assistant for admins on a server with an API key (see `canUseAssistant`). */
async function PlansAssistantGate(): Promise<React.ReactElement | null> {
  const ctx = await getEffectiveContext();
  return ctx && canUseAssistant(ctx) ? <PlansAssistant /> : null;
}
