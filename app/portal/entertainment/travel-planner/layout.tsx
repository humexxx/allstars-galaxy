import type { ReactNode } from "react";

import { TravelAssistant } from "@/components/travel/assistant/travel-assistant";
import { getEffectiveContext } from "@/lib/services/impersonation";
import { canUseTravelAssistant } from "@/lib/travel/assistant/access";

/**
 * Every Travel Planner page, wrapped by the assistant when it is on: in the
 * layout so the conversation survives moving between trips, and around the
 * pages so they can draw a proposal waiting on the user.
 */
export default async function TravelPlannerLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactNode> {
  const ctx = await getEffectiveContext();
  return ctx && canUseTravelAssistant(ctx) ? <TravelAssistant>{children}</TravelAssistant> : children;
}
