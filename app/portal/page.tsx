import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/portal/page-header";
import { PortalPageContainer } from "@/components/portal/page-container";
import { DashboardCardSkeleton } from "@/components/portal/dashboard-card-skeleton";
import { DashboardFinanceCard } from "@/components/finance/dashboard-finance-card";
import { DashboardConfirmationHost } from "@/components/finance/dashboard-confirmation-host";
import { DashboardF1Card } from "@/components/entertainment/sports/dashboard-f1-card";
import { DashboardSportsCard } from "@/components/entertainment/sports/dashboard-sports-card";
import { DashboardTravelCard } from "@/components/travel/dashboard-travel-card";
import { requireEffectiveContext } from "@/lib/services/impersonation";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your investment dashboard",
};

export const dynamic = "force-dynamic";

/**
 * Every card resolves its own data, and the sports ones wait on third-party
 * APIs. Each sits in its own Suspense boundary so the shell and the fast cards
 * stream in immediately, and one slow feed only delays its own card.
 */
export default async function PortalPage() {
  const ctx = await requireEffectiveContext();
  const userId = ctx.effectiveUserId;

  return (
    <PortalPageContainer>
      <section className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="Snapshots from across your workspace."
        />
        {/* Two columns, and every card but F1's spans both. F1's takes one, so
            it sits at half the row — one sport among several rather than a
            banner. */}
        <div className="grid auto-rows-min gap-4 md:grid-cols-2">
          <Suspense fallback={<DashboardCardSkeleton tiles={5} chart />}>
            <DashboardFinanceCard userId={userId} />
          </Suspense>
          <Suspense fallback={<DashboardCardSkeleton tiles={3} />}>
            <DashboardTravelCard userId={userId} />
          </Suspense>
          <Suspense fallback={<DashboardCardSkeleton tiles={3} />}>
            <DashboardSportsCard userId={userId} />
          </Suspense>
          <Suspense fallback={<DashboardCardSkeleton tiles={2} className="col-span-1" />}>
            <DashboardF1Card userId={userId} />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <DashboardConfirmationHost userId={userId} />
        </Suspense>
      </section>
    </PortalPageContainer>
  );
}
