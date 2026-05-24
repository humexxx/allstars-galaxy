import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Plane } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TripsOverview } from "@/components/travel/trips-overview";

import { requireEffectiveContext } from "@/lib/services/impersonation";
import { listUserTrips } from "@/lib/services/travel-service";

export const metadata: Metadata = {
  title: "Travel Planner | Allstars Galaxy",
  description: "Plan, organise and share your trips",
};

export const dynamic = "force-dynamic";

export default async function TravelPlannerPage() {
  const ctx = await requireEffectiveContext();
  const trips = await listUserTrips(ctx.effectiveUserId);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Travel Planner"
        description="Plan your upcoming trips, attach links and prices, share with a private link."
        actions={
          <Button asChild>
            <Link href="/portal/entertainment/travel-planner/new">
              <Plus className="mr-1 h-4 w-4" />
              New trip
            </Link>
          </Button>
        }
      />

      {trips.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Plane}
          title="No trips yet"
          description="Create your first trip to start planning destinations, dates and bookings."
          action={
            <Button asChild className="w-full">
              <Link href="/portal/entertainment/travel-planner/new">
                <Plus className="mr-1 h-4 w-4" />
                Create trip
              </Link>
            </Button>
          }
        />
      ) : (
        <TripsOverview trips={trips} />
      )}
    </section>
  );
}
