import type { ReactNode } from "react";

import { TravelAssistant } from "@/components/travel/assistant/travel-assistant";
import { getEffectiveContext } from "@/lib/services/impersonation";
import { canUseTravelAssistant } from "@/lib/travel/assistant/access";

/**
 * Every Travel Planner page, plus the assistant's corner button. In the layout
 * so the conversation survives moving between the trip list and a trip.
 */
export default async function TravelPlannerLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactNode> {
  const ctx = await getEffectiveContext();
  return (
    <>
      {children}
      {ctx && canUseTravelAssistant(ctx) && <TravelAssistant />}
    </>
  );
}
