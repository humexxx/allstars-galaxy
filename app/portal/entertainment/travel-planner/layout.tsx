import { Suspense, type ReactNode } from "react";

import { ModuleMascot } from "@/components/portal/module-mascot";
import { TravelAssistant } from "@/components/travel/assistant/travel-assistant";
import { getEffectiveContext } from "@/lib/services/impersonation";
import { canUseAssistant } from "@/lib/ai/assistant/access";

/**
 * Every Travel Planner page, wrapped by the assistant when it is on: in the
 * layout so the conversation survives moving between trips, and around the
 * pages so they can draw a proposal waiting on the user. The travel mascot
 * follows the page, streamed so no page waits on the preference it reads.
 */
export default async function TravelPlannerLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactNode> {
  const ctx = await getEffectiveContext();
  const pages = (
    <>
      {children}
      <Suspense fallback={null}>
        <ModuleMascot variant="travel" />
      </Suspense>
    </>
  );
  return ctx && canUseAssistant(ctx) ? <TravelAssistant>{pages}</TravelAssistant> : pages;
}
