import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/page-header";
import { DashboardFinanceCard } from "@/components/finance/dashboard-finance-card";
import { DashboardConfirmationHost } from "@/components/finance/dashboard-confirmation-host";
import { DashboardSportsCard } from "@/components/entertainment/sports/dashboard-sports-card";
import { DashboardTravelCard } from "@/components/travel/dashboard-travel-card";
import { requireEffectiveContext } from "@/lib/services/impersonation";

export const metadata: Metadata = {
  title: "Dashboard | Allstars Galaxy",
  description: "Your investment dashboard",
};

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const ctx = await requireEffectiveContext();

  return (
    <section className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Snapshots from across your workspace."
      />
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <DashboardFinanceCard userId={ctx.effectiveUserId} />
        <DashboardTravelCard userId={ctx.effectiveUserId} />
        <DashboardSportsCard userId={ctx.effectiveUserId} />
      </div>
      <DashboardConfirmationHost userId={ctx.effectiveUserId} />
    </section>
  );
}
