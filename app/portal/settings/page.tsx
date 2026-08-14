import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/page-header";
import { PortalPageContainer } from "@/components/portal/page-container";
import { SettingsShell } from "@/components/settings/settings-shell";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { getUserPreferences } from "@/lib/services/user-preferences-service";

export const metadata: Metadata = {
  title: "Settings",
  description: "Personal preferences for your portal experience",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireEffectiveContext();
  const preferences = await getUserPreferences(ctx.effectiveUserId);

  return (
    <PortalPageContainer>
      <section className="space-y-6">
      <PageHeader
        title="Settings"
        description="Personal preferences for your portal experience."
      />
      <SettingsShell preferences={preferences} />
      </section>
    </PortalPageContainer>
  );
}
