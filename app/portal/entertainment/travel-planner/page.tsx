import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Plane } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TripsOverview } from "@/components/travel/trips-overview";

import { requireEffectiveContext } from "@/lib/services/impersonation";
import { listUserTrips } from "@/lib/services/travel-service";
import { isoDay } from "@/lib/travel/calendar";

export const metadata: Metadata = {
  title: "Travel Planner",
  description: "Plan, organise and share your trips",
};

export const dynamic = "force-dynamic";

export default async function TravelPlannerPage() {
  const ctx = await requireEffectiveContext();
  const trips = await listUserTrips(ctx.effectiveUserId);
  // Decided here, once, so the server render and the browser agree on which
  // trips are upcoming and how far away they are.
  const today = isoDay(new Date());

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Travel Planner"
        description="Plan your upcoming trips, attach links and prices, share with a private link."
        actions={
          <Button asChild>
            <Link href="/portal/entertainment/travel-planner/new">
              <Plus />
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
            <Button asChild>
              <Link href="/portal/entertainment/travel-planner/new">
                <Plus />
                Create trip
              </Link>
            </Button>
          }
        />
      ) : (
        <TripsOverview trips={trips} today={today} />
      )}
    </section>
  );
}
