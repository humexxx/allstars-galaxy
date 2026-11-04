import type { Metadata } from "next";

import { TripsOverview } from "@/components/travel/trips-overview";

import { requireEffectiveContext } from "@/lib/services/impersonation";
import { listUserTrips } from "@/lib/services/travel-service";
import { getRequestTodayIso } from "@/lib/utils/request-today";

export const metadata: Metadata = {
  title: "Travel Planner",
  description: "Plan, organise and share your trips",
};

export const dynamic = "force-dynamic";

export default async function TravelPlannerPage() {
  const ctx = await requireEffectiveContext();
  const trips = await listUserTrips(ctx.effectiveUserId);
  // Decided here, once, on the reader's calendar, so the server render and the
  // browser agree on which trips are upcoming and how far away they are.
  const today = await getRequestTodayIso();

  return (
    // `flex-1` so the calendar can fill the height the shell leaves it.
    <section className="flex flex-1 flex-col gap-6">
      <TripsOverview trips={trips} today={today} />
    </section>
  );
}
