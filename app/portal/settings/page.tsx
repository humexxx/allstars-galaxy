import type { Metadata } from "next";

import { PortalPageContainer } from "@/components/portal/page-container";
import { SettingsShell, type AiPaneData } from "@/components/settings/settings-shell";
import { getAiSettings, getAiUsageSummary } from "@/lib/services/ai-service";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { getUserPreferences } from "@/lib/services/user-preferences-service";
import { getRequestTimeZone, getRequestTodayIso } from "@/lib/utils/request-today";

export const metadata: Metadata = {
  title: "Settings",
  description: "Personal preferences for your portal experience",
};

export default async function SettingsPage() {
  const ctx = await requireEffectiveContext();
  // The AI pane is the app's, not the user's: it follows the real role, so an
  // admin impersonating somebody still sees it and the somebody never does.
  const [preferences, ai] = await Promise.all([
    getUserPreferences(ctx.effectiveUserId),
    ctx.realRole === "admin" ? loadAiPane() : null,
  ]);

  return (
    <PortalPageContainer>
      <h1 className="sr-only">Settings</h1>
      <SettingsShell preferences={preferences} ai={ai} />
    </PortalPageContainer>
  );
}

async function loadAiPane(): Promise<AiPaneData> {
  const [timeZone, today] = await Promise.all([getRequestTimeZone(), getRequestTodayIso()]);
  const [settings, usage] = await Promise.all([getAiSettings(), getAiUsageSummary(timeZone, today)]);
  return { settings, usage, keyConfigured: Boolean(process.env.ANTHROPIC_API_KEY), today };
}
