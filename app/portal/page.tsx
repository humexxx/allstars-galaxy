import type { Metadata } from "next";
import { Suspense } from "react";

import { PortalPageContainer } from "@/components/portal/page-container";
import { DashboardCardSkeleton } from "@/components/portal/dashboard-card-skeleton";
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
      <section className="flex flex-col gap-6">
        {/* The cards are the page: a visible title and tagline only pushed
            them down. The outline still needs its h1. */}
        <h1 className="sr-only">Dashboard</h1>
        {/* Two columns. Finance and travel span both; each favourite sport gets
            a card at half the row — one sport among several, not a banner. */}
        <div className="grid auto-rows-min gap-4 md:grid-cols-2">
          <Suspense fallback={<DashboardCardSkeleton rail={5} />}>
            <DashboardFinanceCard userId={userId} />
          </Suspense>
          <Suspense fallback={<DashboardCardSkeleton tiles={3} />}>
            <DashboardTravelCard userId={userId} />
          </Suspense>
          <Suspense fallback={<DashboardCardSkeleton tiles={2} className="col-span-1" />}>
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
