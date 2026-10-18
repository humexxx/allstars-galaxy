import type { Metadata } from "next";

import { PortalPageContainer } from "@/components/portal/page-container";
import { SettingsShell } from "@/components/settings/settings-shell";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { getUserPreferences } from "@/lib/services/user-preferences-service";

export const metadata: Metadata = {
  title: "Settings",
  description: "Personal preferences for your portal experience",
};

export default async function SettingsPage() {
  const ctx = await requireEffectiveContext();
  const preferences = await getUserPreferences(ctx.effectiveUserId);

  return (
    <PortalPageContainer>
      <h1 className="sr-only">Settings</h1>
      <SettingsShell preferences={preferences} />
    </PortalPageContainer>
  );
}
