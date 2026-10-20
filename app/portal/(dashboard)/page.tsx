import type { Metadata } from "next";
import { Suspense } from "react";

import { PortalPageContainer } from "@/components/portal/page-container";
import { DashboardCardSkeleton } from "@/components/portal/dashboard-card-skeleton";
import { DASHBOARD_GRID, DASHBOARD_SECTION } from "@/components/portal/dashboard-layout";
import { DashboardSportCardSkeleton } from "@/components/entertainment/sports/dashboard-sport-card-skeleton";
import { DashboardFinanceCard } from "@/components/finance/dashboard-finance-card";
import { DashboardConfirmationHost } from "@/components/finance/dashboard-confirmation-host";
import { DashboardSportCards } from "@/components/entertainment/sports/dashboard-sport-cards";
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
      <section className={DASHBOARD_SECTION}>
        {/* The cards are the page: a visible title and tagline only pushed
            them down. The outline still needs its h1. */}
        <h1 className="sr-only">Dashboard</h1>
        <div className={DASHBOARD_GRID}>
          <Suspense fallback={<DashboardCardSkeleton rail={5} />}>
            <DashboardFinanceCard userId={userId} />
          </Suspense>
          <Suspense fallback={<DashboardCardSkeleton trips />}>
            <DashboardTravelCard userId={userId} />
          </Suspense>
          {/* Two sport cards, a row: the favourites are not known yet. */}
          <Suspense
            fallback={
              <>
                <DashboardSportCardSkeleton />
                <DashboardSportCardSkeleton />
              </>
            }
          >
            <DashboardSportCards userId={userId} />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <DashboardConfirmationHost userId={userId} />
        </Suspense>
      </section>
    </PortalPageContainer>
  );
}
