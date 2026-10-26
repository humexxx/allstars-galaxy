import type { ReactNode } from "react";

import { SportsAssistant } from "@/components/entertainment/sports/assistant/sports-assistant";
import { canUseAssistant } from "@/lib/ai/assistant/access";
import { getEffectiveContext } from "@/lib/services/impersonation";

/**
 * Every Sports page, with the assistant beside it when it is on: in the
 * layout so the conversation survives moving between the hub, a race and a
 * tournament.
 */
export default async function SportsLayout({ children }: { children: ReactNode }): Promise<ReactNode> {
  const ctx = await getEffectiveContext();
  return (
    <>
      {children}
      {ctx && canUseAssistant(ctx) && <SportsAssistant />}
    </>
  );
}
