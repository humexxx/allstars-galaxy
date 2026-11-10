import { Suspense, type ReactNode } from "react";

import { TradingAssistant } from "@/components/finance/trading/trading-assistant";
import { ModuleMascot } from "@/components/portal/module-mascot";
import { PortalPageContainer } from "@/components/portal/page-container";
import { canUseAssistant } from "@/lib/ai/assistant/access";
import { getEffectiveContext } from "@/lib/services/impersonation";

/**
 * Adds the trading assistant's corner button when it is on. The layout itself
 * awaits nothing, so the page's `loading.tsx` still paints at once.
 */
export default function TradingLayout({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <PortalPageContainer>
      {children}
      <Suspense fallback={null}>
        <ModuleMascot variant="trading" />
      </Suspense>
      <Suspense fallback={null}>
        <TradingAssistantGate />
      </Suspense>
    </PortalPageContainer>
  );
}

/** The assistant for admins on a server with an API key (see `canUseAssistant`). */
async function TradingAssistantGate(): Promise<React.ReactElement | null> {
  const ctx = await getEffectiveContext();
  return ctx && canUseAssistant(ctx) ? <TradingAssistant /> : null;
}
