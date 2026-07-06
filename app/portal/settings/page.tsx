import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/page-header";
import { PreferencesForm } from "@/components/settings/preferences-form";
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
    <section className="space-y-6">
      <PageHeader
        title="Settings"
        description="Personal preferences for your portal experience."
      />
      <PreferencesForm preferences={preferences} />
    </section>
  );
}
